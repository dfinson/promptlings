import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LOCK_KEY = 'reviewbench';
export const DEFAULT_LOCK_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'datasets.lock');

export class DatasetPinError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DatasetPinError';
  }
}

export function git(args, options = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1', ...options.env },
    cwd: options.cwd,
  }).trim();
}

export function readLockEntry(lockPath = DEFAULT_LOCK_PATH, key = LOCK_KEY) {
  if (!existsSync(lockPath)) throw new DatasetPinError(`datasets.lock not found at ${lockPath}; dataset ${key} is unpinned`);
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const entry = lock?.datasets?.[key];
  if (!entry) throw new DatasetPinError(`dataset ${key} is unpinned: no entry in ${lockPath}`);
  assertPinned(entry, key);
  return entry;
}

export function assertPinned(entry, key = LOCK_KEY) {
  const problems = [];
  if (entry?.source?.type !== 'git' || typeof entry?.source?.url !== 'string') problems.push('source must be {type: "git", url}');
  if (!/^[0-9a-f]{40}$/.test(entry?.commit ?? '')) problems.push('commit must be a full 40-character SHA');
  if (!/^sha256:[0-9a-f]{64}$/.test(entry?.contentHash ?? '')) problems.push('contentHash must be sha256:<64 hex>');
  if (!Array.isArray(entry?.contentPaths) || entry.contentPaths.length === 0) problems.push('contentPaths must list the hashed paths');
  if (typeof entry?.codeLicense !== 'string' || !entry.codeLicense) problems.push('codeLicense must be recorded');
  if (!entry || !('dataLicense' in entry)) problems.push('dataLicense must be recorded (null when not stated)');
  if (problems.length) throw new DatasetPinError(`dataset ${key} is unpinned: ${problems.join('; ')}`);
}

/** A dataset without a stated data license needs a recorded maintainer decision before use. */
export function assertLicenseDecided(entry, key = LOCK_KEY) {
  if (entry.dataLicense) return;
  const decision = entry.licenseDecision;
  if (!decision || typeof decision.decision !== 'string' || typeof decision.by !== 'string' || typeof decision.date !== 'string') {
    throw new DatasetPinError(
      `dataset ${key} states no data license; a maintainer must record licenseDecision {decision, by, date} in datasets.lock before use`,
    );
  }
}

function listFiles(root, rel) {
  const abs = join(root, ...rel.split('/'));
  if (!existsSync(abs)) throw new DatasetPinError(`pinned content path ${rel} is missing`);
  if (statSync(abs).isFile()) return [rel];
  return readdirSync(abs).flatMap((name) => listFiles(root, `${rel}/${name}`));
}

/** sha256 over the sorted "path<TAB>sha256(bytes)" lines of every file under the pinned content paths. */
export function contentHash(root, contentPaths) {
  const lines = [];
  for (const rel of contentPaths) {
    for (const file of listFiles(root, rel)) {
      const digest = createHash('sha256').update(readFileSync(join(root, ...file.split('/')))).digest('hex');
      lines.push(`${file}\t${digest}\n`);
    }
  }
  lines.sort();
  return `sha256:${createHash('sha256').update(lines.join('')).digest('hex')}`;
}

export function verifyDataset(dir, entry, key = LOCK_KEY) {
  assertPinned(entry, key);
  let head;
  try {
    head = git(['rev-parse', 'HEAD'], { cwd: dir });
  } catch {
    throw new DatasetPinError(`dataset ${key} at ${dir} is not a Git checkout`);
  }
  if (head !== entry.commit) {
    throw new DatasetPinError(`dataset ${key} changed: checkout is at ${head}, lock pins ${entry.commit}`);
  }
  const actual = contentHash(dir, entry.contentPaths);
  if (actual !== entry.contentHash) {
    throw new DatasetPinError(`dataset ${key} changed: content hash ${actual} does not match pinned ${entry.contentHash}`);
  }
  return { dir, commit: head, contentHash: actual };
}

export function datasetCacheDir(artifactRoot, entry) {
  return join(artifactRoot, 'datasets', LOCK_KEY, entry.commit);
}

/**
 * Fetches the pinned commit into the artifact root's dataset cache (once) and verifies it.
 * Line endings stay byte-exact (core.autocrlf=false) so the content hash is portable.
 */
export function ensureDataset({ artifactRoot, lockPath = DEFAULT_LOCK_PATH, sourceUrl, requireLicenseDecision = true } = {}) {
  if (!artifactRoot) throw new Error('artifactRoot (ctx.artifactRoot or EVALS_ARTIFACT_ROOT) is required');
  const entry = readLockEntry(lockPath);
  if (requireLicenseDecision) assertLicenseDecided(entry);
  const dir = datasetCacheDir(artifactRoot, entry);
  if (!existsSync(dir)) {
    const tmp = `${dir}.partial-${process.pid}`;
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(dirname(dir), { recursive: true });
    git(['clone', '--quiet', '--config', 'core.autocrlf=false', '--no-checkout', sourceUrl ?? entry.source.url, tmp]);
    git(['-c', 'advice.detachedHead=false', 'checkout', '--quiet', '--detach', entry.commit], { cwd: tmp });
    renameSync(tmp, dir);
  }
  return { ...verifyDataset(dir, entry), entry };
}
