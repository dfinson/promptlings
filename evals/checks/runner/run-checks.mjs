import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Runs every evals check offline. Extra arguments (for example --test-name-pattern=token) go before the
// file list, where node --test applies them.
const checksRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = readdirSync(checksRoot, { recursive: true })
  .map(String)
  .filter((file) => file.endsWith(".check.mjs") && !file.includes("node_modules"))
  .map((file) => relative(process.cwd(), join(checksRoot, file)))
  .sort();
const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...process.argv.slice(2), ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
