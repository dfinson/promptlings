import { execFile, fork } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

async function terminateTree(pid) {
  if (process.platform === "win32") {
    // The worker is dedicated to this batch. Never select processes by executable name.
    await execute("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
  } else {
    try { process.kill(-pid, "SIGKILL"); }
    catch (error) { if (error.code !== "ESRCH") throw error; }
  }
}

export async function superviseRender(script, manifestPath) {
  const started = Date.now();
  const worker = fork(script, [manifestPath, "--render-worker"], {
    execArgv: [],
    stdio: ["inherit", "inherit", "inherit", "ipc"],
    detached: process.platform !== "win32",
    windowsHide: true,
  });
  let result;
  let termination;
  let exitTimer;
  let finish;
  const stop = () => {
    termination ??= terminateTree(worker.pid).catch((error) => {
      (result.shutdownErrors ??= []).push(`Process-tree termination failed: ${error.message}`);
      finish({ error: `Could not terminate render worker ${worker.pid}: ${error.message}` });
    });
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
  const outcome = await new Promise((resolve) => {
    finish = resolve;
    worker.on("message", (message) => {
      if (termination || !["result", "stalled"].includes(message?.type)) return;
      result = message.result;
      if (message.type === "stalled") {
        result.forcedTermination = true;
        stop();
      } else {
        // A rejected renderer promise can leave native work alive in this pinned version.
        exitTimer = setTimeout(() => {
          result.status = "failed";
          (result.shutdownErrors ??= []).push("Render worker did not exit after returning its result");
          result.forcedTermination = true;
          stop();
        }, 10000);
      }
    });
    worker.on("error", (error) => resolve({ error: error.message }));
    worker.on("close", (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(exitTimer);
  await termination;
  process.removeListener("SIGINT", interrupted);
  process.removeListener("SIGTERM", interrupted);
  result ??= { startedAt: new Date(started).toISOString(), status: "failed", jobs: [], bundles: [] };
  if (outcome.error || (!result.forcedTermination && outcome.code !== 0)) {
    result.status = "failed";
    result.error ??= outcome.error ?? `Render worker exited with code ${outcome.code}, signal ${outcome.signal}`;
  }
  if (result.forcedTermination) {
    result.status = "failed";
    result.totalSeconds = (Date.now() - started) / 1000;
  }
  const resultsPath = path.join(path.dirname(manifestPath), `${path.parse(manifestPath).name}-result.json`);
  await writeFile(resultsPath, JSON.stringify(result, null, 2));
  return result;
}
