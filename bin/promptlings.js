#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { discoverAgents, packageRoot } from "../lib/content.js";
import { includesMemorySkill, includesReadSide, publish } from "../lib/publish.js";
import { parseArgs, phases, usage } from "../lib/options.js";
import { InstallError, runPackage } from "../lib/run.js";

const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

function printPlan(options) {
  const steps = phases(options);
  const on = (value) => (value ? "yes" : "no");
  console.log(`Promptlings ${manifest.version}: ${options.command}`);
  if (steps.tools) {
    console.log(`Tools: system packages=${on(options.systemPackages)} bmad=${on(options.bmad)} speckit=${on(options.speckit)} ` +
      `playwright=${on(options.playwright)} hyperframes=${on(options.hyperframes)} demo=${on(options.demo)} external skills=${on(options.skills)}`);
    console.log("Package installation can request elevation.");
  }
  if (steps.publish) {
    console.log(`Agents: ${options.agents.join(", ")}`);
    console.log(`Skills: all bundled skills${includesMemorySkill(options) ? "" : " except promptlings-memory-capture"}.`);
    console.log(`Memory read-side rule: ${on(includesReadSide(options))}.`);
  }
  if (steps.memory) {
    console.log(`Basic Memory: login startup=${on(options.startup)}, loopback port=${options.memoryPort}, skills=${on(options.skills)}.`);
  }
  console.log("Writes only to user-level locations (your home directory and global agent configuration). No repository files are changed.");
}

async function approved(options) {
  if (options.yes) return true;
  if (!process.stdin.isTTY) throw new InstallError("Review --dry-run, then pass --yes for noninteractive installation.");
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^(y|yes)$/i.test((await prompt.question("Install the displayed components? [y/N]: ")).trim());
  } finally {
    prompt.close();
  }
}

async function main() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 20)) throw new InstallError(`Node.js 22.20+ is required. Found ${process.versions.node}.`);
  const allAgents = [...discoverAgents().keys()];
  const options = parseArgs(process.argv.slice(2), allAgents);
  if (options.help) return console.log(usage);
  if (options.version) return console.log(manifest.version);
  if (options.list) return console.log(allAgents.join("\n"));
  printPlan(options);
  if (options.dryRun) return console.log("Dry run. Nothing was downloaded or written.");
  if (!(await approved(options))) return console.log("Cancelled.");

  const steps = phases(options);
  const runSkills = (args, runOptions) => runPackage("skills", args, runOptions);
  const runAddMcp = (args) => runPackage("add-mcp", args);
  const temporary = mkdtempSync(join(tmpdir(), "promptlings-"));
  try {
    if (steps.tools) (await import("../lib/tools.js")).installTools(options, temporary, runSkills);
    if (steps.publish) publish(options, temporary);
    if (steps.memory) await (await import("../lib/memory.js")).installMemory(options, { runSkills, runAddMcp });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  console.log("Installed selected components. Restart your terminal and assistant.");
}

main().catch((error) => {
  console.error(`Installation incomplete: ${error instanceof InstallError ? error.message : error.stack}`);
  process.exitCode = 1;
});
