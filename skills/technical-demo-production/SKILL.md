---
name: technical-demo-production
description: 'Support Technical Demo production with retained decisions, existing frame-aware components, dependency-aware overlap and native-resolution batch rendering. Use when preparing, realizing or revising a demo, not as another creative director.'
---

# Technical Demo Production

The director owns the story, treatment, approvals and delivery. This skill supplies execution support, not another workflow or review owner. Continue the selected Motionite/Remotion, explicit HyperFrames or plain-recording route.

## Retain production inputs

Use the project's existing production notes and shot list as one production record. Do not add a competing brief, tracker or template. At a new task, record the request time. At continuation, retrieve the record before rediscovering tools, inputs or decisions. It should contain:

- Audience, central idea, creative treatment, scope and selected route.
- Exact script and treatment revisions, script SHA-256, user approval words and conditions.
- Accepted voice/provider/settings, listening sample and unchanged audio references.
- Source locators and revisions, evidence status, required real interactions and artifact paths.
- Asset paths, measured durations, cue bindings, composition IDs and native dimensions/fps.
- Moving-reference timecodes and the directing behavior transferred into the shot list.
- Each beat's evidence object, visible change, native region, attention move, handoff and non-speech inspection purpose.
- Selected component versions, licenses, imported resources and production dependency lockfile.
- Working platform-specific commands, retained results, bundle inputs and invalidated outputs.
- Request-to-draft elapsed time, approval waits, stage durations and final artifact path/hash.

Check relevant identities and availability, not every source and asset on every turn. Reopen decisions when their inputs change or evidence disproves them. Resume at the affected stage. Preserve valid approval across sessions, while respecting its exact text, treatment, voice, scope and conditions.

Keep the human-readable treatment and segment descriptions with the exact script. Keep the upstream frame-based shot list and technical commands as production material. They express the same film at different levels, not separate design exercises.

Keep production provenance in this record, not in the film. Never add stock disclaimers such as "SYNTHETIC EXAMPLE", "NOT AN APP CAPTURE" or "ILLUSTRATIVE ONLY" to layouts, captions or narration. Do not inherit them from sample components or trial scaffolding. They are blocking editorial defects, not evidence safeguards. Correct an unsupported claim or supply its evidence instead. Preserve required legal notices, explicit user-requested labels and concise claim-specific attribution or meaningful time-cut markers without adding blanket production warnings.

## Compose before coding

Read [the component catalog](references/components.md) when selecting visuals. Start with the chosen Motionite example and helpers, then select existing components for gaps. Keep a thin React composition and use props for content, assets, styling and timing. Reuse the code across unrelated subjects. Write a new component only when the approved visual behavior is missing.

Install only selected, version-pinned production dependencies in the external production workspace, after updating its manifest. Preserve licenses and notices when copying source. Do not install every catalog entry, adopt another library's production agent, or write a new universal scene language.

Use `useCurrentFrame()` and deterministic calculations for Remotion animation. Static React/SVG components can be useful as-is. Timer-driven, CSS-transition and live-state animation needs a frame-driven adapter. A simulated terminal or chat is illustration, not proof of execution.

## Overlap only independent work

After treatment and inputs are settled, asset preparation, capture setup and composition scaffolding can overlap. Approved synthesis can overlap independent capture preparation. Final cue scheduling depends on measured audio and actual recorded events. Final rendering depends on the approved inputs and complete timeline.

Use separate output locations and browser sessions for independent operations. Avoid simultaneous writers to a composition or shared capture session. Budget CPU, memory and browser workers across the host. A synchronous tool need not block unrelated preparation, but parallelism does not waive approvals or justify more directors.

## Render without repeated startup

Build one complete previewable composition containing the recorded media, authored scenes and actual soundtrack. Use the existing Motionite/Remotion Player or Studio route for moving review before encoding. Selected native stills support that review, rather than becoming a separate prerequisite phase. Do not build an overlay-image export and per-frame FFmpeg compositing loop for ordinary footage, crops, highlights or transitions. Final media assembly and unchanged-audio muxing remain valid FFmpeg uses.

