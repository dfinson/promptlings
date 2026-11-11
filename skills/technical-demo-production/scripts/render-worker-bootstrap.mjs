import { ChildProcess } from "node:child_process";

if (process.platform !== "win32") {
  // Remotion normally detaches Chrome. Keep every Node-launched child in the
  // batch's process group so ownership survives an unexpected worker exit.
  const spawn = ChildProcess.prototype.spawn;
  ChildProcess.prototype.spawn = function (options) {
    return spawn.call(this, { ...options, detached: false });
  };
}

if (process.env.PROMPTLINGS_WAIT_FOR_RENDER_OWNER === "1") {
  delete process.env.PROMPTLINGS_WAIT_FOR_RENDER_OWNER;
  await new Promise((resolve) => {
    const disconnected = () => process.exit(1);
    process.once("disconnect", disconnected);
    const start = (message) => {
      if (message?.type !== "start") return;
      process.removeListener("message", start);
      process.removeListener("disconnect", disconnected);
      resolve();
    };
    process.on("message", start);
  });
}
