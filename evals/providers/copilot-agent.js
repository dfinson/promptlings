#!/usr/bin/env node
/**
 * promptfoo exec provider: runs one promptlings agent under GitHub Copilot CLI.
 *
 * promptfoo passes the rendered prompt as the last argument. Which agent runs,
 * and where it runs, come from env, so one script serves every variant:
 *
 *   PROMPTLINGS_AGENT   agent name, matching the file stem in .github/agents/
 *   PROMPTLINGS_CWD     repository checkout the agent runs against
 *
 * Prints agent output on stdout, which promptfoo records as the response.
 */

const { runCopilot } = require("./copilot");

const prompt = process.argv[process.argv.length - 1];
const agent = process.env.PROMPTLINGS_AGENT;
const cwd = process.env.PROMPTLINGS_CWD || process.cwd();

if (!agent) {
  console.error("PROMPTLINGS_AGENT is not set");
  process.exit(1);
}

const res = runCopilot(
  ["-p", prompt, "--agent", agent, "--allow-all-tools", "--allow-all-paths", "--silent", "--no-color", "--log-level", "none"],
  { cwd },
);

if (res.error) {
  console.error(String(res.error.message));
  process.exit(1);
}
if (res.status !== 0) {
  console.error(res.stderr || `copilot exited ${res.status}`);
  process.exit(res.status || 1);
}

process.stdout.write(res.stdout);
