#!/usr/bin/env node
// AC-1: the published promptlings package must not contain any evals/ file.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const command = "npm pack --dry-run --json --ignore-scripts";
// One fixed command string through the shell, so npm.cmd resolves on Windows without passing arguments to a shell.
const result = spawnSync(command, { cwd: repoRoot, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 });
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  console.error(`npm pack --dry-run exited with ${result.status}.`);
  process.exit(1);
}

let packed;
try {
  packed = JSON.parse(result.stdout);
} catch {
  console.error("npm pack --dry-run --json did not print JSON:");
  console.error(result.stdout);
  process.exit(1);
}
const files = packed.flatMap((entry) => entry.files ?? []).map((file) => file.path.replace(/\\/g, "/"));
if (!files.length) {
  console.error("npm pack --dry-run listed no files; cannot confirm the package contents.");
  process.exit(1);
}
const leaked = files.filter((path) => path === "evals" || path.startsWith("evals/"));
if (leaked.length) {
  console.error(`The published package includes ${leaked.length} evals file(s):`);
  for (const path of leaked) console.error(`  ${path}`);
  process.exit(1);
}
console.log(`Package check passed: ${files.length} packed files, none under evals/.`);