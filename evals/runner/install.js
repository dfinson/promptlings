import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashTree } from "./evidence.js";
import { artifactRoot, repoRoot } from "./paths.js";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, options) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}: ${(result.stderr || result.stdout || "").trim()}`);
  }
  return result.stdout;
}

export function resolveRef(ref) {
  return run("git", ["rev-parse", "--verify", `${ref}^{commit}`], { cwd: repoRoot }).trim();
}

function lockHash(dir) {
  const file = join(dir, "package-lock.json");
  return existsSync(file) ? createHash("sha256").update(readFileSync(file)).digest("hex") : null;
}

// Extracts the Promptlings tree at `ref` into a cached, read-only source directory with its dependencies.
export function prepareSource(ref, { root = artifactRoot() } = {}) {
  const sha = resolveRef(ref);
  const target = join(root, "sources", sha);
  if (existsSync(join(target, ".ready"))) return { sha, dir: target };
  const staging = `${target}.tmp-${process.pid}-${Date.now()}`;
  mkdirSync(staging, { recursive: true });
  try {
    const archive = join(staging, "..", `${sha}-${process.pid}.tar`);
    run("git", ["archive", "--format=tar", `--output=${archive}`, sha], { cwd: repoRoot });
    run("tar", ["-xf", archive, "-C", staging]);
    rmSync(archive, { force: true });
    const sameLock = lockHash(staging) && lockHash(staging) === lockHash(repoRoot);
    if (sameLock && existsSync(join(repoRoot, "node_modules"))) {
      symlinkSync(join(repoRoot, "node_modules"), join(staging, "node_modules"), "junction");
    } else {
      run(npmCommand, ["ci", "--no-fund", "--no-audit", "--ignore-scripts"], { cwd: staging, shell: process.platform === "win32" });
    }
    writeFileSync(join(staging, ".ready"), `${sha}\n`);
    try {
      renameSync(staging, target);
    } catch (error) {
      if (!existsSync(join(target, ".ready"))) throw error;
      rmSync(staging, { recursive: true, force: true });
    }
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  return { sha, dir: target };
}

export function selectionArgs(selection) {
  if (Array.isArray(selection)) return selection.map(String);
  if (!selection || selection === "all") return ["--all"];
  if (selection === "review") return ["--review"];
  return ["--agents", String(selection)];
}

export function isStockArm(arm) {
  return arm.ref === null || arm.ref === undefined || arm.ref === "none";
}

/**
 * Resolves every arm's ref to a commit SHA. `null` or "none" is a stock arm. "candidate" is the current
 * checkout's HEAD unless `candidateRef` is given; "previous" requires `previousRef`; any other string is a
 * Git ref. Returns { refs: {armId: sha|null}, arms: arms with `resolvedRef` set }.
 */
export function resolveArmRefs(arms, { candidateRef, previousRef } = {}) {
  const refs = {};
  const resolved = arms.map((arm) => {
    if (isStockArm(arm)) {
      refs[arm.id] = null;
      return { ...arm, resolvedRef: null };
    }
    let ref = arm.ref;
    if (ref === "candidate") ref = candidateRef || "HEAD";
    else if (ref === "previous") {
      if (!previousRef) throw new Error(`Arm ${arm.id} installs the previous ref; pass --previous-ref <git-ref>.`);
      ref = previousRef;
    }
    const sha = resolveRef(ref);
    refs[arm.id] = sha;
    return { ...arm, resolvedRef: sha };
  });
  return { refs, arms: resolved };
}

// Installs the arm's Promptlings ref into the isolated home and returns the hashes of every file it wrote.
// A stock arm installs nothing.
export function installArm(arm, { home, env, root }) {
  if (isStockArm(arm)) return { installedHashes: {}, sourceSha: null };
  if (arm.ref === "previous" && !arm.resolvedRef) throw new Error(`Arm ${arm.id} installs the previous ref; pass --previous-ref <git-ref>.`);
  const ref = arm.resolvedRef ?? (arm.ref === "candidate" ? "HEAD" : arm.ref);
  const source = prepareSource(ref, { root });
  const before = hashTree(home);
  const args = [join(source.dir, "bin", "promptlings.js"), "publish", ...selectionArgs(arm.selection), "--no-readside", "--yes"];
  const result = spawnSync(process.execPath, args, { cwd: home, env, encoding: "utf8", windowsHide: true });
  if (result.error || result.status !== 0) {
    throw new Error(`Promptlings publish failed (${result.status}): ${(result.error?.message || result.stderr || result.stdout || "").trim()}`);
  }
  const after = hashTree(home);
  const installedHashes = {};
  for (const [path, hash] of Object.entries(after)) {
    if (before[path] !== hash) installedHashes[path] = hash;
  }
  return { installedHashes, sourceSha: source.sha, log: result.stdout };
}
