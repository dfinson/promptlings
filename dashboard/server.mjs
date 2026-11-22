#!/usr/bin/env node
// Foreman dashboard server: shows ~/.promptlings/foreman/status/*.json on one local page.
// Node built-ins only. Listens on 127.0.0.1, answers GET only, starts no child processes,
// and connects out only to probe Foreman bridge ports on 127.0.0.1.

import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { connect } from "node:net";
import { readFileSync, mkdirSync, chmodSync, readdirSync, statSync, writeFileSync, renameSync, unlinkSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SERVICE = "promptlings-foreman-dashboard";
const SCHEMA = 1;
const MAX_FILE = 1024 * 1024;
const KEY = /^[a-z0-9.-]{1,200}$/;
const LANE_ID = /^[A-Za-z0-9._-]{1,120}$/;

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "public");
const base = join(homedir(), ".promptlings", "foreman");
const statusDir = join(base, "status");
const talkDir = join(base, "talk");
const infoFile = join(base, "dashboard.json");
const logFile = join(base, "dashboard.log");

function readVersion() {
  for (const candidate of [join(here, "version.json"), join(here, "..", "package.json")]) {
    try {
      const version = JSON.parse(readFileSync(candidate, "utf8")).version;
      if (typeof version === "string" && version) return version;
    } catch {}
  }
  return "0.0.0";
}

function parsePort(argv) {
  const index = argv.indexOf("--port");
  if (index === -1) return 4747;
  const value = Number(argv[index + 1]);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    console.error("--port needs a whole number from 1 to 65535.");
    process.exit(2);
  }
  return value;
}

const version = readVersion();
const port = parsePort(process.argv.slice(2));
const startedAt = new Date().toISOString();
const url = `http://127.0.0.1:${port}`;
const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

// Status, talk files and dashboard.json stay readable only by this OS user where the platform supports modes.
mkdirSync(base, { recursive: true, mode: 0o700 });
try { chmodSync(base, 0o700); } catch {}
mkdirSync(statusDir, { recursive: true });
mkdirSync(talkDir, { recursive: true });

// The page key keeps the API, and with it the bridge token, readable only by this OS user. It is new on
// every start and written only to dashboard.json, so a key read by a page that squatted the port while the
// dashboard was down is useless once this server listens. `/health` returns `instance` only to a request
// carrying the current key, so a listener that copied it earlier cannot pass Foreman's ownership check.
const pageKey = Buffer.from(randomBytes(32).toString("hex"));
const instance = randomBytes(16).toString("hex");
const page = `${url}/#key=${pageKey}`;

function authorized(request, target) {
  const given = Buffer.from(String(request.headers["x-foreman-key"] || target.searchParams.get("key") || ""));
  return given.length === pageKey.length && timingSafeEqual(given, pageKey);
}

function log(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  try { appendFileSync(logFile, line); } catch {}
  if (process.stdout.isTTY) process.stdout.write(line);
}

// Status files, keyed by repository key.
const repos = new Map();
let talkSignature = null;
const clients = new Set();

function readStatus(name) {
  const key = name.slice(0, -5);
  const path = join(statusDir, name);
  let stat;
  try { stat = statSync(path); } catch { return null; }
  if (!stat.isFile()) return null;
  const signature = `${stat.mtimeMs}:${stat.size}`;
  const previous = repos.get(key);
  if (previous && previous.signature === signature) return previous;
  const entry = { key, signature };
  if (stat.size > MAX_FILE) {
    entry.status = "error";
    entry.error = `The file is larger than 1 MB (${stat.size.toLocaleString("en-US")} bytes).`;
    return entry;
  }
  try {
    const file = JSON.parse(readFileSync(path, "utf8"));
    if (!file || typeof file !== "object" || Array.isArray(file)) throw new Error("The file is not a JSON object.");
    if (Number.isInteger(file.schema) && file.schema > SCHEMA) {
      entry.status = "newer";
      entry.schema = file.schema;
    } else if (file.schema !== SCHEMA) {
      throw new Error(`The file has no supported schema (found ${JSON.stringify(file.schema ?? null)}).`);
    } else {
      entry.status = "ok";
      entry.file = file;
    }
  } catch (error) {
    entry.status = "error";
    entry.error = error.message;
  }
  return entry;
}

