import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { deps } from "../lib/memory.js";
import { memoryClient } from "./memory-concurrency.test.js";

// Opt in with PROMPTLINGS_MEMORY_CRASH_DIR under C:\agent-artifacts and an
// already installed PROMPTLINGS_MEMORY_PYTHON containing FastMCP 4.1.3.
// This acceptance restarts the installed service; run it without other writers.
const artifactRoot = process.env.PROMPTLINGS_MEMORY_CRASH_DIR;
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const text = (result) => result?.content?.filter((item) => item.type === "text").map((item) => item.text).join("\n") || "";
function checked(result) {
  assert.equal(Boolean(result?.isError), false, text(result));
  return result;
}
const parsed = (result) => JSON.parse(text(checked(result)));
const pendingOperations = (status) => status.operations.filter((operation) =>
  ["queued", "dispatched", "unknown"].includes(operation.state));
const projects = (result) => {
  const value = parsed(result);
  return Array.isArray(value) ? value : value.projects;
};
async function until(probe, message, timeout = 90_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) return value;
    await pause(1000);
  }
  throw new Error(message);
}
function powershell(script) {
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024,
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  assert.ifError(result.error);
  assert.equal(result.status, 0, "Acceptance process inspection failed.");
  return result.stdout.trim();
}
function processTree(pid) {
  return JSON.parse(powershell(`
$ErrorActionPreference = 'Stop'
$all = @(Get-CimInstance Win32_Process)
$owned = @($all | Where-Object { $_.ProcessId -eq ${pid} })
for ($i = 0; $i -lt $owned.Count; $i++) {
  $parentId = $owned[$i].ProcessId
  $owned += @($all | Where-Object { $_.ParentProcessId -eq $parentId -and $_.ProcessId -notin $owned.ProcessId })
}
ConvertTo-Json -InputObject @($owned | ForEach-Object {
  @{ pid = $_.ProcessId; parent = $_.ParentProcessId; created = $_.CreationDate.ToString('o'); executable = $_.ExecutablePath }
}) -Depth 4
`));
}
function killTree(tree) {
  // Kill descendants first and refuse a recycled PID.
  for (const original of [...tree].reverse()) {
    powershell(`
$ErrorActionPreference = 'Stop'
$current = Get-CimInstance Win32_Process -Filter 'ProcessId=${original.pid}'
if ($current) {
  if ($current.CreationDate.ToString('o') -ne '${original.created}') { throw 'PID creation time changed; refusing termination.' }
  Write-Output "Stopping owned PID ${original.pid}, created ${original.created}"
  Stop-Process -Id ${original.pid} -Force
}
`);
  }
}

// Fixture-only relay: transport headers and GET streams pass through; only a
// selected completed POST result is held after the real upstream commits.
async function relay(targetPort) {
  const sockets = new Set();
  const calls = [];
  let gate;
  const server = createServer((incoming, outgoing) => {
    const chunks = [];
    incoming.on("data", (chunk) => chunks.push(chunk));
    incoming.on("end", () => {
      const body = Buffer.concat(chunks);
      let message;
      try { message = body.length ? JSON.parse(body.toString()) : null; } catch { /* pass malformed transport unchanged */ }
      const mutation = message?.method === "tools/call" && message.params.name === "edit_note";
      if (mutation) calls.push({ ...message.params.arguments, forwarded: new Date().toISOString() });
      const selected = gate && mutation && message.params.arguments.content.includes(gate.marker) ? gate : null;
      const upstream = request({
        host: "127.0.0.1", port: targetPort, path: incoming.url, method: incoming.method,
        headers: { ...incoming.headers, host: `127.0.0.1:${targetPort}` },
      }, (response) => {
        if (!selected) {
          outgoing.writeHead(response.statusCode, response.headers);
          response.pipe(outgoing);
          return;
        }
        const resultChunks = [];
        response.on("data", (chunk) => resultChunks.push(chunk));
        response.on("end", () => {
          selected.body = Buffer.concat(resultChunks);
          selected.status = response.statusCode;
          selected.received = new Date().toISOString();
          selected.release = () => {
            if (!outgoing.destroyed) {
              outgoing.writeHead(response.statusCode, response.headers);
              outgoing.end(selected.body);
            }
          };
          selected.complete(selected);
        });
      });
      upstream.on("error", (error) => {
        if (!outgoing.destroyed) { outgoing.writeHead(502); outgoing.end(error.message); }
      });
      outgoing.on("close", () => upstream.destroy());
      upstream.end(body);
    });
  });
  server.on("connection", (socket) => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return {
    port: server.address().port, calls,
    hold(marker) {
      let complete;
      const received = new Promise((done) => { complete = done; });
      gate = { marker, complete, received };
      return gate;
    },
    release() { gate?.release?.(); gate = null; },
    async close() {
      gate?.release?.();
      for (const socket of sockets) socket.destroy();
      await new Promise((done) => server.close(done));
    },
  };
}
async function freePort() {
  const server = createServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}
const bounded = (promise, timeout = 90_000) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Crash boundary was not reached within its deadline.")), timeout);
  })]).finally(() => clearTimeout(timer));
};
const observed = (promise) => promise.then((result) => ({ result }), (error) => ({ error: error.message }));

