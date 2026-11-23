import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { deps, installMemoryRuntime } from "../lib/memory.js";
import { pins } from "../lib/pins.js";

const artifactRoot = process.env.PROMPTLINGS_MEMORY_ACCEPTANCE_DIR;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function memoryClient(port) {
  const url = `http://127.0.0.1:${port}/mcp`;
  const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  let id = 0;
  async function rpc(method, params, notification = false) {
    const response = await fetch(url, {
      method: "POST", headers,
      body: JSON.stringify({ jsonrpc: "2.0", ...(notification ? {} : { id: ++id }), method, params }),
      signal: AbortSignal.timeout(660_000),
    });
    if (response.headers.has("mcp-session-id")) headers["mcp-session-id"] = response.headers.get("mcp-session-id");
    const text = await response.text();
    const messages = response.headers.get("content-type")?.includes("text/event-stream") ?
      text.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => JSON.parse(line.slice(5))) :
      (text ? [JSON.parse(text)] : []);
    const result = messages.find((message) => "result" in message || "error" in message);
    if (!response.ok || result?.error) throw new Error(`MCP ${response.status}: ${JSON.stringify(result || text)}`);
    return result?.result;
  }
  const initialized = await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "promptlings-concurrency", version: "1" } });
  headers["MCP-Protocol-Version"] = initialized.protocolVersion;
  await rpc("notifications/initialized", {}, true);
  return {
    rpc,
    call: (name, args) => rpc("tools/call", { name, arguments: args }),
    close: async () => {
      const response = await fetch(url, { method: "DELETE", headers, signal: AbortSignal.timeout(660_000) });
      const text = await response.text();
      if (!response.ok) throw new Error(`MCP session close ${response.status}: ${text}`);
    },
  };
}
function content(result) {
  return result?.content?.filter((item) => item.type === "text").map((item) => item.text).join("\n") || "";
}
function checked(result) {
  assert.equal(Boolean(result?.isError), false, content(result));
  return result;
}
function logSnapshot() {
  const directory = join(homedir(), ".basic-memory");
  return Object.fromEntries(readdirSync(directory).filter((file) => file.endsWith(".log"))
    .map((file) => [file, statSync(join(directory, file)).size]));
}
function logErrors(before) {
  const directory = join(homedir(), ".basic-memory");
  const records = [];
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".log"))) {
    const text = readFileSync(join(directory, file)).subarray(before[file] || 0).toString("utf8");
    for (const line of text.split("\n")) {
      if (/database is locked|QueuePool limit|pool.*timed out/i.test(line)) records.push({ file, line });
    }
  }
  return {
    lockLogLines: records.filter(({ line }) => /database is locked/i.test(line)).length,
    poolTimeoutLogLines: records.filter(({ line }) => /QueuePool limit|pool.*timed out/i.test(line)).length,
    sqliteLockExceptions: records.filter(({ line }) => /^sqlalchemy\.exc\.OperationalError:.*database is locked/.test(line)).length,
    records,
  };
}

