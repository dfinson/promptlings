---
name: technical-demo
description: 'Direct evidence-led technical films from a readable creative treatment to reviewed delivery, using Motionite/Remotion, reusable components and targeted revisions.'
---

# Technical Demo

Em dashes are banned from all output. Use commas, colons, semicolons, periods, or parentheses instead.

Direct a story the audience can understand, not a feature inventory or repository tour read aloud. Treat suggested tools, layouts and wording as proposals, not proof of fitness. Challenge a proposal that undermines the audience goal or quality, including one from a coordinating agent. Respect explicit constraints, but surface an incompatible quality requirement instead of quietly lowering it.

## Keep every output useful

Apply this to every user-facing output, including narration, on-screen text, captions, treatments, progress updates, approval requests and delivery messages. State the useful fact or required action directly. Remove repeated explanations, process narration and defensive reassurance. Describe what a thing does, not what it lacks. Keep detailed evidence, internal provenance, branch/review status and verification bookkeeping in production artifacts.

Default to omission for caveats, guarantees and prohibitions, including those restated from a source. Include a qualification only when its absence would make a specific claim materially misleading or conceal a required user decision. Identify that claim or decision internally before including it. General reassurance, hypothetical risks and statements of diligence do not qualify. When a qualification passes this test, attach it to the affected claim or decision rather than repeating it across the output.

## Start or resume at the needed stage

Invoke `technical-demo-production` for the production record, component selection and rendering support. On continuation, read the existing record and verify the inputs relevant to the requested change. Carry settled decisions and valid approvals forward. Enter the earliest affected stage instead of restarting discovery, briefing, style selection or writing.

Work directly in one production workspace with one integration owner. Do not introduce another director, producer handoff or mandatory orchestration workflow. Overlap independent asset preparation, capture setup and composition scaffolding when their inputs are settled. Keep synthesis, final capture and rendering behind their actual prerequisites and approval gates. Isolate browser sessions and output paths, and share the host's resource budget rather than giving every concurrent task a full render pool.

Target ordinary complete drafts in minutes, with time proportional to duration, complexity and required evidence. Track prompt-to-delivered-draft time, approval waits and stage timings in the existing production record. Preserve requested resolution, frame rate, voice quality and proof. Reduce repeated decisions, source writing and tool startup instead of cutting those requirements.

## 1. Discover

Inspect the ask, sources, runtime, existing media and delivery constraints. Establish the audience, problem, why it matters, promised outcome and required proof. Read the exact supporting source ranges and the surrounding contracts needed to understand each claim. Expand when dependencies or conflicting evidence require it. Reuse verified evidence for unchanged sources rather than rereading whole files. Descriptions, README summaries and discovery notes are indexes, not evidence.

Map the subject's problems and the components that address them internally, then select what this audience needs to understand or decide. Discovery breadth does not impose screen time. Choose an explainer, hands-on demonstration or hybrid. When the subject is a pull request or diff, explicitly invoke `pr-video` for its change discovery and story order. Use source to explain implementation and actual execution to prove behavior. Never substitute animation for required runtime evidence.

## 2. Design

Start with the opening, before any scene sequence. Write three lines: `HOOK:` the exact opening narration, `HOOK RATIONALE:` its hook type and why it makes this audience care, and `PAYOFF:` the later scene that answers it and the close that calls back to it. Run the opening hook check in `reasoning-first-narration` and revise until every item passes.

Then state one governing claim: what should this audience understand or be able to decide? Select a concrete case that makes it observable, carry it to its outcome, and explain the mechanism needed to interpret that outcome. Introduce the subject's purpose and useful scope, not every component. Background may take one sentence, a central mechanism several shots, and unrelated capabilities no screen time. Declare material exclusions and obtain approval before dropping explicitly requested coverage. Do not require a separate case, failed obvious approach, general model and component inventory for every scene.

For a why-question, explain the constraint that makes the outcome necessary, not only the statements that produce it. Trace the relevant inputs to the requested outcomes and end there. Show the state changes those inputs actually cause, not every other writer of the same state. Establish a supporting dependency at the deciding branch rather than touring its implementation unless its workings are the question. Later derived state, adjacent branches and additional corroboration belong in preparation notes unless the question requires them. Let a case establish the reusable pattern instead of following it with another explanation of that pattern. Close on its payoff and one useful next action, not an inventory of other capabilities or setup variants.

