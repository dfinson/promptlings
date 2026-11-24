import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { fail } from "./run.js";

export const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const memorySkill = "promptlings-memory-capture";

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "__pycache__" ? [] : walk(path);
    return entry.name.endsWith(".pyc") ? [] : [path];
  }).sort();
}

const toPosix = (path) => path.split(sep).join("/");

// Agents are discovered from agents/**/NAME.agent.md, so new agents need no installer change.
export function discoverAgents(root = packageRoot) {
  const agents = new Map();
  for (const path of walk(join(root, "agents"))) {
    if (!path.endsWith(".agent.md")) continue;
    const name = basename(path, ".agent.md");
    if (agents.has(name)) fail(`Duplicate agent name: ${name}`);
    agents.set(name, path);
  }
  return agents;
}

// Every file under skills/ ships, including scripts and references.
export function skillFiles({ includeMemory }, root = packageRoot) {
  const skillsRoot = join(root, "skills");
  return walk(skillsRoot)
    .map((path) => toPosix(relative(skillsRoot, path)))
    .filter((path) => includeMemory || !path.startsWith(`${memorySkill}/`));
}

const normalize = (text) => text.replace(/\r\n/g, "\n");

// rulesync skips sources without targets.
export function withTargets(text, source) {
  const body = normalize(text);
  if (!body.startsWith("---\n")) fail(`No frontmatter: ${source}`);
  return `---\ntargets: ["*"]\n${body.slice(4)}`;
}

export const readSideStart = "<!-- memory-manager-read-side-start -->";
export const readSideEnd = "<!-- memory-manager-read-side-end -->";

function managedRule(path, start, end, label, { scoped = true } = {}) {
  const block = normalize(readFileSync(path, "utf8"));
  if (!block.startsWith(`${start}\n`) || !block.trimEnd().endsWith(end)) fail(`Invalid ${label}.`);
  return `---\ntargets: ["*"]\n${scoped ? 'globs: ["**/*"]\n' : ""}---\n${block}`;
}

export function readSideRule(root = packageRoot) {
  return managedRule(join(root, "agents", "context", "memory-manager-read-side.md"), readSideStart, readSideEnd,
    "memory read-side rule");
}

export const prRuleSkill = "pr-description-writing";
export const prRuleStart = "<!-- promptlings-pr-description-writing-start -->";
export const prRuleEnd = "<!-- promptlings-pr-description-writing-end -->";

export function prDescriptionRule(root = packageRoot, { scoped = true } = {}) {
  return managedRule(join(root, "rules", "pr-description-writing.md"), prRuleStart, prRuleEnd,
    "PR description rule", { scoped });
}

// rulesync turns globs into Claude Code `paths`, which loads a rule only after the agent reads a matching file.
// A PR edit can happen without any file read, so Claude Code gets its rules from this separate input root.
export const claudeRulesRoot = "claudecode";

// Builds the rulesync input tree for the selected agents, bundled skills and global rules.
// The PR description rule ships with its skill. Returns the staged rule file names.
export function stageRulesync(destination, { agents, includeMemory, readSide }, root = packageRoot) {
  const available = discoverAgents(root);
  mkdirSync(join(destination, "subagents"), { recursive: true });
  for (const name of agents) {
    const path = available.get(name) || fail(`Unknown agent: ${name}`);
    writeFileSync(join(destination, "subagents", `${name}.md`), withTargets(readFileSync(path, "utf8"), path));
  }
  const skills = skillFiles({ includeMemory }, root);
  for (const path of skills) {
    const source = join(root, "skills", path);
    const target = join(destination, "skills", path);
    mkdirSync(dirname(target), { recursive: true });
    if (basename(path) === "SKILL.md") writeFileSync(target, withTargets(readFileSync(source, "utf8"), source));
    else copyFileSync(source, target);
  }
  const rules = {};
  if (readSide) rules["promptlings-memory.md"] = [readSideRule(root), readSideRule(root)];
  if (skills.includes(`${prRuleSkill}/SKILL.md`)) {
    rules["promptlings-pr-description-writing.md"] = [prDescriptionRule(root), prDescriptionRule(root, { scoped: false })];
  }
  for (const [name, [shared, claude]] of Object.entries(rules)) {
    for (const [directory, text] of [[destination, shared], [join(destination, claudeRulesRoot), claude]]) {
      mkdirSync(join(directory, "rules"), { recursive: true });
      writeFileSync(join(directory, "rules", name), text);
    }
  }
  return Object.keys(rules);
}
