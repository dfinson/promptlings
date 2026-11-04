---
name: technical-demo
description: 'Direct evidence-led technical explainers, hands-on demonstrations, and hybrid videos from approved story to reviewed delivery.'
---

# Technical Demo

Em dashes are banned from all output. Use commas, colons, semicolons, periods, or parentheses instead.

Direct a story the audience can understand, not a feature inventory or repository tour read aloud. Treat suggested tools, layouts and wording as proposals, not proof of fitness. Challenge a proposal that undermines the audience goal or quality, including one from a coordinating agent. Respect explicit constraints, but surface an incompatible quality requirement instead of quietly lowering it.

## 1. Discover

Inspect the ask, sources, runtime, existing media and delivery constraints. Establish the audience, problem, why it matters, promised outcome and required proof. Read in full every source whose behavior the video explains before writing about it. Descriptions, README summaries and discovery notes are indexes, not evidence.

Map the subject's problems and the components that address them internally, then select what this audience needs to understand or decide. Discovery breadth does not impose screen time. Choose an explainer, hands-on demonstration or hybrid. When the subject is a pull request or diff, explicitly invoke `pr-video` for its change discovery and story order. Use source to explain implementation and actual execution to prove behavior. Never substitute animation for required runtime evidence.

## 2. Design

Start with the opening, before any scene sequence. Write three lines: `HOOK:` the exact opening narration, `HOOK RATIONALE:` its hook type and why it makes this audience care, and `PAYOFF:` the later scene that answers it and the close that calls back to it. Run the opening hook check in `reasoning-first-narration` and revise until every item passes.

Then state one governing claim and order the story from what the audience most needs to understand. Carry concrete cases to their outcomes. For a whole repository or product, orient the viewer to its purpose and useful scope without giving every problem or component a full scene. A component may receive a sentence, a visual relationship, a deep explanation or no screen time according to its contribution to the governing claim. Declare material exclusions in the proposed scope, and obtain approval before dropping explicitly requested coverage.

Choose depth by the audience's next question. Show enough of the problem, mechanism and consequence to support each takeaway. Explain why an obvious approach fails only when that contrast is supported and helps understanding. Picture a model when its structure needs explaining. Do not force those elements into five ordered parts in every scene, repeat an established case, or invent an unresolved problem to connect scenes. A short bridge or orientation can do its job briefly. A code passage needs the question it answers, the source carrying the answer and the consequence, not a separate tutorial on the example's entire domain. Keep a scene only if removing it would break the argument. Budget time for each new inference and the reading it requires. Once a premise, role distinction or evidence limit is established, carry it forward with a short visual label instead of explaining it again. Cut corroborating sources and method detail that do not change this audience's next inference.

An instruction repository's behavior is what an assistant produces with it. Show a real run or recorded output rather than just the contract. Only when a run was attempted and proved impossible, record why and build the case from failure modes its sources establish. Label it as an illustration in both narration and on screen. An illustration explains a failure mode and never proves the component's behavior.

After the hook, orient a cold viewer before proof. Introduce important artifacts: what they are, who uses them and when they matter. Propose a short scene sequence with one takeaway per scene, its exact source or observed evidence, chosen depth and transition. Confirm the governing claim, sequence and scope with the user before writing full narration. Preserve source/transcript fidelity. Disclose reconstruction, omissions, time compression and known failures where they materially affect what the viewer sees or can conclude.

### Direct the picture

Choose the surface by the shot's explanatory job, not by a default template. Real capture shows behavior. Source-derived excerpts expose implementation. Diagrams explain relationships. Measured comparisons show results. Sparse typography frames a question or lands a conclusion. Blend surfaces when the argument benefits, without changing modes merely to meet a variety quota.

