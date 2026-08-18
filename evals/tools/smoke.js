"use strict";

/**
 * Cheap preflight: confirm the Copilot CLI resolves every agent name in the
 * ladder before committing to a multi-hour sweep. A typo in a provider label
 * or a missing install into a target checkout would otherwise surface an hour
 * into the run, after the machine has already been tied up.
 *
 * Usage: node evals/tools/smoke.js
 */

const path = require("node:path");
const { runCopilot } = require("../providers/copilot.js");

const AGENTS = [
  "pr-walkthrough-baseline",
  "pr-walkthrough-l2",
  "pr-walkthrough-l3",
  "pr-walkthrough-l4",
  "pr-walkthrough-l5",
  "pr-walkthrough-l6",
];

const cwd = path.resolve(__dirname, "..", ".work", "promptlings");
let failed = 0;

for (const agent of AGENTS) {
  const started = Date.now();
  const res = runCopilot(
    [
      "-p", "Reply with exactly the word LOADED and nothing else. Do not use tools.",
      "--agent", agent,
      "--allow-all-tools",
      "--allow-all-paths",
      "--silent",
      "--no-color",
      "--log-level", "none",
    ],
    { cwd, timeout: 4 * 60 * 1000 },
  );

  const secs = ((Date.now() - started) / 1000).toFixed(0);
  const out = String(res.stdout || "").trim().replace(/\s+/g, " ");
  const err = String(res.stderr || "").trim().replace(/\s+/g, " ");

  if (res.status !== 0 || /unknown agent|not found/i.test(err)) {
    failed++;
    console.log(`FAIL  ${agent}  ${secs}s  status=${res.status}  ${err.slice(0, 200)}`);
  } else {
    console.log(`ok    ${agent}  ${secs}s  -> ${out.slice(0, 60)}`);
  }
}

console.log(failed ? `\n${failed} agent(s) failed to load` : "\nall agents load");
process.exit(failed ? 1 : 0);
