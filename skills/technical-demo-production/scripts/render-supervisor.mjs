import { execFile, fork, spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);

async function terminateGroup(pid) {
  const deadline = Date.now() + 10000;
  do {
    try { process.kill(-pid, "SIGKILL"); }
    catch (error) {
      if (error.code === "ESRCH") return;
      throw error;
    }
    const { stdout } = await execute("ps", ["-axo", "pgid=,stat="]);
    const active = stdout.trim().split("\n").some((line) => {
      const [group, state] = line.trim().split(/\s+/);
      return Number(group) === pid && !state.startsWith("Z");
    });
    if (!active) return;
    await delay(25);
  } while (Date.now() < deadline);
  throw new Error(`Render process group ${pid} still contains active processes`);
}

function ownProcesses(worker) {
  if (process.platform !== "win32") {
    return { ready: Promise.resolve(), stop: () => terminateGroup(worker.pid) };
  }
  const owner = spawn("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
    "-File", fileURLToPath(new URL("./render-job-object.ps1", import.meta.url)),
    "-WorkerId", String(worker.pid),
  ], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  let output = "";
  let errors = "";
  let readyResolve;
  let readyReject;
  let controlError;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const startupTimer = setTimeout(() => {
    controlError = new Error("Render job owner did not become ready within 30 seconds");
    readyReject(controlError);
    owner.kill();
  }, 30000);
  owner.stdin.on("error", (error) => {
    controlError = error;
    readyReject(error);
    owner.kill();
  });
  owner.stdout.on("data", (chunk) => {
    output += chunk;
    if (output.split(/\r?\n/).includes("READY")) {
      clearTimeout(startupTimer);
      readyResolve();
    }
  });
  owner.stderr.on("data", (chunk) => { errors += chunk; });
  const exited = new Promise((resolve) => {
    owner.on("error", (error) => {
      clearTimeout(startupTimer);
      readyReject(error);
      resolve({ error });
    });
    owner.on("close", (code, signal) => {
      clearTimeout(startupTimer);
      const error = controlError ?? (code === 0 ? undefined : new Error(`Render job owner exited with code ${code}, signal ${signal}: ${errors}`));
      readyReject(error ?? new Error("Render job owner exited before startup"));
      resolve({ error });
    });
  });
  return {
    ready,
    stop: async () => {
      owner.stdin.end();
      let timeout;
      try {
        const outcome = await Promise.race([
          exited,
          new Promise((resolve) => {
            timeout = setTimeout(() => {
              owner.kill();
              resolve({ error: new Error("Render job owner did not confirm termination") });
            }, 15000);
          }),
        ]);
        if (outcome.error) throw outcome.error;
      } finally { clearTimeout(timeout); }
    },
  };
}

export async function superviseRender(script, manifestPath) {
  const started = Date.now();
  const worker = fork(script, [manifestPath, "--render-worker"], {
    execArgv: ["--import", new URL("./render-worker-bootstrap.mjs", import.meta.url).href],
    env: { ...process.env, PROMPTLINGS_WAIT_FOR_RENDER_OWNER: "1" },
    stdio: ["inherit", "inherit", "inherit", "ipc"],
    detached: process.platform !== "win32",
    windowsHide: true,
  });
  let result;
  let termination;
  let exitTimer;
  let failedTermination;
  const terminationFailure = new Promise((resolve) => { failedTermination = resolve; });
  const owner = ownProcesses(worker);
  const exited = new Promise((resolve) => {
    worker.on("error", (error) => resolve({ error: error.message }));
    worker.on("close", (code, signal) => resolve({ code, signal }));
  });
  const stop = () => {
    termination ??= owner.stop().catch((error) => {
      result ??= { status: "failed", jobs: [], bundles: [] };
      (result.shutdownErrors ??= []).push(`Process-tree termination failed: ${error.message}`);
      failedTermination({ error: `Could not terminate render worker ${worker.pid}: ${error.message}` });
    });
    return termination;
  };
  const interrupted = () => {
    result ??= { jobs: [], bundles: [] };
    result.status = "failed";
    result.error = "Render interrupted";
    result.forcedTermination = true;
    stop();
  };
  process.once("SIGINT", interrupted);
  process.once("SIGTERM", interrupted);
  worker.on("message", (message) => {
    if (termination || !["result", "stalled"].includes(message?.type)) return;
    result = message.result;
    if (message.type === "stalled") {
      result.forcedTermination = true;
      stop();
    } else {
      // A rejected renderer promise can leave native work alive in this pinned version.
      clearTimeout(exitTimer);
      exitTimer = setTimeout(() => {
        result.status = "failed";
        (result.shutdownErrors ??= []).push("Render worker did not exit after returning its result");
        result.forcedTermination = true;
        stop();
      }, 10000);
    }
  });
  const outcome = await Promise.race([
    (async () => {
      try {
        await owner.ready;
        if (!termination) worker.send({ type: "start" });
        return await exited;
      } catch (error) {
        worker.kill("SIGKILL");
        return { error: error.message };
      }
    })(),
    terminationFailure,
  ]);
  clearTimeout(exitTimer);
  // Even an unexpected worker exit must release its remaining native processes.
  await stop();
  process.removeListener("SIGINT", interrupted);
  process.removeListener("SIGTERM", interrupted);
  result ??= { startedAt: new Date(started).toISOString(), status: "failed", error: "Render worker exited without a result", jobs: [], bundles: [] };
  if (result.shutdownErrors?.length) result.status = "failed";
  if (outcome.error || (!result.forcedTermination && outcome.code !== 0)) {
    result.status = "failed";
    result.error = outcome.error ?? result.error ?? `Render worker exited with code ${outcome.code}, signal ${outcome.signal}`;
    if (result.error === "Render worker exited without a result") result.error += ` (code ${outcome.code}, signal ${outcome.signal})`;
  }
  if (result.forcedTermination) {
    result.status = "failed";
    result.totalSeconds = (Date.now() - started) / 1000;
  }
  const resultsPath = path.join(path.dirname(manifestPath), `${path.parse(manifestPath).name}-result.json`);
  await writeFile(resultsPath, JSON.stringify(result, null, 2));
  return result;
}