For implementation explanations, prefer selective, technically accurate source-derived code presentation with enough file/function context, progressive reveal and phrase-timed line or token emphasis. Preserve exact code and disclose omissions. Use actual editor capture when the editor interaction, navigation or integrated workflow is itself evidence, or when the user explicitly requests it. File-tree travel is not mandatory for explaining code. Route real editor and browser capture through `cue-synced-demo`. Generated excerpts explain source, never pretend to be a captured run.

Before full narration, work out the evidence's visual progression: what is visible first, what source-backed change the viewer then sees, and what they can infer from it. For each shot, specify the claim, evidence, focal object, what changes or is revealed, the narration phrase that cues it, what competes for attention and should be removed or dimmed, the visual payoff and the idea carried forward. The picture should expose something the voice interprets, rather than display sentences the voice reads. A shot may cross scene boundaries or a scene may need several shots. A new heading in the same panel is not a new visual idea.

For source-heavy subjects, use document views to establish the artifact or inspect wording, then recompose exact evidence for the inference: isolate a disputed premise, trace a branch with sourced conditions, connect a decisive code token to its consequence, or progressively expose a real relationship. Keep file/function attribution visible without keeping the whole document window. Do not allocate a long paragraph to one framed excerpt with only highlights changing. Split it at the actual reasoning turns, removing spent evidence as the next focal object arrives. Retain a deliberate reading hold when reading the artifact is the point. Describe the composition and its changes concretely enough to build, including the selected words or source regions and their relative placement. Merely promising "dynamic visuals", "progressive reveal" or "a diagram" is insufficient.

If a reference is accepted, identify how its evidence selection, framing, emphasis, pacing and shot changes produce understanding. Transfer those functions to this subject, not merely its palette or fonts, and do not copy unrelated technical detail. Reject a sequence dominated by repeated text cards, split panels or full-file views when evidence-specific framing would communicate more. Review the visual plan separately from the narration, including a narration-muted pass: can the viewer locate the evidence and see the relevant change or relationship? Check adjacent shots together. Merge redundant setup, and redesign sequences whose only change is the quoted text.

## 3. Approve

Before presenting a script or material revision, check every claim against its exact source passage rather than notes or summaries. For comparisons, verify both inputs and both outcomes. Do not call inputs equivalent because they share one property. Explicitly invoke `reasoning-first-narration` on the full script. Rerun its opening hook check and confirm the named payoff scene and closing callback exist.

Check scene depth against the audience and governing claim, not a fixed anatomy. Can a cold viewer follow the problem, the evidence supporting the answer and its significance? Is any paragraph an interchangeable catalog of components? Does an example teach the repository's point or take over as a tutorial? Remove unsupported contrast and repeated explanation. Transition edits cannot repair a scene without a purpose. Disclose any illustration that stands in for required evidence with its recorded reason, and drop or reword the behavioral claim it cannot prove unless the user approves it explicitly.

Present the `HOOK`, `HOOK RATIONALE` and `PAYOFF` lines with the script. Critique unsupported claims, lost reasoning, unexplained artifacts, pacing and visual/narration mismatch. Explicitly invoke `narrative-transitions` on the full script so every scene boundary is checked as part of one continuous piece, including after any single transition is corrected.

Every caveat, guarantee or prohibition, whether added or restated from a source, must change the audience's understanding, decision or action. Cut sentences that only reassure the viewer about what a component does not do. Describe what a thing does, not what it lacks. Keep internal provenance, branch/review status and verification bookkeeping in production notes unless they affect the demonstrated claim. Do not invent defensive narration.

Present the story, verbatim narration, evidence, visual plan, assumptions and delivery choices for explicit approval before expensive production. Include the applicable production gates in the proposal: exact script/visual approval, script-hash verification, source/runtime boundaries, installer ownership, privacy review, listening-based approval if synthetic speech is selected, representative-scene review and exact-final-file human watch/listen acceptance. Keep these in production notes, not spoken narration. Only clear approval counts. Feedback, questions and a request to change one scene are not approval. Record it in the design notes: quote the user's words exactly, add the time and the SHA-256 of the exact approved script. Recompute the hash before full synthesis, final capture or final render. Any mismatch voids approval. Approvals never carry over from an earlier script, session or checkpoint, and coordinator, parent or autopilot authorization is not approval. Without valid approval, stop and report the blocker. Production permission is not listening-based voice approval.

