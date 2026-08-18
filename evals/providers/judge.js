"use strict";

/**
 * promptfoo custom provider: LLM judge backed by GitHub Copilot CLI.
 *
 * promptfoo hands a grading prompt to this provider and expects the response to
 * contain JSON with `pass`, `score`, and `reason`. Copilot is asked for that
 * shape directly, and the first JSON object in the reply is extracted, since a
 * CLI reply can carry prose around the payload.
 *
 * Config, from promptfooconfig.yaml:
 *   model   optional judge model. Running the same rubrics under more than one
 *           model, then comparing per-dimension scores, is how a panel is formed.
 */

const { runCopilot } = require("./copilot");

const SHAPE =
  '{"pass": true or false, "score": 0.0 to 1.0, "reason": "one or two sentences citing the specific text that decided it"}';

class CopilotJudgeProvider {
  constructor(options = {}) {
    this.config = options.config || {};
    this.providerId = options.id || `copilot-judge:${this.config.model || "default"}`;
  }

  id() {
    return this.providerId;
  }

  async callApi(prompt) {
    const instruction = [
      prompt,
      "",
      "Respond with one JSON object and nothing else, in this exact shape:",
      SHAPE,
      "",
      "Score the named dimension only. Do not reward length. Do not reward hedging.",
      "Competent but unremarkable is a middling score, not a high one.",
    ].join("\n");

    const args = [
      "-p", instruction,
      "--allow-all-tools",
      "--silent",
      "--no-color",
      "--log-level", "none",
    ];
    if (this.config.model) {
      args.push("--model", this.config.model);
    }

    const res = runCopilot(args, { timeout: 10 * 60 * 1000 });

    if (res.error) {
      return { error: `judge failed: ${res.error.message}` };
    }
    if (res.status !== 0) {
      return { error: res.stderr || `judge exited ${res.status}` };
    }

    const out = res.stdout || "";
    const start = out.indexOf("{");
    const end = out.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) {
      return { error: `judge returned no JSON object: ${out.slice(0, 500)}` };
    }

    const payload = out.slice(start, end + 1);
    try {
      JSON.parse(payload);
    } catch (e) {
      return { error: `judge JSON did not parse: ${e.message}` };
    }

    return { output: payload };
  }
}

module.exports = CopilotJudgeProvider;
