"""Framework-owned MCP transport with one durably journaled mutation lane."""

import argparse
import asyncio
import hashlib
import json
import logging
import math
import os
import re
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
RECEIPT = "promptlings_operation_id"
# Basic Memory's SQLite busy_timeout is 10 seconds. Leave time for lock recovery.
WRITE_TIMEOUT = 600.0


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
                if schema not in (0, 1, 2):
                    raise RuntimeError(f"Unsupported write journal schema: {schema}")
                self.connection.execute("""CREATE TABLE IF NOT EXISTS writes (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                    operation_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
                    arguments TEXT NOT NULL, target TEXT NOT NULL, state TEXT NOT NULL,
                    created REAL NOT NULL, updated REAL NOT NULL, deadline REAL NOT NULL,
                    result TEXT, resolution TEXT, reconciliation TEXT
                )""")
                if "target" not in {row[1] for row in self.connection.execute("PRAGMA table_info(writes)")}:
                    raise RuntimeError("Write journal schema lacks target summaries. Preserve it and inspect before migration.")
                if "reconciliation" not in {row[1] for row in self.connection.execute("PRAGMA table_info(writes)")}:
                    self.connection.execute("ALTER TABLE writes ADD COLUMN reconciliation TEXT")
                self.connection.execute("PRAGMA user_version=2")
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

    def uncertain(self):
        return self.connection.execute(
            "SELECT operation_id,reconciliation FROM writes WHERE state='unknown' ORDER BY sequence",
        ).fetchall()

    def prepare(self, operation_id, reconciliation):
        with self.connection:
            self.connection.execute(
                "UPDATE writes SET reconciliation=?, updated=? WHERE operation_id=?",
                (json.dumps(reconciliation), time.time(), operation_id),
            )

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
                value["reconciliation"] = json.loads(record["reconciliation"]) if record["reconciliation"] else None
            values.append(value)
        return {
            "blocked": self.unknown(), "block_scope": "affected targets, or all mutations when identity is unresolved",
            "operations": values,
            "next_before_sequence": min(row["sequence"] for row in recent) if len(recent) == 50 else None,
        }

    def resolve(self, operation_id, outcome, evidence, result=None, automatic=False):
        with self.connection:
            record = self.get(operation_id)
            if record["state"] != "unknown":
                raise ToolError("QUEUE_NOT_UNKNOWN: only an uncertain operation can be reconciled.")
            self.connection.execute(
                "UPDATE writes SET state=?, updated=?, resolution=?, result=COALESCE(?,result) WHERE operation_id=?",
                (f"resolved_{outcome}", time.time(),
                 json.dumps({"outcome": outcome, "evidence": evidence, "automatic": automatic}),
                 result.model_dump_json() if result is not None else None, operation_id),
            )


class MemoryHTTPTransport(StreamableHttpTransport):
    @asynccontextmanager
    async def connect_session(self, *, transport_options=None, **session_kwargs):
        options = transport_options or TransportOptions()
        headers = (_get_forwardable_http_headers() if options.forward_incoming_headers else {}) | self.headers
        read_timeout = session_kwargs.get("read_timeout_seconds")
        timeout = httpx2.Timeout(30.0, read=WRITE_TIMEOUT + 60 if read_timeout is None else read_timeout)
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
    diagnostic = payload(result)
    if diagnostic and diagnostic.get("error") == "EDIT_OUTCOME_UNKNOWN":
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


def payload(result):
    if isinstance(result.structured_content, dict):
        value = result.structured_content
        # FastMCP wraps the object branch of a union return schema in "result".
        return value["result"] if len(value) == 1 and isinstance(value.get("result"), dict) else value
    for item in result.content:
        if item.type == "text":
            try:
                value = json.loads(item.text)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict):
                return value
    return None


def lock_timeout(result):
    if not result.is_error:
        return False
    text = "\n".join(item.text for item in result.content if item.type == "text").lower()
    data = payload(result)
    if data:
        text += "\n" + str(data.get("detail", "")).lower() + "\n" + str(data.get("error", "")).lower()
    return any(marker in text for marker in (
        "database is locked", "database table is locked", "sqlite_busy", "sqlite_locked",
        "lock timeout", "locknotavailable",
    ))