Use [the batch renderer](scripts/render-jobs.mjs) for Remotion 4.0.539. It resolves packages from the production root, not this skill. Pin `remotion`, `@remotion/bundler` and `@remotion/renderer` to that exact version in the production manifest. The Motionite example already pins this Remotion version. The version guard protects the measured browser-shutdown path, which uses a version-specific browser connection.

Use a job manifest instead of writing another rendering wrapper. If the helper cannot express a required output, record the exact missing capability or observed failure before choosing another execution path. A preference for transparent intermediate frames is not itself a requirement when the complete composition can render the intended picture.

Run `node "<skill directory>/scripts/render-jobs.mjs" "<production directory>/jobs.json"` using the host's path syntax. Paths in each job resolve from `root`, which resolves relative to the manifest. This example uses a manifest inside the production directory:

```json
{
  "root": ".",
  "browserExecutable": "browser/chrome",
  "concurrency": 4,
  "jobs": [
    {
      "entryPoint": "src/index.ts",
      "id": "Film",
      "inputProps": {"title": "The approved title"},
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "stills": [0, 29, 30, 31],
      "stillOutput": "review/frames",
      "output": "renders/draft.mp4"
    }
  ]
}
```

Choose concurrency for current host capacity, not this example's number. Each job requires exactly one `entryPoint` or `serveUrl` (an existing local bundle directory or HTTP(S) URL). Omit `output` for a stills-only review. Native dimensions and frame rate are mandatory checks, never scaling requests. The helper uses H.264 CRF 18, x264 veryfast and scale 1. Mastering, cue verification and encoded-output review remain required by the selected production route.

Prepare the approved browser once with the production toolchain. Replace the example's `browserExecutable` with its actual path, relative to `root` or absolute. This required path prevents implicit downloads, upgrades and browser-cache lookup in the caller's repository. Keep the verified browser identity in the production record. The pinned public `openBrowser()` does not forward an `onBrowserDownload` option, so a callback alone cannot enforce this boundary.

One invocation reuses a browser and bundles each entry point once. The result file, beside the manifest as `jobs-result.json`, retains timings, bundle paths, completed jobs and errors, including shutdown failures. Failures exit nonzero. Read that result rather than rerunning a job to collect or reformat output.

The helper's programmatic `entryPoint` bundling does not load `remotion.config.ts`. For custom webpack aliases or other project bundling overrides, build through the configured Remotion CLI and pass that existing bundle as `serveUrl`. This also supports source-copy libraries whose imports depend on a configured alias.

For props-only revisions, reuse `serveUrl` only after checking that source, dependencies, configuration and bundled assets are unchanged. Rebundle when those inputs change. Use Remotion Player/Studio for immediate motion review without encoding. Changed visuals still need rendering for video delivery. Reuse encoded clips only when their content, audio, timing and joins remain compatible.

Batch the native-resolution review frames and transition frames needed to answer specific visual questions. Contact-sheet thumbnails may help navigation but do not replace native-size inspection or moving review. Use the playable composition to review a moving section with its actual audio across the relevant capture/authored joins before the full render, not only isolated scene entrances. Keep this within the director's existing review, not another gate. Check that the focal evidence remains identifiable through each handoff and that motion communicates its relationship rather than merely changing the layout.

At native size, check highlight bounds after crop, scale and translation: borders must clear the intended text and exclude the following heading or unrelated content. Verify framing keeps an actionable control visible when it is used. Inspect source-derived crops for unrelated names, stale labels and burned-in overlays. Check readable excerpts against their exact source and ensure they do not obscure the operation. Correct only the affected composition or framing, retain the observed defect and corrected output in the existing record, then rerun the affected interval and joins. Apply the director's issue-driven revision policy instead of fixed-count critique rounds.

## Keep results and scope intact

Keep captures, dependencies, benchmarks and media in the authorized external artifact location, never in the repository or installed skill. Preserve unchanged source, recordings and approved audio. Save full tool output once, inspect targeted results, and rerun only for changed inputs or a specific failed check. Record prompt-to-draft timing separately from renderer timing and approval waits. A fast render is not a measured end-to-end draft.