function scan() {
  let changed = false;
  let names = [];
  try { names = readdirSync(statusDir).filter((name) => name.endsWith(".json") && KEY.test(name.slice(0, -5))); } catch {}
  const seen = new Set();
  for (const name of names) {
    const entry = readStatus(name);
    if (!entry) continue;
    seen.add(entry.key);
    if (repos.get(entry.key) !== entry) {
      repos.set(entry.key, entry);
      changed = true;
    }
  }
  for (const key of [...repos.keys()]) {
    if (!seen.has(key)) {
      repos.delete(key);
      changed = true;
    }
  }
  if (changed) broadcast("state");

  let talk = "";
  try {
    talk = readdirSync(talkDir).filter((name) => name.endsWith(".json")).sort().map((name) => {
      try { const stat = statSync(join(talkDir, name)); return `${name}:${stat.mtimeMs}:${stat.size}`; } catch { return name; }
    }).join("|");
  } catch {}
  if (talk !== talkSignature) {
    const first = talkSignature === null;
    talkSignature = talk;
    if (!first) broadcast("talk");
  }
}

function broadcast(event) {
  for (const response of clients) response.write(`event: ${event}\ndata: {}\n\n`);
}

// The summary leaves out what only the lane detail shows.
function summarizeLane(lane) {
  if (!lane || typeof lane !== "object") return lane;
  const copy = { ...lane };
  if (lane.checkpoint && typeof lane.checkpoint === "object") {
    const { sections, ...rest } = lane.checkpoint;
    copy.checkpoint = rest;
    if (sections && typeof sections === "object" && typeof sections.next === "string") copy.checkpoint.next = sections.next;
  }
  if (lane.git && typeof lane.git === "object") {
    const { commits, paths, ...rest } = lane.git;
    copy.git = rest;
  }
  if (Array.isArray(lane.prs)) {
    copy.prs = lane.prs.map((pr) => {
      if (!pr || typeof pr !== "object") return pr;
      const { reviews, ...rest } = pr;
      if (pr.checks && typeof pr.checks === "object") {
        const { failing, passing, ...counts } = pr.checks;
        rest.checks = counts;
      }
      return rest;
    });
  }
  return copy;
}

function summary() {
  return {
    server: { version, startedAt, url, statusDir },
    repos: [...repos.values()].map((entry) => {
      const out = { key: entry.key, status: entry.status };
      if (entry.error) out.error = entry.error;
      if (entry.schema) out.schema = entry.schema;
      if (entry.file) out.file = { ...entry.file, lanes: Array.isArray(entry.file.lanes) ? entry.file.lanes.map(summarizeLane) : [] };
      return out;
    }),
  };
}

function laneDetail(key, id) {
  const entry = repos.get(key);
  if (!entry || entry.status !== "ok" || !Array.isArray(entry.file.lanes)) return null;
  const lane = entry.file.lanes.find((item) => item && item.id === id);
  if (!lane) return null;
  const events = Array.isArray(entry.file.events) ? entry.file.events.filter((event) => event && event.lane === id) : [];
  return { repo: key, lane, events };
}

function normalizePath(path) {
  if (typeof path !== "string" || !path) return "";
  let value = resolve(path).replace(/\\/g, "/").replace(/\/+$/, "");
  if (process.platform === "win32") value = value.toLowerCase();
  return value;
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
}

