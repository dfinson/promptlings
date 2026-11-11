import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

// Maps a suite's `analysis` block (top level, overridden per stage by stages[name].analysis) to report options.
// Suites list each comparison as [treatment, baseline]; the report takes [baseline, treatment].
export function stageAnalysis(manifest, stageName) {
  return manifest.stages?.[stageName]?.analysis;
}

// The stage's own analysis block (for example {verdict, minPairedN}) is passed unchanged as `analysis`;
// planned n comes from the task list, not from minPairedN.
// `defaults` is the report's DEFAULT_DECLARED_DIFFERENCES; the suite's analysis.declaredDifferences (a stage-level list
// replaces the suite's) adds the arm fields a comparison may differ in without being confounded.
export function reportOptions(manifest, stageName, armIds, defaults = []) {
  const own = stageAnalysis(manifest, stageName);
  const analysis = { ...(manifest.analysis ?? {}), ...(own ?? {}) };
  const options = { ...analysis };
  if (own) options.analysis = own;
  if (Array.isArray(analysis.comparisons)) {
    options.comparisons = analysis.comparisons
      .map(([treatment, baseline]) => [baseline, treatment])
      .filter((pair) => pair.every((id) => armIds.includes(id)));
  }
  if (!options.primary && analysis.primaryMetric) options.primary = [analysis.primaryMetric];
  if (typeof analysis.guardrail === "string") options.guardrail = [analysis.guardrail];
  if (typeof analysis.secondary === "string") options.secondary = [analysis.secondary];
  if (options.alpha === undefined && analysis.familywiseAlpha !== undefined) options.alpha = analysis.familywiseAlpha;
  const declared = analysis.declaredDifferences ?? [];
  if (!Array.isArray(declared) || declared.some((field) => typeof field !== "string")) {
    throw new Error("analysis.declaredDifferences must be a list of arm field names");
  }
  if (defaults.length || declared.length) options.declaredDifferences = [...new Set([...defaults, ...declared])];
  return options;
}

/** A declared comparison list with no pair inside this stage means the stage has nothing to compare. */
export function hasComparisons(options) {
  return !Array.isArray(options.comparisons) || options.comparisons.length > 0;
}

// Adds a failed or skipped panel to the written report, which the report module does not know about.
export function notePanelInReport(run) {
  if (!run.panel || run.panel.ok || !run.report?.json) return;
  const report = JSON.parse(readFileSync(run.report.json, "utf8"));
  writeFileSync(run.report.json, `${JSON.stringify({ ...report, panel: run.panel }, null, 2)}\n`);
  const line = run.panel.error ? `The analysis panel failed: ${run.panel.error}` : `The analysis panel was skipped: ${run.panel.skipped}`;
  appendFileSync(run.report.markdown, `\n## Analysis panel\n\n${line}\n`);
}
