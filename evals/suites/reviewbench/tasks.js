import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** ReviewBench's PR key: owner_repo_<pr_number>-<head[0:8]> (scripts/lib/types.ts prKey). */
export function prKey(entry) {
  const nwo = entry.repo.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
  return `${nwo.replace('/', '_')}_${entry.pr_number}-${entry.head.slice(0, 8)}`;
}

export function loadCorpus(datasetDir) {
  const read = (rel) => JSON.parse(readFileSync(join(datasetDir, ...rel.split('/')), 'utf8'));
  const full = read('corpus/manifest.json');
  const test = read('corpus/test/test.json');
  return { full, test };
}

/** mulberry32: small, portable, seedable PRNG. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded sample of `size` keys: Fisher-Yates over the sorted keys, result sorted. */
export function seededSample(keys, size, seed) {
  const pool = [...keys].sort();
  if (size > pool.length) throw new Error(`sample size ${size} exceeds pool of ${pool.length}`);
  const rand = mulberry32(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, size).sort();
}

export function keysHash(keys) {
  return `sha256:${createHash('sha256').update([...keys].sort().join('\n')).digest('hex')}`;
}

/**
 * Resolves a split definition from suite.yaml against the corpus.
 * Split shape: { source: full|test|<other split>, exclude?: [split...], sample?: {size, seed}, keysSha256? }
 * keysSha256 freezes a sampled split: a different draw fails instead of running.
 */
export function resolveSplit(name, splits, corpus, seen = new Set()) {
  const def = splits?.[name];
  if (!def) throw new Error(`unknown ReviewBench split: ${name}`);
  if (seen.has(name)) throw new Error(`split ${name} refers to itself`);
  seen.add(name);
  let entries;
  if (def.source === 'full') entries = corpus.full;
  else if (def.source === 'test') entries = corpus.test;
  else entries = resolveSplit(def.source, splits, corpus, new Set(seen));
  const excluded = new Set();
  for (const other of def.exclude ?? []) {
    for (const e of resolveSplit(other, splits, corpus, new Set(seen))) excluded.add(prKey(e));
  }
  entries = entries.filter((e) => !excluded.has(prKey(e)));
  if (def.sample) {
    const picked = new Set(seededSample(entries.map(prKey), def.sample.size, def.sample.seed));
    entries = entries.filter((e) => picked.has(prKey(e)));
  }
  entries = [...entries].sort((a, b) => (prKey(a) < prKey(b) ? -1 : prKey(a) > prKey(b) ? 1 : 0));
  if (def.size !== undefined && entries.length !== def.size) {
    throw new Error(`split ${name} has ${entries.length} PRs, suite.yaml expects ${def.size}`);
  }
  if (def.keysSha256) {
    const actual = keysHash(entries.map(prKey));
    if (actual !== def.keysSha256) throw new Error(`split ${name} drew ${actual}, frozen as ${def.keysSha256}`);
  }
  return entries;
}

export function toTask(entry, split) {
  const nwo = entry.repo.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
  return {
    id: prKey(entry),
    split,
    repo: entry.repo,
    nwo,
    prNumber: entry.pr_number,
    base: entry.base,
    head: entry.head,
    title: entry.title ?? '',
    body: entry.body ?? '',
    language: entry.language ?? null,
  };
}
