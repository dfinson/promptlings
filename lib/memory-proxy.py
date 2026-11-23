"""Framework-owned MCP transport with one durably journaled mutation lane."""

import argparse
import asyncio
import json
import logging
import math
import os
import socket
import sqlite3
import time
from contextlib import asynccontextmanager
from importlib.metadata import version
from pathlib import Path
from typing import Literal
from uuid import uuid4

import anyio
import httpx2
import uvicorn
from fastmcp.client.dependencies import _get_forwardable_http_headers
from fastmcp.client.transports import StreamableHttpTransport
from fastmcp.client.transports.base import TransportOptions
from fastmcp.exceptions import NotFoundError, ToolError, ValidationError
from fastmcp.server import create_proxy
from fastmcp.server.event_store import EventStore
from fastmcp.server.middleware import Middleware
from fastmcp.tools.base import ToolResult
from mcp.client.streamable_http import streamable_http_client
from mcp.shared._httpx_utils import create_mcp_http_client
from starlette.middleware import Middleware as HTTPMiddleware
from starlette.responses import JSONResponse

LOG = logging.getLogger("promptlings.memory")
READY = "PROMPTLINGS_MEMORY_PROXY_READY"
CONTROL_TOOLS = frozenset({"memory_queue_status", "memory_queue_resolve"})


