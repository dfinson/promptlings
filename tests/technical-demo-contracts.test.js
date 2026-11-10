import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { packageRoot, skillFiles, stageRulesync, withTargets } from "../lib/content.js";
import { pins } from "../lib/pins.js";

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

test("output discipline covers every surface and requires a concrete reason for qualifications", () => {
  for (const text of [
    "every user-facing output", "narration, on-screen text, captions, treatments",
    "progress updates, approval requests and delivery messages",
    "Default to omission", "specific claim materially misleading",
    "conceal a required user decision", "Identify that claim or decision internally",
    "General reassurance, hypothetical risks and statements of diligence do not qualify",
    "rather than repeating it across the output",
    "timing/check results and rerun instructions in linked or attached production artifacts",
  ]) assert.ok(agent.includes(text), text);
  assert.ok(agent.indexOf("## Keep every output useful") < agent.indexOf("## 1. Discover"));
});

test("route selection preserves specialist ownership and approval continuity", () => {
  assert.match(agent, /invoke the installer's pinned upstream `motionite`/);
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

test("composed films ground the storyboard in a moving reference without another approval round", () => {
  for (const text of [
    "Before storyboarding an authored film or composed hybrid",
    "inspect a finished product demo as a moving sequence",
    "reusing an available reference when suitable",
    "one concrete directing behavior with timecodes",
    "Apply that behavior to this film's actual evidence",
    "Record the reference and transferable behavior in the existing production record",
    "not an additional approval or review round",
  ]) assert.ok(agent.includes(text), text);
  assert.ok(agent.indexOf("Before storyboarding an authored film") < agent.indexOf("Storyboard the visual argument"));
  assert.doesNotMatch(agent, /Reference imitation is optional when requested, not a prerequisite/);
});

test("the directing package carries evidence through framing, handoffs, holds and targeted correction", () => {
  for (const text of [
    "In the existing shot list",
    "evidence object, its visible change, the decisive native-resolution region",
    "restore context when the next action needs it",
    "carry the recognizable evidence object",
    "capture-to-explanation and explanation-to-capture handoffs",
    "readable verbatim excerpt linked to its visible source region",
    "continuous soundtrack, including intervals spanning cuts",
    "decorative movement does not make one useful",
  ]) assert.ok(agent.includes(text), text);
  for (const text of [
    "Moving-reference timecodes",
    "non-speech inspection purpose",
    "actual audio across the relevant capture/authored joins",
    "highlight bounds after crop, scale and translation",
    "borders must clear the intended text",
    "an actionable control visible when it is used",
    "unrelated names, stale labels and burned-in overlays",
    "retain the observed defect and corrected output",
    "rerun the affected interval and joins",
  ]) assert.ok(production.includes(text), text);
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

test("production targets a complete moving preview through the existing execution path", () => {
  for (const text of [
    "complete playable timeline the first production target",
    "existing Motionite/Remotion preview",
    "job manifest, not a new renderer script",
    "concrete unsupported requirement or observed error",
    "rather than looping over individual still renders",
    "not as a separate exhaustive review phase",
  ]) assert.ok(agent.includes(text), text);
  for (const text of [
    "complete previewable composition",
    "recorded media, authored scenes and actual soundtrack",
    "job manifest instead of writing another rendering wrapper",
    "per-frame FFmpeg compositing loop",
    "unchanged-audio muxing remain valid",
    "not another gate",
  ]) assert.ok(production.includes(text), text);
  assert.ok(agent.indexOf("complete playable timeline") < agent.indexOf("Render the required video after moving review"));
  assert.match(agent, /Still inspection, format checks and audio hashes do not satisfy moving-output review/);
  assert.match(agent, /preserve the file as a preview/);
});

test("Motionite belongs to the pinned upstream installer rather than the package", () => {
  assert.equal(pins.motioniteSkills, "https://github.com/nxrskyaa/motionite/tree/7b7d4dbdc0a725b362317683711d77195336b34a");
  assert.ok(!existsSync(join(packageRoot, "skills", "motionite")));
  const catalog = read("skills/technical-demo-production/references/components.md");
  assert.match(catalog, /Installed from a pinned upstream revision/);
  assert.match(catalog, /SIL OFL/);
  assert.match(catalog, /Installation is not permission to reuse product imagery/);
});

test("existing discovery and publication ship the complete production support", (t) => {
  const staging = mkdtempSync(join(tmpdir(), "demo-stage-"));
  t.after(() => rmSync(staging, { recursive: true, force: true }));
  stageRulesync(staging, { agents: ["technical-demo"], includeMemory: false, readSide: false });
  assert.equal(readFileSync(join(staging, "subagents", "technical-demo.md"), "utf8"), withTargets(agent, "technical-demo"));
  const discovered = skillFiles({ includeMemory: false });
  assert.ok(!discovered.some((file) => file.startsWith("motionite/")));
  const files = discovered.filter((file) => /^(technical-demo-production|cue-synced-demo|pr-video)\//.test(file));
  assert.ok(files.includes("technical-demo-production/scripts/render-jobs.mjs"));
  for (const file of files) {
    const original = readFileSync(join(packageRoot, "skills", file));
    const staged = readFileSync(join(staging, "skills", file));
    if (file.endsWith("/SKILL.md")) assert.equal(staged.toString(), withTargets(original.toString(), file), file);
    else assert.ok(staged.equals(original), file);
  }
});
