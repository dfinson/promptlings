import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const python = process.env.PROMPTLINGS_MEMORY_PYTHON || "python";
const proxyPath = fileURLToPath(new URL("../lib/memory-proxy.py", import.meta.url));
const fixture = String.raw`
import asyncio
import importlib.util
import json
import socket
import sys
import tempfile
import time
from contextlib import asynccontextmanager
from pathlib import Path

try:
    import httpx2 as httpx
    import uvicorn
    from fastmcp import Client, Context, FastMCP
    from fastmcp.exceptions import ToolError
    from fastmcp.server.event_store import EventStore
    from fastmcp.tools.base import ToolResult
except ImportError as exc:
    raise SystemExit(
        "Proxy validation requires the pinned FastMCP dependency. Install pins.memoryProxy "
        "with this Python interpreter, or set PROMPTLINGS_MEMORY_PYTHON to that interpreter. "
        f"Missing dependency: {exc}"
    ) from exc

spec = importlib.util.spec_from_file_location("memory_proxy", sys.argv[1])
memory_proxy = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = memory_proxy
spec.loader.exec_module(memory_proxy)

async def eventually(predicate):
    async with asyncio.timeout(5):
        while not predicate():
            await asyncio.sleep(0.005)

@asynccontextmanager
async def serve(app):
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    sock.listen()
    port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(
        app, host="127.0.0.1", port=port, lifespan="on", log_level="warning",
        timeout_graceful_shutdown=1,
    ))
    running = asyncio.create_task(server.serve(sockets=[sock]))
    try:
        await eventually(lambda: server.started or running.done())
        if running.done():
            await running
            raise AssertionError("Fixture server exited before becoming ready")
        yield f"http://127.0.0.1:{port}/mcp"
    finally:
        server.should_exit = True
        try:
            await asyncio.wait_for(asyncio.shield(running), 5)
        except TimeoutError:
            running.cancel()
            await asyncio.gather(running, return_exceptions=True)
        finally:
            sock.close()

@asynccontextmanager
async def fixture(handler, *, streaming=True, queue_timeout=120, max_body_bytes=64 * 1024 * 1024,
                  transport_failure=False, fragment_size=7, journal_path=":memory:"):
    backend = FastMCP("isolated-memory-fixture", tasks=False)
    sessions = []

    async def invoke(name, label, ctx):
        sessions.append(ctx.session_id)
        return await handler(name, label, ctx)

    @backend.tool
    async def write_note(label: str, ctx: Context) -> ToolResult:
        return await invoke("write_note", label, ctx)

    @backend.tool
    async def edit_note(label: str, ctx: Context) -> ToolResult:
        return await invoke("edit_note", label, ctx)

    @backend.tool
    async def future_mutation(label: str, ctx: Context) -> ToolResult:
        return await invoke("future_mutation", label, ctx)

    @backend.tool
    async def read_note(label: str, ctx: Context) -> ToolResult:
        return await invoke("read_note", label, ctx)

    backend_app = backend.http_app(
        path="/mcp", json_response=not streaming, stateless_http=False,
        event_store=EventStore(),
    )
    if streaming:
        unfragmented = backend_app
        async def backend_app(scope, receive, send):
            async def fragmented_send(message):
                body = message.get("body", b"")
                if message["type"] == "http.response.body" and body:
                    for offset in range(0, len(body), fragment_size):
                        await send({
                            **message, "body": body[offset:offset + fragment_size],
                            "more_body": offset + fragment_size < len(body) or message.get("more_body", False),
                        })
                        await asyncio.sleep(0.001)
                else:
                    await send(message)
            await unfragmented(scope, receive, fragmented_send)
    if transport_failure:
        original = backend_app
        async def backend_app(scope, receive, send):
            if scope["type"] != "http" or scope["method"] != "POST":
                return await original(scope, receive, send)
            messages = []
            body = b""
            while True:
                message = await receive()
                messages.append(message)
                body += message.get("body", b"")
                if not message.get("more_body"):
                    break
            call = json.loads(body)
            if call.get("method") == "tools/call" and call["params"]["name"] == "edit_note":
                await handler("edit_note", call["params"]["arguments"]["label"], None)
                await send({"type": "http.response.start", "status": 503, "headers": []})
                await send({"type": "http.response.body", "body": b"lost accepted write response"})
                return
            async def replay():
                if messages:
                    return messages.pop(0)
                return await receive()
            await original(scope, replay, send)

    policy = memory_proxy.WritePolicy(queue_timeout=queue_timeout, journal_path=journal_path)
    async with serve(backend_app) as upstream:
        app = memory_proxy.create_app(upstream, policy=policy, max_body_bytes=max_body_bytes)
        async with serve(app) as url:
            yield url, policy, sessions

def ok(label):
    return ToolResult(content=label)

def text(result):
    return "\n".join(block.text for block in result.content if block.type == "text")

async def call(client, name, label):
    return await client.call_tool(name, {"label": label}, raise_on_error=False)

def message(request_id, name, label):
    return {"jsonrpc": "2.0", "id": request_id, "method": "tools/call",
            "params": {"name": name, "arguments": {"label": label}}}

def sse_messages(body):
    return [json.loads(line[6:]) for line in body.splitlines() if line.startswith("data: ")]

async def initialize(http, url):
    response = await http.post(url, headers={
        "content-type": "application/json", "accept": "application/json, text/event-stream",
    }, json={"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {
        "protocolVersion": "2025-03-26", "capabilities": {},
        "clientInfo": {"name": "proxy-protocol-fixture", "version": "1"},
    }})
    assert response.status_code == 200, response.text
    session = response.headers["mcp-session-id"]
    headers = {"content-type": "application/json", "accept": "application/json, text/event-stream",
               "mcp-session-id": session, "mcp-protocol-version": "2025-03-26"}
    response = await http.post(url, headers=headers, json={
        "jsonrpc": "2.0", "method": "notifications/initialized",
    })
    assert response.status_code == 202, response.text
    return headers
`;