class WriteJournal:
    def __init__(self, path):
        self.owner = None
        self.connection = None
        try:
            if str(path) != ":memory:":
                path = Path(path).absolute()
                path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                self.owner = open(str(path) + ".lock", "a+b")
                self.owner.seek(0, os.SEEK_END)
                if self.owner.tell() == 0:
                    self.owner.write(b"\0")
                    self.owner.flush()
                self.owner.seek(0)
                if os.name == "nt":
                    import msvcrt
                    msvcrt.locking(self.owner.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(self.owner.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                os.chmod(self.owner.name, 0o600)
            self.connection = sqlite3.connect(str(path), timeout=0)
            self.connection.row_factory = sqlite3.Row
            self.connection.execute("PRAGMA journal_mode=WAL")
            self.connection.execute("PRAGMA synchronous=FULL")
            if str(path) != ":memory:":
                os.chmod(path, 0o600)
            with self.connection:
                schema = self.connection.execute("PRAGMA user_version").fetchone()[0]
                if schema not in (0, 1):
                    raise RuntimeError(f"Unsupported write journal schema: {schema}")
                self.connection.execute("""CREATE TABLE IF NOT EXISTS writes (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                    operation_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
                    arguments TEXT NOT NULL, target TEXT NOT NULL, state TEXT NOT NULL,
                    created REAL NOT NULL, updated REAL NOT NULL, deadline REAL NOT NULL,
                    result TEXT, resolution TEXT
                )""")
                if "target" not in {row[1] for row in self.connection.execute("PRAGMA table_info(writes)")}:
                    raise RuntimeError("Write journal schema lacks target summaries. Preserve it and inspect before migration.")
                self.connection.execute("PRAGMA user_version=1")
                # A persisted dispatch cannot be distinguished from a committed write.
                self.connection.execute(
                    "UPDATE writes SET state='unknown', updated=? WHERE state='dispatched'", (time.time(),),
                )
        except BaseException:
            self.close()
            raise

    def close(self):
        if self.connection is not None:
            self.connection.close()
            self.connection = None
        if self.owner is not None:
            self.owner.close()
            self.owner = None

    def queued(self):
        return self.connection.execute(
            "SELECT operation_id,name,deadline,sequence FROM writes WHERE state='queued' ORDER BY sequence",
        ).fetchall()

    def unknown(self):
        return bool(self.connection.execute("SELECT 1 FROM writes WHERE state='unknown' LIMIT 1").fetchone())

    def enqueue(self, name, arguments, timeout, capacity):
        with self.connection:
            waiting = self.connection.execute("SELECT count(*) FROM writes WHERE state='queued'").fetchone()[0]
            if waiting >= capacity:
                raise ToolError("QUEUE_FULL: mutation queue is full. Request was not admitted or dispatched.")
            operation_id = str(uuid4())
            now = time.time()
            target = {key: arguments[key] for key in (
                "project_id", "project", "project_name", "identifier", "title", "directory",
            ) if key in arguments}
            for key, value in list(target.items()):
                if isinstance(value, str):
                    target[key] = value[:256]
                    if len(value) > 256:
                        target["_truncated"] = True
                elif not isinstance(value, (type(None), bool, int, float)):
                    target[key] = "[non-scalar target]"
                    target["_truncated"] = True
                elif len(str(value)) > 256:
                    target[key] = str(value)[:256]
                    target["_truncated"] = True
            self.connection.execute(
                "INSERT INTO writes(operation_id,name,arguments,target,state,created,updated,deadline) VALUES(?,?,?,?,'queued',?,?,?)",
                (operation_id, name, json.dumps(arguments), json.dumps(target), now, now, now + timeout),
            )
        return operation_id

    def get(self, operation_id):
        record = self.connection.execute("SELECT * FROM writes WHERE operation_id=?", (operation_id,)).fetchone()
        if record is None:
            raise ToolError(f"QUEUE_NOT_FOUND: unknown operation {operation_id}.")
        return record

    def transition(self, operation_id, state, result=None):
        with self.connection:
            self.connection.execute(
                "UPDATE writes SET state=?, updated=?, result=? WHERE operation_id=?",
                (state, time.time(), result.model_dump_json() if result is not None else None, operation_id),
            )

    def status(self, operation_id=None, before_sequence=None):
        if before_sequence is not None and before_sequence < 1:
            raise ToolError("QUEUE_INVALID_CURSOR: before_sequence must be positive.")
        recent = []
        if operation_id:
            records = [self.get(operation_id)]
        else:
            columns = "sequence,operation_id,name,state,created,updated,deadline,target"
            recent = self.connection.execute(
                f"SELECT {columns} FROM writes WHERE (? IS NULL OR sequence < ?) ORDER BY sequence DESC LIMIT 50",
                (before_sequence, before_sequence),
            ).fetchall()
            pending = self.connection.execute(
                f"SELECT {columns} FROM writes WHERE state IN ('queued','dispatched','unknown') ORDER BY sequence",
            ).fetchall() if before_sequence is None else []
            records = sorted({record["sequence"]: record for record in [*pending, *recent]}.values(), key=lambda row: row["sequence"])
        values = []
        for record in records:
            value = {key: record[key] for key in ("sequence", "operation_id", "name", "state", "created", "updated", "deadline")}
            value["target"] = json.loads(record["target"])
            if operation_id:
                value["arguments"] = json.loads(record["arguments"])
                value["result"] = json.loads(record["result"]) if record["result"] else None
                value["resolution"] = json.loads(record["resolution"]) if record["resolution"] else None
            values.append(value)
        return {
            "blocked": self.unknown(), "operations": values,
            "next_before_sequence": min(row["sequence"] for row in recent) if len(recent) == 50 else None,
        }

    def resolve(self, operation_id, outcome, evidence):
        with self.connection:
            record = self.get(operation_id)
            if record["state"] != "unknown":
                raise ToolError("QUEUE_NOT_UNKNOWN: only an uncertain operation can be reconciled.")
            self.connection.execute(
                "UPDATE writes SET state=?, updated=?, resolution=? WHERE operation_id=?",
                (f"resolved_{outcome}", time.time(), json.dumps({"outcome": outcome, "evidence": evidence}), operation_id),
            )


class MemoryHTTPTransport(StreamableHttpTransport):
    @asynccontextmanager
    async def connect_session(self, *, transport_options=None, **session_kwargs):
        options = transport_options or TransportOptions()
        headers = (_get_forwardable_http_headers() if options.forward_incoming_headers else {}) | self.headers
        read_timeout = session_kwargs.get("read_timeout_seconds")
        timeout = httpx2.Timeout(30.0, read=600.0 if read_timeout is None else read_timeout)
        client = create_mcp_http_client(headers=headers, timeout=timeout, auth=self.auth)
        self._session_id = None
        client.event_hooks.setdefault("response", []).append(self._capture_session_id)
        # The SDK's 1 MiB default truncates valid note results. Parsing stays SDK-owned.
        async with (
            client,
            streamable_http_client(self.url, http_client=client, max_sse_event_size=None) as streams,
            options.session_class(*streams, **session_kwargs) as session,
        ):
            yield session


# Basic Memory 0.24.1 annotations. New or unknown tools take the mutation lane.
READ_TOOLS = frozenset({
    "basic_memory_diagnostics", "build_context", "search", "fetch", "list_directory",
    "cat", "grep", "ls", "find", "tail", "man", "list_memory_projects", "read_content",
    "read_note", "recent_activity", "schema_validate", "schema_infer", "schema_diff",
    "search_notes", "search_notes_ui", "read_note_ui", "view_note", "list_workspaces",
})


def outcome_unknown(result):
    if not result.is_error:
        return False
    if isinstance(result.structured_content, dict):
        if result.structured_content.get("error") == "EDIT_OUTCOME_UNKNOWN":
            return True
    for item in result.content:
        if item.type != "text":
            continue
        try:
            diagnostic = json.loads(item.text)
        except json.JSONDecodeError:
            diagnostic = None
        if isinstance(diagnostic, dict) and diagnostic.get("error") == "EDIT_OUTCOME_UNKNOWN":
            return True
        if item.text.splitlines()[:1] == ["# Edit Outcome Unknown"]:
            return True
    return False


class WritePolicy(Middleware):
    def __init__(self, queue_timeout=300.0, write_timeout=600.0, max_queue=1000, journal_path=":memory:"):
        for timeout in (queue_timeout, write_timeout):
            if not math.isfinite(timeout) or timeout <= 0:
                raise ValueError("Write and queue deadlines must be finite and positive.")
        if isinstance(max_queue, bool) or not isinstance(max_queue, int) or max_queue < 0:
            raise ValueError("Maximum waiting writes must be a nonnegative integer.")
        self.queue_timeout = queue_timeout
        self.write_timeout = write_timeout
        self.max_queue = max_queue
        self.lock = asyncio.Lock()
        self.waiting = 0
        self.journal = WriteJournal(journal_path)
        self.failed = False
        self.active_operation = None
        self.recovery_ready = asyncio.Event()
        self.resolved = asyncio.Event()
        try:
            self.recovery_records = self.read_journal(self.journal.queued)
        except BaseException:
            self.journal.close()
            raise
        if not self.recovery_records:
            self.recovery_ready.set()

    @property
    def blocked(self):
        return self.failed or self.read_journal(self.journal.unknown)

    def block(self, operation_id, reason):
        LOG.error("Operation %s: %s. Mutation lane blocked until explicit reconciliation.", operation_id, reason)
        result = self.result(operation_id, f"WRITE_OUTCOME_UNKNOWN: {reason}. Do not replay. Reconcile this operation.", True)
        self.transition(operation_id, "unknown", result)
        return result

    @staticmethod
    def result(operation_id, value, error=False):
        if isinstance(value, ToolResult):
            return ToolResult(
                content=value.content, structured_content=value.structured_content,
                meta=(value.meta or {}) | {"memory_queue_operation_id": operation_id}, is_error=value.is_error,
            )
        return ToolResult(content=value, is_error=error, meta={"memory_queue_operation_id": operation_id})

    @asynccontextmanager
    async def mutation(self, allow_blocked=False, deadline=None, recovering=False):
        if self.blocked and not allow_blocked:
            raise ToolError("QUEUE_BLOCKED: prior write outcome is unknown. Request was not dispatched. Use memory_queue_status and explicitly reconcile it.")
        capacity = self.max_queue + (0 if self.lock.locked() else 1)
        if self.waiting >= capacity:
            raise ToolError("QUEUE_FULL: mutation queue is full. Request was not dispatched.")
        self.waiting += 1
        try:
            try:
                remaining = self.queue_timeout if deadline is None else max(0, deadline - time.time())
                async with asyncio.timeout(remaining):
                    if not allow_blocked and not recovering:
                        await self.recovery_ready.wait()
                    await self.lock.acquire()
            except TimeoutError:
                LOG.error("Mutation queue wait exceeded %s seconds. Request was not dispatched.", self.queue_timeout)
                raise ToolError("QUEUE_TIMEOUT: mutation queue wait expired. Request was not dispatched.") from None
        finally:
            self.waiting -= 1
        try:
            if self.blocked and not allow_blocked:
                raise ToolError("QUEUE_BLOCKED: prior write outcome is unknown. Request was not dispatched. Use memory_queue_status and explicitly reconcile it.")
            yield
        finally:
            self.lock.release()

    async def on_call_tool(self, context, call_next):
        try:
            return await self.admit(context, call_next)
        except (sqlite3.Error, OSError) as cause:
            raise self.persistence_failure() from cause

    def persistence_failure(self, operation_id=None):
        self.failed = True
        LOG.exception("Write journal failure for operation %s", operation_id)
        return ToolError(f"JOURNAL_FAILURE: persistence failed for {operation_id}. Do not replay; inspect the journal and target.")

    def transition(self, operation_id, state, result=None):
        try:
            self.journal.transition(operation_id, state, result)
        except (sqlite3.Error, OSError) as cause:
            raise self.persistence_failure(operation_id) from cause

    def read_journal(self, read, *arguments):
        try:
            return read(*arguments)
        except (sqlite3.Error, OSError) as cause:
            raise self.persistence_failure() from cause

    async def admit(self, context, call_next):
        if context.message.name in READ_TOOLS or context.message.name in CONTROL_TOOLS:
            return await call_next(context)
        operation_id = None
        try:
            if self.blocked:
                raise ToolError("QUEUE_BLOCKED: prior write outcome is unknown. Request was not dispatched. Admission was refused.")
            capacity = self.max_queue + (0 if self.lock.locked() else 1)
            operation_id = self.journal.enqueue(
                context.message.name, context.message.arguments or {}, self.queue_timeout, capacity,
            )
            LOG.info("Durably admitted mutation %s (%s)", operation_id, context.message.name)
            deadline = self.read_journal(self.journal.get, operation_id)["deadline"]
            async with self.mutation(deadline=deadline):
                if time.time() >= deadline:
                    raise TimeoutError
                return await self.execute(operation_id, lambda: call_next(context))
        except (TimeoutError, ToolError) as cause:
            if operation_id is None or self.failed:
                raise
            message = "QUEUE_TIMEOUT: wait expired. Request was not dispatched." if isinstance(cause, TimeoutError) else str(cause)
            result = self.result(operation_id, message, True)
            if self.read_journal(self.journal.get, operation_id)["state"] == "queued":
                expired = isinstance(cause, TimeoutError) or "QUEUE_TIMEOUT:" in message
                self.transition(operation_id, "expired" if expired else "rejected", result)
            return result
        except asyncio.CancelledError:
            if operation_id is not None and self.read_journal(self.journal.get, operation_id)["state"] == "queued":
                self.transition(operation_id, "cancelled", self.result(operation_id, "Cancelled before dispatch.", True))
            raise

    async def execute(self, operation_id, call):
        self.transition(operation_id, "dispatched")
        self.active_operation = operation_id
        try:
            # A caller disconnect must not free the lane before outcome persistence.
            with anyio.CancelScope(shield=True):
                try:
                    with anyio.fail_after(self.write_timeout):
                        result = await call()
                except TimeoutError:
                    return self.block(operation_id, "ACTIVE_WRITE_TIMEOUT: active response deadline expired")
                except asyncio.CancelledError:
                    self.block(operation_id, "Active write was interrupted")
                    raise
                except (NotFoundError, ValidationError) as cause:
                    result = self.result(operation_id, f"WRITE_REJECTED: {cause}", True)
                    self.transition(operation_id, "rejected", result)
                    return result
                except Exception:
                    return self.block(operation_id, "Active write transport or protocol failed")
                result = self.result(operation_id, result)
                self.transition(operation_id, "unknown" if outcome_unknown(result) else "completed", result)
                if outcome_unknown(result):
                    LOG.error("Operation %s reported EDIT_OUTCOME_UNKNOWN; mutations remain blocked.", operation_id)
                return result
        finally:
            self.active_operation = None

    async def recover(self, proxy):
        try:
            for record in self.recovery_records:
                while self.blocked:
                    self.resolved.clear()
                    try:
                        await asyncio.wait_for(self.resolved.wait(), max(0, record["deadline"] - time.time()))
                    except TimeoutError:
                        break
                if record["deadline"] <= time.time():
                    self.transition(record["operation_id"], "expired", self.result(
                        record["operation_id"], "QUEUE_TIMEOUT: persisted wait expired before recovery dispatch.", True,
                    ))
                    continue
                try:
                    # Discovery failures are safe to retry: no mutation has been dispatched.
                    async with asyncio.timeout(max(0, record["deadline"] - time.time())):
                        while True:
                            try:
                                tool = await proxy.get_tool(record["name"])
                                if tool is None:
                                    raise NotFoundError(f"Unknown tool {record['name']}")
                                break
                            except NotFoundError as cause:
                                self.transition(record["operation_id"], "rejected", self.result(record["operation_id"], str(cause), True))
                                tool = None
                                break
                            except Exception as cause:
                                LOG.warning("Backend discovery failed before recovery dispatch: %s", cause)
                                await asyncio.sleep(1)
                    if tool is None:
                        continue
                    async with self.mutation(deadline=record["deadline"], recovering=True):
                        arguments = json.loads(self.read_journal(self.journal.get, record["operation_id"])["arguments"])
                        if time.time() >= record["deadline"]:
                            raise TimeoutError
                        await self.execute(record["operation_id"], lambda: proxy.call_tool(
                            record["name"], arguments, run_middleware=False,
                        ))
                except (TimeoutError, ToolError) as cause:
                    if not isinstance(cause, TimeoutError) and not str(cause).startswith("QUEUE_TIMEOUT:"):
                        raise
                    self.transition(record["operation_id"], "expired", self.result(
                        record["operation_id"], "QUEUE_TIMEOUT: persisted wait expired before recovery dispatch.", True,
                    ))
            self.recovery_ready.set()
        except asyncio.CancelledError:
            raise
        except Exception:
            self.failed = True
            LOG.exception("Durable queue recovery failed; mutation admission is blocked.")

    async def resolve(self, operation_id, outcome, evidence, backend_restarted):
        if not backend_restarted or not evidence.strip():
            raise ToolError("QUEUE_RECONCILIATION_REQUIRED: stop the previous backend worker and supply MCP readback evidence.")
        try:
            async with self.mutation(allow_blocked=True):
                if self.failed or self.active_operation == operation_id:
                    raise ToolError("QUEUE_UNSAFE_RESOLUTION: persistence failed or this operation is still active.")
                self.journal.resolve(operation_id, outcome, evidence)
                self.resolved.set()
                return self.read_journal(self.journal.status, operation_id)
        except (sqlite3.Error, OSError) as cause:
            raise self.persistence_failure(operation_id) from cause


class RequestPolicy:
    def __init__(self, app, policy, max_body_bytes):
        self.app = app
        self.policy = policy
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        if scope["path"] not in ("/mcp", "/mcp/"):
            return await JSONResponse({"error": "Only the MCP endpoint is exposed."}, status_code=404)(scope, receive, send)
        if scope["method"] == "POST":
            chunks = []
            size = 0
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                size += len(message.get("body", b""))
                if size > self.max_body_bytes:
                    return await JSONResponse({
                        "error": "MCP request body limit exceeded. Request was not dispatched.",
                    }, status_code=413)(scope, receive, send)
                chunks.append(message.get("body", b""))
                if not message.get("more_body", False):
                    break
            body = b"".join(chunks)
            delivered = False

            async def replay_body():
                nonlocal delivered
                if not delivered:
                    delivered = True
                    return {"type": "http.request", "body": body, "more_body": False}
                return await receive()

            return await self.app(scope, replay_body, send)
        if scope["method"] == "DELETE":
            try:
                # Closing a frontend session does not mutate SQLite, even after a blocked write.
                async with self.policy.mutation(allow_blocked=True):
                    with anyio.CancelScope(shield=True):
                        return await self.app(scope, receive, send)
            except ToolError as cause:
                return await JSONResponse({"error": str(cause), "dispatched": False}, status_code=503)(scope, receive, send)
        return await self.app(scope, receive, send)


def create_app(backend_url, policy=None, max_body_bytes=64 * 1024 * 1024):
    if isinstance(max_body_bytes, bool) or not isinstance(max_body_bytes, int) or max_body_bytes < 1:
        raise ValueError("Request body limit must be a positive integer.")
    policy = policy if policy is not None else WritePolicy()
    proxy = create_proxy(
        MemoryHTTPTransport(backend_url), name="basic-memory", mode="legacy",
        provider_error_strategy="raise", mask_error_details=False, tasks=False,
    )
    proxy.add_middleware(policy)

    @proxy.tool
    async def memory_queue_status(operation_id: str | None = None, before_sequence: int | None = None) -> dict:
        """List pending writes and 50 recent records, including completed calls whose response was lost.
        Page older records with next_before_sequence. An operation ID returns its saved request and outcome.
        """
        return policy.read_journal(policy.journal.status, operation_id, before_sequence) | {
            "blocked": policy.blocked, "journal_failed": policy.failed,
        }

    @proxy.tool
    async def memory_queue_resolve(
        operation_id: str, outcome: Literal["applied", "not_applied"], evidence: str, backend_restarted: bool,
    ) -> dict:
        """User-authorized reconciliation only: confirm the previous backend stopped and read the target via MCP.
        Record whether the uncertain write applied. Never replay it. This unblocks later queued writes.
        """
        return await policy.resolve(operation_id, outcome, evidence, backend_restarted)

    app = proxy.http_app(
        path="/mcp", stateless_http=False, event_store=EventStore(),
        host_origin_protection=True,
        allowed_hosts=["127.0.0.1:*", "localhost:*"],
        allowed_origins=["http://127.0.0.1:*", "https://127.0.0.1:*", "http://localhost:*", "https://localhost:*"],
        middleware=[HTTPMiddleware(RequestPolicy, policy=policy, max_body_bytes=max_body_bytes)],
    )
    original_lifespan = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(app):
        async with original_lifespan(app) as state:
            recovery = asyncio.create_task(policy.recover(proxy))
            try:
                yield state
            finally:
                recovery.cancel()
                await asyncio.gather(recovery, return_exceptions=True)
                policy.journal.close()

    app.router.lifespan_context = lifespan
    return app


async def serve(args):
    if version("fastmcp") != args.fastmcp_version:
        raise RuntimeError(f"Expected FastMCP {args.fastmcp_version}, found {version('fastmcp')}. Reinstall the managed runtime.")
    listener = socket.socket()
    try:
        listener.bind(("127.0.0.1", args.proxy_port))
        listener.listen(128)
        policy = WritePolicy(journal_path=args.journal_path)
        app = create_app(f"http://127.0.0.1:{args.port}/mcp", policy=policy)
        server = uvicorn.Server(uvicorn.Config(
            app, host="127.0.0.1", port=args.proxy_port, log_level="info",
            timeout_graceful_shutdown=5,
        ))
        task = asyncio.create_task(server.serve(sockets=[listener]))
        while not server.started:
            if task.done():
                await task
                raise RuntimeError("FastMCP gateway exited before readiness.")
            await asyncio.sleep(0.01)
        print(READY, flush=True)
        await task
    finally:
        listener.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--proxy-port", type=int, required=True)
    parser.add_argument("--fastmcp-version", required=True)
    parser.add_argument("--journal-path", default=str(Path.home() / ".promptlings" / "memory" / "write-queue.sqlite3"))
    args = parser.parse_args()
    if not (0 < args.port <= 65535 and 0 < args.proxy_port <= 65535 and args.port != args.proxy_port):
        parser.error("Backend and proxy require distinct valid ports.")
    asyncio.run(serve(args))
