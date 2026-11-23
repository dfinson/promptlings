import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { createMemoryProxy } from "../lib/memory-proxy.mjs";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fixture(t, handler, options = {}) {
  const backend = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString("utf8");
    await handler(request, response, text ? JSON.parse(text) : null);
  });
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const proxy = createMemoryProxy({ backendPort: backend.address().port, ...options });
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  t.after(async () => {
    proxy.closeAllConnections();
    backend.closeAllConnections();
    await Promise.all([new Promise((resolve) => proxy.close(resolve)), new Promise((resolve) => backend.close(resolve))]);
  });
  const url = `http://127.0.0.1:${proxy.address().port}/mcp`;
  const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "mcp-session-id": "session-1" };
  return {
    url, headers,
    post: (message, extra = {}) => fetch(url, { method: "POST", headers, body: JSON.stringify(message), ...extra }),
  };
}
const tool = (id, name) => ({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: {} } });
function reply(response, message, result = {}) {
  response.writeHead(200, { "Content-Type": "application/json", "mcp-session-id": "session-1" });
  response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
}

test("FIFO spans sessions and unknown mutations while reads bypass the write queue", async (t) => {
  const order = [];
  let active = 0;
  let maximum = 0;
  let unblock;
  const first = new Promise((resolve) => { unblock = resolve; });
  let seen;
  const started = new Promise((resolve) => { seen = resolve; });
  const f = await fixture(t, async (request, response, message) => {
    if (message.params.name === "read_note") { reply(response, message); return; }
    active++;
    maximum = Math.max(maximum, active);
    order.push(message.id);
    if (message.id === 1) { seen(); await first; }
    active--;
    reply(response, message);
  });
  const a = f.post(tool(1, "write_note"));
  await started;
  const b = f.post(tool(2, "edit_note"));
  await pause(10);
  const c = f.post(tool(3, "future_mutation"), { headers: { ...f.headers, "mcp-session-id": "session-2" } });
  const read = await f.post(tool(4, "read_note"));
  assert.equal(read.status, 200);
  assert.deepEqual(order, [1]);
  unblock();
  await Promise.all([a, b, c].map(async (promise) => (await promise).text()));
  assert.deepEqual(order, [1, 2, 3]);
  assert.equal(maximum, 1);
});

test("SSE, initialization/session headers, GET resumption and DELETE pass through", async (t) => {
  const seen = [];
  const f = await fixture(t, async (request, response, message) => {
    seen.push({ method: request.method, session: request.headers["mcp-session-id"],
      last: request.headers["last-event-id"], protocol: request.headers["mcp-protocol-version"] });
    response.writeHead(200, { "Content-Type": "text/event-stream", "mcp-session-id": "session-1" });
    response.write("id: resumed-event\nevent: message\ndata: ");
    await pause(10);
    response.end(JSON.stringify({ jsonrpc: "2.0", id: message?.id, result: { ok: true } }) + "\n\n");
  });
  const response = await f.post({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.equal(response.headers.get("mcp-session-id"), "session-1");
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  assert.match(await response.text(), /id: resumed-event\nevent: message\ndata:/);
  const resumed = await fetch(f.url, { headers: { ...f.headers, "last-event-id": "resumed-event", "mcp-protocol-version": "2025-03-26" } });
  await resumed.text();
  await (await fetch(f.url, { method: "DELETE", headers: f.headers })).text();
  assert.deepEqual(seen.map((item) => item.method), ["POST", "GET", "DELETE"]);
  assert.equal(seen[1].last, "resumed-event");
  assert.equal(seen[1].protocol, "2025-03-26");
  assert.ok(seen.every((item) => item.session === "session-1"));
});

test("accepted commit error is returned once without replay", async (t) => {
  let commits = 0;
  const f = await fixture(t, async (request, response, message) => {
    commits++;
    reply(response, message, { isError: true, content: [{ type: "text", text: "failed after accepted note commit" }] });
  });
  const result = await (await f.post(tool(1, "edit_note"))).json();
  assert.equal(result.result.isError, true);
  assert.equal(commits, 1);
});

test("unknown write outcome blocks subsequent writes but leaves reads available", async (t) => {
  let writes = 0;
  const f = await fixture(t, async (request, response, message) => {
    if (message.params.name === "read_note") { reply(response, message); return; }
    writes++;
    response.destroy();
  });
  assert.equal((await f.post(tool(1, "edit_note"))).status, 502);
  const waiting = await f.post(tool(2, "write_note"));
  assert.equal(waiting.status, 503);
  assert.equal((await waiting.json()).error.data.dispatched, false);
  assert.equal((await f.post(tool(3, "read_note"))).status, 200);
  assert.equal(writes, 1);
});

test("queue expiration is explicit and never dispatches the expired write", async (t) => {
  const received = [];
  let seen;
  const started = new Promise((resolve) => { seen = resolve; });
  const f = await fixture(t, async (request, response, message) => {
    received.push(message.id);
    seen();
    await pause(80);
    reply(response, message);
  }, { queueTimeoutMs: 20 });
  const first = f.post(tool(1, "write_note"));
  await started;
  const timedOut = await f.post(tool(2, "edit_note"));
  assert.equal(timedOut.status, 504);
  assert.equal((await timedOut.json()).error.data.dispatched, false);
  await (await first).text();
  assert.deepEqual(received, [1]);
});

test("disconnect and advisory cancellation cannot release an in-flight write early", async (t) => {
  let seen;
  let finish;
  const started = new Promise((resolve) => { seen = resolve; });
  const completed = new Promise((resolve) => { finish = resolve; });
  const received = [];
  const f = await fixture(t, async (request, response, message) => {
    received.push(message.id);
    if (message.id === 1) { seen(); await completed; }
    reply(response, message);
  });
  const controller = new AbortController();
  const first = f.post(tool(1, "edit_note"), { signal: controller.signal }).catch((cause) => cause);
  await started;
  controller.abort();
  const cancelled = await f.post({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 1 } });
  assert.equal(cancelled.status, 202);
  const next = f.post(tool(2, "write_note"));
  await pause(15);
  assert.deepEqual(received, [1]);
  finish();
  await first;
  await (await next).text();
  assert.deepEqual(received, [1, 2]);
});

test("malformed, batched, oversized and non-loopback requests fail before dispatch", async (t) => {
  let calls = 0;
  const f = await fixture(t, async (request, response, message) => { calls++; reply(response, message); }, { maxBodyBytes: 200 });
  for (const body of ["null", "{}", "[]", JSON.stringify([tool(1, "write_note")]), "{"]) {
    assert.equal((await fetch(f.url, { method: "POST", headers: f.headers, body })).status, 400);
  }
  assert.equal((await fetch(f.url, { method: "POST", headers: f.headers, body: " ".repeat(201) })).status, 413);
  assert.equal((await f.post(tool(1, "write_note"), { headers: { ...f.headers, Origin: "https://example.com" } })).status, 403);
  assert.equal(calls, 0);
});
