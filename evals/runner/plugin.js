import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { artifactRoot } from "./paths.js";

export const pluginRepoPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export const pluginCommitPattern = /^[0-9a-f]{40}$/;

function git(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  if (result.error) throw result.error;
  return result;
}

function gitOk(args, cwd) {
  const result = git(args, cwd);
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} exited ${result.status}: ${(result.stderr || result.stdout || "").trim()}`);
  return result.stdout.trim();
}

// EVALS_PLUGIN_GIT_BASE replaces https://github.com/ so tests can serve a plugin repository from disk.
export function pluginSourceUrl(repo, env = process.env) {
  const base = env.EVALS_PLUGIN_GIT_BASE || "https://github.com/";
  return `${base.replace(/\/?$/, "/")}${repo}.git`;
}

function mismatch(dir, commit) {
  const head = git(["rev-parse", "HEAD"], dir);
  const sha = head.stdout.trim();
  if (head.status !== 0 || sha !== commit) return `HEAD is ${sha || "unreadable"}, not ${commit}`;
  const status = git(["status", "--porcelain", "--untracked-files=all"], dir);
  if (status.status !== 0) return `git status failed: ${status.stderr.trim()}`;
  if (status.stdout.trim()) return "the checkout has local changes";
  return null;
}

/**
 * Checks out an external plugin repository at a pinned commit under <root>/plugins, outside every trial
 * workspace and home, and returns its identity for --plugin-dir and the trial evidence. A cached checkout is
 * reused only when its HEAD is the pinned commit and it has no local changes; otherwise it is fetched again.
 */
export function preparePlugin(plugin, { root = artifactRoot(), env = process.env } = {}) {
  const { repo, commit } = plugin ?? {};
  if (typeof repo !== "string" || !pluginRepoPattern.test(repo)) throw new Error(`Plugin repo ${repo} must be <owner>/<name>.`);
  if (typeof commit !== "string" || !pluginCommitPattern.test(commit)) throw new Error(`Plugin commit ${commit} must be a 40-character hexadecimal SHA.`);
  const dir = join(root, "plugins", `${repo.replace("/", "__")}@${commit}`);
  if (existsSync(dir) && mismatch(dir, commit) !== null) rmSync(dir, { recursive: true, force: true });
  if (!existsSync(dir)) {
    const staging = `${dir}.tmp-${process.pid}-${Date.now()}`;
    mkdirSync(staging, { recursive: true });
    try {
      const url = pluginSourceUrl(repo, env);
      gitOk(["init", "-q"], staging);
      if (git(["fetch", "-q", "--depth", "1", url, commit], staging).status !== 0) {
        gitOk(["fetch", "-q", url, "+refs/heads/*:refs/remotes/source/*", "+refs/tags/*:refs/tags/*"], staging);
      }
      gitOk(["-c", "advice.detachedHead=false", "checkout", "-q", commit], staging);
      try {
        renameSync(staging, dir);
      } catch (error) {
        if (!existsSync(dir)) throw error;
        rmSync(staging, { recursive: true, force: true });
      }
    } catch (error) {
      rmSync(staging, { recursive: true, force: true });
      throw new Error(`Fetching plugin ${repo}@${commit} failed: ${error.message}`);
    }
  }
  const problem = mismatch(dir, commit);
  if (problem) throw new Error(`Plugin checkout ${dir} does not match ${repo}@${commit}: ${problem}.`);
  const manifestFile = join(dir, "plugin.json");
  if (!existsSync(manifestFile)) throw new Error(`Plugin ${repo}@${commit} has no plugin.json at its root.`);
  let meta;
  try {
    meta = JSON.parse(readFileSync(manifestFile, "utf8"));
  } catch (error) {
    throw new Error(`Plugin ${repo}@${commit} has an unreadable plugin.json: ${error.message}`);
  }
  // Declared extensions are recorded as evidence. On CLI 1.0.106 a -p run with --plugin-dir starts none of them.
  const extensions = [meta.extensions ?? []].flat().map(String);
  return { repo, commit, name: meta.name ?? null, version: meta.version ?? null, extensions, path: dir };
}

/** Prepares each distinct plugin once and returns the arms with `plugin` resolved to its checkout. */
export function preparePlugins(arms, options) {
  const prepared = new Map();
  return arms.map((arm) => {
    if (!arm.plugin) return arm;
    const key = `${arm.plugin.repo}@${arm.plugin.commit}`;
    if (!prepared.has(key)) prepared.set(key, preparePlugin(arm.plugin, options));
    return { ...arm, plugin: prepared.get(key) };
  });
}

/** Per-arm plugin identity for run.json. */
export function pluginSummary(arms) {
  return Object.fromEntries(arms.filter((arm) => arm.plugin).map((arm) => [arm.id, arm.plugin]));
}

/**
 * --plugin-dir loads the plugin but does not let --sandbox tools read it, so the trial home's settings.json grants
 * read-only access to the checkout. A read-only grant, unlike --add-dir, does not load the plugin's skills twice.
 */
export function grantPluginReads(copilotHome, plugin) {
  if (!plugin?.path) return null;
  const file = join(copilotHome, "settings.json");
  const settings = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const sandbox = (settings.sandbox ??= {});
  const filesystem = ((sandbox.userPolicy ??= {}).filesystem ??= {});
  filesystem.readonlyPaths = [...new Set([...(filesystem.readonlyPaths ?? []), plugin.path])];
  mkdirSync(copilotHome, { recursive: true });
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
  return filesystem.readonlyPaths;
}
