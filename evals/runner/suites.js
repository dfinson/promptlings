import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadManifest } from "./manifest.js";
import { suitesRoot } from "./paths.js";

const required = ["listTasks", "materialize", "collect"];

// Every directory under the suites root holding a suite.yaml is a suite. No registry needs editing.
export function discoverSuites(root = suitesRoot) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, "suite.yaml")))
    .map((entry) => entry.name)
    .sort();
}

export async function loadSuite(name, root = suitesRoot) {
  const dir = resolve(root, name);
  const manifestPath = join(dir, "suite.yaml");
  if (!existsSync(manifestPath)) {
    const known = discoverSuites(root);
    throw new Error(`Unknown suite ${name}. Known suites: ${known.length ? known.join(", ") : "none"}.`);
  }
  const manifest = loadManifest(manifestPath, { suiteName: name });
  const adapterPath = join(dir, "adapter.js");
  if (!existsSync(adapterPath)) throw new Error(`Suite ${name} has no adapter.js.`);
  const adapter = await import(pathToFileURL(adapterPath).href);
  const missing = required.filter((fn) => typeof adapter[fn] !== "function");
  if (missing.length) throw new Error(`Suite ${name} adapter.js must export ${missing.join(", ")}.`);
  return { name, dir, manifest, adapter };
}
