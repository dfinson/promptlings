"""Framework-owned MCP transport with one process-local mutation lane."""

import argparse
import asyncio
import json
import logging
import math
import socket
from contextlib import asynccontextmanager
from importlib.metadata import version

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
from mcp.client.streamable_http import streamable_http_client
from mcp.shared._httpx_utils import create_mcp_http_client
from starlette.middleware import Middleware as HTTPMiddleware
from starlette.responses import JSONResponse

LOG = logging.getLogger("promptlings.memory")
READY = "PROMPTLINGS_MEMORY_PROXY_READY"


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
    def __init__(self, queue_timeout=300.0, write_timeout=600.0, max_queue=1000):
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
        self.blocked = False

    def block(self, reason):
        self.blocked = True
        LOG.error("%s. Mutation lane blocked until managed restart. Reconcile the target before retrying.", reason)

    @asynccontextmanager
    async def mutation(self, allow_blocked=False):
        if self.blocked and not allow_blocked:
            raise ToolError("QUEUE_BLOCKED: prior write outcome is unknown. Request was not dispatched. Reconcile the target before restart.")
        capacity = self.max_queue + (0 if self.lock.locked() else 1)
        if self.waiting >= capacity:
            raise ToolError("QUEUE_FULL: mutation queue is full. Request was not dispatched.")
        self.waiting += 1
        try:
            try:
                await asyncio.wait_for(self.lock.acquire(), self.queue_timeout)
            except TimeoutError:
                LOG.error("Mutation queue wait exceeded %s seconds. Request was not dispatched.", self.queue_timeout)
                raise ToolError("QUEUE_TIMEOUT: mutation queue wait expired. Request was not dispatched.") from None
        finally:
            self.waiting -= 1
        try:
            if self.blocked and not allow_blocked:
                raise ToolError("QUEUE_BLOCKED: prior write outcome is unknown. Request was not dispatched. Reconcile the target before restart.")
            yield
        finally:
            self.lock.release()

    async def on_call_tool(self, context, call_next):
        if context.message.name in READ_TOOLS:
            return await call_next(context)
        async with self.mutation():
            # SDK cancellation must not release the lane while a backend write runs.
            with anyio.CancelScope(shield=True):
                try:
                    with anyio.fail_after(self.write_timeout):
                        result = await call_next(context)
                except TimeoutError:
                    self.block("Active write response deadline expired")
                    raise ToolError("ACTIVE_WRITE_TIMEOUT: write outcome is unknown. Do not replay. Reconcile the target before restart.") from None
                except asyncio.CancelledError:
                    self.block("Active write was interrupted")
                    raise
                except (NotFoundError, ValidationError):
                    # Framework lookup/argument refusal happens before the backend tool runs.
                    raise
                except Exception as cause:
                    self.block(f"Active write transport or protocol failed: {cause}")
                    raise ToolError("WRITE_OUTCOME_UNKNOWN: backend call failed. Do not replay. Reconcile the target before restart.") from cause
                if outcome_unknown(result):
                    self.block("Basic Memory reported EDIT_OUTCOME_UNKNOWN")
                return result


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
    return proxy.http_app(
        path="/mcp", stateless_http=False, event_store=EventStore(),
        host_origin_protection=True,
        allowed_hosts=["127.0.0.1:*", "localhost:*"],
        allowed_origins=["http://127.0.0.1:*", "https://127.0.0.1:*", "http://localhost:*", "https://localhost:*"],
        middleware=[HTTPMiddleware(RequestPolicy, policy=policy, max_body_bytes=max_body_bytes)],
    )


async def serve(args):
    if version("fastmcp") != args.fastmcp_version:
        raise RuntimeError(f"Expected FastMCP {args.fastmcp_version}, found {version('fastmcp')}. Reinstall the managed runtime.")
    listener = socket.socket()
    try:
        listener.bind(("127.0.0.1", args.proxy_port))
        listener.listen(128)
        app = create_app(f"http://127.0.0.1:{args.port}/mcp")
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
    args = parser.parse_args()
    if not (0 < args.port <= 65535 and 0 < args.proxy_port <= 65535 and args.port != args.proxy_port):
        parser.error("Backend and proxy require distinct valid ports.")
    asyncio.run(serve(args))