test("real installed SQLite concurrency and materialization worker measurements", {
  skip: !artifactRoot, timeout: 3_600_000,
}, async () => {
  mkdirSync(artifactRoot, { recursive: true });
  const memoryCommand = deps.which("basic-memory");
  assert.ok(memoryCommand, "Install pinned Basic Memory before this opt-in acceptance.");
  const runtime = installMemoryRuntime();
  const configPath = join(homedir(), ".basic-memory", "config.json");
  const original = JSON.parse(readFileSync(configPath, "utf8"));
  assert.equal(original.database_backend, "sqlite");
  const workers = process.env.PROMPTLINGS_MEMORY_ACCEPTANCE_WORKERS ?
    process.env.PROMPTLINGS_MEMORY_ACCEPTANCE_WORKERS.split(",").map(Number) : [1, 2, 4];
  assert.ok(workers.length && workers.every((count) => [1, 2, 4].includes(count)), "Worker selector must contain 1, 2 or 4.");
  const report = { date: new Date().toISOString(), version: pins.memory, proxyVersion: pins.memoryProxy, runs: [] };
  const projectName = `promptlings-concurrency-${randomUUID()}`;
  report.projectName = projectName;
  let projectId;
  let client;
  async function restart(workers) {
    if (client) { await client.close(); client = null; }
    deps.stopPreviousServer();
    await deps.waitUntilStopped([8000, 8001]);
    const current = JSON.parse(readFileSync(configPath, "utf8"));
    writeFileSync(configPath, JSON.stringify({ ...current, materialization_workers: workers, auto_update: false }, null, 2) + "\n");
    deps.startService(memoryCommand, 8000, 8001, runtime);
    await deps.waitUntilReady(8001);
    client = await memoryClient(8001);
  }
  async function runRound(workers, port) {
    const clients = await Promise.all(Array.from({ length: 10 }, () => memoryClient(port)));
    const prefix = `stress${randomUUID().replaceAll("-", "")}`;
    const snapshot = logSnapshot();
    const notes = [];
    const errors = [];
    const seeded = checked(await clients[0].call("write_note", {
      project_id: projectId, title: `${prefix}edits`, directory: "stress",
      content: "# Concurrent edits\n\nEach marker must occur exactly once.\n", output_format: "json",
    }));
    console.log(`workers=${workers} port=${port} seed=${content(seeded)}`);
    await Promise.all(clients.map(async (connection, i) => {
      const title = `${prefix}note${i}`;
      const searchToken = `${prefix}body${i}`;
      const start = Date.now();
      const result = await connection.call("write_note", {
        project_id: projectId, title, directory: "stress", output_format: "json",
        content: `# ${title}\n\nSearch marker: ${searchToken}\n\n` + Array.from({ length: 20 }, (_, j) =>
          `- [evidence] Observation ${j} for ${title} verifies concurrent SQLite materialization and independent note indexing.`).join("\n"),
      });
      const accepted = Date.now();
      if (result?.isError) errors.push(content(result));
      const note = { title, searchToken, requestMs: accepted - start, accepted, searchableMs: null };
      notes.push(note);
      const deadline = accepted + 300_000;
      while (!result?.isError && note.searchableMs === null && Date.now() < deadline) {
        const searched = await connection.call("search_notes", {
          project_id: projectId, query: `"${searchToken}"`, search_type: "text", output_format: "json",
        });
        if (searched?.isError) errors.push(content(searched));
        else if (JSON.parse(content(searched)).results.some((entry) => entry.title === title)) note.searchableMs = Date.now() - accepted;
        if (note.searchableMs === null) await pause(500);
      }
    }));
    await Promise.all(clients.map(async (connection, i) => {
      const result = await connection.call("edit_note", {
        project_id: projectId, identifier: `${prefix}edits`, operation: "append",
        content: `\n${prefix}marker${i}END\n`, output_format: "json",
      });
      if (result?.isError) errors.push(content(result));
    }));
    const readback = checked(await clients[0].call("read_note", {
      project_id: projectId, identifier: `${prefix}edits`, output_format: "json",
    }));
    const text = content(readback);
    const edits = Array.from({ length: 10 }, (_, i) => ({
      marker: `${prefix}marker${i}END`, occurrences: text.split(`${prefix}marker${i}END`).length - 1,
    }));
    // Verify the materialized revision through MCP as well as the accepted database revision.
    const materializedDeadline = Date.now() + 300_000;
    let materializedEdits;
    do {
      const file = checked(await clients[0].call("read_content", {
        project_id: projectId, path: `stress/${prefix}edits.md`,
      }));
      const materializedText = content(file);
      materializedEdits = edits.map(({ marker }) => ({ marker, occurrences: materializedText.split(marker).length - 1 }));
      if (materializedEdits.every((edit, i) => edit.occurrences === edits[i].occurrences)) break;
      await pause(500);
    } while (Date.now() < materializedDeadline);
    // The host previously observed vector-sync durations up to 133 seconds.
    console.log(`workers=${workers} port=${port}: observing background indexing for 150 seconds.`);
    await pause(150_000);
    const run = {
      workers, port, concurrentClients: 10, writeCalls: 10, editCalls: 10,
      errors, toolLockErrors: errors.filter((text) => /database is locked/i.test(text)).length,
      toolPoolTimeouts: errors.filter((text) => /QueuePool limit|pool.*timed out/i.test(text)).length,
      notes: notes.map(({ accepted, ...note }) => note), edits, materializedEdits, ...logErrors(snapshot),
    };
    report.runs.push(run);
    console.log(JSON.stringify(run, null, 2));
    writeFileSync(join(artifactRoot, "memory-concurrency.json"), JSON.stringify(report, null, 2) + "\n");
    await Promise.all(clients.map((connection) => connection.close()));
    if (port === 8001) {
      assert.equal(errors.length, 0, JSON.stringify(errors));
      assert.ok(edits.every((edit) => edit.occurrences === 1), "Proxy lost or duplicated an edit.");
      assert.ok(materializedEdits.every((edit) => edit.occurrences === 1), "Materialized note lost or duplicated an edit.");
      assert.ok(notes.every((note) => note.searchableMs !== null), "A note never became searchable.");
    }
  }
  try {
    await restart(4);
    const created = checked(await client.call("create_memory_project", {
      project_name: projectName, project_path: join(artifactRoot, projectName), set_default: false, output_format: "json",
    }));
    console.log(content(created));
    const projects = checked(await client.call("list_memory_projects", { output_format: "json" }));
    const payload = JSON.parse(content(projects));
    const list = Array.isArray(payload) ? payload : payload.projects;
    projectId = list.find((project) => project.name === projectName)?.external_id;
    assert.ok(projectId, `Cannot resolve throwaway project ID: ${content(projects)}`);
    report.projectId = projectId;
    await runRound(4, 8000);
    for (const count of workers) {
      await restart(count);
      await runRound(count, 8001);
    }
  } finally {
    if (projectId && client) {
      checked(await client.call("delete_project", { project_name: projectName, delete_notes: true }));
      const listed = checked(await client.call("list_memory_projects", { output_format: "json" }));
      assert.ok(!JSON.parse(content(listed)).projects.some((project) => project.external_id === projectId));
      assert.equal(existsSync(join(artifactRoot, projectName)), false, "Throwaway project directory was not removed.");
      report.projectRemoved = true;
    }
    writeFileSync(join(artifactRoot, "memory-concurrency.json"), JSON.stringify(report, null, 2) + "\n");
    await restart(pins.memoryWorkers);
    if (client) await client.close();
  }
});
