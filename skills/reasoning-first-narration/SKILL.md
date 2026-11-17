---
name: reasoning-first-narration
description: Write or revise natural spoken explanations for technical demos, walkthroughs, presentations, and complex topics. Preserve the source's reasoning, evidence, meaning, and attribution. Supports human delivery, teleprompters, and TTS.
---

# Reasoning-First Narration

## Goal and shared foundation

Produce conversational narration that develops an explanation instead of announcing conclusions. Use supplied material, an approved storyboard, verified research, or directly observable evidence. Do not imitate a named person's mannerisms without a supplied voice profile.

Before drafting or revising, invoke `reasoning-first-writing` through the host's skill mechanism and apply its evidence, meaning, attribution, reasoning, and language rules. If the host has no invocation mechanism, read that skill's `SKILL.md` through its documented discovery location. Do not assume a personal installation path or reach through another skill's private resources. If the foundation cannot be loaded, report the missing dependency and stop the writing task. Do not install it or silently substitute another editor.

The shared foundation owns those rules. This skill adds spoken delivery and visual truth. Preserve source accuracy, meaningful substance, attribution and explicit scope. Within those constraints, prioritize first-listen comprehension and narrative flow over brevity or an exhaustive feature inventory. Respect delivery requirements without compressing away the reasoning. When required coverage cannot fit the requested duration, return that concrete tradeoff to the director instead of silently dropping scope or racing through it.

The target is a knowledgeable engineer naturally walking colleagues through
what they are seeing. Accurate short sentences can still sound like compressed
release notes. Review the complete story and its surrounding context, not
only the wording of individual blocks.

## Opening hook

When narration opens a demo, walkthrough, video or talk, its first spoken lines must be a hook: a few sentences that make this audience care by opening a gap the piece later closes. Without an explicit hook, technical narration drifts into a definition, an agenda or a feature list.

Choose one hook type. Each one fails under the stated condition.

| Type | What it does | Fails when |
| --- | --- | --- |
| Concrete case | Opens on a real user, input or failure that the piece carries to its outcome | The case is generic or unrelated to the main argument |
| End result first | Shows or states the finished output before any mechanism | It opens on setup, installation or a file listing instead |
| Stakes | States what the problem costs this audience | The cost is abstract |
| Surprising result | Presents a supported outcome the viewer would not predict | The piece never explains it |
| Answerable question | Asks a specific question the piece answers | The question is vague or rhetorical |
| Before and after | Contrasts the situation without and with the subject | It needs background the viewer lacks |

The hook passes only when every item holds:

1. It names a specific user, case, result or problem rather than a product category.
2. It fits within the first two spoken sentences, about 35 words.
3. It opens a gap (a question, stakes or an unexplained result) rather than summarizing the piece.
4. The sources support every claim in it. Overpromising fails.
5. A named later scene pays it off, and the close calls back to it.
6. It uses none of the failing openings below.

Failing openings: a definition of the subject ("X is a..."), a greeting or self-introduction, an agenda or "in this video", a runtime promise, a repository or folder tour, a list of features or components, and background scene-setting before the stakes.

These examples show variety. They are illustrative only; never reuse their wording.

- Case: "One pull request changed how four layers talk to each other. The reviewer had ten minutes to understand all four."
- Result: "Everything in this video, from script to voice, came from a pull request the agent had never seen."
- Question: "Why does a one-line configuration change need three reviewers?"

## Gates

### G1. Inputs, scope, and mode

- For an edit, retain effective existing wording unless the requested change or a failed rule calls for revision. For new narration, use available source material. Request missing factual material instead of inventing it.
- Select exactly one delivery mode: explicit TTS first, then explicit teleprompter, then explicit human live or recorded narration. Otherwise use human recorded narration. Apply only that mode's formatting.
- Derive the audience from the request or source. Keep its established knowledge level. Add explanations when the user requests teaching or comprehension depends on them, rather than explaining every technical term.

### G2. Visual and argument fidelity

