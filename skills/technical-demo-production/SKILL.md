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
- Selected component versions, licenses, imported resources and production dependency lockfile.
- Working platform-specific commands, retained results, bundle inputs and invalidated outputs.
- Request-to-draft elapsed time, approval waits, stage durations and final artifact path/hash.

Check relevant identities and availability, not every source and asset on every turn. Reopen decisions when their inputs change or evidence disproves them. Resume at the affected stage. Preserve valid approval across sessions, while respecting its exact text, treatment, voice, scope and conditions.

Keep the human-readable treatment and segment descriptions with the exact script. Keep the upstream frame-based shot list and technical commands as production material. They express the same film at different levels, not separate design exercises.

## Compose before coding

Read [the component catalog](references/components.md) when selecting visuals. Start with the chosen Motionite example and helpers, then select existing components for gaps. Keep a thin React composition and use props for content, assets, styling and timing. Reuse the code across unrelated subjects. Write a new component only when the approved visual behavior is missing.

Install only selected, version-pinned production dependencies in the external production workspace, after updating its manifest. Preserve licenses and notices when copying source. Do not install every catalog entry, adopt another library's production agent, or write a new universal scene language.

Use `useCurrentFrame()` and deterministic calculations for Remotion animation. Static React/SVG components can be useful as-is. Timer-driven, CSS-transition and live-state animation needs a frame-driven adapter. A simulated terminal or chat is illustration, not proof of execution.

## Overlap only independent work

After treatment and inputs are settled, asset preparation, capture setup and composition scaffolding can overlap. Approved synthesis can overlap independent capture preparation. Final cue scheduling depends on measured audio and actual recorded events. Final rendering depends on the approved inputs and complete timeline.

Use separate output locations and browser sessions for independent operations. Avoid simultaneous writers to a composition or shared capture session. Budget CPU, memory and browser workers across the host. A synchronous tool need not block unrelated preparation, but parallelism does not waive approvals or justify more directors.

## Render without repeated startup

Use [the batch renderer](scripts/render-jobs.mjs) for Remotion 4.0.539. It resolves packages from the production root, not this skill. Pin `remotion`, `@remotion/bundler` and `@remotion/renderer` to that exact version in the production manifest. The Motionite example already pins this Remotion version. The version guard protects the measured browser-shutdown path, which uses a version-specific browser connection.

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

Batch native-resolution review frames and transition frames. Contact-sheet thumbnails may help navigation but do not replace native-size inspection. Review a short moving section and its joins before the full render. Apply the director's issue-driven revision policy instead of fixed-count critique rounds.

## Keep results and scope intact

Keep captures, dependencies, benchmarks and media in the authorized external artifact location, never in the repository or installed skill. Preserve unchanged source, recordings and approved audio. Save full tool output once, inspect targeted results, and rerun only for changed inputs or a specific failed check. Record prompt-to-draft timing separately from renderer timing and approval waits. A fast render is not a measured end-to-end draft.
