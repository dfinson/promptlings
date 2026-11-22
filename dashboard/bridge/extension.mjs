// Foreman bridge: carries requests from the Foreman dashboard page into this
// Copilot session. It stays dormant unless the session's agent is Foreman, adds
// no tools, hooks or canvases, and never writes to standard output.

import { joinSession } from "@github/copilot-sdk/extension";
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";

const base = join(homedir(), ".promptlings", "foreman");
const talkDir = join(base, "talk");
const statusDir = join(base, "status");
const infoFile = join(base, "dashboard.json");

const KEY = /^[a-z0-9.-]{1,200}$/;
const LANE_ID = /^[A-Za-z0-9._-]{1,120}$/;
const MAX_BODY = 4096;
const MAX_TEXT = 1000;
const REPEAT_MS = 15000;
const SEND_WAIT_MS = 5000;
const REMOVABLE = new Set(["superseded head", "PR merged, removable", "PR closed, removable"]);

const REQUESTS = {
  "refresh": { label: "Refresh all", display: () => "Dashboard: refresh all" },
  "refresh-lane": { label: "Refresh this lane", lane: true, display: (r) => `Dashboard: refresh lane ${r.lane}` },
  "recover-lane": { label: "Recover this lane", lane: true, display: (r) => `Dashboard: recover lane ${r.lane}` },
  "launch-lane": { label: "Launch this lane", lane: true, display: (r) => `Dashboard: launch lane ${r.lane}` },
  "review-new-head": { label: "Review the new head", lane: true, display: (r) => `Dashboard: review the new head of ${r.lane}` },
  "recheck-environment": { label: "Recheck environment", display: () => "Dashboard: recheck the environment" },
  "remove-worktree": { label: "Remove worktree", path: true, display: (r) => `Dashboard: remove worktree ${r.path}` },
  "ask": { label: "Ask Foreman", display: (r) => `Dashboard: ${r.text}` },
};

const session = await joinSession();
const talkFile = join(talkDir, `${String(session.sessionId).replace(/[^A-Za-z0-9._-]/g, "_")}.json`);

let cwd = process.cwd();
let server = null;
let port = 0;
let token = "";
let startedAt = "";
let switching = Promise.resolve();
const recent = new Map();

function note(message) {
  try { Promise.resolve(session.log(`Foreman bridge: ${message}`, { level: "warning", ephemeral: true })).catch(() => {}); } catch {}
}

function isForeman(name) {
  return typeof name === "string" && name.trim().toLowerCase() === "foreman";
}

async function agentIsForeman() {
  try {
    const current = await session.rpc.agent.getCurrent();
    return isForeman(current?.agent?.name);
  } catch {
    return false;
  }
}

async function readCwd() {
  try {
    const events = await session.getEvents();
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event.type === "session.context_changed" && event.data?.cwd) return event.data.cwd;
      if ((event.type === "session.start" || event.type === "session.resume") && event.data?.context?.cwd) return event.data.context.cwd;
    }
  } catch {}
  return process.cwd();
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
}

function writeTalk() {
  mkdirSync(talkDir, { recursive: true });
  const temporary = `${talkFile}.${process.pid}.tmp`;
  const body = { sessionId: session.sessionId, pid: process.pid, port, token, cwd: resolve(cwd), startedAt };
  writeFileSync(temporary, `${JSON.stringify(body, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, talkFile);
}

function removeTalk() {
  try {
    const talk = JSON.parse(readFileSync(talkFile, "utf8"));
    if (talk.pid === process.pid) unlinkSync(talkFile);
  } catch {}
}

function removeStaleTalk() {
  let names = [];
  try { names = readdirSync(talkDir).filter((name) => name.endsWith(".json")); } catch { return; }
  for (const name of names) {
    const path = join(talkDir, name);
    try {
      const talk = JSON.parse(readFileSync(path, "utf8"));
      if (!alive(talk.pid)) unlinkSync(path);
    } catch {}
  }
}

function dashboardOrigins() {
  try {
    const info = JSON.parse(readFileSync(infoFile, "utf8"));
    const origin = new URL(info.url);
    if (origin.hostname !== "127.0.0.1") return new Set();
    return new Set([origin.origin, `http://localhost:${origin.port}`]);
  } catch {
    return new Set();
  }
}

function reply(response, status, body, origin) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", Vary: "Origin" };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

