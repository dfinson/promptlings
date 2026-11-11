import { createHash } from "node:crypto";
import { copyFileSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

export const redaction = "[REDACTED:COPILOT_GITHUB_TOKEN]";
const maxCopyBytes = 1024 * 1024;

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function toPosix(path) {
  return path.split(sep).join("/");
}

// Lists regular files under root without following symbolic links. Paths are POSIX-style and relative.
export function listFiles(root, { skip = [] } = {}) {
  const files = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = toPosix(relative(root, full));
      if (skip.includes(entry.name) || skip.includes(rel)) continue;
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(rel);
    }
  };
  walk(root);
  return files.sort();
}

export function hashTree(root, options) {
  const hashes = {};
  for (const rel of listFiles(root, options)) hashes[rel] = sha256(readFileSync(join(root, rel)));
  return hashes;
}

export function snapshotWorkspace(workspace) {
  return hashTree(workspace, { skip: [".git"] });
}

export function diffWorkspace(before, workspace, trialDir) {
  const after = snapshotWorkspace(workspace);
  const added = Object.keys(after).filter((p) => !(p in before));
  const removed = Object.keys(before).filter((p) => !(p in after));
  const modified = Object.keys(after).filter((p) => p in before && before[p] !== after[p]);
  const copied = [];
  const tooLarge = [];
  for (const rel of [...added, ...modified]) {
    const source = join(workspace, rel);
    if (lstatSync(source).size > maxCopyBytes) {
      tooLarge.push(rel);
      continue;
    }
    const target = join(trialDir, "workspace-after", rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    copied.push(rel);
  }
  const diff = { added, removed, modified, copied, tooLarge, after };
  const diffPath = join(trialDir, "workspace-diff.json");
  writeFileSync(diffPath, `${JSON.stringify(diff, null, 2)}\n`);
  return { diffPath, diff };
}

// Finds every file containing the token, replaces each occurrence, and returns the affected paths.
export function scrubToken(roots, token, extraFiles = []) {
  if (!token) return [];
  const needle = Buffer.from(token);
  const files = [...extraFiles];
  for (const root of roots) for (const rel of listFiles(root)) files.push(join(root, rel));
  const hits = [];
  for (const file of new Set(files)) {
    let content;
    try {
      content = readFileSync(file);
    } catch {
      continue;
    }
    if (content.indexOf(needle) === -1) continue;
    hits.push(file);
    writeFileSync(file, content.toString("utf8").split(token).join(redaction));
  }
  return hits;
}
