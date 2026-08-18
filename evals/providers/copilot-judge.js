#!/usr/bin/env node
/**
 * promptfoo exec provider: LLM judge backed by GitHub Copilot CLI.
 *
 * promptfoo hands this script a grading prompt and expects JSON carrying
 * `pass`, `score`, and `reason`. Copilot is asked for that shape directly and
 * the first JSON object in the reply is extracted, since a CLI reply can carry
 * prose around the payload.
 *
 * PROMPTLINGS_JUDGE_MODEL optionally overrides the judge model, which is how a
 * panel is run: the same rubric, scored by more than one model.
 */

const { runCopilot } = require("./copilot");

const gradingPrompt = process.argv[process.argv.length - 1];
const model = process.env.PROMPTLINGS_JUDGE_MODEL;

const instruction = [
  gradingPrompt,
  "",
  "Respond with one JSON object and nothing else, in this exact shape:",
  '{"pass": true or false, "score": 0.0 to 1.0, "reason": "one or two sentences citing the specific text that decided it"}',
  "",
  "Score the named dimension only. Do not reward length. Do not reward hedging.",
  "Competent but unremarkable is a middling score, not a high one.",
].join("\n");

const args = ["-p", instruction, "--allow-all-tools", "--silent", "--no-color", "--log-level", "none"];
if (model) {
  args.push("--model", model);
}

const res = runCopilot(args, { timeout: 10 * 60 * 1000 });

if (res.error || res.status !== 0) {
  console.error(res.error ? res.error.message : res.stderr);
  process.exit(1);
}

const out = res.stdout;
const start = out.indexOf("{");
const end = out.lastIndexOf("}");
if (start === -1 || end === -1 || end < start) {
  console.error("judge returned no JSON object:\n" + out.slice(0, 2000));
  process.exit(1);
}

const payload = out.slice(start, end + 1);
try {
  JSON.parse(payload);
} catch (e) {
  console.error("judge JSON did not parse: " + e.message + "\n" + payload.slice(0, 2000));
  process.exit(1);
}

process.stdout.write(payload);
