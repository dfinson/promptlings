import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ruleTargets } from "./pins.js";
import { stageRulesync } from "./content.js";
import { runPackage } from "./run.js";

export const includesMemorySkill = (options) => options.agents.includes("memory-manager") && options.memory;
export const includesReadSide = (options) => includesMemorySkill(options) && options.readside;

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
}