// A talk file left by a killed session can name a process id the system has since reused,
// so a candidate counts only when its bridge port also accepts a connection.
function listening(port) {
  return new Promise((done) => {
    const socket = connect({ host: "127.0.0.1", port });
    const finish = (value) => { socket.destroy(); done(value); };
    socket.setTimeout(500, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

async function talkFor(key) {
  const entry = repos.get(key);
  const cwd = entry && entry.status === "ok" && entry.file.briefing ? normalizePath(entry.file.briefing.cwd) : "";
  if (!cwd) return { connected: false };
  const candidates = [];
  let names = [];
  try { names = readdirSync(talkDir).filter((name) => name.endsWith(".json")); } catch {}
  for (const name of names) {
    let talk;
    try { talk = JSON.parse(readFileSync(join(talkDir, name), "utf8")); } catch { continue; }
    if (!talk || !Number.isInteger(talk.port) || talk.port < 1 || talk.port > 65535 || typeof talk.token !== "string" || !alive(talk.pid)) continue;
    if (normalizePath(talk.cwd) !== cwd) continue;
    candidates.push(talk);
  }
  candidates.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
  for (const talk of candidates) {
    if (await listening(talk.port)) return { connected: true, port: talk.port, token: talk.token };
  }
  return { connected: false };
}

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };
const assets = {
  "/": "index.html", "/index.html": "index.html", "/app.js": "app.js", "/app.css": "app.css", "/favicon.svg": "favicon.svg",
  "/vendor/tabler/tabler.min.css": "vendor/tabler/tabler.min.css",
  "/vendor/tabler/tabler.min.js": "vendor/tabler/tabler.min.js",
  "/vendor/tabler/tabler-theme.min.js": "vendor/tabler/tabler-theme.min.js",
  "/vendor/tabler/LICENSE": "vendor/tabler/LICENSE",
};

function headers(type) {
  return {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:*",
  };
}

function send(response, status, body, type = "application/json; charset=utf-8") {
  response.writeHead(status, headers(type));
  response.end(typeof body === "string" ? body : JSON.stringify(body));
}

const server = createServer((request, response) => {
  if (!allowedHosts.has(String(request.headers.host || "").toLowerCase())) {
    send(response, 403, { error: "This server answers only 127.0.0.1 and localhost." });
    return;
  }
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    send(response, 405, { error: "The dashboard is read-only." });
    return;
  }
  let target;
  try { target = new URL(request.url, url); } catch { send(response, 404, { error: "Not found." }); return; }
  const path = target.pathname;

  if (Object.hasOwn(assets, path)) {
    const name = assets[path];
    try {
      send(response, 200, readFileSync(join(publicDir, name), "utf8"), types[name.slice(name.lastIndexOf("."))] || "text/plain; charset=utf-8");
    } catch {
      send(response, 404, { error: "Not found." });
    }
    return;
  }
  if (path === "/health") {
    send(response, 200, { service: SERVICE, version, schema: SCHEMA, ...(authorized(request, target) ? { instance } : {}) });
    return;
  }
  if ((path.startsWith("/api/") || path === "/events") && !authorized(request, target)) {
    send(response, 401, { error: "Open the dashboard from the address Foreman reports in its briefing." });
    return;
  }
  if (path === "/api/state") {
    send(response, 200, summary());
    return;
  }
  if (path === "/api/lane") {
    const key = target.searchParams.get("repo") || "";
    const id = target.searchParams.get("lane") || "";
    const detail = KEY.test(key) && LANE_ID.test(id) ? laneDetail(key, id) : null;
    if (detail) send(response, 200, detail); else send(response, 404, { error: "No such lane." });
    return;
  }
  if (path === "/api/talk") {
    const key = target.searchParams.get("repo") || "";
    if (!KEY.test(key)) { send(response, 200, { connected: false }); return; }
    talkFor(key).then((talk) => send(response, 200, talk), () => send(response, 200, { connected: false }));
    return;
  }
  if (path === "/events") {
    response.writeHead(200, { ...headers("text/event-stream; charset=utf-8"), Connection: "keep-alive" });
    response.write("retry: 5000\nevent: hello\ndata: {}\n\n");
    clients.add(response);
    request.on("close", () => clients.delete(response));
    return;
  }
  send(response, 404, { error: "Not found." });
});

function writeInfo() {
  const temporary = `${infoFile}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify({ url, page, instance, pid: process.pid, version, startedAt }, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, infoFile);
}

function removeInfo() {
  try {
    const info = JSON.parse(readFileSync(infoFile, "utf8"));
    if (info.pid === process.pid) unlinkSync(infoFile);
  } catch {}
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") log(`Port ${port} is already in use; the dashboard did not start.`);
  else log(`The dashboard server failed: ${error.message}`);
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  writeInfo();
  scan();
  setInterval(scan, 1000);
  setInterval(() => { for (const response of clients) response.write(": keep-alive\n\n"); }, 15000);
  log(`Foreman dashboard ${version} listening at ${url}, reading ${statusDir}`);
});

function stop(signal) {
  log(`Stopping on ${signal}.`);
  removeInfo();
  for (const response of clients) response.end();
  server.close();
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]) {
  try { process.on(signal, () => stop(signal)); } catch {}
}
process.on("exit", removeInfo);