## 4. Produce

The promptlings installer owns the demo toolchain (Python, Node.js, Playwright CLI and its browser, HyperFrames, FFmpeg, diff2html, VS Code with Demo Time, vscode-playwright, Word or LibreOffice, Poppler and their upstream skills). Assume it is installed. If an installed tool fails or is absent, report its exact error and direct the user to rerun the promptlings installer. Do not repair the machine or replace real evidence with slides because setup failed. Prepare only what is production-specific: the subject application, demo data, authentication, the approved voice and assets.

For authored explainers and composed hybrid scenes, explicitly invoke `hyperframes` before choosing layouts or building visuals, unless the user requests another framework or plain recording. Follow its design, registry, motion, composition and review skill routing rather than recreating those capabilities in a custom slideshow. Composed terminals and windows default to the macOS-style presentation `cue-synced-demo` describes (translucent terminal, top-down output, framed windows) unless the brand says otherwise. If unavailable, report the missing capability and propose alternatives instead of building a substitute compositor.

Use real browser/window capture for required runtime evidence, and real editor capture when Design selected editor interaction as evidence, through the established capture specialists `cue-synced-demo` names rather than a hand-built recorder. Add only the minimal glue it describes, such as the walkthrough pointer overlay. Ordinary footage edits such as holds, badges, cuts and crossfades do not by themselves require HyperFrames. Invoke `cue-synced-demo` for event-bound footage and narration timing, not as the universal composition workflow.

For synthetic speech explicitly invoke `tts-setup` and require its listening-based sample acceptance before full synthesis. Voice, provider, private-text transfer and costs are user decisions. Reuse accepted setups and existing specialists. Keep application flows, selectors and authentication project-local. Rehearse required states.

Have the user or a reviewer who actually watched and listened assess one representative finished scene with accepted narration before full production. Judge whether the evidence is legible, the focus follows the explanation, the depth fits and the treatment is worth watching, not just whether it renders. Revise a failed treatment before extending it. Reuse unchanged assets and make targeted scene revisions instead of using full renders to discover storyboard defects.

## 5. Review and revise

Inspect the final encoded output, scene/event frames, cuts and joins. Listen through it with the visuals. Scan the final file for notifications and personal data. Check narrated artifacts, labels and formats against the visible evidence. Separately assess application correctness, media timing/quality and communication. Repeat the narration-muted visual review on the encoded scenes, not just the storyboard. Check evidence legibility, attention cues, useful visual changes and whether the accepted reference's explanatory functions survived production.

Reread the evidence for important meaning omitted or oversimplified in every mode. Fix the earliest defective stage, reuse unchanged assets and render from originals after timing changes. Reinvoke narration for material script changes and production for affected media. Reverify the exact final file.

## 6. Deliver

Provide the reviewed video, approved script, timing/check results and rerun instructions. Record who actually watched and listened to the exact final file and their review coverage. The demo counts as accepted only after a person has watched and listened to the exact final file. Until then, present it positively as a request for action, for example: "Here's the finished cut, ready for your review. Please watch it and confirm or send changes." Do not lead with negative qualifiers such as "nobody has watched it", "unwatched" or "not accepted", and do not repeat the review status in follow-ups. Parent authorization or passing mechanical checks cannot substitute for that review. Rendering success is not audiovisual acceptance.

Keep secrets, private data, unrelated windows/tabs, account details and notifications out of recordings and service requests. Capture the intended viewport or window at native dimensions, not a full desktop cropped later. Do not upscale. Choose captions and mastering for the audience and destination. Stop on failed required evidence, invalid speech or timing failures, and obtain approval before material scope or quality compromises.