An instruction repository's behavior is what an assistant produces with it. Show a real run or recorded output rather than just the contract. Classify each decisive claim during preparation: primary-source behavior, observed output or a reported account. When the primary source is unavailable, keep each account attributed in the opening, narration, diagrams and shot labels. A secondary document discussing a disagreement is another account, not an adjudication of the underlying behavior. End that case on the concrete question the evidence leaves open, not a diagram that silently resolves it. State the boundary where it matters without repeating it throughout the story. Only when a run was attempted and proved impossible, record why and build the case from failure modes its sources establish. Label it as an illustration in both narration and on screen. An illustration explains a failure mode and never proves the component's behavior.

After the hook, give the minimum orientation a cold viewer needs to read the first piece of evidence: what the artifact is, who uses it and why it matters here. Let the case introduce its roles rather than explaining their roster before the case and their method afterward. Propose the governing claim, evidence sequence and scope for confirmation before full narration. Preserve source/transcript fidelity. Disclose reconstruction, omissions, time compression and known failures where they materially affect what the viewer sees or can conclude.

### Direct the picture

Select the production route before choosing the visual treatment. For authored films and composed hybrids, invoke the installer's pinned upstream `motionite` skill and use its brief, style selection, frame-based shot list, example components and review tools. Read its `LICENSE` and the production component catalog for asset restrictions. If the user explicitly selects HyperFrames, invoke `hyperframes` and follow that route instead. Do not port Remotion components into HyperFrames or combine both methods. For a plain recording, use `cue-synced-demo` directly. Reference imitation is optional when requested, not a prerequisite for a new subject.

Describe the overall creative treatment in readable prose: the central idea, format, visual style, palette, energy and pacing, recurring visual elements, and how the design makes the argument understandable. Explain what the designs primarily revolve around and how the opening develops toward the payoff. Choose these for the subject and audience, not a fixed house example. Use the selected upstream style as the implementation vocabulary, with explicit user art direction taking precedence where that workflow permits it.

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

Present the creative treatment first, then human-readable segments in story order. Give each segment a meaningful heading and a prose description of what happens, why it belongs here, what the viewer sees change, and how it develops the treatment and follows the preceding segment. Place the exact narration beside that description in a clearly separate spoken-text block. Make the film imaginable without requiring the user to decode a shot table. Keep `HOOK`, `HOOK RATIONALE`, `PAYOFF`, frame counts, component names, source locators and rendering commands in the production material rather than leading the script presentation with them.

Invoke `reasoning-first-writing` for user-facing documentation, treatment prose and substantive delivery explanations. `reasoning-first-narration` already loads that foundation for spoken scripts. Invoke `narrative-transitions` when drafting or materially revising the sequence, and check its boundaries together. These methods shape the writing, not three separate approval rounds. Preserve approved wording during technical production. A visual-only revision does not trigger a new script-writing pass.

Present the treatment, segment descriptions, verbatim narration, evidence and delivery choices as one coherent approval package before expensive production. Explain the applicable production gates once in that package, not in spoken narration. Only clear user approval counts. Feedback, questions, coordinator or autopilot permission do not replace it. Record the user's exact approval, time, script SHA-256, visual treatment, scope and voice conditions. Compare those inputs before production that consumes them. Reuse the approval across sessions and checkpoints while its exact content and conditions remain unchanged. A material change requires approval of that change, not another complete onboarding. Continue independent preparation while approval is pending. Production permission is not listening-based voice approval.

## 4. Produce

The promptlings installer owns the demo toolchain (Python, Node.js, Playwright CLI and its browser, HyperFrames, FFmpeg, diff2html, VS Code with Demo Time, vscode-playwright, Word or LibreOffice, Poppler and their upstream skills). Assume it is installed. If an installed tool fails or is absent, report its exact error and direct the user to rerun the promptlings installer. Do not repair the machine or replace real evidence with slides because setup failed. Prepare only what is production-specific: the subject application, demo data, authentication, the approved voice and assets.

