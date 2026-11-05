# Research and prior art

These sources inform the method, not runtime dependencies or permission to
install anything. Verify current capabilities and local adapters before use.

- [Anthropic skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator)
  supplies with/without or old/new skill comparisons, grading, aggregation and
  human review. Reuse compatible mechanisms rather than building another
  evaluation framework.
- Its [blind comparator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/agents/comparator.md)
  constructs a rubric after reading outputs and encourages marginal winners.
  This method instead freezes confirmation criteria before outputs and permits
  inconclusive results. Hard constraints remain vetoes.
- Its [description optimizer](https://github.com/anthropics/skills/blob/main/skills/skill-creator/scripts/run_loop.py)
  separates training queries from test queries but selects the best iteration
  by test score. Data used for selection are validation data, not untouched
  final confirmation.
- [Demystifying evals for AI agents](https://www.anthropic.com/research/demystifying-evals-for-ai-agents)
  distinguishes tasks, trials, graders, transcripts and environment outcomes,
  and capability evaluations from regression protection.
- [Harbor skill injection](https://docs.harborframework.com/jobs/skills)
  records content digests and Git provenance and delegates native registration
  to agent integrations. Injection alone does not establish invocation.
- [Inspect AI](https://inspect.aisi.org.uk/) provides composable datasets,
  solvers, scorers, external agents and sandbox integrations.
- [Promptfoo custom providers](https://www.promptfoo.dev/docs/providers/custom-api/)
  can wrap existing execution and return outputs, errors, usage and metadata.
  The provider still needs valid state isolation and outcome verification.
- [Adding Error Bars to Evals](https://arxiv.org/abs/2411.00640) addresses
  uncertainty, differences between configurations and experiment planning.
  Analysis must match the actual task and repetition structure.
- [Judging LLM-as-a-Judge](https://arxiv.org/abs/2306.05685) examines position,
  verbosity and self-enhancement biases alongside agreement with humans.
- [LLM Evaluators Recognize and Favor Their Own Generations](https://arxiv.org/abs/2404.13076)
  studies self-recognition and self-preference. Different judges can help
  assess sensitivity, but diversity alone does not establish unbiased grading.

This is original Promptlings instruction text informed by these sources.
No upstream agent prompts, runner implementation or benchmark dataset is
vendored. Findings from one task set, model or execution profile do not
establish general superiority.
