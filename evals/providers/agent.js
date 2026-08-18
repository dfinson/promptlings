"use strict";

/**
 * promptfoo custom provider: runs one promptlings agent under GitHub Copilot CLI.
 *
 * A JavaScript provider is used rather than `exec:` because promptfoo passes the
 * prompt, the provider config, and the full test context as command-line
 * arguments to an exec provider. This suite carries eight rubrics in that
 * context, which exceeds the Windows command-line limit and fails with
 * ENAMETOOLONG. An in-process provider receives the same values as function
 * arguments, so there is no length ceiling.
 *
 * Config, from promptfooconfig.yaml:
 *   agent   agent name, matching the file stem in <target>/.github/agents/
 *   cwd     optional explicit checkout path, overriding the per-case target
 *
 * Test vars:
 *   target  selects evals/.work/<target> as the repository to run against
 */

const path = require("node:path");
const { runCopilot } = require("./copilot");

class CopilotAgentProvider {
  constructor(options = {}) {
    this.config = options.config || {};
    this.label = options.label;
    this.providerId = options.id || `copilot-agent:${this.config.agent || "unset"}`;
  }

  id() {
    return this.providerId;
  }

  async callApi(prompt, context = {}) {
    const agent = this.config.agent;
    if (!agent) {
      return { error: "provider config is missing `agent`" };
    }

    const vars = context.vars || {};
    const cwd = this.config.cwd
      ? path.resolve(this.config.cwd)
      : path.join(__dirname, "..", ".work", vars.target || "target");

    const res = runCopilot(
      [
        "-p", prompt,
        "--agent", agent,
        "--allow-all-tools",
        "--allow-all-paths",
        "--silent",
        "--no-color",
        "--log-level", "none",
      ],
      { cwd },
    );

    if (res.error) {
      return { error: `copilot failed in ${cwd}: ${res.error.message}` };
    }
    if (res.status !== 0) {
      return { error: res.stderr || `copilot exited ${res.status}` };
    }

    return { output: extractArtifact(res.stdout) };
  }
}

/**
 * Return the walkthrough itself, not the session transcript.
 *
 * Even under `--silent`, the CLI emits the model's own progress narration
 * ("I'll map the diff first, then...") before the artifact. Judging that text
 * scores the harness rather than the agent: on the first run it dropped
 * cold-open quality to 0.05 while every other dimension scored above 0.82,
 * because the judge read process narration as the opening paragraph.
 *
 * The walkthrough format opens with an H1 title, so the artifact begins at the
 * first top-level heading. When no heading is present the full text is returned
 * rather than silently emitting nothing.
 */
function extractArtifact(stdout) {
  const text = stdout || "";
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^#\s+\S/.test(l));
  return start === -1 ? text.trim() : lines.slice(start).join("\n").trim();
}

module.exports = CopilotAgentProvider;