function sameToken(value) {
  if (typeof value !== "string" || !token) return false;
  const given = Buffer.from(value);
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function readBody(request) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("The request is larger than 4 KB."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function readStatus(repo) {
  try {
    return JSON.parse(readFileSync(join(statusDir, `${repo}.json`), "utf8"));
  } catch {
    return null;
  }
}

function validate(body) {
  if (!body || typeof body !== "object") return "The request body must be a JSON object.";
  const spec = REQUESTS[body.request];
  if (!spec || !Object.hasOwn(REQUESTS, body.request)) return `Unknown request ${JSON.stringify(body.request)}.`;
  if (typeof body.repo !== "string" || !KEY.test(body.repo)) return "The repository key is not valid.";
  const status = readStatus(body.repo);
  if (!status) return `There is no readable status file for ${body.repo}.`;
  const lanes = Array.isArray(status.lanes) ? status.lanes : [];
  if (body.lane !== undefined && body.lane !== null) {
    if (typeof body.lane !== "string" || !LANE_ID.test(body.lane)) return "The lane id is not valid.";
    if (!lanes.some((lane) => lane && lane.id === body.lane)) return `The status file has no lane ${body.lane}.`;
  } else if (spec.lane) {
    return `${body.request} needs a lane.`;
  }
  if (spec.path) {
    const worktrees = Array.isArray(status.worktrees) ? status.worktrees : [];
    const match = worktrees.find((worktree) => worktree && worktree.path === body.path);
    if (typeof body.path !== "string" || !match) return "The status file has no such worktree.";
    if (!REMOVABLE.has(match.condition)) return "The status file does not label that worktree removable.";
  } else if (body.path !== undefined) {
    return `${body.request} takes no path.`;
  }
  if (body.request === "ask") {
    if (typeof body.text !== "string" || !body.text.trim()) return "Ask Foreman needs some words.";
    if (body.text.length > MAX_TEXT) return "Ask Foreman takes at most 1,000 characters.";
  } else if (body.text !== undefined) {
    return `${body.request} takes no text.`;
  }
  return "";
}

function compose(body) {
  const spec = REQUESTS[body.request];
  const lines = ["[Foreman dashboard request]", `request: ${body.request}`, `repo: ${body.repo}`];
  if (body.lane) lines.push(`lane: ${body.lane}`);
  if (body.path) lines.push(`path: ${body.path}`);
  if (body.request === "ask") {
    lines.push("The user wrote this in the Foreman dashboard's Ask Foreman box:");
    for (const line of body.text.trim().split(/\r?\n/)) lines.push(`> ${line}`);
  } else {
    lines.push(`The user pressed "${spec.label}" in the Foreman dashboard.`);
  }
  const display = spec.display({ ...body, text: body.text ? body.text.trim().replace(/\s+/g, " ") : "" });
  return { prompt: lines.join("\n"), displayPrompt: display };
}

async function handle(request, response) {
  const origin = request.headers.origin;
  const allowed = dashboardOrigins();
  if (origin !== undefined && !allowed.has(origin)) {
    reply(response, 403, { error: "This origin may not send requests to Foreman." });
    return;
  }
  const corsOrigin = origin || "";
  if (request.headers.host !== `127.0.0.1:${port}`) {
    reply(response, 403, { error: "Wrong host." }, corsOrigin);
    return;
  }
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "content-type, x-foreman-token",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    });
    response.end();
    return;
  }
  if (url.pathname !== "/request") {
    reply(response, 404, { error: "Not found." }, corsOrigin);
    return;
  }
  if (request.method !== "POST") {
    reply(response, 405, { error: "Use POST." }, corsOrigin);
    return;
  }
  if (!sameToken(request.headers["x-foreman-token"])) {
    reply(response, 403, { error: "Missing or wrong token." }, corsOrigin);
    return;
  }
  let body;
  try {
    body = JSON.parse(await readBody(request));
  } catch (error) {
    reply(response, 400, { error: error.message.includes("4 KB") ? error.message : "The request body is not valid JSON." }, corsOrigin);
    return;
  }
  if (!(await agentIsForeman())) {
    reply(response, 409, { error: "This session is no longer running Foreman" }, corsOrigin);
    return;
  }
  const problem = validate(body);
  if (problem) {
    reply(response, 400, { error: problem }, corsOrigin);
    return;
  }
  const now = Date.now();
  for (const [key, at] of recent) if (now - at > REPEAT_MS) recent.delete(key);
  const key = [body.request, body.repo, body.lane || "", body.path || "", body.text || ""].join("\u0000");
  if (recent.has(key)) {
    reply(response, 200, { sent: true, repeated: true, at: new Date(recent.get(key)).toISOString() }, corsOrigin);
    return;
  }
  recent.set(key, now);
  const message = compose(body);
  const sending = session.send({ prompt: message.prompt, displayPrompt: message.displayPrompt, mode: "immediate" });
  let timer;
  const waited = new Promise((resolveWait) => { timer = setTimeout(() => resolveWait("waiting"), SEND_WAIT_MS); });
  try {
    const outcome = await Promise.race([sending.then(() => "sent"), waited]);
    if (outcome === "sent") reply(response, 200, { sent: true, at: new Date(now).toISOString() }, corsOrigin);
    else reply(response, 202, { sent: false, waiting: true }, corsOrigin);
  } catch (error) {
    recent.delete(key);
    reply(response, 502, { error: error?.message || "Could not send to the Foreman session." }, corsOrigin);
  } finally {
    clearTimeout(timer);
  }
  sending.catch((error) => note(`a dashboard request failed to send: ${error?.message || error}`));
}

async function activate() {
  if (server) return;
  const created = createServer((request, response) => {
    handle(request, response).catch((error) => {
      try { reply(response, 500, { error: error?.message || "Bridge error." }); } catch {}
    });
  });
  await new Promise((resolveListen, reject) => {
    created.once("error", reject);
    created.listen(0, "127.0.0.1", resolveListen);
  });
  server = created;
  port = created.address().port;
  token = randomBytes(16).toString("hex");
  startedAt = new Date().toISOString();
  removeStaleTalk();
  writeTalk();
}

async function deactivate() {
  removeTalk();
  const closing = server;
  server = null;
  port = 0;
  token = "";
  recent.clear();
  if (closing) await new Promise((resolveClose) => closing.close(() => resolveClose()));
}

function update(active) {
  switching = switching.then(() => (active ? activate() : deactivate())).catch((error) => note(error?.message || String(error)));
  return switching;
}

session.on("subagent.selected", (event) => { update(isForeman(event.data?.agentName)); });
session.on("subagent.deselected", () => { update(false); });
session.on("session.context_changed", (event) => {
  if (!event.data?.cwd) return;
  cwd = event.data.cwd;
  if (server) {
    try { writeTalk(); } catch (error) { note(error.message); }
  }
});
session.on("session.shutdown", () => { update(false); });
process.on("exit", removeTalk);
for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]) {
  try { process.on(signal, () => { removeTalk(); process.exit(0); }); } catch {}
}

cwd = await readCwd();
if (await agentIsForeman()) await update(true);
