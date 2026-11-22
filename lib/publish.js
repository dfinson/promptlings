import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ruleTargets } from "./pins.js";
import { packageRoot, stageRulesync } from "./content.js";
import { runPackage } from "./run.js";

export const includesMemorySkill = (options) => options.agents.includes("memory-manager") && options.memory;
export const includesReadSide = (options) => includesMemorySkill(options) && options.readside;
export const includesDashboard = (options) => options.agents.includes("foreman") && options.dashboard;

// Copies Foreman's dashboard, its bridge extension and a default settings file. Opting out never deletes an existing copy.
export function installDashboard(home = homedir(), copilotHome = process.env.COPILOT_HOME || join(home, ".copilot")) {
  const source = join(packageRoot, "dashboard");
  const target = join(home, ".promptlings", "foreman-dashboard");
  mkdirSync(target, { recursive: true });
  copyFileSync(join(source, "server.mjs"), join(target, "server.mjs"));
  cpSync(join(source, "public"), join(target, "public"), { recursive: true, force: true });
  const { version } = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  writeFileSync(join(target, "version.json"), `${JSON.stringify({ version }, null, 2)}\n`);
  const bridge = join(copilotHome, "extensions", "foreman-bridge");
  mkdirSync(bridge, { recursive: true });
  copyFileSync(join(source, "bridge", "extension.mjs"), join(bridge, "extension.mjs"));
  const state = join(home, ".promptlings", "foreman");
  mkdirSync(state, { recursive: true, mode: 0o700 });
  try { chmodSync(state, 0o700); } catch {}
  const settings = join(state, "settings.json");
  if (!existsSync(settings)) writeFileSync(settings, `${JSON.stringify({ pollMinutes: 5 }, null, 2)}\n`);
}

// Publishes selected agents, bundled skills and the optional memory read-side rule to every supported harness.
export function publish(options, temporary) {
  const source = join(temporary, "rulesync");
  mkdirSync(source, { recursive: true });
  const readSide = includesReadSide(options);
  stageRulesync(source, { agents: options.agents, includeMemory: includesMemorySkill(options), readSide });
  runPackage("rulesync", ["generate", "-g", "--input-roots", ".", "-t", "*", "-f", "subagents,skills"], { cwd: source });
  if (readSide) {
    runPackage("rulesync", ["generate", "-g", "--input-roots", ".", "-t", ruleTargets, "-f", "rules"], { cwd: source });
  }
  if (includesDashboard(options)) installDashboard();
}