test("opt-in real Basic Memory crash recovery and durable uncertain-outcome barrier", {
  skip: !artifactRoot, timeout: 600_000,
}, async () => {
  assert.equal(process.platform, "win32", "This bounded acceptance targets the installed Windows service.");
  assert.ok(resolve(artifactRoot).toLowerCase().startsWith("c:\\agent-artifacts\\"), "Use the external artifact root.");
  mkdirSync(artifactRoot, { recursive: true });
  const runRoot = join(artifactRoot, randomUUID());
  mkdirSync(runRoot);
  const reportPath = join(runRoot, "memory-crash.json");
  const report = { started: new Date().toISOString(), expiryDays: 14, crashProcesses: [], outcomes: {}, written: [] };
  const save = () => {
    report.updated = new Date().toISOString();
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  };
  const source = fileURLToPath(new URL("../lib/memory-proxy.py", import.meta.url));
  const stableSource = join(runRoot, "memory-proxy.py");
  copyFileSync(source, stableSource);
  report.gatewaySHA256 = createHash("sha256").update(readFileSync(stableSource)).digest("hex");
  const python = process.env.PROMPTLINGS_MEMORY_PYTHON ||
    join(dirname(artifactRoot), "fastmcp-only-20261123", "Scripts", "python.exe");
  assert.ok(existsSync(python), "Select the already installed isolated FastMCP Python via PROMPTLINGS_MEMORY_PYTHON.");
  const installedEnvironment = join(homedir(), "AppData", "Roaming", "uv", "tools", "basic-memory");
  assert.ok(!resolve(python).toLowerCase().startsWith(installedEnvironment.toLowerCase() + "\\"),
    "Use a separate installed fixture Python: managed backend maintenance stops its own environment processes.");
  const metadata = spawnSync(join(installedEnvironment, "Scripts", "python.exe"),
    ["-c", "from importlib.metadata import version; print(version('basic-memory')); print(version('fastmcp'))"],
    { encoding: "utf8", windowsHide: true });
  console.log(metadata.stdout);
  console.error(metadata.stderr);
  assert.equal(metadata.status, 0);
  assert.equal(metadata.stdout.trim().split(/\r?\n/)[0], "0.24.1");
  const configPath = join(homedir(), ".basic-memory", "config.json");
  const configBefore = readFileSync(configPath);
  const config = JSON.parse(configBefore);
  assert.equal(config.database_backend, "sqlite");
  assert.equal(config.materialization_workers, 2, "Acceptance must preserve the installed two-worker configuration.");
  report.backendVersion = "0.24.1";
  report.materializationWorkers = 2;
  const memoryCommand = deps.which("basic-memory");
  const managedRuntime = join(homedir(), ".promptlings", "memory", "memory-service.mjs");
  assert.ok(memoryCommand && existsSync(managedRuntime));
  const originalCapture = deps.capture;
  const originalPowershell = deps.powershell;
  deps.capture = (command, args, options) => {
    const value = originalCapture(command, args, { ...options, quiet: false });
    console.log(value);
    return value;
  };
  deps.powershell = (script, options) => originalPowershell(script, { ...options, quiet: false });
  let direct;
  let gateway;
  let gatewayTree;
  let upstream;
  let frontend;
  let control;
  let projectId;
  let serviceStopped = false;
  const connections = [];
  const pending = [];
  const projectName = `promptlings-crash-${randomUUID()}`;
  const projectPath = join(runRoot, projectName);
  report.projectName = projectName;
  report.projectPath = projectPath;
  const journalPath = join(runRoot, "write-queue.sqlite3");
  const gatewayPort = await freePort();
  async function startGateway() {
    gateway = spawn(python, [stableSource, "--port", String(upstream.port), "--proxy-port", String(gatewayPort),
      "--fastmcp-version", "4.1.3", "--journal-path", journalPath], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    gateway.stdout.on("data", (chunk) => process.stdout.write(chunk));
    gateway.stderr.on("data", (chunk) => process.stderr.write(chunk));
    await until(async () => {
      assert.equal(gateway.exitCode, null, "Gateway exited before readiness.");
      if (!await deps.portOpen(gatewayPort)) return false;
      try { control = await memoryClient(gatewayPort); return true; } catch { return false; }
    }, "Isolated gateway did not become ready.");
    connections.push(control);
    gatewayTree = processTree(gateway.pid);
    assert.ok(gatewayTree.length);
  }
  async function crashGateway(boundary) {
    const crash = { boundary, killed: new Date().toISOString(), processes: gatewayTree };
    report.crashProcesses.push(crash);
    killTree(gatewayTree);
    for (const original of gatewayTree) {
      powershell(`
$p = Get-CimInstance Win32_Process -Filter 'ProcessId=${original.pid}'
if ($p -and $p.CreationDate.ToString('o') -eq '${original.created}') { throw 'Owned gateway process survived crash termination.' }
Write-Output 'Verified stopped gateway PID ${original.pid}, created ${original.created}'
`);
    }
    crash.processTreeStopped = true;
    gateway = null;
    gatewayTree = null;
    await deps.waitUntilStopped([gatewayPort]);
    save();
  }
  async function restartBackend() {
    if (direct) { await direct.close(); direct = null; }
    report.backendBeforeRestart = JSON.parse(powershell(`
ConvertTo-Json -InputObject @(Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)"
  @{ pid = $p.ProcessId; created = $p.CreationDate.ToString('o') }
})
`));
    serviceStopped = true;
    deps.stopPreviousServer();
    await deps.waitUntilStopped([8000, 8001]);
    for (const previous of report.backendBeforeRestart) {
      assert.equal(powershell(`
$p = Get-CimInstance Win32_Process -Filter 'ProcessId=${previous.pid}'
if ($p -and $p.CreationDate.ToString('o') -eq '${previous.created}') { throw 'Old backend is still running.' }
Write-Output 'Previous backend worker stopped.'
`), "Previous backend worker stopped.");
    }
    deps.startService(memoryCommand, 8000, 8001, managedRuntime);
    await deps.waitUntilReady(8001);
    serviceStopped = false;
    direct = await memoryClient(8000);
    report.backendRestarted = new Date().toISOString();
  }
  const occurrences = (body, markers) => markers.map((marker) => ({ marker, occurrences: body.split(marker).length - 1 }));
  try {
    direct = await memoryClient(8000);
    checked(await direct.call("create_memory_project", {
      project_name: projectName, project_path: projectPath, set_default: false, output_format: "json",
    }));
    projectId = projects(await direct.call("list_memory_projects", { output_format: "json" }))
      .find((project) => project.name === projectName)?.external_id;
    assert.ok(projectId, "Throwaway project external ID was not returned.");
    report.projectId = projectId;
    const title = `crash${randomUUID().replaceAll("-", "")}`;
    checked(await direct.call("write_note", {
      project_id: projectId, title, directory: "crash", content: "# Crash acceptance\n\n", output_format: "json",
    }));
    const args = (marker) => ({
      project_id: projectId, identifier: title, operation: "append", content: `\n${marker}\n`, output_format: "json",
    });
    const read = async (client = control) => text(checked(await client.call("read_note", {
      project_id: projectId, identifier: title, output_format: "json",
    })));
    upstream = await relay(8000);
    await startGateway();
    const activeMarker = `active_${randomUUID()}_END`;
    const queuedMarkers = Array.from({ length: 3 }, () => `queued_${randomUUID()}_END`);
    const held = upstream.hold(activeMarker);
    const activeClient = await memoryClient(gatewayPort);
    connections.push(activeClient);
    pending.push(observed(activeClient.call("edit_note", args(activeMarker))));
    await bounded(held.received);
    assert.equal(held.status, 200);
    assert.ok(!held.body.toString().includes('"isError":true'), held.body.toString());
    report.upstreamCommittedResponse = { received: held.received, response: held.body.toString() };
    assert.equal(occurrences(await read(direct), [activeMarker])[0].occurrences, 1);
    for (const marker of queuedMarkers) {
      const client = await memoryClient(gatewayPort);
      connections.push(client);
      pending.push(observed(client.call("edit_note", args(marker))));
      await until(async () => {
        const status = parsed(await control.call("memory_queue_status", {}));
        return status.operations.filter((operation) => operation.state === "queued").length === pending.length - 1;
      }, "Append was not durably admitted.");
    }
    const admitted = parsed(await control.call("memory_queue_status", {}));
    const admittedPending = pendingOperations(admitted);
    assert.deepEqual(admittedPending.map((operation) => operation.state), ["dispatched", "queued", "queued", "queued"]);
    report.admitted = admitted;
    const activeId = admittedPending[0].operation_id;
    const queuedIds = admittedPending.slice(1).map((operation) => operation.operation_id);
    await crashGateway("upstream committed, gateway result not received, three queued appends");
    upstream.release();
    await startGateway();
    const recovered = parsed(await control.call("memory_queue_status", {}));
    const recoveredPending = pendingOperations(recovered);
    assert.equal(recovered.blocked, true);
    assert.deepEqual(recoveredPending.map((operation) => operation.state), ["unknown", "queued", "queued", "queued"]);
    assert.deepEqual(recoveredPending.map((operation) => operation.operation_id), [activeId, ...queuedIds]);
    assert.deepEqual(recoveredPending.map((operation) => operation.deadline),
      admittedPending.map((operation) => operation.deadline), "Restart reset an original admission deadline.");
    report.recovered = recovered;
    const blockedMarker = `blocked_${randomUUID()}_END`;
    const refused = await control.call("edit_note", args(blockedMarker));
    assert.equal(refused.isError, true);
    assert.match(text(refused), /QUEUE_BLOCKED/);
    const duringBarrier = await read();
    assert.deepEqual(occurrences(duringBarrier, [activeMarker, ...queuedMarkers, blockedMarker]).map((item) => item.occurrences),
      [1, 0, 0, 0, 0]);
    report.outcomes.readsAvailableAndWritesBlockedAcrossRestart = true;
    await restartBackend();
    const evidenceRead = await read();
    assert.equal(occurrences(evidenceRead, [activeMarker])[0].occurrences, 1);
    const evidence = `User-authorized crash acceptance: previous backend PID stopped at ${report.backendRestarted}; ` +
      `MCP read_note project_id=${projectId} identifier=${title} confirms ${activeMarker} occurs exactly once.`;
    checked(await control.call("memory_queue_resolve", {
      operation_id: activeId, outcome: "applied", evidence, backend_restarted: true,
    }));
    report.recoveredResults = await until(async () => {
      const statuses = await Promise.all(queuedIds.map((operation_id) => control.call("memory_queue_status", { operation_id }).then(parsed)));
      return statuses.every((status) => status.operations[0].state === "completed") && statuses;
    }, "Recovered FIFO did not complete before admission deadline.");
    const afterRecovery = await read();
    const acceptedMarkers = [activeMarker, ...queuedMarkers];
    assert.ok(occurrences(afterRecovery, acceptedMarkers).every((item) => item.occurrences === 1));
    assert.ok(queuedMarkers.every((marker, index) => index === 0 || afterRecovery.indexOf(queuedMarkers[index - 1]) < afterRecovery.indexOf(marker)));
    assert.deepEqual(upstream.calls.map((call) => call.content.trim()), acceptedMarkers);
    report.outcomes.queuedFIFORecoveredWithoutLostOrDuplicateWrites = true;
    report.outcomes.uncertainAppendNeverReplayed = true;
    report.resolution = parsed(await control.call("memory_queue_status", { operation_id: activeId }));

    frontend = await relay(gatewayPort);
    const completedMarker = `completed_${randomUUID()}_END`;
    const completedGate = frontend.hold(completedMarker);
    const completedClient = await memoryClient(frontend.port);
    connections.push(completedClient);
    pending.push(observed(completedClient.call("edit_note", args(completedMarker))));
    await bounded(completedGate.received);
    const wire = completedGate.body.toString();
    const message = wire.startsWith("data:") || wire.includes("\ndata:") ?
      wire.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => JSON.parse(line.slice(5))).find((item) => item.result) :
      JSON.parse(wire);
    const completedResult = checked(message.result);
    const completedId = completedResult._meta?.memory_queue_operation_id;
    assert.ok(completedId, "Completed response omitted durable operation ID.");
    const beforeCrash = parsed(await control.call("memory_queue_status", { operation_id: completedId })).operations[0];
    assert.equal(beforeCrash.state, "completed");
    assert.ok(beforeCrash.result);
    await crashGateway("gateway completed result persisted, frontend client response withheld");
    await startGateway();
    const discoverable = parsed(await control.call("memory_queue_status", {}));
    const discoveredId = discoverable.operations.filter((operation) => operation.state === "completed" &&
      operation.target.project_id === projectId && operation.target.identifier === title)
      .sort((left, right) => left.sequence - right.sequence).at(-1)?.operation_id;
    assert.equal(discoveredId, completedId, "Completed response-loss operation was not discoverable without its ID.");
    const afterCrash = parsed(await control.call("memory_queue_status", { operation_id: discoveredId })).operations[0];
    assert.equal(afterCrash.state, "completed");
    assert.deepEqual(afterCrash.result, beforeCrash.result);
    assert.deepEqual(afterCrash.arguments, args(completedMarker));
    const allMarkers = [...acceptedMarkers, completedMarker];
    report.acceptedOccurrences = occurrences(await read(), [...allMarkers, blockedMarker]);
    assert.deepEqual(report.acceptedOccurrences.map((item) => item.occurrences), [1, 1, 1, 1, 1, 0]);
    report.materializedOccurrences = await until(async () => {
      const result = await control.call("read_content", { project_id: projectId, path: `crash/${title}.md` });
      if (result.isError) return false;
      const counts = occurrences(text(result), [...allMarkers, blockedMarker]);
      return counts.every((item, index) => item.occurrences === (index === allMarkers.length ? 0 : 1)) && counts;
    }, "Materialized content did not match accepted revision.", 120_000);
    assert.deepEqual(upstream.calls.map((call) => call.content.trim()), allMarkers);
    report.written = upstream.calls;
    report.completed = { operationId: completedId, heldAt: completedGate.received, beforeCrash, afterCrash };
    report.outcomes.completedOperationDiscoverableWithoutResponseID = true;
    report.outcomes.completedResultRecoveredByOperationIDWithoutReplay = true;
    frontend.release();
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    try {
      if (upstream) report.written = upstream.calls;
      if (gatewayTree) { killTree(gatewayTree); await deps.waitUntilStopped([gatewayPort]); }
      if (frontend) await frontend.close();
      if (upstream) await upstream.close();
      if (serviceStopped) {
        deps.startService(memoryCommand, 8000, 8001, managedRuntime);
        await deps.waitUntilReady(8001);
        direct = await memoryClient(8000);
        serviceStopped = false;
      }
      for (const connection of connections) {
        try { await bounded(connection.close(), 3000); } catch (error) { console.log(`Closed crash-invalidated session: ${error.message}`); }
      }
      direct ||= await memoryClient(8000);
      projectId ||= projects(await direct.call("list_memory_projects", { output_format: "json" }))
        .find((project) => project.name === projectName)?.external_id;
      if (projectId) {
        checked(await direct.call("delete_project", { project_name: projectName, delete_notes: true }));
        assert.ok(!projects(await direct.call("list_memory_projects", { output_format: "json" }))
          .some((project) => project.external_id === projectId));
      }
      assert.ok(!projects(await direct.call("list_memory_projects", { output_format: "json" }))
        .some((project) => project.name === projectName), "Throwaway project registration still exists.");
      assert.equal(existsSync(projectPath), false, "Throwaway project directory still exists.");
      report.projectRemoved = true;
      if (direct) await direct.close();
      report.requests = await bounded(Promise.all(pending), 5000);
      assert.deepEqual(readFileSync(configPath), configBefore, "Acceptance changed installed backend configuration.");
      assert.equal(await deps.portOpen(8000), true);
      await deps.waitUntilReady(8001);
      report.installedServiceRestored = true;
    } catch (error) {
      report.passed = false;
      report.cleanupError = { message: error.message, stack: error.stack };
      throw error;
    } finally {
      deps.capture = originalCapture;
      deps.powershell = originalPowershell;
      report.finished = new Date().toISOString();
      save();
      console.log(JSON.stringify(report, null, 2));
      console.log(`Crash acceptance report: ${reportPath}`);
    }
  }
});