def authoritative(note):
    return (
        isinstance(note, dict) and not note.get("error")
        and isinstance(note.get("content"), str)
        and isinstance(note.get("frontmatter"), dict)
        and isinstance(note.get("file_path"), str)
        and note.get("checksum") == hashlib.sha256(note["content"].encode("utf-8")).hexdigest()
    )


class WritePolicy(Middleware):
    def __init__(self, queue_timeout=300.0, write_timeout=WRITE_TIMEOUT, max_queue=1000, journal_path=":memory:"):
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
        self.proxy = None
        self.retry_delays = (0.25, 1.0)
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
        LOG.error("Operation %s: %s. Affected target awaits reconciliation.", operation_id, reason)
        result = self.result(operation_id, f"WRITE_OUTCOME_UNKNOWN: {reason}. Do not replay. Inspect memory_queue_status.", True)
        self.transition(operation_id, "unknown", result)
        return result

    async def read_target(self, guard):
        try:
            async with asyncio.timeout(min(30, self.write_timeout)):
                result = await self.proxy.call_tool("read_note", {
                    "identifier": guard["identifier"], "project_id": guard["project_id"],
                    "output_format": "json", "include_frontmatter": True,
                }, run_middleware=False)
        except Exception as cause:
            raise ToolError(f"RECONCILIATION_READ_FAILED: upstream read failed ({type(cause).__name__}).") from cause
        note = payload(result)
        if note is None or (result.is_error and note.get("error") != "NOTE_NOT_FOUND"):
            raise ToolError("RECONCILIATION_READ_FAILED: exact note read did not return a note or NOTE_NOT_FOUND.")
        return note

    async def prepare(self, operation_id, name, arguments):
        """Persist a receipt and original revision before any dispatch."""
        if self.proxy is None or name not in ("write_note", "edit_note"):
            return None
        metadata = arguments.get("metadata")
        if isinstance(metadata, dict) and RECEIPT in metadata:
            raise ToolError(f"QUEUE_RESERVED_METADATA: {RECEIPT} is reserved for proxy recovery.")
        if not isinstance(arguments.get("content"), str):
            return None
        project_id = arguments.get("project_id")
        identifier = arguments.get("identifier")
        if name == "edit_note" and not project_id and isinstance(identifier, str):
            if identifier.startswith("memory://") or (not arguments.get("project") and identifier.count("/") >= 2):
                # Native edit routing can infer or reject a project from this identifier.
                return None
        if project_id and arguments.get("workspace"):
            return None
        if arguments.get("workspace") and not arguments.get("project"):
            return None
        if not project_id:
            try:
                async with asyncio.timeout(min(30, self.write_timeout)):
                    projects = payload(await self.proxy.call_tool(
                        "list_memory_projects", {"output_format": "json"}, run_middleware=False,
                    ))
            except Exception as cause:
                raise ToolError(f"RECONCILIATION_PROJECT_FAILED: upstream project lookup failed ({type(cause).__name__}).") from cause
            rows = projects.get("projects", []) if projects else []
            if not isinstance(rows, list):
                raise ToolError("RECONCILIATION_READ_FAILED: project discovery returned an invalid project list.")
            route = arguments.get("project")
            workspace = arguments.get("workspace")
            if workspace and route:
                route = f"{workspace}/{route}"
            matches = [
                row for row in rows if isinstance(row, dict) and (
                    route in (row.get("name"), row.get("qualified_name")) if route
                    else row.get("is_default") and row.get("workspace_is_default", True)
                )
            ]
            if len(matches) != 1 or not matches[0].get("external_id"):
                return None
            project_id = matches[0]["external_id"]
        if not isinstance(project_id, str):
            return None
        directory = arguments.get("directory", arguments.get("folder", arguments.get("dir", arguments.get("path"))))
        if name == "write_note":
            if not isinstance(arguments.get("title"), str) or not isinstance(directory, str):
                return None
            title = arguments["title"]
            # Slug titles have the same filename under either backend filename setting.
            exact_write_path = f"{directory.strip('/')}/{title}.md".lstrip("/") if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", title) else None
            identifier = exact_write_path or title
        if not isinstance(identifier, str) or not identifier.strip():
            return None
        guard = {"project_id": project_id, "identifier": identifier, "file_path": None,
                 "aliases": [identifier], "arguments": dict(arguments), "retry_safe": False, "response_lost": False}
        note = await self.read_target(guard)
        if name == "write_note" and (not exact_write_path or note.get("file_path") != exact_write_path):
            # Title resolution is only a receipt discovery hint, never a path precondition.
            note = {"error": "NOTE_NOT_FOUND"}
        if not note.get("error") and not authoritative(note):
            raise ToolError("RECONCILIATION_PARTIAL_STATE: accepted content and checksum disagree. Request was not dispatched.")
        if authoritative(note):
            guard.update({
                "identifier": note["file_path"], "file_path": note["file_path"], "checksum": note["checksum"],
                "previous_receipt": note["frontmatter"].get(RECEIPT),
                "aliases": [value for value in (identifier, note.get("title"), note.get("permalink"), note["file_path"]) if value],
            })
        if name in ("write_note", "edit_note"):
            metadata = arguments.get("metadata")
            if metadata is not None and not isinstance(metadata, dict):
                return None
            forwarded = guard["arguments"]
            forwarded["metadata"] = {**(metadata or {}), RECEIPT: operation_id}
            forwarded["project_id"] = project_id
            forwarded.pop("workspace", None)
            if guard["file_path"] and (name == "edit_note" or arguments.get("overwrite") is True):
                forwarded.setdefault("expected_checksum", guard["checksum"])
                if forwarded["expected_checksum"] is None:
                    forwarded["expected_checksum"] = guard["checksum"]
                guard["retry_safe"] = True
            elif name == "write_note" and arguments.get("overwrite") is False:
                guard["retry_safe"] = True
                guard["create_only"] = True
            elif name == "write_note" and arguments.get("overwrite") is True and isinstance(arguments.get("expected_checksum"), str) and arguments["expected_checksum"]:
                guard["retry_safe"] = True
        self.journal.prepare(operation_id, guard)
        return guard

    def conflicts(self, guard):
        for row in self.read_journal(self.journal.uncertain):
            other = json.loads(row["reconciliation"]) if row["reconciliation"] else None
            if not guard or not other:
                return True
            if guard["project_id"] != other["project_id"]:
                continue
            if guard.get("previous_receipt") == row["operation_id"]:
                return True
            if guard["file_path"] and other["file_path"]:
                if guard["file_path"] == other["file_path"]:
                    return True
            else:
                return True
        return False

    async def reconcile(self, operation_id, guard):
        if not guard or not self.proxy or self.failed:
            return None
        try:
            note = await self.read_target(guard)
        except Exception as cause:
            LOG.warning("Readback for %s failed: %s", operation_id, cause)
            return None
        if authoritative(note) and note["frontmatter"].get(RECEIPT) == operation_id:
            diagnostic = {
                "reconciled": True, "outcome": "applied", "title": note.get("title"),
                "file_path": note["file_path"], "permalink": note.get("permalink"), "checksum": note["checksum"],
            }
            result = self.result(operation_id, ToolResult(
                content=json.dumps(diagnostic), structured_content={"result": diagnostic},
            ))
            self.journal.resolve(operation_id, "applied", {
                "file_path": note["file_path"], "checksum": note["checksum"], "receipt": operation_id,
                "scope": "accepted note content, not completion of derived indexing or materialization",
            }, result, automatic=True)
            self.resolved.set()
            return result
        return None

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
                    if not recovering:
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
            if self.failed:
                raise ToolError("QUEUE_BLOCKED: prior write outcome is unknown. Request was not dispatched. Admission was refused.")
            capacity = self.max_queue + (0 if self.lock.locked() else 1)
            operation_id = self.journal.enqueue(
                context.message.name, context.message.arguments or {}, self.queue_timeout, capacity,
            )
            LOG.info("Durably admitted mutation %s (%s)", operation_id, context.message.name)
            deadline = self.read_journal(self.journal.get, operation_id)["deadline"]
            async with self.mutation(deadline=deadline, allow_blocked=True):
                if time.time() >= deadline:
                    raise TimeoutError
                if self.failed:
                    raise ToolError("QUEUE_BLOCKED: journal persistence failed. Request was not dispatched.")
                async with asyncio.timeout(max(0, deadline - time.time())):
                    guard = await self.prepare(operation_id, context.message.name, context.message.arguments or {})
                    for row in self.read_journal(self.journal.uncertain):
                        saved = json.loads(row["reconciliation"]) if row["reconciliation"] else None
                        await self.reconcile(row["operation_id"], saved)
                if self.conflicts(guard):
                    raise ToolError("QUEUE_BLOCKED: this target has an unresolved write. Request was not dispatched.")
                forwarded = context if guard is None else context.copy(
                    message=context.message.model_copy(update={"arguments": guard["arguments"]}),
                )
                return await self.execute(operation_id, lambda: call_next(forwarded), guard)
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

    async def execute(self, operation_id, call, guard=None):
        had_uncertainty = self.read_journal(self.journal.get, operation_id)["state"] == "unknown"
        self.transition(operation_id, "dispatched")
        self.active_operation = operation_id
        try:
            # A caller disconnect must not free the lane before outcome persistence.
            with anyio.CancelScope(shield=True):
                expires = time.monotonic() + self.write_timeout
                for attempt in range(len(self.retry_delays) + 1):
                    uncertain = False
                    prior_response_lost = had_uncertainty or (guard.get("response_lost", True) if guard else True)
                    if guard:
                        guard["response_lost"] = True
                        self.journal.prepare(operation_id, guard)
                    try:
                        with anyio.fail_after(max(0, expires - time.monotonic())):
                            result = self.result(operation_id, await call())
                    except asyncio.CancelledError:
                        self.block(operation_id, "Active write was interrupted")
                        raise
                    except (NotFoundError, ValidationError) as cause:
                        if attempt or had_uncertainty:
                            return self.block(operation_id, f"Recovery dispatch rejected: {cause}")
                        result = self.result(operation_id, f"WRITE_REJECTED: {cause}", True)
                        self.transition(operation_id, "rejected", result)
                        return result
                    except Exception as cause:
                        result = self.block(operation_id, f"Active write response failed ({type(cause).__name__})")
                        uncertain = True
                    if not uncertain and guard:
                        guard["response_lost"] = prior_response_lost or outcome_unknown(result)
                        self.journal.prepare(operation_id, guard)
                    if not uncertain and not outcome_unknown(result) and not lock_timeout(result):
                        if (attempt or had_uncertainty) and result.is_error:
                            self.transition(operation_id, "unknown", result)
                            settled = await self.reconcile(operation_id, guard)
                            if settled:
                                return settled
                            # A conflict after a lost response does not prove the first attempt failed.
                            return self.block(operation_id, "Guarded retry rejected without an operation receipt")
                        self.transition(operation_id, "completed", result)
                        return result
                    if not uncertain:
                        self.transition(operation_id, "unknown", result)
                    settled = await self.reconcile(operation_id, guard)
                    if settled:
                        return settled
                    can_retry = guard and guard["retry_safe"]
                    if guard and guard.get("create_only"):
                        can_retry = can_retry and not guard["response_lost"] and lock_timeout(result) and not outcome_unknown(result)
                    if not can_retry or attempt == len(self.retry_delays):
                        if guard and guard["file_path"] and not guard["response_lost"] and lock_timeout(result):
                            try:
                                note = await self.read_target(guard)
                            except ToolError as cause:
                                LOG.warning("Final lock readback for %s failed: %s", operation_id, cause)
                                return result
                            if authoritative(note) and note["checksum"] == guard.get("checksum"):
                                failure = self.result(operation_id, "WRITE_NOT_APPLIED: lock retries exhausted. Accepted revision is unchanged.", True)
                                self.journal.resolve(operation_id, "not_applied", {
                                    "checksum": note["checksum"], "file_path": note["file_path"],
                                    "reason": "all dispatched workers returned and the accepted base revision is unchanged",
                                }, failure, automatic=True)
                                return failure
                        return result
                    delay = self.retry_delays[attempt]
                    if time.monotonic() + delay >= expires:
                        return result
                    LOG.warning("Retrying guarded operation %s after uncertain/locked result (attempt %s).", operation_id, attempt + 2)
                    await asyncio.sleep(delay)
                    self.transition(operation_id, "dispatched")
        finally:
            self.active_operation = None

    async def recover(self, proxy):
        self.proxy = proxy
        try:
            async with self.mutation(allow_blocked=True, recovering=True):
                for row in self.read_journal(self.journal.uncertain):
                    guard = json.loads(row["reconciliation"]) if row["reconciliation"] else None
                    if await self.reconcile(row["operation_id"], guard):
                        continue
                    record = self.read_journal(self.journal.get, row["operation_id"])
                    if guard and guard["retry_safe"] and not guard.get("create_only") and record["deadline"] > time.time():
                        await self.execute(row["operation_id"], lambda record=record, guard=guard: proxy.call_tool(
                            record["name"], guard["arguments"], run_middleware=False,
                        ), guard)
            for record in self.recovery_records:
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
                    async with self.mutation(deadline=record["deadline"], recovering=True, allow_blocked=True):
                        saved = self.read_journal(self.journal.get, record["operation_id"])
                        arguments = json.loads(saved["arguments"])
                        if time.time() >= record["deadline"]:
                            raise TimeoutError
                        try:
                            async with asyncio.timeout(max(0, record["deadline"] - time.time())):
                                guard = await self.prepare(record["operation_id"], record["name"], arguments)
                        except ToolError as cause:
                            if self.failed:
                                raise
                            self.transition(record["operation_id"], "rejected", self.result(record["operation_id"], str(cause), True))
                            continue
                        if self.conflicts(guard):
                            self.transition(record["operation_id"], "rejected", self.result(
                                record["operation_id"], "QUEUE_BLOCKED: affected target has an unresolved write. Not dispatched.", True,
                            ))
                            continue
                        await self.execute(record["operation_id"], lambda: proxy.call_tool(
                            record["name"], guard["arguments"] if guard else arguments, run_middleware=False,
                        ), guard)
                except (TimeoutError, ToolError) as cause:
                    if not isinstance(cause, TimeoutError) and not str(cause).startswith("QUEUE_TIMEOUT:"):
                        raise
                    self.transition(record["operation_id"], "expired", self.result(
                        record["operation_id"], "QUEUE_TIMEOUT: persisted wait expired before recovery dispatch.", True,
                    ))
        except asyncio.CancelledError:
            raise
        except Exception:
            self.failed = True
            LOG.exception("Durable queue recovery failed; mutation admission is blocked.")
        finally:
            self.recovery_ready.set()

    async def reconcile_pending(self):
        while True:
            await asyncio.sleep(5)
            try:
                if self.failed or not self.read_journal(self.journal.unknown):
                    continue
                async with self.mutation(allow_blocked=True, recovering=True):
                    for row in self.read_journal(self.journal.uncertain):
                        guard = json.loads(row["reconciliation"]) if row["reconciliation"] else None
                        await self.reconcile(row["operation_id"], guard)
            except asyncio.CancelledError:
                raise
            except (sqlite3.Error, OSError):
                self.persistence_failure()
                return
            except ToolError as cause:
                LOG.warning("Pending reconciliation deferred: %s", cause)
                if self.failed:
                    return
            except Exception:
                self.failed = True
                LOG.exception("Automatic reconciliation failed; mutation admission is blocked.")
                return

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
    policy.proxy = proxy

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
        """Manual fallback only, with explicit user approval: stop the prior backend and read the exact target via MCP.
        Automatic receipt reconciliation normally settles note writes. This resolves remaining ambiguous outcomes.
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
            reconciliation = asyncio.create_task(policy.reconcile_pending())
            try:
                yield state
            finally:
                recovery.cancel()
                reconciliation.cancel()
                await asyncio.gather(recovery, reconciliation, return_exceptions=True)
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
