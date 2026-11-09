import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { packageRoot, skillFiles, stageRulesync, withTargets } from "../lib/content.js";

const read = (file) => readFileSync(join(packageRoot, file), "utf8");
const agent = read("agents/media/technical-demo.agent.md");
const production = read("skills/technical-demo-production/SKILL.md");

test("restored storytelling uses a treatment-first human-readable script presentation", () => {
  for (const text of [
    "one governing claim", "Select a concrete case", "Storyboard the visual argument",
    "Present the creative treatment first", "human-readable segments in story order",
    "exact narration", "clearly separate spoken-text block", "how it develops the treatment",
    "Em dashes are banned",
  ]) assert.ok(agent.includes(text), text);
  for (const name of ["reasoning-first-writing", "reasoning-first-narration", "narrative-transitions"]) {
    assert.ok(agent.includes(`\`${name}\``));
    assert.ok(existsSync(join(packageRoot, "skills", name, "SKILL.md")));
  }
  assert.match(agent, /visual-only revision does not trigger a new script-writing pass/);
});

test("route selection preserves specialist ownership and approval continuity", () => {
  assert.match(agent, /invoke `motionite`/);
  assert.match(agent, /user explicitly selects HyperFrames, invoke `hyperframes`/);
  assert.match(agent, /For a plain recording, use `cue-synced-demo` directly/);
  assert.match(agent, /Reuse the approval across sessions and checkpoints/);
  assert.match(agent, /material change requires approval of that change/);
  assert.match(agent, /listening-based sample acceptance before full synthesis/);
  assert.match(agent, /one integration owner/);
  assert.match(agent, /Fixed-count self-critique rounds, including Motionite's three-round instruction/);
  assert.doesNotMatch(agent, /Approvals never carry over|Read in full every source/);
  assert.match(read("skills/pr-video/SKILL.md"), /`motionite` and Remotion by default/);
  assert.match(read("skills/cue-synced-demo/SKILL.md"), /follow the director's selected film style/);
});

test("production support retains inputs, concurrency prerequisites, components and native rendering", () => {
  for (const text of [
    "production record", "approval waits", "dependency lockfile", "CPU, memory and browser workers",
    "Final cue scheduling depends on measured audio", "thin React composition",
    "component catalog", "stills-only", "4.0.539", "scale 1", "Failures exit nonzero",
  ]) assert.ok(production.includes(text), text);
  const catalog = read("skills/technical-demo-production/references/components.md");
  for (const name of ["snapcn", "remotion-bits", "parameterized-rendering", "animating-properties"]) {
    assert.ok(catalog.includes(name), name);
  }
  assert.match(agent, /Save full command results once/);
  assert.match(agent, /prompt-to-delivered-draft time/);
});

test("pinned Motionite resources retain original bytes and redistribution notices", () => {
  assert.match(read(".gitattributes"), /skills\/motionite\/\*\* -text -whitespace/);
  const root = join(packageRoot, "skills", "motionite");
  const manifest = JSON.parse(read("skills/motionite/UPSTREAM.json"));
  assert.equal(manifest.revision, "7b7d4dbdc0a725b362317683711d77195336b34a");
  for (const [file, expected] of Object.entries(manifest.files)) {
    assert.ok(!file.includes(".."), file);
    assert.equal(createHash("sha256").update(readFileSync(join(root, file))).digest("hex"), expected.sha256, file);
  }
  assert.match(read("skills/motionite/LICENSE"), /Permission is hereby granted/);
  assert.ok(!existsSync(join(root, "examples", "public", "img")));
  assert.match(read("skills/motionite/UPSTREAM.md"), /deliberately omitted/);
});

test("existing discovery and publication ship the complete production support", (t) => {
  const staging = mkdtempSync(join(tmpdir(), "demo-stage-"));
  t.after(() => rmSync(staging, { recursive: true, force: true }));
  stageRulesync(staging, { agents: ["technical-demo"], includeMemory: false, readSide: false });
  assert.equal(readFileSync(join(staging, "subagents", "technical-demo.md"), "utf8"), withTargets(agent, "technical-demo"));
  const files = skillFiles({ includeMemory: false }).filter((file) => /^(motionite|technical-demo-production)\//.test(file));
  assert.ok(files.includes("technical-demo-production/scripts/render-jobs.mjs"));
  for (const file of files) {
    const original = readFileSync(join(packageRoot, "skills", file));
    const staged = readFileSync(join(staging, "skills", file));
    if (file.endsWith("/SKILL.md")) assert.equal(staged.toString(), withTargets(original.toString(), file), file);
    else assert.ok(staged.equals(original), file);
  }
});
