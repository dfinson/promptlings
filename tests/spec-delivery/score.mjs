import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.argv[2]) throw new Error("Specify an existing external benchmark directory");
const directory = resolve(process.argv[2]);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fromRoot = relative(root, directory);
if (!fromRoot || (!isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`))) {
  throw new Error("Benchmark summaries must be outside the repository");
}
const hash = (text) => createHash("sha256").update(text).digest("hex");
const rows = [];
for (const name of readdirSync(directory).sort()) {
  const resultPath = join(directory, name, "result.json");
  if (!existsSync(resultPath)) continue;
  const result = JSON.parse(readFileSync(resultPath, "utf8"));
  const verificationPath = join(directory, name, "delivery-verification.json");
  const verification = existsSync(verificationPath) ? JSON.parse(readFileSync(verificationPath, "utf8")) : null;
  const final = verification?.final ?? result.final;
  const acceptance = verification?.acceptance ?? result.acceptance;
  const audit = readFileSync(join(directory, name, "audit.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  const toolExecutions = audit.filter((e) => ["fixture_run", "run"].includes(e.tool) && Array.isArray(e.argv));
  const helperGates = [];
  for (const event of toolExecutions) {
    if (!event.argv.some((part) => part.endsWith("gate.py")) || !event.stdout.trim().startsWith("{")) continue;
    const report = JSON.parse(event.stdout);
    if (Array.isArray(report.evidence)) helperGates.push({ owner: event.owner, argv: event.argv, exit: event.exit, ...report });
  }
  const executions = [...toolExecutions, ...helperGates.flatMap((gate) => gate.evidence.map((event) => ({ owner: gate.owner, ...event })))];
  const starts = audit.filter((e) => e.tool === "start_lane");
  const firstWait = audit.findIndex((e) => ["wait_lane_start", "wait_lane"].includes(e.tool));
  const beforeFirstWait = audit.slice(0, firstWait < 0 ? audit.length : firstWait).filter((e) => e.tool === "start_lane");
  const writes = audit.filter((e) => ["fixture_write", "write_file"].includes(e.tool));
  const masterProductWrites = writes.filter((e) => e.owner === "master" && /^(store|formatting|app)\.py$|^tests[\\/]/.test(e.path));
  const testFailures = executions.filter((e) => e.exit !== 0 && /FAIL:|AssertionError/.test(e.stdout + e.stderr));
  const specDirectory = join(directory, name, "repo", "specs");
  const specs = existsSync(specDirectory) ? readdirSync(specDirectory).map((file) => {
    const text = readFileSync(join(specDirectory, file), "utf8");
    return { file, sha256: hash(text), words: text.split(/\s+/).length, tables: /^\s*\|/m.test(text), text };
  }) : [];
  const usage = result.usage ?? [];
  const billingComplete = usage.length > 0 && usage.every((entry) =>
    entry.aiCreditsStatus === "complete" && Number.isSafeInteger(entry.copilotUsage?.totalNanoAiu) &&
    entry.copilotUsage.totalNanoAiu >= 0);
  const nanoAiu = billingComplete ? usage.reduce((total, entry) => total + entry.copilotUsage.totalNanoAiu, 0) : null;
  if (nanoAiu !== null && !Number.isSafeInteger(nanoAiu)) throw new Error("Recorded nano-AIU total exceeds integer precision");
  const row = {
    run: name, arm: result.arm, case: result.kind, repeat: result.repeat,
    seconds: result.seconds, error: result.error ?? (!result.final ? "Incomplete generation. Inspect session.error events." : null),
    models: [...new Set((result.usage ?? []).map((u) => u.model))],
    inputTokens: (result.usage ?? []).reduce((n, u) => n + (u.inputTokens ?? 0), 0),
    outputTokens: (result.usage ?? []).reduce((n, u) => n + (u.outputTokens ?? 0), 0),
    cacheReadTokens: (result.usage ?? []).reduce((n, u) => n + (u.cacheReadTokens ?? 0), 0),
    billingUnits: (result.usage ?? []).reduce((n, u) => n + (u.cost ?? 0), 0),
    nanoAiu, billingComplete,
    calls: (result.usage ?? []).length, toolCalls: audit.filter((e) => !["session_done", "wait_lane"].includes(e.tool)).length,
    packetHash: result.packetHash, inputHash: result.inputHash, settingsHash: result.settingsHash,
    caseConcurrency: result.caseConcurrency ?? 1, sourceSha: result.base, approvedSha: result.approved,
    mainUnchanged: final ? final.main === (result.mainAtStart ?? (result.kind === "regression" ? result.base : result.approved)) : null,
    finalBranch: final?.branch, finalHead: final?.head, uncommitted: final?.status,
    e2eExit: acceptance?.exit ?? null, originalE2eExit: result.acceptance?.exit ?? null,
    verifiedWorktree: verification?.integration ?? null,
    acceptanceUnchanged: verification?.acceptanceUnchanged ??
      (["single", "multi"].includes(result.kind) && typeof final?.diff === "string"
        ? !/^diff --git a\/acceptance\.py b\/acceptance\.py\r?$/m.test(final.diff) : null),
    children: starts.length, readyBeforeFirstWait: beforeFirstWait.map((e) => e.lane),
    masterProductWrites, intendedFailureRuns: testFailures.map((e) => ({ owner: e.owner, argv: e.argv, exit: e.exit })),
    toolErrors: audit.filter((e) => e.error).map((e) => ({ owner: e.owner, tool: e.tool, error: e.error })),
    helperGates: helperGates.map(({ evidence, ...gate }) => ({ ...gate, commands: evidence.length })),
    e2eAgentRuns: executions.filter((e) => e.argv.includes("acceptance.py")).map((e) => ({ owner: e.owner, argv: e.argv, exit: e.exit })),
    specFiles: specs.map(({ text, ...rest }) => rest),
  };
  rows.push(row);
}
const matching = [];
for (const kind of [...new Set(rows.map((r) => r.case))]) {
  for (const repeat of [...new Set(rows.filter((r) => r.case === kind).map((r) => r.repeat))]) {
    const group = rows.filter((r) => r.case === kind && r.repeat === repeat);
    matching.push({ case: kind, repeat, trials: group.length, arms: group.map((r) => r.arm),
      sameInput: group.every((r) => r.inputHash) && new Set(group.map((r) => r.inputHash)).size === 1,
      sameSource: group.every((r) => r.sourceSha) && new Set(group.map((r) => r.sourceSha)).size === 1,
      sameSettings: group.every((r) => r.settingsHash) ? new Set(group.map((r) => r.settingsHash)).size === 1 : null,
      sameModels: group.every((r) => r.models.length === 1 && typeof r.models[0] === "string" && r.models[0].length > 0) &&
        new Set(group.map((r) => r.models[0])).size === 1 });
  }
}
const summary = { note: "Mechanical observations, not semantic verdicts. Billing units are legacy SDK usage.cost. nanoAiu sums token-weighted copilotUsage.totalNanoAiu only when every recorded call reports complete billing. Neither is dollars. Review source, tests, audit and complete outputs before judging a contract.", matching, rows };
writeFileSync(join(directory, "summary.json"), JSON.stringify(summary, null, 2));
for (const row of rows) console.log(JSON.stringify({ run: row.run, seconds: Math.round(row.seconds), billingUnits: row.billingUnits, nanoAiu: row.nanoAiu, billingComplete: row.billingComplete, calls: row.calls, e2e: row.e2eExit, children: row.children, mainUnchanged: row.mainUnchanged, masterProductWrites: row.masterProductWrites.length, intendedFailures: row.intendedFailureRuns.length, error: row.error }));
