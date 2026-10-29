---
name: reasoning-first-narration
description: Write or revise natural spoken explanations for technical demos, walkthroughs, presentations, and complex topics. Preserve the source's reasoning, evidence, meaning, and attribution; avoid generic AI presenter language, fabricated spontaneity, and unnecessary explanation. Supports human delivery, teleprompters, and TTS.
---

# Reasoning-First Narration

**Clear thinking. Natural delivery.**

## Purpose and priority

Produce clear, conversational narration that develops an explanation instead of merely announcing conclusions. Preserve what makes an argument intelligible: its evidence, distinctions, causal links, and limits. Do not imitate a named person's mannerisms unless the user supplies a separate voice profile.

Apply priorities in this order: **source accuracy > intended meaning and attribution > visual or argument sequence > delivery requirements > style**. A lower-priority rule never overrides a higher one.

## Gates (apply in order; fail closed)

**G1. Inputs, scope, and mode**

- If the user supplies a draft, keep each sentence unchanged unless it violates a gate or the requested edit requires changing it. If producing a new script, use the supplied source material, storyboard, verified research, or directly observable evidence. If the task requires factual material that is unavailable, request that material instead of inventing it.
- Select exactly one delivery mode: explicit TTS takes precedence, then explicit teleprompter, then explicit human live/recorded narration. Otherwise use human recorded narration. Use only that mode's formatting rules.
- Identify the intended audience from the request or source. Do not invent audience background, expertise, motivations, or prior knowledge.

**G2. Evidence**

- For **each new factual assertion**, record internally: the claim, exact supporting source passage or observation, and its locator (file/line, URL, code location, screenshot region, or supplied text). A filename or citation without supporting content does not pass. Existing claims in a rewrite are preserved at their original confidence level, not independently certified.
- Source code establishes what is implemented, not what successfully ran. Logs/tests establish only observed outcomes. Numbers require measurements. Design motives require an explicit rationale. A plan is not a delivered result; a partial test is not end-to-end proof.
- If a claim is stronger than the evidence, narrow it. If no supported version remains, remove it. Never fill missing steps with plausible behavior, motives, performance, or outcomes.

**G3. Meaning and attribution**

- Preserve explicit constraints, numbers, comparisons, negations, uncertainties, technical distinctions, causal claims, and sequence. Do not remove them merely to make the narration shorter or smoother.
- Preserve existing first-person and team attribution. When ownership is unstated, name the component or process instead of inventing an author or a team.
- Mention an action, visual, state change, or result as *shown* only if the source or storyboard confirms that viewers will see it. Otherwise describe it as background, not on-screen evidence.

**G4. Explanation, not performance**

- Develop the source's actual reasoning: the relevant observation, its supported explanation, and its consequence where evidenced. Preserve a documented distinction or tradeoff, including both sides and why it matters. Never manufacture a contrast, objection, false start, correction, doubt, or conclusion.
- If no causal link is supported, describe the observable facts without adding one. Do not force every passage into a problem/contrast/solution template.
- Explain a basic concept only if the user asks for teaching, the source calls for that explanation, or the user supplies a required definition. Otherwise keep the original assumed knowledge level. Do not invent a tutorial for terms merely mentioned in the source.
- Use ordinary spoken English and exact domain terminology. Prefer concrete actions, mechanisms, and outcomes over abstract promotional labels. Do not add filler words, jokes, artificial hesitations, or a personality performance.

**G5. Text rules**

- Limit spoken sentences to **40 words**. Split longer ones at a real clause boundary, preserving their meaning.
- Do not produce **three consecutive one-sentence paragraphs**. Do not repeat the same opening transition in adjacent paragraphs.
- Never repeat the same sentence after ignoring case, punctuation, and spacing. Do not append a recap that adds no information unless the user explicitly asks for a recap.
- Exclude these strings from spoken output, case-insensitive: "let's dive in," "without further ado," "it is important to note," "we will now proceed," "this functionality enables," "game-changing," "seamless," or "in summary." Replace them with precise information, not synonyms of the same cliche.
- Do not insert a scripted "Not X, not Y, but Z" sequence. Use contrasts only when both sides are explicitly supported by G2.
- Never narrate an unsupplied click, navigation step, or mouse movement.

**G6. Delivery**

- **TTS:** Output spoken words only; no bracketed stage cues, fake hesitations, SSML, or engine-specific controls. Use markup only when the user specifies the engine and its supported syntax.
- **Teleprompter:** Output spoken words only, without bracketed cues.
- **Human recording/live:** Use [beat], [pause], or [hold for screen] only when the user or storyboard explicitly requests that timing or action. Otherwise use ordinary punctuation and paragraph breaks.

**G7. Release**

- Recheck G2 factual support, G3 meaning and attribution, sequence, G5 text rules, and G6 delivery, in that order. Meeting G5 and G6 does not show that claims follow from their sources; G2 and G3 must be checked against the evidence.
- Revise any failure, then rerun the checks. If a required factual claim has no support, remove or qualify it. If that leaves no usable explanation, state the specific missing evidence rather than inventing a script.
- Return the complete ready-to-use narration without a preface unless the user requests commentary, evidence notes, or another format.

## Examples (style illustrations, not factual sources)

**Preserve a real distinction**

Generic: "The asynchronous architecture improves efficiency by decoupling report generation from the interface."

Reasoning-first: "The issue isn't only how long the report takes. We also don't want the request waiting for the whole process. The interface submits the job, the worker generates the report, and the result is tracked separately. That's why the work is split up."

Use that contrast only when the supplied material establishes both the waiting problem and the architectural rationale.

**Explain what actually changes**

Generic: "This update enhances robustness through improved error handling."

Reasoning-first: "This change moves the validation earlier. Invalid requests are rejected before they reach the next stage, rather than failing later in the process."

**Preserve an existing speaker's voice**

Source: "I kept implementing while the earlier part was still under review, mainly because we had a short window to get the demo working."

Acceptable: Keep unchanged.

Unacceptable: "Due to timeline constraints, implementation proceeded in parallel with the review process."

Examples demonstrate style only. Never reuse their technical claims without G2 support.
