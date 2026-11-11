import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const fakeCopilot = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "fake-copilot", "copilot.mjs");
export const testToken = "gho_FAKEevalsTOKEN0123456789abcdefXYZ";

export function tempDir(label) {
  return realpathSync(mkdtempSync(join(tmpdir(), `evals-${label}-`)));
}

export function filesUnder(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(full);
    }
  };
  walk(root);
  return out.sort();
}

export function treeDigest(root) {
  const digest = {};
  for (const file of filesUnder(root)) {
    digest[relative(root, file).split(sep).join("/")] = createHash("sha256").update(readFileSync(file)).digest("hex");
  }
  return digest;
}

export function filesContaining(roots, needle) {
  return roots.flatMap((root) => filesUnder(root).filter((file) => readFileSync(file).includes(Buffer.from(needle))));
}

// Points the parent process at a fake "real" home and the fake CLI for the duration of `fn`.
export async function withParentEnv(overrides, fn) {
  const saved = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

export function makeRealHome(root) {
  const home = join(root, "real-home");
  mkdirSync(join(home, ".copilot", "agents"), { recursive: true });
  writeFileSync(join(home, ".copilot", "config.json"), '{"maintainer": true}\n');
  writeFileSync(join(home, ".copilot", "agents", "maintainer.agent.md"), "maintainer agent\n");
  return home;
}

export const stockArm = {
  id: "stock",
  ref: null,
  selection: null,
  agent: null,
  model: "fake-model",
  reasoningEffort: "medium",
  tools: { allow: [], deny: [], allowUrl: [], denyUrl: [] },
  sandbox: false,
  customInstructions: true,
};

export function makeFixtureSuite(root, { repeats = 2, concurrency = 1, ceiling, maxAiCredits = 30, arms, prompt = "Solve {{title}} in {{workspace}}", extraYaml = [], extraAdapter = [] } = {}) {
  const dir = join(root, "suites", "fixture");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(root, "suites", "package.json"), '{"type": "module"}\n');
  const armList = arms ?? [stockArm];
  const armYaml = armList
    .map((arm) => `  - id: ${arm.id}\n    ref: ${arm.ref ?? "null"}\n    model: ${arm.model}\n    reasoningEffort: ${arm.reasoningEffort}\n    selection: ${JSON.stringify(arm.selection ?? null)}\n`)
    .join("");
  writeFileSync(join(dir, "suite.yaml"), [
    "name: fixture",
    "taskSource:",
    "  type: fixtures",
    "splits:",
    "  smoke: {}",
    "arms:",
    armYaml.trimEnd(),
    `prompt: ${JSON.stringify(prompt)}`,
    "limits:",
    "  timeoutMs: 60000",
    `  maxAiCredits: ${maxAiCredits}`,
    ...(ceiling ? ["  stageCeilings:", `    smoke: ${ceiling}`] : []),
    `repeats: ${repeats}`,
    `concurrency: ${concurrency}`,
    "scorers:",
    "  - id: exact",
    "    kind: deterministic",
    "    primary: true",
    "license: fixture data, not redistributed",
    ...extraYaml,
    "",
  ].join("\n"));
  writeFileSync(join(dir, "adapter.js"), [
    'import { writeFileSync } from "node:fs";',
    'import { join } from "node:path";',
    'export async function listTasks(split) { return [{ id: "task-1", title: "the fixture task", split }]; }',
    'export async function materialize(task, workspace) { writeFileSync(join(workspace, "README.md"), "fixture\\n"); }',
    "export async function collect(record, task) { return { task: task.id, status: record.status }; }",
    ...extraAdapter,
    "",
  ].join("\n"));
  return join(root, "suites");
}
