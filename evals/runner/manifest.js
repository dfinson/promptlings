import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { pluginCommitPattern, pluginRepoPattern } from "./plugin.js";

function fail(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validateArm(arm, index, errors) {
  const at = `arms[${index}]`;
  if (!isObject(arm)) return fail(errors, at, "must be a mapping");
  if (typeof arm.id !== "string" || !/^[A-Za-z0-9._-]+$/.test(arm.id)) fail(errors, `${at}.id`, "must be a path-safe string");
  if (arm.ref !== null && arm.ref !== undefined && typeof arm.ref !== "string") fail(errors, `${at}.ref`, "must be a Git ref or null");
  if (typeof arm.model !== "string" || !arm.model || arm.model === "auto") fail(errors, `${at}.model`, "must pin a model (auto is not allowed)");
  if (typeof arm.reasoningEffort !== "string" || !arm.reasoningEffort || arm.reasoningEffort === "auto") {
    fail(errors, `${at}.reasoningEffort`, "must pin a reasoning effort");
  }
  if (arm.maxAiCredits !== undefined && (typeof arm.maxAiCredits !== "number" || arm.maxAiCredits < 30)) fail(errors, `${at}.maxAiCredits`, "must be a number of at least 30");
  if (arm.limits !== undefined) {
    if (!isObject(arm.limits)) fail(errors, `${at}.limits`, "must be a mapping");
    else {
      const credits = arm.limits.maxAiCredits;
      if (credits !== undefined && (typeof credits !== "number" || credits < 30)) fail(errors, `${at}.limits.maxAiCredits`, "must be a number of at least 30");
      if (arm.limits.timeoutMs !== undefined && !positiveInteger(arm.limits.timeoutMs)) fail(errors, `${at}.limits.timeoutMs`, "must be a positive integer");
    }
  }
  if (arm.agent !== undefined && arm.agent !== null && typeof arm.agent !== "string") fail(errors, `${at}.agent`, "must be a string or null");
  if (arm.plugin !== undefined && arm.plugin !== null) {
    if (!isObject(arm.plugin)) fail(errors, `${at}.plugin`, "must be a mapping with repo and commit");
    else {
      if (typeof arm.plugin.repo !== "string" || !pluginRepoPattern.test(arm.plugin.repo)) fail(errors, `${at}.plugin.repo`, "must be <owner>/<name>");
      if (typeof arm.plugin.commit !== "string" || !pluginCommitPattern.test(arm.plugin.commit)) {
        fail(errors, `${at}.plugin.commit`, "must be a 40-character lowercase hexadecimal commit SHA");
      }
    }
  }
  if (arm.tools !== undefined) {
    if (!isObject(arm.tools)) fail(errors, `${at}.tools`, "must be a mapping");
    else {
      for (const key of ["allow", "deny", "allowUrl", "denyUrl"]) {
        const list = arm.tools[key];
        if (list !== undefined && (!Array.isArray(list) || list.some((v) => typeof v !== "string"))) {
          fail(errors, `${at}.tools.${key}`, "must be a list of strings");
        }
      }
    }
  }
}

function normalizeArm(arm) {
  return {
    ...arm,
    ref: arm.ref === "none" ? null : arm.ref ?? null,
    maxAiCredits: arm.maxAiCredits ?? arm.limits?.maxAiCredits,
    timeoutMs: arm.timeoutMs ?? arm.limits?.timeoutMs,
    selection: arm.selection ?? null,
    agent: arm.agent ?? null,
    plugin: arm.plugin ? { repo: arm.plugin.repo, commit: arm.plugin.commit } : null,
    tools: { allow: [], deny: [], allowUrl: [], denyUrl: [], ...(arm.tools ?? {}) },
    sandbox: arm.sandbox ?? false,
    customInstructions: arm.customInstructions ?? true,
  };
}

/**
 * Validates a parsed suite manifest. Required keys follow the shared contract; other top-level keys
 * (for example reviewRequests or judge) and suite-specific keys inside `stages` pass through unchanged.
 */
export function validateManifest(manifest, { suiteName } = {}) {
  const errors = [];
  if (!isObject(manifest)) return { errors: ["manifest: must be a mapping"], manifest: null };
  const m = manifest;
  if (typeof m.name !== "string" || !m.name) fail(errors, "name", "is required");
  else if (suiteName && m.name !== suiteName) fail(errors, "name", `must match the suite directory (${suiteName})`);
  if (!isObject(m.taskSource) || typeof m.taskSource.type !== "string") fail(errors, "taskSource.type", "is required");
  if (!isObject(m.splits)) fail(errors, "splits", "must be a mapping of split names");
  if (!Array.isArray(m.arms) || !m.arms.length) fail(errors, "arms", "must list at least one arm");
  else {
    m.arms.forEach((arm, i) => validateArm(arm, i, errors));
    const ids = m.arms.map((a) => a?.id);
    if (new Set(ids).size !== ids.length) fail(errors, "arms", "ids must be unique");
  }
  if (typeof m.prompt !== "string" || !m.prompt.trim()) fail(errors, "prompt", "is required");
  if (!isObject(m.limits)) fail(errors, "limits", "is required");
  else {
    if (!positiveInteger(m.limits.timeoutMs)) fail(errors, "limits.timeoutMs", "must be a positive integer");
    if (typeof m.limits.maxAiCredits !== "number" || m.limits.maxAiCredits <= 0) fail(errors, "limits.maxAiCredits", "must be a positive number");
    if (m.limits.stageCeilings !== undefined && !isObject(m.limits.stageCeilings)) fail(errors, "limits.stageCeilings", "must be a mapping");
    for (const [stage, value] of Object.entries(m.limits.stageCeilings ?? {})) {
      if (typeof value !== "number" || value <= 0) fail(errors, `limits.stageCeilings.${stage}`, "must be a positive number");
    }
  }
  if (!positiveInteger(m.repeats)) fail(errors, "repeats", "must be a positive integer");
  if (!positiveInteger(m.concurrency)) fail(errors, "concurrency", "must be a positive integer");
  if (!Array.isArray(m.scorers) || !m.scorers.length) fail(errors, "scorers", "must list at least one scorer");
  else {
    m.scorers.forEach((s, i) => {
      if (!isObject(s) || typeof s.id !== "string") fail(errors, `scorers[${i}].id`, "is required");
      else if (typeof s.kind !== "string" || !s.kind) fail(errors, `scorers[${i}].kind`, "is required");
      else if (s.rubric !== undefined && typeof s.rubric !== "string") fail(errors, `scorers[${i}].rubric`, "must be a string");
      else if (s.kind === "llm-rubric" && !s.rubric?.trim()) fail(errors, `scorers[${i}].rubric`, "is required for llm-rubric scorers");
    });
    if (!m.scorers.some((s) => s?.primary === true)) fail(errors, "scorers", "must mark at least one primary scorer");
  }
  const licensed = (typeof m.license === "string" && m.license.trim()) || (isObject(m.license) && Object.keys(m.license).length);
  if (!licensed) fail(errors, "license", "is required (a statement or a mapping such as {code, data, redistribution})");
  if (m.stages !== undefined) {
    if (!isObject(m.stages)) fail(errors, "stages", "must be a mapping");
    else {
      const armIds = new Set((m.arms ?? []).map((a) => a?.id));
      for (const [name, stage] of Object.entries(m.stages)) {
        if (!isObject(stage)) {
          fail(errors, `stages.${name}`, "must be a mapping");
          continue;
        }
        if (stage.split !== undefined && isObject(m.splits) && !(stage.split in m.splits)) fail(errors, `stages.${name}.split`, `unknown split ${stage.split}`);
        if (stage.arms !== undefined) {
          if (!Array.isArray(stage.arms)) fail(errors, `stages.${name}.arms`, "must list arm ids");
          else for (const id of stage.arms) if (!armIds.has(id)) fail(errors, `stages.${name}.arms`, `unknown arm ${id}`);
        }
        if (stage.repeats !== undefined && !positiveInteger(stage.repeats)) fail(errors, `stages.${name}.repeats`, "must be a positive integer");
        if (stage.concurrency !== undefined && !positiveInteger(stage.concurrency)) fail(errors, `stages.${name}.concurrency`, "must be a positive integer");
        if (stage.maxAiCredits !== undefined && (typeof stage.maxAiCredits !== "number" || stage.maxAiCredits <= 0)) fail(errors, `stages.${name}.maxAiCredits`, "must be a positive number");
        if (stage.ceilingGroup !== undefined && (typeof stage.ceilingGroup !== "string" || !/^[A-Za-z0-9._-]+$/.test(stage.ceilingGroup))) fail(errors, `stages.${name}.ceilingGroup`, "must be a path-safe string");
      }
    }
  }
  if (errors.length) return { errors, manifest: null };
  return { errors, manifest: { ...m, arms: m.arms.map(normalizeArm) } };
}

export function loadManifest(file, options) {
  const parsed = parse(readFileSync(file, "utf8"));
  const { errors, manifest } = validateManifest(parsed, options);
  if (errors.length) throw new Error(`Invalid suite manifest ${file}:\n  ${errors.join("\n  ")}`);
  return manifest;
}

/**
 * Resolves the split, arms, repeats and concurrency for a stage. `stages[stage]` wins when present; otherwise the stage
 * name is used as the split name with every arm and the suite's repeats.
 */
export function resolveStage(manifest, stage) {
  const block = manifest.stages?.[stage];
  const split = block?.split ?? stage;
  if (!manifest.splits || !(split in manifest.splits)) {
    throw new Error(`Suite ${manifest.name} has no stage or split named ${stage}.`);
  }
  const armIds = block?.arms ?? manifest.arms.map((a) => a.id);
  return {
    name: stage,
    split,
    arms: manifest.arms.filter((a) => armIds.includes(a.id)),
    repeats: block?.repeats ?? manifest.repeats,
    concurrency: block?.concurrency ?? manifest.concurrency,
    ceiling: block?.maxAiCredits ?? manifest.limits.stageCeilings?.[stage] ?? null,
    group: block?.ceilingGroup ?? null,
    groupCeiling: block?.ceilingGroup ? groupCeiling(manifest, block.ceilingGroup) : null,
    block: block ?? null,
  };
}

// A ceiling group's ceiling is the largest value declared for the group itself or any stage in it.
export function groupCeiling(manifest, group) {
  const values = [];
  const ceilings = manifest.limits.stageCeilings ?? {};
  if (typeof ceilings[group] === "number") values.push(ceilings[group]);
  for (const [name, stage] of Object.entries(manifest.stages ?? {})) {
    if (stage?.ceilingGroup !== group) continue;
    if (typeof stage.maxAiCredits === "number") values.push(stage.maxAiCredits);
    if (typeof ceilings[name] === "number") values.push(ceilings[name]);
  }
  return values.length ? Math.max(...values) : null;
}