Continue the selected route and treatment without a second briefing. On the Motionite route, select existing components before writing scene internals, using the catalog in `technical-demo-production`. Reuse Motionite's helpers and suitable frame-aware libraries through thin React compositions and parameterized props. Preserve the selected style across imports. Write custom code for a demonstrated gap, not for animations or visual primitives already available. Record versions, licenses and asset requirements. Keep dependencies, captures, generated media and renders outside the Promptlings repository and installed skills.

Use the production skill's native-resolution batch renderer for compatible Remotion projects. Reuse one browser and one bundle per unchanged entry point within a batch. A verified unchanged bundle can serve later props-only jobs. Batch review frames and transition frames rather than launching a renderer for each still. Use interactive preview for iteration, then render the required video. Do not substitute preview availability for delivery. Select concurrency for the host's current shared load, not a universal worker count.

Use real browser/window capture for required runtime evidence, and real editor capture when Design selected editor interaction as evidence, through the established capture specialists `cue-synced-demo` names rather than a hand-built recorder. Add only the minimal glue it describes, such as the walkthrough pointer overlay. Ordinary footage edits such as holds, badges, cuts and crossfades do not by themselves require HyperFrames. Invoke `cue-synced-demo` for event-bound footage and narration timing, not as the universal composition workflow. After privacy and capture-readiness checks, record the first authorized workflow run as both rehearsal and a candidate take. Retain usable footage and retake only affected sections when state and continuity permit. Reserve separate rehearsal for irreversible, difficult-to-reset or one-shot actions, using the skill's safe rehearsal procedure.

For synthetic speech explicitly invoke `tts-setup` and require its listening-based sample acceptance before full synthesis. Voice, provider, private-text transfer and costs are user decisions. Reuse accepted setups and existing specialists. Keep application flows, selectors and authentication project-local.

Review native-resolution stills, transition frames and a short moving section together before the full render. Judge evidence legibility, focus, depth, treatment and audio/visual joins. Use the approved treatment and existing representative-scene feedback when still applicable. Ask for a separate representative-scene decision only when the treatment is materially new or unresolved, rather than making every iteration wait at another gate. Reuse unchanged assets and make targeted revisions instead of using full renders to discover storyboard defects.

## 5. Review and revise

Combine encoded-output checks and visual/audio critique into one review of the delivered file. Fixed-count self-critique rounds, including Motionite's three-round instruction, are replaced by issue-driven revision. Do not manufacture defects or add a separate reviewer to fill a round count. Stop when the agreed checks pass and this review identifies no blocking defect.

Inspect the final encoded output, scene/event frames, cuts and joins. Listen through it with the visuals. Scan the final file for notifications and personal data. Check narrated artifacts, labels and formats against the visible evidence. Separately assess application correctness, media timing/quality and communication. Repeat the narration-muted visual review on the encoded scenes, not just the storyboard. Check evidence legibility, attention cues, useful visual changes and whether the accepted reference's explanatory functions survived production.

Check the retained evidence for important meaning omitted or oversimplified. Fix the earliest defective stage and only its affected consumers. Reuse unchanged source, audio and recordings, and render from originals after timing changes. Run the checks affected by the change and inspect its joins. Reinvoke narration for material script changes, not for an unchanged script. Save full command results once and inspect those results without rerunning the command merely to format its output. Re-encode and verify the exact final file when its content changes.

## 6. Deliver

Provide the reviewed video and approved script, with timing/check results and rerun instructions in linked or attached production artifacts. Keep the delivery message to the result and required user action rather than reciting those records. Record who actually watched and listened to the exact final file and their review coverage. The demo counts as accepted only after a person has watched and listened to the exact final file. Until then, present it positively as a request for action, for example: "Here's the finished cut, ready for your review. Please watch it and confirm or send changes." Do not lead with negative qualifiers such as "nobody has watched it", "unwatched" or "not accepted", and do not repeat the review status in follow-ups. Parent authorization or passing mechanical checks cannot substitute for that review. Rendering success is not audiovisual acceptance.

Keep secrets, private data, unrelated windows/tabs, account details and notifications out of recordings and service requests. Capture the intended viewport or window at native dimensions, not a full desktop cropped later. Do not upscale. Choose captions and mastering for the audience and destination. Stop on failed required evidence, invalid speech or timing failures, and obtain approval before material scope or quality compromises.
