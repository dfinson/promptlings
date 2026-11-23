import { createServer, request } from "node:http";
import { StringDecoder } from "node:string_decoder";

// Derived from basic-memory 0.24.1 MCP tool annotations. Unknown tools serialize.
export const mutatingTools = [
  "write_note", "edit_note", "move_note", "delete_note", "create_memory_project", "delete_project",
];
const readTools = new Set([
  "basic_memory_diagnostics", "build_context", "search", "fetch", "list_directory",
  "cat", "grep", "ls", "find", "tail", "man", "list_memory_projects", "read_content",
  "read_note", "recent_activity", "schema_validate", "schema_infer", "schema_diff",
  "search_notes", "search_notes_ui", "read_note_ui", "view_note", "list_workspaces",
]);
const hopHeaders = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade"]);
function headers(source) {
  const excluded = new Set([...hopHeaders, ...(source.connection || "").toLowerCase().split(",").map((s) => s.trim())]);
  return Object.fromEntries(Object.entries(source).filter(([key]) => !excluded.has(key.toLowerCase())));
}
function error(response, id, status, code, message, data) {
  if (response.destroyed || response.writableEnded) return;
  if (response.headersSent) { response.destroy(); return; }
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message, data } }));
}

function outcomeObserver() {
  const decoder = new StringDecoder("utf8");
  let quoted = false;
  let escaped = false;
  let unicode = null;
  let text = "";
  let literal = "";
  let errorValue = false;
  let toolError = false;
  let unknown = false;
  const character = (value) => {
    text = (text + value).slice(-256);
    if (text.includes("EDIT_OUTCOME_UNKNOWN") || text.includes("# Edit Outcome Unknown")) unknown = true;
  };
  const scan = (chunk) => {
    for (const value of chunk) {
      if (quoted) {
        if (unicode !== null) {
          unicode += value;
          if (unicode.length === 4) { character(String.fromCharCode(parseInt(unicode, 16))); unicode = null; }
        } else if (escaped) {
          escaped = false;
          if (value === "u") unicode = "";
          else character(({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" })[value] ?? value);
        } else if (value === "\\") escaped = true;
        else if (value === '"') { quoted = false; errorValue = text === "isError"; }
        else character(value);
      } else if (value === '"') {
        quoted = true;
        text = "";
        literal = "";
      } else if (errorValue) {
        if (value === ":" || /\s/.test(value)) continue;
        if (/[a-z]/.test(value)) literal += value;
        else {
          if (literal === "true") toolError = true;
          errorValue = false;
          literal = "";
        }
      }
    }
  };
  return {
    write: (chunk) => scan(decoder.write(chunk)),
    end: () => { scan(decoder.end()); return unknown && toolError; },
  };
}

export function createMemoryProxy({
  backendPort = 8000, queueTimeoutMs = 120_000, writeTimeoutMs = 600_000,
  maxBodyBytes = 64 * 1024 * 1024, maxQueue = 1000, log = console.error,
} = {}) {
  const queue = [];
  let active = null;
  let blocked = false;
  function rejectWaiting() {
    for (const job of queue.splice(0)) {
      clearTimeout(job.timer);
      error(job.response, job.id, 503, -32002, "Write outcome unknown. Inspect the target and restart the managed server before further writes.",
        { dispatched: false });
    }
  }
  function dispatch(job) {
    active = job;
    clearTimeout(job.timer);
    forward(job, true);
  }
  function finish(job, uncertain) {
    if (active !== job) return;
    active = null;
    if (uncertain) {
      blocked = true;
      log("Basic Memory write outcome unknown. Write queue blocked until managed server restart. Never replay the request.");
      rejectWaiting();
    } else if (queue.length) dispatch(queue.shift());
  }
  function enqueue(job) {
    if (blocked) {
      error(job.response, job.id, 503, -32002, "Write queue blocked after an unknown outcome. Inspect the target and restart the managed server.",
        { dispatched: false });
    } else if (!active) dispatch(job);
    else if (queue.length >= maxQueue) {
      error(job.response, job.id, 503, -32003, "Basic Memory write queue is full. Request was not dispatched.", { dispatched: false });
    } else {
      job.timer = setTimeout(() => {
        const index = queue.indexOf(job);
        if (index < 0) return;
        queue.splice(index, 1);
        log(`Basic Memory write queue timeout after ${queueTimeoutMs}ms. Request was not dispatched.`);
        error(job.response, job.id, 504, -32001, "Basic Memory write queue wait timed out. Request was not dispatched.", { dispatched: false });
      }, queueTimeoutMs);
      queue.push(job);
    }
  }
  function forward(job, write) {
    const { incoming, response, body } = job;
    let settled = false;
    let timer;
    const settle = (uncertain) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (write) finish(job, uncertain);
    };
    const upstream = request({
      host: "127.0.0.1", port: backendPort, method: incoming.method, path: incoming.url,
      headers: { ...headers(incoming.headers), host: `127.0.0.1:${backendPort}` },
    }, (reply) => {
      const outcome = write ? outcomeObserver() : null;
      if (!response.destroyed && !response.writableEnded) response.writeHead(reply.statusCode, headers(reply.headers));
      // Drain disconnected clients' writes to completion instead of cancelling or replaying them.
      reply.on("data", (chunk) => {
        outcome?.write(chunk);
        if (!response.destroyed && !response.writableEnded && !response.write(chunk)) {
          reply.pause();
          response.once("drain", () => reply.resume());
        }
      });
      response.once("close", () => reply.resume());
      reply.on("end", () => {
        if (!response.destroyed && !response.writableEnded) response.end();
        // HTTP rejection is not evidence that a tool failed before committing.
        settle(write && (reply.statusCode >= 500 || outcome.end()));
      });
      reply.on("error", (cause) => {
        log(`Basic Memory upstream response failed: ${cause.message}`);
        error(response, job.id, 502, -32002, "Basic Memory response failed. Write outcome may be unknown. Do not replay.", { dispatched: true });
        settle(write);
      });
    });
    upstream.on("error", (cause) => {
      log(`Basic Memory upstream request failed: ${cause.message}`);
      error(response, job.id, 502, -32002, "Basic Memory transport failed. Inspect the target before retrying any write.", { dispatched: true });
      settle(write);
    });
    if (write) timer = setTimeout(() => {
      log(`Basic Memory write exceeded ${writeTimeoutMs}ms. Outcome unknown.`);
      error(response, job.id, 504, -32002, "Basic Memory write response timed out. Outcome unknown. Do not replay.", { dispatched: true });
      settle(true);
      upstream.destroy();
    }, writeTimeoutMs);
    if (!write) response.once("close", () => { if (!response.writableFinished) upstream.destroy(); });
    upstream.end(body);
  }
  const server = createServer(async (incoming, response) => {
    if (!["/mcp", "/mcp/"].includes(incoming.url)) {
      error(response, null, 404, -32600, "Only the MCP endpoint is exposed.");
      return;
    }
    const host = incoming.headers.host || "";
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
      error(response, null, 403, -32600, "Loopback Host required.");
      return;
    }
    if (incoming.headers.origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(incoming.headers.origin)) {
      error(response, null, 403, -32600, "Loopback Origin required.");
      return;
    }
    let body;
    let message;
    if (incoming.method === "POST") {
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of incoming) {
          size += chunk.length;
          if (size > maxBodyBytes) {
            error(response, null, 413, -32600, "MCP request exceeds the 64 MiB proxy body limit. Request was not dispatched.");
            return;
          }
          chunks.push(chunk);
        }
        body = Buffer.concat(chunks);
        message = JSON.parse(body.toString("utf8"));
      } catch (cause) {
        error(response, null, 400, -32700, `Invalid MCP JSON: ${cause.message}`);
        return;
      }
      if (!message || Array.isArray(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
        error(response, message?.id, 400, -32600, "A single JSON-RPC 2.0 MCP request is required. Batches are unsupported.");
        return;
      }
      // Cancellation is advisory. Do not interrupt a write whose commit outcome is unknown.
      if (message.method === "notifications/cancelled" && [active, ...queue].some((job) =>
        job && job.id === message.params?.requestId &&
        job.incoming.headers["mcp-session-id"] === incoming.headers["mcp-session-id"])) {
        log("Ignored advisory cancellation of a queued or active Basic Memory write.");
        response.writeHead(202);
        response.end();
        return;
      }
    }
    const job = { incoming, response, body, id: message?.id };
    if (message?.method === "tools/call" &&
      !(typeof message.id === "string" || (typeof message.id === "number" && Number.isFinite(message.id)))) {
      error(response, null, 400, -32600, "Tool calls require a request ID. Notifications cannot dispatch tools.");
      return;
    }
    // Session deletion must not race an active mutation in that session.
    if (incoming.method === "DELETE" ||
      (message?.method === "tools/call" && !readTools.has(message.params?.name))) enqueue(job);
    else forward(job, false);
  });
  server.requestTimeout = 120_000;
  server.on("close", () => {
    blocked = true;
    rejectWaiting();
  });
  return server;
}