- Preserve the source's meaningful argument sequence, constraints, uncertainty, ownership, and technical distinctions under the foundation's rules.
- Describe an action, visual, state change, or result as shown only when the source or storyboard confirms viewers will see it. Describe other supported information as background.
- Never narrate an unsupplied click, navigation step, or mouse movement. Storyboard intent is not proof that capture succeeded. Do not turn planned footage or unexecuted tests into observed results.
- Use ordinary spoken language and exact domain terms. Do not add jokes, filler words, artificial hesitations, manufactured doubts, or a personality performance.

### G3. Spoken text

- Orient the listener before each unfamiliar detail: what they are looking at, what matters about it, then the mechanism and its consequence. Keep the opening hook before extended background. Name the visible object rather than relying on an ambiguous "this" or an abstract system property.
- Let one consequential thought land at a time. Use natural conversational sentences and contractions, with length varied for meaning and rhythm. Split overloaded utterances at real idea boundaries without deleting the causal link. Word or sentence counts do not prove comprehensibility.
- Connect the changed behavior to why it matters and to the next visible step. Reuse the same terms for the same objects. Avoid a chain of isolated feature announcements, even when each sentence is accurate.
- Give a new idea and its on-screen evidence time to be understood. Coordinate inspection holds with the production owner instead of filling every pause with another claim. Distinguish existing baseline behavior from the actual new contribution.
- Remove unnecessary repetition and repeated transition formulas. Keep a useful hook payoff or necessary reminder, not a section-by-section recap. Follow the foundation's semantic repetition check.
- Exclude these strings from spoken output, case-insensitive: "let's dive in", "without further ado", "it is important to note", "we will now proceed", "this functionality enables", "game-changing", "seamless", and "in summary". Replace filler with precise information rather than a synonym of the cliche.
- Do not insert a scripted "Not X, not Y, but Z" sequence. Retain contrasts when both sides and their relevance are supported.

### G4. Delivery

- **TTS:** Return spoken words only. No bracketed cues, fake hesitations, SSML, or engine-specific controls unless the user specifies the engine and its supported syntax.
- **Teleprompter:** Return spoken words only, without bracketed cues.
- **Human live or recording:** Use `[beat]`, `[pause]`, or `[hold for screen]` only when explicitly requested by the user or storyboard. Otherwise use punctuation and paragraph breaks.
- Pronunciation preparation, synthesis, timing, capture, captions, and audio review remain with the production owner. When it requests separate canonical captions and spoken-form fields, apply spoken-only rules to the spoken field and preserve the requested container. Never feed unrequested editing notes to TTS.

### G5. Release

Recheck the shared foundation against the evidence, then the opening hook,
visual/argument sequence, spoken text and delivery. In the existing script
review, run a whole-script first-listen pass at intended spoken pace against
the screen sequence. Ask whether a listener unfamiliar with the investigation
can identify the object, follow what changes, understand the consequence and
connect each section to the overall story without rereading or reconstructing
missing reasoning. Check the surrounding setup and transitions too.

If accurate prose still reads like compressed release notes, restructure and
rewrite the complete affected passage now. Clarity, factual substance and the
selected scope must survive together. Prefer concrete visible explanation over
abstract phrasing, marketing, artificial polish or filler. This is part of
script review, not another approval stage or permission for early full synthesis.
Actual produced speech must still be listened to with its visuals by the
production owner. A text pass is not evidence that that listening occurred.

Revise failures and check again. Remove or qualify unsupported claims. If that
leaves no usable explanation, return the specific missing evidence rather than
a fabricated script.

Return the complete ready-to-use narration without a preface or change report unless requested. A missing dependency or blocking evidence gap is a task-status response, not spoken script.

## Examples

These illustrate style, not evidence for a new script.

Generic: "This update enhances robustness through improved error handling."

Grounded alternative, only when supported: "This change moves validation earlier. Invalid requests are rejected before they reach the next stage, rather than failing later in the process."

Source: "I kept implementing while the earlier part was still under review, mainly because we had a short window to get the demo working."

Keep that voice when no change is needed. Do not recast it as "Due to timeline constraints, implementation proceeded in parallel with the review process."
