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

Then state one governing claim: what should this audience understand or be able to decide? Select a concrete case that makes it observable, carry it to its outcome, and explain the mechanism needed to interpret that outcome. Introduce the subject's purpose and useful scope, not every component. Background may take one sentence, a central mechanism several shots, and unrelated capabilities no screen time. Declare material exclusions and obtain approval before dropping explicitly requested coverage. Do not require a separate case, failed obvious approach, general model and component inventory for every scene.

For a why-question, explain the constraint that makes the outcome necessary, not only the statements that produce it. Trace the relevant inputs to the requested outcomes and end there. Show the state changes those inputs actually cause, not every other writer of the same state. Establish a supporting dependency at the deciding branch rather than touring its implementation unless its workings are the question. Later derived state, adjacent branches and additional corroboration belong in preparation notes unless the question requires them. Let a case establish the reusable pattern instead of following it with another explanation of that pattern. Close on its payoff and one useful next action, not an inventory of other capabilities or setup variants.

An instruction repository's behavior is what an assistant produces with it. Show a real run or recorded output rather than just the contract. Classify each decisive claim during preparation: primary-source behavior, observed output or a reported account. When the primary source is unavailable, keep each account attributed in the opening, narration, diagrams and shot labels. A secondary document discussing a disagreement is another account, not an adjudication of the underlying behavior. End that case on the concrete question the evidence leaves open, not a diagram that silently resolves it. State the boundary where it matters without repeating it throughout the story. Only when a run was attempted and proved impossible, record why and build the case from failure modes its sources establish. Label it as an illustration in both narration and on screen. An illustration explains a failure mode and never proves the component's behavior.

After the hook, give the minimum orientation a cold viewer needs to read the first piece of evidence: what the artifact is, who uses it and why it matters here. Let the case introduce its roles rather than explaining their roster before the case and their method afterward. Propose the governing claim, evidence sequence and scope for confirmation before full narration. Preserve source/transcript fidelity. Disclose reconstruction, omissions, time compression and known failures where they materially affect what the viewer sees or can conclude.

### Direct the picture

Storyboard the visual argument before drafting full narration. For each beat, identify the observation the audience sees and the inference it enables. If a beat adds neither, remove it. Select the actual evidence region, choose its framing, and describe the visible change at the relevant spoken phrase. State what disappears or is dimmed so the viewer follows one focal object. Specify enough to build the shot, not just "show code" or "use an animated diagram."

Choose the surface for that observation:

- Real capture for behavior, interactions and produced artifacts.
- Accurate source-derived code for implementation. Keep file/function context, select only the decisive region and emphasize the relevant line or token as it is discussed. Disclose omissions without altering source.
- A source-backed diagram when a path, relationship or state change is the observation. Trace the actual path progressively rather than displaying a taxonomy.
- A measured comparison for results, retaining units, baseline and context.
- Sparse typography for a question, short quotation or conclusion, not a substitute for available evidence.

Use actual editor capture when editor interaction or navigation is evidence, or when explicitly requested. Explaining implementation does not require file-tree travel or a full workbench. Route genuine editor/browser capture through `cue-synced-demo`. Generated code and diagrams explain evidence, never pretend to be a recorded run.

A coherent scene may contain several views, and a continuous view may support several spoken lines. Choose cuts where the evidence or inference changes. Do not impose a shot count, a new layout for every sentence or a fixed shot-duration ceiling. Retain reading time when inspecting the artifact matters.

When one comparison carries the argument, preserve its spatial anchors as focus changes. Develop the evidence with local highlights and progressive annotation. Avoid removing an artifact and bringing it back solely to restate its premise or recap the same payoff. A boundary label or settling question can update the current evidence view instead of becoming another scene.

The picture proves, compares, exposes or traces. The voice supplies the reasoning and significance. Do not paste the narration into panels and read it. For document-heavy subjects, establish the artifact, isolate the exact premise that matters, then carry that premise into a consequence or relationship. Keep attribution without keeping a full document window. Avoid a run of identical quote panels or unrelated diagrams.

When a reference is accepted, transfer its explanatory functions: what it selects, reveals, emphasizes and removes, how it changes focus, and where it lands the payoff. Palette and fonts alone do not reproduce the treatment. Before extending the sequence, review adjacent views with narration muted: the evidence and intended change must remain intelligible.

## 3. Approve

Before presenting a script or material revision, check every claim against its exact source passage rather than notes or summaries. For comparisons, verify both inputs and both outcomes. Do not call inputs equivalent because they share one property. Explicitly invoke `reasoning-first-narration` on the full script. Rerun its opening hook check and confirm the named payoff scene and closing callback exist.

Check the whole argument, not a scene template. A cold viewer must understand the question, evidence, mechanism and consequence at the depth needed for the promised outcome. If core sections can be reordered without breaking the reasoning, they are probably a catalog. Cut repeated orientation and explanation. Keep an example subordinate to the subject rather than turning it into a domain tutorial. Budget the spoken script near the middle of any requested word range, count only spoken words, and revise it into range before presenting it. Transition edits cannot repair a missing argument. Disclose any illustration that stands in for required evidence with its recorded reason, and drop or reword the behavioral claim it cannot prove unless the user approves it explicitly.

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
