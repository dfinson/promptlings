"use strict";

/**
 * Locate the Copilot CLI entry point and run it without a shell.
 *
 * On Windows `copilot` resolves to a .cmd/.ps1 shim. Spawning a shim requires
 * `shell: true`, and on Windows that re-parses the argument vector, which
 * splits any prompt containing spaces into separate arguments. Resolving the
 * package's JS entry point and running it under the current node binary keeps
 * argv intact on every platform.
 */

const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

function resolveEntry() {
  if (process.env.PROMPTLINGS_COPILOT_ENTRY) {
    return process.env.PROMPTLINGS_COPILOT_ENTRY;
  }
  const candidates = [];
  const appdata = process.env.APPDATA;
  if (appdata) {
    candidates.push(path.join(appdata, "npm", "node_modules", "@github", "copilot", "npm-loader.js"));
  }
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    candidates.push(path.join(home, ".npm-global", "lib", "node_modules", "@github", "copilot", "npm-loader.js"));
    candidates.push(path.join(home, ".local", "share", "npm", "lib", "node_modules", "@github", "copilot", "npm-loader.js"));
  }
  candidates.push("/usr/local/lib/node_modules/@github/copilot/npm-loader.js");
  candidates.push("/usr/lib/node_modules/@github/copilot/npm-loader.js");

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

/**
 * @param {string[]} args argv passed to the Copilot CLI
 * @param {object} opts   spawnSync options (cwd, timeout, maxBuffer)
 */
function runCopilot(args, opts = {}) {
  const entry = resolveEntry();
  const base = {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 20 * 60 * 1000,
    ...opts,
  };

  if (entry) {
    return spawnSync(process.execPath, [entry, ...args], base);
  }
  // Fall back to the shim. Correct on POSIX; on Windows this is the path that
  // mangles quoting, so surface it rather than failing silently.
  if (process.platform === "win32") {
    return {
      status: 1,
      stdout: "",
      stderr:
        "Could not locate the Copilot CLI entry point. Set PROMPTLINGS_COPILOT_ENTRY " +
        "to the full path of @github/copilot/npm-loader.js.",
    };
  }
  return spawnSync("copilot", args, base);
}

module.exports = { runCopilot, resolveEntry };