async function runCase(source) {
  const child = spawn(python, ["-B", "-", proxyPath], {
    stdio: ["pipe", "inherit", "inherit"],
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  const timer = setTimeout(() => child.kill(), 60_000);
  try {
    const finished = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    child.stdin.on("error", () => {});
    child.stdin.end(`${fixture}\n${source}\nasyncio.run(asyncio.wait_for(main(), 40))\n`);
    const { code, signal } = await finished;
    assert.equal(code, 0, `Python proxy behavior failed (signal: ${signal ?? "none"}). See fixture output above.`);
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
}

test("FIFO spans sessions and unknown mutations while reads bypass the write queue", async () => {
  await runCase(String.raw`
async def main():
    order = []
    active = 0
    maximum = 0
    started = asyncio.Event()
    release = asyncio.Event()
    async def handler(name, label, ctx):
        nonlocal active, maximum
        if name == "read_note":
            return ok(label)
        active += 1
        maximum = max(maximum, active)
        order.append(label)
        if label == "first":
            started.set()
            await release.wait()
        active -= 1
        return ok(label)
    async with fixture(handler) as (url, policy, sessions):
        async with Client(url, mode="legacy") as one, Client(url, mode="legacy") as two:
            first = asyncio.create_task(call(one, "write_note", "first"))
            try:
                await started.wait()
                second = asyncio.create_task(call(one, "edit_note", "second"))
                await eventually(lambda: policy.waiting == 1)
                third = asyncio.create_task(call(two, "future_mutation", "third"))
                await eventually(lambda: policy.waiting == 2)
                read = await call(two, "read_note", "read")
                assert not read.is_error and text(read) == "read"
                assert order == ["first"], order
            finally:
                release.set()
            results = await asyncio.gather(first, second, third)
            assert all(not result.is_error for result in results), results
            assert [text(result) for result in results] == ["first", "second", "third"]
            assert order == ["first", "second", "third"], order
            assert maximum == 1, maximum
`);
});

test("SSE, initialization/session headers, GET resumption and DELETE use framework sessions", async () => {
  await runCase(String.raw`
async def main():
    progress_arrived = asyncio.Event()
    release = asyncio.Event()
    large_note = "0123456789abcdef" * (1100 * 1024 // 16)
    async def handler(name, label, ctx):
        if name == "read_note" and label == "large-note":
            return ok(large_note)
        if label == "stream":
            await ctx.report_progress(1, 2, "accepted")
            await release.wait()
        return ok(label)
    async with fixture(handler, fragment_size=16 * 1024) as (url, policy, upstream_sessions):
        async with Client(memory_proxy.MemoryHTTPTransport(url), mode="legacy") as one, \
                   Client(memory_proxy.MemoryHTTPTransport(url), mode="legacy") as two:
            one_id = one.transport.get_session_id()
            two_id = two.transport.get_session_id()
            assert one_id and two_id and one_id != two_id
            async def progress(value, total, note):
                assert (value, total, note) == (1, 2, "accepted")
                progress_arrived.set()
            pending = asyncio.create_task(one.call_tool(
                "edit_note", {"label": "stream"}, progress_handler=progress,
            ))
            try:
                await asyncio.wait_for(progress_arrived.wait(), 5)
                assert not pending.done(), "SSE progress was buffered until completion"
                read = await call(two, "read_note", "independent")
                assert text(read) == "independent"
                assert one.transport.get_session_id() == one_id
                assert two.transport.get_session_id() == two_id
            finally:
                release.set()
            assert text(await pending) == "stream"
            large_result = await call(one, "read_note", "large-note")
            assert not large_result.is_error, "Gateway rejected the 1,100KiB note response"
            assert text(large_result) == large_note, "Gateway did not preserve the full 1,100KiB note content"
            assert not policy.blocked, "Large read response quarantined the mutation lane"
            write = await call(one, "edit_note", "after-large-read")
            assert not write.is_error and text(write) == "after-large-read", write
            assert not policy.blocked
            assert one.transport.get_session_id() == one_id
            assert all(upstream_sessions)
            assert one_id not in upstream_sessions and two_id not in upstream_sessions

        async with httpx.AsyncClient(timeout=5) as http:
            headers = await initialize(http, url)
            delete_headers = await initialize(http, url)
            release.clear()
            payload = message(10, "edit_note", "stream")
            payload["params"]["_meta"] = {"progressToken": "resume-progress"}
            deletion = None
            try:
                async with http.stream("POST", url, headers=headers, json=payload) as response:
                    assert response.status_code == 200
                    assert response.headers["content-type"].startswith("text/event-stream")
                    lines = []
                    async for line in response.aiter_lines():
                        lines.append(line)
                        if line.startswith("data: "):
                            event = json.loads(line[6:])
                            if event.get("method") == "notifications/progress":
                                deletion = asyncio.create_task(http.delete(url, headers=delete_headers))
                                await eventually(lambda: policy.waiting == 1)
                                assert not deletion.done(), "Session DELETE bypassed the active write"
                                release.set()
                    body = "\n".join(lines)
            finally:
                release.set()
                if deletion is not None:
                    deleted_other = await deletion
            assert deletion is not None, "SSE progress did not arrive"
            assert deleted_other.status_code == 200, deleted_other.text
            events = [line[4:] for line in body.splitlines() if line.startswith("id: ")]
            assert len(events) >= 2, body
            results = sse_messages(body)
            assert results[-1]["id"] == 10 and results[-1]["result"]["isError"] is False
            assert results[0]["method"] == "notifications/progress", results
            assert results[-1]["result"]["content"][0]["text"] == "stream"
            async with http.stream("GET", url, headers={**headers, "last-event-id": events[0]}) as resumed:
                assert resumed.status_code == 200
                async for line in resumed.aiter_lines():
                    if line.startswith("data: "):
                        replay = json.loads(line[6:])
                        if replay.get("id") == 10:
                            assert replay == results[-1]
                            break
                else:
                    raise AssertionError("EventStore did not replay the completed result")
            deleted = await http.delete(url, headers=headers)
            assert deleted.status_code == 200, deleted.text
            after_delete = await http.post(url, headers=headers, json=message(11, "read_note", "expired"))
            assert after_delete.status_code == 404, after_delete.text
`);
});

test("accepted commit error is returned once without replay", async () => {
  await runCase(String.raw`
async def main():
    commits = []
    async def handler(name, label, ctx):
        commits.append(label)
        raise ToolError("failed after accepted note commit")
    async with fixture(handler) as (url, policy, sessions):
        async with Client(url, mode="legacy") as client:
            result = await call(client, "edit_note", "committed")
            assert result.is_error
            assert "failed after accepted note commit" in text(result), result
            assert commits == ["committed"], commits
`);
});

test("uncertain MCP edit results block writes for JSON and fragmented SSE without buffering progress", async () => {
  await runCase(String.raw`
async def main():
    for streaming in (False, True):
        for marker in (
            json.dumps({"error": "EDIT_OUTCOME_UNKNOWN", "detail": "No confirmation came back."}),
            "# Edit Outcome Unknown\n\nThe edit may have been applied. Read the note before retrying.",
        ):
            writes = []
            progress_arrived = asyncio.Event()
            release = asyncio.Event()
            async def handler(name, label, ctx):
                if name == "read_note":
                    return ok(label)
                writes.append(label)
                if streaming:
                    await ctx.report_progress(1, 2, "accepted")
                    await release.wait()
                return ToolResult(content=marker, is_error=True)
            async with fixture(handler, streaming=streaming) as (url, policy, sessions):
                async with Client(url, mode="legacy") as client:
                    async def progress(value, total, note):
                        progress_arrived.set()
                    pending = asyncio.create_task(client.call_tool(
                        "edit_note", {"label": "uncertain"}, raise_on_error=False,
                        progress_handler=progress,
                    ))
                    try:
                        if streaming:
                            await asyncio.wait_for(progress_arrived.wait(), 5)
                            assert not pending.done(), "Progress was buffered until the uncertain result"
                    finally:
                        release.set()
                    result = await pending
                    assert result.is_error and text(result) == marker, result
                    assert policy.blocked, "Exact uncertain result did not quarantine the write lane"
                    blocked = await call(client, "write_note", "blocked")
                    assert blocked.is_error and text(blocked).startswith("QUEUE_BLOCKED:"), blocked
                    assert "Request was not dispatched." in text(blocked), blocked
                    read = await call(client, "read_note", "read")
                    assert not read.is_error and text(read) == "read"
                    assert writes == ["uncertain"], writes
`);
});

test("confirmed refusals mentioning outcome markers do not block later writes", async () => {
  await runCase(String.raw`
async def main():
    for refusal in (
        json.dumps({"title": "EDIT_OUTCOME_UNKNOWN", "error": "NOTE_REVISION_CONFLICT"}),
        json.dumps({"title": "# Edit Outcome Unknown", "error": "NOTE_REVISION_CONFLICT",
                    "detail": "The prior result included EDIT_OUTCOME_UNKNOWN."}),
        '# Note Revision Conflict\n\nNote "# Edit Outcome Unknown" with identifier EDIT_OUTCOME_UNKNOWN changed.',
    ):
        writes = []
        async def handler(name, label, ctx):
            writes.append(label)
            if label == "refused":
                return ToolResult(content=refusal, is_error=True)
            return ok(label)
        assert not memory_proxy.outcome_unknown(ToolResult(content=refusal, is_error=True))
        async with fixture(handler) as (url, policy, sessions):
            async with Client(url, mode="legacy") as client:
                result = await call(client, "edit_note", "refused")
                assert result.is_error and text(result) == refusal, result
                assert not policy.blocked
                next_result = await call(client, "write_note", "next")
                assert not next_result.is_error and text(next_result) == "next", next_result
                assert writes == ["refused", "next"], writes
`);
});

test("unknown write outcome blocks subsequent writes but leaves reads available", async () => {
  await runCase(String.raw`
async def main():
    writes = []
    async def handler(name, label, ctx):
        if name != "read_note":
            writes.append(label)
        return ok(label)
    async with fixture(handler, transport_failure=True) as (url, policy, sessions):
        async with Client(url, mode="legacy") as client:
            failed = await call(client, "edit_note", "lost-response")
            assert failed.is_error, failed
            assert policy.blocked
            blocked = await call(client, "write_note", "blocked")
            assert blocked.is_error and text(blocked).startswith("QUEUE_BLOCKED:"), blocked
            assert "Request was not dispatched." in text(blocked), blocked
            read = await call(client, "read_note", "still-readable")
            assert not read.is_error and text(read) == "still-readable", read
            assert writes == ["lost-response"], writes
            async with httpx.AsyncClient(timeout=5) as http:
                headers = await initialize(http, url)
                deleted = await http.delete(url, headers=headers)
                assert deleted.status_code == 200, "Blocked writes prevented frontend session cleanup"
`);
});

test("queue expiration is explicit and never dispatches the expired write", async () => {
  await runCase(String.raw`
async def main():
    received = []
    started = asyncio.Event()
    release = asyncio.Event()
    async def handler(name, label, ctx):
        received.append(label)
        started.set()
        await release.wait()
        return ok(label)
    async with fixture(handler, queue_timeout=0.05) as (url, policy, sessions):
        async with Client(url, mode="legacy") as client:
            first = asyncio.create_task(call(client, "write_note", "first"))
            try:
                await started.wait()
                expired = await call(client, "edit_note", "expired")
                assert expired.is_error and text(expired).startswith("QUEUE_TIMEOUT:"), expired
                assert "Request was not dispatched." in text(expired), expired
                assert received == ["first"], received
                assert not policy.blocked
            finally:
                release.set()
                first_result = await first
            assert not first_result.is_error and text(first_result) == "first"
            assert received == ["first"], received
`);
});

test("disconnect and advisory cancellation cannot release an in-flight write early", async () => {
  await runCase(String.raw`
async def main():
    started = asyncio.Event()
    release = asyncio.Event()
    received = []
    commits = []
    async def handler(name, label, ctx):
        received.append(label)
        if label == "first":
            started.set()
            await release.wait()
        commits.append(label)
        return ok(label)
    async with fixture(handler) as (url, policy, sessions):
        async with httpx.AsyncClient(timeout=5) as http, Client(url, mode="legacy") as next_client:
            headers = await initialize(http, url)
            async def abandoned():
                async with http.stream("POST", url, headers=headers, json=message(1, "edit_note", "first")) as response:
                    assert response.status_code == 200
                    await response.aread()
            first = asyncio.create_task(abandoned())
            try:
                await started.wait()
                first.cancel()
                await asyncio.gather(first, return_exceptions=True)
                cancellation = await http.post(url, headers=headers, json={
                    "jsonrpc": "2.0", "method": "notifications/cancelled",
                    "params": {"requestId": 1, "reason": "client disconnected"},
                })
                assert cancellation.status_code == 202, cancellation.text
                next_write = asyncio.create_task(call(next_client, "write_note", "second"))
                await eventually(lambda: policy.waiting == 1)
                assert received == ["first"] and commits == [], (received, commits)
            finally:
                release.set()
            next_result = await next_write
            assert not next_result.is_error and text(next_result) == "second", next_result
            assert received == ["first", "second"], received
            assert commits == ["first", "second"], commits
`);
});

test("malformed, batched, oversized and non-loopback requests fail before dispatch", async () => {
  await runCase(String.raw`
async def main():
    calls = []
    async def handler(name, label, ctx):
        calls.append(label)
        return ok(label)
    async with fixture(handler, max_body_bytes=1024) as (url, policy, sessions):
        async with httpx.AsyncClient(timeout=5) as http:
            headers = await initialize(http, url)
            for body in ("null", "{}", "[]", json.dumps([message(1, "write_note", "batch")]), "{"):
                response = await http.post(url, headers=headers, content=body)
                assert response.status_code == 400, (body, response.status_code, response.text)
            oversized = await http.post(url, headers=headers, content=" " * 1025)
            assert oversized.status_code == 413, oversized.text
            for extra, expected in (({"origin": "https://example.com"}, 403),
                                    ({"host": "example.com"}, 421)):
                response = await http.post(url, headers={**headers, **extra},
                                           json=message(2, "write_note", "untrusted"))
                assert response.status_code == expected, (extra, response.status_code, response.text)
            outside = await http.post(url.replace("/mcp", "/outside"), headers=headers,
                                      json=message(3, "write_note", "outside"))
            assert outside.status_code == 404, outside.text
            assert calls == [], calls
`);
});

test("journal reopening retains FIFO requests, results and uncertain dispatches with a single owner", async () => {
  await runCase(String.raw`
async def main():
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "queue.sqlite3"
        first = memory_proxy.WriteJournal(path)
        queued = first.enqueue("edit_note", {"identifier": "target", "content": "queued"}, 300, 10)
        uncertain = first.enqueue("edit_note", {"identifier": "target", "content": "uncertain"}, 300, 10)
        completed = first.enqueue("write_note", {"title": "finished"}, 300, 10)
        first.transition(uncertain, "dispatched")
        result = memory_proxy.WritePolicy.result(completed, ToolResult(
            content="saved outcome", structured_content={"accepted": True}, meta={"upstream": "preserved"},
        ))
        first.transition(completed, "completed", result)
        try:
            memory_proxy.WriteJournal(path)
            raise AssertionError("A second gateway acquired the same journal")
        except OSError:
            pass
        assert first.get(uncertain)["state"] == "dispatched"
        first.close()
        reopened = memory_proxy.WriteJournal(path)
        try:
            assert reopened.unknown()
            assert [row["operation_id"] for row in reopened.queued()] == [queued]
            assert reopened.get(uncertain)["state"] == "unknown"
            saved = reopened.status(completed)["operations"][0]
            assert saved["state"] == "completed"
            assert saved["result"]["structured_content"] == {"accepted": True}
            assert saved["result"]["meta"] == {"upstream": "preserved", "memory_queue_operation_id": completed}
            reopened.resolve(uncertain, "applied", "Verified accepted target after stopping the prior backend")
            assert not reopened.unknown()
            assert reopened.get(uncertain)["state"] == "resolved_applied"
            assert reopened.get(queued)["state"] == "queued"
        finally:
            reopened.close()
`);
});

test("failed outcome persistence returns an explicit error and quarantines the dispatched write after restart", async () => {
  await runCase(String.raw`
async def main():
    import sqlite3
    calls = []
    async def handler(name, label, ctx):
        calls.append(label)
        return ok(label)
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "queue.sqlite3"
        async with fixture(handler, journal_path=path) as (url, policy, sessions):
            transition = policy.journal.transition
            def fail_result(operation_id, state, result=None):
                if state == "completed":
                    raise sqlite3.OperationalError("Simulated outcome persistence failure")
                return transition(operation_id, state, result)
            policy.journal.transition = fail_result
            async with Client(url, mode="legacy") as client:
                failed = await call(client, "edit_note", "accepted")
                assert failed.is_error and "JOURNAL_FAILURE:" in text(failed), failed
                blocked = await call(client, "write_note", "must-not-run")
                assert blocked.is_error and "QUEUE_BLOCKED:" in text(blocked), blocked
                assert calls == ["accepted"]
                operation_id = policy.journal.status()["operations"][0]["operation_id"]
                status = await client.call_tool("memory_queue_status", {"operation_id": operation_id})
                assert not status.is_error
                assert status.structured_content["blocked"]
                assert status.structured_content["journal_failed"]
                assert status.structured_content["operations"][0]["state"] == "dispatched"
        reopened = memory_proxy.WriteJournal(path)
        try:
            assert reopened.unknown()
            assert reopened.get(operation_id)["state"] == "unknown"
            assert not reopened.queued()
        finally:
            reopened.close()
`);
});

test("status history discovers lost completed responses without loading every stored payload", async () => {
  await runCase(String.raw`
async def main():
    journal = memory_proxy.WriteJournal(":memory:")
    try:
        pending = journal.enqueue("edit_note", {"project": "throwaway", "identifier": "target", "content": "pending body"}, 300, 100)
        completed = []
        for index in range(55):
            operation_id = journal.enqueue("write_note", {"title": f"note-{index}", "content": "saved body"}, 300, 100)
            journal.transition(operation_id, "completed", memory_proxy.WritePolicy.result(operation_id, ok(f"result-{index}")))
            completed.append(operation_id)
        # Invalid large-payload columns prove list queries do not decode their contents.
        journal.connection.execute("UPDATE writes SET arguments='not JSON', result='not JSON' WHERE operation_id=?", (completed[0],))
        journal.connection.commit()
        page = journal.status()
        assert len(page["operations"]) == 51
        assert page["operations"][0]["operation_id"] == pending
        assert page["operations"][-1]["operation_id"] == completed[-1]
        assert all("arguments" not in row and "result" not in row for row in page["operations"])
        older = journal.status(before_sequence=page["next_before_sequence"])
        assert [row["operation_id"] for row in older["operations"]] == [pending, *completed[:5]]
        assert older["next_before_sequence"] is None
        saved = journal.status(completed[-1])["operations"][0]
        assert saved["arguments"]["content"] == "saved body"
        assert saved["result"]["meta"]["memory_queue_operation_id"] == completed[-1]
        assert saved["target"] == {"title": "note-54"}
        assert [row["operation_id"] for row in journal.queued()] == [pending]
        assert "arguments" not in journal.queued()[0].keys()
        oversized = journal.enqueue("write_note", {"title": "x" * 4096, "directory": {"nested": "y" * 4096}}, 300, 100)
        summary = journal.status()["operations"][-1]["target"]
        assert summary == {"title": "x" * 256, "directory": "[non-scalar target]", "_truncated": True}
        assert journal.status(oversized)["operations"][0]["arguments"]["title"] == "x" * 4096
    finally:
        journal.close()
`);
});

test("recovery expires overdue discovery and acquisition without dispatch or permanent quarantine", async () => {
  await runCase(String.raw`
async def main():
    import time
    for scenario in ("blocking-discovery", "async-discovery", "acquisition"):
        policy = memory_proxy.WritePolicy()
        first = policy.journal.enqueue("write_note", {"label": "expired"}, 0.02, 10)
        second = policy.journal.enqueue("write_note", {"label": "later"}, 2, 10)
        policy.recovery_records = policy.journal.queued()
        policy.recovery_ready.clear()
        calls = []
        class Proxy:
            discovery = 0
            async def get_tool(self, name):
                self.discovery += 1
                if self.discovery == 1:
                    if scenario == "blocking-discovery":
                        time.sleep(0.05)
                    elif scenario == "async-discovery":
                        await asyncio.sleep(0.05)
                return object()
            async def call_tool(self, name, arguments, *, run_middleware):
                assert not run_middleware
                calls.append(arguments["label"])
                return ok(arguments["label"])
        release = None
        if scenario == "acquisition":
            await policy.lock.acquire()
            async def release_later():
                await asyncio.sleep(0.06)
                policy.lock.release()
            release = asyncio.create_task(release_later())
        try:
            await asyncio.wait_for(policy.recover(Proxy()), 3)
            assert calls == ["later"], (scenario, calls)
            assert policy.journal.get(first)["state"] == "expired", scenario
            assert policy.journal.get(second)["state"] == "completed", scenario
            assert policy.recovery_ready.is_set() and not policy.failed, scenario
        finally:
            if release:
                await release
            policy.journal.close()
`);
});

test("expiry cancellation and reconciliation persistence failures all stop mutation admission", async () => {
  await runCase(String.raw`
async def main():
    import sqlite3
    from types import SimpleNamespace
    for scenario in ("expired", "cancelled", "resolved"):
        policy = memory_proxy.WritePolicy(queue_timeout=0.02 if scenario == "expired" else 120)
        context = SimpleNamespace(message=SimpleNamespace(name="write_note", arguments={"label": scenario}))
        calls = []
        async def execute(context):
            calls.append(context.message.arguments["label"])
            return ok("executed")
        try:
            if scenario == "resolved":
                operation_id = policy.journal.enqueue("write_note", {}, 120, 10)
                policy.journal.transition(operation_id, "unknown")
                def fail_resolve(*args):
                    raise sqlite3.OperationalError("Simulated reconciliation persistence failure")
                policy.journal.resolve = fail_resolve
                action = policy.resolve(operation_id, "applied", "Verified target through MCP", True)
            else:
                transition = policy.journal.transition
                def fail_terminal(operation_id, state, result=None):
                    if state == scenario:
                        raise sqlite3.OperationalError(f"Simulated {scenario} persistence failure")
                    return transition(operation_id, state, result)
                policy.journal.transition = fail_terminal
                await policy.lock.acquire()
                action = asyncio.create_task(policy.on_call_tool(context, execute))
                await eventually(lambda: bool(policy.journal.queued()))
                if scenario == "cancelled":
                    action.cancel()
            try:
                await action
                raise AssertionError(f"{scenario} did not report persistence failure")
            except ToolError as cause:
                assert "JOURNAL_FAILURE:" in str(cause), cause
            assert policy.failed and policy.blocked, scenario
            if policy.lock.locked():
                policy.lock.release()
            try:
                await policy.on_call_tool(context, execute)
                raise AssertionError("Mutation admission continued after persistence failure")
            except ToolError as cause:
                assert "QUEUE_BLOCKED:" in str(cause), cause
            assert calls == [], calls
        finally:
            if policy.lock.locked():
                policy.lock.release()
            policy.journal.close()
`);
});

test("recovery payload and session DELETE journal read failures preserve fail-stop protection", async () => {
  await runCase(String.raw`
async def main():
    import sqlite3
    from types import SimpleNamespace
    for scenario in ("recovery", "delete"):
        policy = memory_proxy.WritePolicy()
        operation_id = policy.journal.enqueue("write_note", {"label": "must-not-run"}, 120, 10)
        calls = []
        try:
            if scenario == "recovery":
                policy.recovery_records = policy.journal.queued()
                policy.recovery_ready.clear()
                original = policy.journal.get
                def fail_get(*args):
                    raise sqlite3.OperationalError("Simulated recovery payload read failure")
                policy.journal.get = fail_get
                class Proxy:
                    async def get_tool(self, name):
                        return object()
                    async def call_tool(self, *args, **kwargs):
                        calls.append("dispatched")
                        return ok("unexpected")
                await policy.recover(Proxy())
                policy.journal.get = original
                assert policy.journal.get(operation_id)["state"] == "queued"
            else:
                def fail_unknown():
                    raise sqlite3.OperationalError("Simulated DELETE barrier read failure")
                policy.journal.unknown = fail_unknown
                sent = []
                async def app(scope, receive, send):
                    calls.append("session deleted")
                async def receive():
                    return {"type": "http.disconnect"}
                async def send(message):
                    sent.append(message)
                await memory_proxy.RequestPolicy(app, policy, 1024)(
                    {"type": "http", "path": "/mcp", "method": "DELETE"}, receive, send,
                )
                assert sent[0]["status"] == 503, sent
                assert b"JOURNAL_FAILURE:" in sent[1]["body"], sent
            assert policy.failed and policy.blocked, scenario
            assert calls == [], calls
            policy.journal.transition(operation_id, "unknown")
            try:
                await policy.resolve(operation_id, "not_applied", "Verified target through MCP", True)
                raise AssertionError("Reconciliation cleared a journal failure without restart")
            except ToolError as cause:
                assert "QUEUE_UNSAFE_RESOLUTION:" in str(cause), cause
            context = SimpleNamespace(message=SimpleNamespace(name="write_note", arguments={}))
            async def execute(context):
                calls.append("admitted")
                return ok("unexpected")
            try:
                await policy.on_call_tool(context, execute)
                raise AssertionError("Mutation admitted after journal read failure")
            except ToolError as cause:
                assert "QUEUE_BLOCKED:" in str(cause), cause
        finally:
            policy.journal.close()
`);
});

const receiptFixture = String.raw`
import hashlib
from fastmcp.server.middleware import MiddlewareContext
from mcp.types import CallToolRequestParams

class ReceiptBackend:
    def __init__(self):
        self.notes = {}
        self.failures = []
        self.dispatches = []
        self.accepted = []

    def seed(self, path, body="original", receipt=None, project="project-id"):
        content = "---\ntitle: " + path + "\n"
        if receipt:
            content += memory_proxy.RECEIPT + ": " + receipt + "\n"
        content += "---\n" + body
        note = {"title": path.removesuffix(".md"), "file_path": path, "permalink": path.removesuffix(".md"),
                "content": content, "frontmatter": {memory_proxy.RECEIPT: receipt} if receipt else {},
                "checksum": hashlib.sha256(content.encode()).hexdigest()}
        self.notes[(project, path)] = note
        return note

    async def get_tool(self, name):
        return object()

    async def call_tool(self, name, arguments, *, run_middleware=False):
        assert not run_middleware
        if name == "list_memory_projects":
            assert arguments == {"output_format": "json"}
            return ToolResult(content={"projects": [{"name": "project-name", "external_id": "project-id",
                                                     "is_default": True}]})
        project = arguments.get("project_id")
        identifier = arguments.get("identifier", arguments.get("title"))
        if name == "write_note":
            identifier = "/".join(filter(None, (arguments["directory"].strip("/"), arguments["title"] + ".md")))
        match = next((note for (owner, path), note in self.notes.items() if owner == project and
                      identifier in (path, note["title"], note["permalink"])), None)
        if name == "read_note":
            assert arguments["include_frontmatter"] and arguments["output_format"] == "json"
            return ToolResult(content=match or {"error": "NOTE_NOT_FOUND"})
        self.dispatches.append(dict(arguments))
        mode = self.failures.pop(0) if self.failures else "ok"
        if mode == "locked":
            return ToolResult(content="sqlite3.OperationalError: database is locked", is_error=True)
        if mode == "transport":
            raise OSError("Lost response before acceptance is known")
        if mode == "refused":
            return ToolResult(content={"error": "ACCESS_DENIED"}, is_error=True)
        if arguments.get("expected_checksum") is not None and (not match or arguments["expected_checksum"] != match["checksum"]):
            return ToolResult(content={"error": "NOTE_REVISION_CONFLICT"}, is_error=True)
        if name == "write_note" and match and arguments.get("overwrite") is False:
            return ToolResult(content={"error": "NOTE_ALREADY_EXISTS"}, is_error=True)
        path = match["file_path"] if match else arguments["directory"].strip("/") + "/" + arguments["title"] + ".md"
        receipt = arguments["metadata"][memory_proxy.RECEIPT]
        self.seed(path, arguments["content"], receipt, project)
        self.accepted.append(receipt)
        if mode == "accepted-lost":
            raise OSError("Lost response after DB acceptance")
        if mode == "partial":
            self.notes[(project, path)]["checksum"] = "stale-checksum"
            return ToolResult(content={"error": "EDIT_OUTCOME_UNKNOWN"}, is_error=True)
        return ToolResult(content={"file_path": path, "checksum": self.notes[(project, path)]["checksum"]})

async def receipt_call(policy, backend, name="edit_note", **overrides):
    arguments = {"project_id": "project-id", "identifier": "notes/a.md", "operation": "append", "content": "addition"}
    if name == "write_note":
        arguments = {"project_id": "project-id", "title": "notes/a", "directory": "notes", "content": "replacement"}
    arguments.update(overrides)
    context = MiddlewareContext(message=CallToolRequestParams(name=name, arguments=arguments))
    return await policy.on_call_tool(context, lambda forwarded: backend.call_tool(name, forwarded.message.arguments))
`;

test("accepted receipt settles a lost edit response without replay and preserves caller metadata", async () => {
  await runCase(receiptFixture + String.raw`
async def main():
    policy = memory_proxy.WritePolicy()
    backend = ReceiptBackend()
    backend.seed("notes/a.md")
    policy.proxy = backend
    backend.failures = ["accepted-lost"]
    try:
        result = await receipt_call(policy, backend, metadata={"custom": "kept"})
        assert not result.is_error, result
        operation = policy.journal.status()["operations"][0]
        saved = policy.journal.status(operation["operation_id"])["operations"][0]
        assert saved["state"] == "resolved_applied"
        assert saved["resolution"]["automatic"] is True
        assert len(backend.dispatches) == len(backend.accepted) == 1
        assert backend.dispatches[0]["metadata"]["custom"] == "kept"
        assert saved["arguments"]["metadata"] == {"custom": "kept"}
        assert backend.dispatches[0]["expected_checksum"]
        assert not policy.blocked
    finally:
        policy.journal.close()
`);
});

test("guarded retries retain the original revision and never erase an earlier worker's uncertainty", async () => {
  await runCase(receiptFixture + String.raw`
async def main():
    for failures, state in ((["locked"], "completed"), (["locked"] * 3, "resolved_not_applied"),
                            (["transport", "refused"], "unknown")):
        policy = memory_proxy.WritePolicy()
        policy.retry_delays = (0, 0)
        backend = ReceiptBackend()
        original = backend.seed("notes/a.md")
        policy.proxy = backend
        backend.failures = failures.copy()
        try:
            result = await receipt_call(policy, backend)
            assert result.is_error == (state != "completed"), result
            assert policy.journal.status()["operations"][0]["state"] == state
            assert all(item["expected_checksum"] == original["checksum"] for item in backend.dispatches)
            assert len(backend.dispatches) == (3 if state == "resolved_not_applied" else 2)
            assert len(backend.accepted) == (1 if state == "completed" else 0)
            assert policy.blocked == (state == "unknown")
        finally:
            policy.journal.close()
`);
});

test("partial accepted state blocks only its canonical note and aliases while other notes proceed", async () => {
  await runCase(receiptFixture + String.raw`
async def main():
    policy = memory_proxy.WritePolicy()
    policy.retry_delays = ()
    backend = ReceiptBackend()
    backend.seed("notes/a.md")
    backend.seed("notes/b.md")
    policy.proxy = backend
    backend.failures = ["transport"]
    try:
        unknown = await receipt_call(policy, backend)
        assert unknown.is_error and policy.blocked
        blocked = await receipt_call(policy, backend, identifier="notes/a", project_id=None, project="project-name")
        assert blocked.is_error and "QUEUE_BLOCKED:" in text(blocked)
        other = await receipt_call(policy, backend, identifier="notes/b.md")
        assert not other.is_error, other
        assert len(backend.dispatches) == 2
        row = policy.journal.status()["operations"][0]
        receipt = row["operation_id"]
        partial = backend.seed("notes/a.md", "accepted", receipt)
        partial["checksum"] = "stale"
        assert await policy.reconcile(receipt, json.loads(policy.journal.get(receipt)["reconciliation"])) is None
        assert policy.journal.get(receipt)["state"] == "unknown"
        backend.seed("notes/a.md", "accepted", receipt)
        async with policy.mutation(allow_blocked=True):
            settled = await policy.reconcile(receipt, json.loads(policy.journal.get(receipt)["reconciliation"]))
        assert settled and not settled.is_error and not policy.blocked
    finally:
        policy.journal.close()
`);
});

test("restarted receipt recovery settles acceptance without replay or refreshing the original checksum", async () => {
  await runCase(receiptFixture + String.raw`
async def main():
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "queue.sqlite3"
        backend = ReceiptBackend()
        original = backend.seed("notes/a.md")
        first = memory_proxy.WritePolicy(journal_path=path)
        first.proxy = backend
        operation = first.journal.enqueue("edit_note", {"identifier": "notes/a.md", "project_id": "project-id",
                                             "operation": "append", "content": "once"}, 300, 10)
        guard = await first.prepare(operation, "edit_note", json.loads(first.journal.get(operation)["arguments"]))
        first.journal.transition(operation, "dispatched")
        backend.seed("notes/a.md", "once", operation)
        first.journal.close()
        recovered = memory_proxy.WritePolicy(journal_path=path)
        try:
            await recovered.recover(backend)
            assert recovered.journal.get(operation)["state"] == "resolved_applied"
            assert backend.dispatches == []
            assert recovered.journal.status(operation)["operations"][0]["reconciliation"]["checksum"] == original["checksum"]
            assert recovered.recovery_ready.is_set() and not recovered.failed
        finally:
            recovered.journal.close()
`);
});

test("no-overwrite creates retry returned lock refusals but lost workers and missing edits remain conservative", async () => {
  await runCase(receiptFixture + String.raw`
async def main():
    for name, options, failure, retry_safe in (
        ("write_note", {"title": "new", "overwrite": False}, "locked", True),
        ("write_note", {"title": "new", "overwrite": False}, "transport", False),
        ("write_note", {"title": "new"}, "transport", False),
        ("edit_note", {"identifier": "notes/missing.md"}, "transport", False),
    ):
        policy = memory_proxy.WritePolicy()
        policy.retry_delays = (0, 0)
        backend = ReceiptBackend()
        policy.proxy = backend
        backend.failures = [failure]
        try:
            result = await receipt_call(policy, backend, name, **options)
            saved = policy.journal.status()["operations"][0]
            assert (not result.is_error) == retry_safe, result
            assert saved["state"] == ("completed" if retry_safe else "unknown")
            assert len(backend.dispatches) == (2 if retry_safe else 1)
            if name == "write_note" and "overwrite" not in options:
                assert "overwrite" not in backend.dispatches[0]
        finally:
            policy.journal.close()
`);
});

test("write targeting never turns a fuzzy title match into a different note's checksum guard", async () => {
  await runCase(receiptFixture + String.raw`
async def main():
    policy = memory_proxy.WritePolicy()
    policy.retry_delays = (0, 0)
    backend = ReceiptBackend()
    backend.seed("notes/renamed.md")["title"] = "Human Title"
    original = backend.seed("notes/a.md")
    policy.proxy = backend
    try:
        created = await receipt_call(policy, backend, "write_note", title="Human Title", overwrite=True)
        assert not created.is_error, created
        assert backend.dispatches[0].get("expected_checksum") is None
        assert ("project-id", "notes/Human Title.md") in backend.notes
        backend.failures = ["transport"]
        replaced = await receipt_call(policy, backend, "write_note", title="a", overwrite=True)
        assert not replaced.is_error, replaced
        assert len(backend.dispatches) == 3
        assert all(item["expected_checksum"] == original["checksum"] for item in backend.dispatches[1:])
        refused = await receipt_call(policy, backend, "write_note", title="a", overwrite=True,
                                     expected_checksum=original["checksum"])
        assert refused.is_error
        assert backend.dispatches[-1]["expected_checksum"] == original["checksum"]
        assert len(backend.accepted) == 2
    finally:
        policy.journal.close()
`);
});

test("implicit edit project routes retain native routing instead of being rebound to the default", async () => {
  await runCase(receiptFixture + String.raw`
async def main():
    for identifier in ("memory://other-project/notes/a", "workspace/project/a"):
        policy = memory_proxy.WritePolicy()
        backend = ReceiptBackend()
        async def routed(name, arguments, *, run_middleware=False):
            assert name == "edit_note", "Implicit project routes must not be read in a guessed default project"
            assert arguments.get("project_id") is None
            assert "metadata" not in arguments and arguments["identifier"] == identifier
            return ToolResult(content="Native route preserved")
        backend.call_tool = routed
        policy.proxy = backend
        try:
            result = await receipt_call(policy, backend, identifier=identifier, project_id=None)
            assert not result.is_error, result
            assert policy.journal.status()["operations"][0]["state"] == "completed"
        finally:
            policy.journal.close()
`);
});

test("a late original acceptance races a guarded retry without applying an append twice", async () => {
  await runCase(receiptFixture + String.raw`
async def main():
    policy = memory_proxy.WritePolicy()
    policy.retry_delays = (0, 0)
    backend = ReceiptBackend()
    backend.seed("notes/a.md")
    policy.proxy = backend
    dispatch = backend.call_tool
    original = None
    attempts = 0
    async def delayed(name, arguments, *, run_middleware=False):
        nonlocal original, attempts
        if name != "edit_note":
            return await dispatch(name, arguments, run_middleware=run_middleware)
        attempts += 1
        if attempts == 1:
            original = dict(arguments)
            raise OSError("Frontend response lost while original worker continues")
        if attempts == 2:
            await dispatch(name, original)
        return await dispatch(name, arguments)
    backend.call_tool = delayed
    try:
        result = await receipt_call(policy, backend)
        assert not result.is_error, result
        assert len(backend.accepted) == 1
        assert attempts == 2
        assert backend.dispatches[0]["expected_checksum"] == backend.dispatches[1]["expected_checksum"]
        assert policy.journal.status()["operations"][0]["state"] == "resolved_applied"
    finally:
        policy.journal.close()
`);
});

test("a timed-out worker is not classified not applied from an unchanged read and later readback settles it", async () => {
  await runCase(receiptFixture + String.raw`
async def main():
    policy = memory_proxy.WritePolicy(write_timeout=0.02)
    backend = ReceiptBackend()
    backend.seed("notes/a.md")
    policy.proxy = backend
    release = asyncio.Event()
    late = None
    dispatch = backend.call_tool
    async def delayed(name, arguments, *, run_middleware=False):
        nonlocal late
        if name != "edit_note":
            return await dispatch(name, arguments, run_middleware=run_middleware)
        async def original():
            await release.wait()
            return await dispatch(name, arguments)
        late = asyncio.create_task(original())
        return await asyncio.shield(late)
    backend.call_tool = delayed
    try:
        result = await receipt_call(policy, backend)
        assert result.is_error and policy.blocked
        row = policy.journal.status()["operations"][0]
        guard = json.loads(policy.journal.get(row["operation_id"])["reconciliation"])
        assert guard["response_lost"] is True
        assert row["state"] == "unknown"
        release.set()
        await late
        settled = await policy.reconcile(row["operation_id"], guard)
        assert settled and not settled.is_error and not policy.blocked
        assert len(backend.accepted) == 1
    finally:
        release.set()
        if late:
            await late
        policy.journal.close()
`);
});

test("receipt preparation failures stop before dispatch and preserve journal fail-stop", async () => {
  await runCase(receiptFixture + String.raw`
async def main():
    import sqlite3
    for mode in ("partial", "persistence", "reserved"):
        policy = memory_proxy.WritePolicy()
        backend = ReceiptBackend()
        note = backend.seed("notes/a.md")
        policy.proxy = backend
        if mode == "partial":
            note["checksum"] = "stale"
        elif mode == "persistence":
            def fail_prepare(*args):
                raise sqlite3.OperationalError("Simulated receipt persistence failure")
            policy.journal.prepare = fail_prepare
        try:
            try:
                result = await receipt_call(policy, backend, **({"metadata": {memory_proxy.RECEIPT: "forged"}} if mode == "reserved" else {}))
                assert result.is_error, (mode, result)
            except ToolError as cause:
                assert mode == "persistence" and "JOURNAL_FAILURE:" in str(cause), cause
            assert backend.dispatches == []
            assert policy.failed == (mode == "persistence")
        finally:
            policy.journal.close()
`);
});

test("recovered preparation deadlines and target readback failures do not quarantine unrelated notes", async () => {
  await runCase(receiptFixture + String.raw`
async def main():
    for mode in ("partial", "deadline", "readback"):
        policy = memory_proxy.WritePolicy()
        policy.retry_delays = (0, 0)
        backend = ReceiptBackend()
        backend.seed("notes/a.md")
        backend.seed("notes/b.md")
        first = policy.journal.enqueue("edit_note", {"project_id": "project-id", "identifier": "notes/a.md",
                                                   "operation": "append", "content": "first"}, 300, 10)
        second = policy.journal.enqueue("edit_note", {"project_id": "project-id", "identifier": "notes/b.md",
                                                    "operation": "append", "content": "second"}, 300, 10)
        if mode == "partial":
            backend.notes[("project-id", "notes/a.md")]["checksum"] = "unmaterialized"
        elif mode == "deadline":
            policy.journal.connection.execute("UPDATE writes SET deadline = ? WHERE operation_id = ?", (time.time() + 0.1, first))
            policy.journal.connection.commit()
            dispatch = backend.call_tool
            async def delayed(name, arguments, *, run_middleware=False):
                if name == "read_note" and arguments["identifier"] == "notes/a.md":
                    await asyncio.Event().wait()
                return await dispatch(name, arguments, run_middleware=run_middleware)
            backend.call_tool = delayed
        else:
            backend.failures = ["locked"] * 3
            dispatch = backend.call_tool
            final_reads = 0
            async def missing_readback(name, arguments, *, run_middleware=False):
                nonlocal final_reads
                if name == "read_note" and arguments["identifier"] == "notes/a.md" and len(backend.dispatches) == 3:
                    final_reads += 1
                    if final_reads == 2:
                        raise OSError("Temporary final lock readback failure")
                return await dispatch(name, arguments, run_middleware=run_middleware)
            backend.call_tool = missing_readback
        policy.recovery_records = policy.journal.queued()
        policy.recovery_ready.clear()
        try:
            await policy.recover(backend)
            assert policy.recovery_ready.is_set() and not policy.failed
            assert policy.journal.get(first)["state"] == {"partial": "rejected", "deadline": "expired", "readback": "unknown"}[mode]
            assert policy.journal.get(second)["state"] == "completed"
            assert len(backend.dispatches) == (4 if mode == "readback" else 1)
        finally:
            policy.journal.close()
`);
});

test("framework proxy forwards prepared receipts and revision guards over MCP", async () => {
  await runCase(receiptFixture + String.raw`
async def main():
    backend = ReceiptBackend()
    backend.seed("notes/a.md")
    server = FastMCP("receipt-wire-fixture")
    @server.tool
    async def read_note(identifier: str, project_id: str, output_format: str, include_frontmatter: bool) -> str | dict:
        result = await backend.call_tool("read_note", locals())
        return memory_proxy.payload(result)
    @server.tool
    async def edit_note(identifier: str, project_id: str, content: str, operation: str,
                        metadata: dict | None = None, expected_checksum: str | None = None) -> str | dict:
        try:
            result = await backend.call_tool("edit_note", locals())
        except OSError as cause:
            raise ToolError(json.dumps({"error": "EDIT_OUTCOME_UNKNOWN"})) from cause
        if result.is_error:
            raise ToolError(text(result))
        return memory_proxy.payload(result)
    policy = memory_proxy.WritePolicy()
    async with serve(server.http_app(path="/mcp")) as upstream:
        async with serve(memory_proxy.create_app(upstream, policy)) as gateway:
            async with Client(gateway, mode="legacy") as client:
                result = await client.call_tool("edit_note", {"identifier": "notes/a.md", "project_id": "project-id",
                                                             "operation": "append", "content": "wire"})
                assert not result.is_error, result
                assert len(backend.accepted) == 1
                assert backend.dispatches[0]["expected_checksum"]
                assert backend.dispatches[0]["metadata"][memory_proxy.RECEIPT] == backend.accepted[0]
                backend.failures = ["accepted-lost"]
                recovered = await client.call_tool("edit_note", {"identifier": "notes/a.md", "project_id": "project-id",
                                                                "operation": "append", "content": "wire lost"})
                assert not recovered.is_error, recovered
                assert len(backend.accepted) == len(backend.dispatches) == 2
                assert policy.journal.status()["operations"][-1]["state"] == "resolved_applied"
`);
});
