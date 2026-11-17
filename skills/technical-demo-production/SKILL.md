---
name: technical-demo-production
description: 'Guide Technical Demo production with retained decisions, existing frame-aware components, dependency-aware overlap and measured rendering practices. Use when preparing, realizing or revising a demo, not as another creative director.'
---

# Technical Demo Production

The director owns the story, treatment, approvals and delivery. This skill supplies execution support, not another workflow or review owner. Continue the selected Motionite/Remotion, explicit HyperFrames or plain-recording route.

Use the upstream tools directly. Choose task-specific commands or ad hoc production code when needed in the authorized external workspace. This skill does not require a repository-owned renderer, job format, process supervisor or test suite.

## Retain production inputs

Use the project's existing production notes and shot list as one production record. Do not add a competing brief, tracker or template. At a new task, record the request time. At continuation, retrieve the record before rediscovering tools, inputs or decisions. It should contain:

- Audience, central idea, creative treatment, scope and selected route.
- Exact script, treatment and representative-still revisions, script SHA-256, user approval words and conditions.
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

Before full production, use `technical-illustration` for the representative
content stills presented with the director's script. Build only those static
views, not a complete timeline, working experience or soundtrack. Reuse the
accepted direction and sample source after approval. Rejection of the palette
revises the affected samples without discarding an unchanged script.

Read [the component catalog](references/components.md) when selecting visuals. Start with the chosen Motionite example and helpers, then select existing components for gaps. Keep a thin React composition and use props for content, assets, styling and timing. Reuse the code across unrelated subjects. Write a new component only when the approved visual behavior is missing.

Reuse the installer's pinned demo runtime for standard Remotion, React, media, preview and TypeScript dependencies. Install only additional selected, version-pinned production dependencies in the external production workspace, after updating its manifest. Preserve licenses and notices when copying source. Do not install every catalog entry, adopt another library's production agent, or write a new universal scene language.

Use `useCurrentFrame()` and deterministic calculations for Remotion animation. Static React/SVG components can be useful as-is. Timer-driven, CSS-transition and live-state animation needs a frame-driven adapter. A simulated terminal or chat is illustration, not proof of execution.

## Overlap only independent work

After treatment and inputs are settled, asset preparation, capture setup and composition scaffolding can overlap. Approved synthesis can overlap independent capture preparation. Final cue scheduling depends on measured audio and actual recorded events. Final rendering depends on the approved inputs and complete timeline.

Use separate output locations and browser sessions for independent operations. Avoid simultaneous writers to a composition or shared capture session. Budget CPU, memory and browser workers across the host. A synchronous tool need not block unrelated preparation, but parallelism does not waive approvals or justify more directors.

## Render without repeated startup

After the director's script-and-still approval, build one complete previewable composition containing the recorded media, authored scenes and actual soundtrack. Use the existing Motionite/Remotion Player or Studio route for moving review before encoding. Later selected native stills support that review without adding another exhaustive approval phase. Do not build an overlay-image export and per-frame FFmpeg compositing loop for ordinary footage, crops, highlights or transitions. Final media assembly and unchanged-audio muxing remain valid FFmpeg uses.

Use the project's existing Remotion CLI/configuration or public renderer APIs. The installer prepares standard packages in `~/.promptlings/runtimes/remotion-4.0.539` under the user home, including React, TypeScript, Remotion CLI/Player, bundler, renderer, media and matching Headless Shell. Exact pins live in the installer's `lib/pins.js`. Check the package versions actually used by the production before rendering. Keep Remotion packages and add-ons version-matched rather than silently mixing local and installed versions.

Resolve packages and assets from explicit locations. An installed runtime is not automatically on a production project's module search path. When using its bundler API from an external production, include that runtime's `node_modules` in webpack module resolution while preserving project aliases and Remotion's React aliases. Some add-ons, including `@remotion/transitions`, install `remotion` without the renderer or bundler. Check the complete selected toolchain rather than treating that package's presence as readiness. Keep the managed runtime installer-owned, with compositions, additional dependencies, assets, bundles and renders in the external production workspace.

Reuse the prepared browser. Remotion 4.0.539 uses Headless Shell 157.0.8080.0. The installer runs Remotion's own `browser ensure` command from the managed runtime so its cache stays there. Locate the prepared executable and pass its absolute path through the chosen CLI or API. Record its identity once. Do not let a different working directory trigger another download or silently select full Chrome. If setup is missing, report the exact failure and use the installer rather than inventing a repair pipeline.

Keep the requested native width, height and fps, with scale 1 and even dimensions for H.264. Select stills and inclusive frame ranges within the composition duration. A stills-only inspection does not replace delivery of the required video. Mastering, cue verification and encoded-output review remain part of the selected production route.

Reuse one browser and one bundle per unchanged entry point when batching through the renderer API. With the CLI, reuse a verified unchanged bundle instead of rebuilding it for every output. Batch selected native review frames rather than launching a separate compositor for each frame. Programmatic bundling does not load `remotion.config.ts`: use the configured CLI when that file supplies aliases or other required behavior, or carry those settings explicitly into the chosen API call.

### Runtime defaults and bounded tuning

The installer provides standard packages and a browser, not CUDA or GPU drivers. Select rendering settings at production time from the machine's working capabilities. Browser graphics, video decoding and final encoding are separate decisions.

| Decision | Starting point and adaptation |
| --- | --- |
| Footage | Prefer `Video` from version-matched `@remotion/media`, following the component catalog's codec/fallback guidance. Preserve trims, framing, timing and audio when replacing `OffthreadVideo`. |
| Browser and graphics | Use pinned Headless Shell with default graphics for ordinary footage and HTML/CSS. Use ANGLE or another graphics backend only for a demonstrated WebGL/WebGPU need or a matched measured benefit. |
| Encoding | Try an actual bounded H.264 encode with the selected runtime's bundled FFmpeg: `h264_videotoolbox` on macOS or `h264_nvenc` on Windows/Linux. Use hardware only after it succeeds. Otherwise record the reason and use software H.264, CRF 18 and x264 `veryfast`. If hardware was explicitly required, report the failed requirement. |
| Hardware bitrate | Start at 30 Mbps for 1080p30, scaling by pixel count and fps with a 1 Mbps floor, then judge the actual picture and delivery size. Remotion bitrate strings need a suffix, such as `30000k` or `30M`. Bitrate encoding is not equivalent to CPU CRF quality. |
| Workers | Start with at least one and at most four, bounded by half the available CPU parallelism and one worker per 2 GiB available to the process. Use current available memory and shared load, not total installed RAM. Tune from measured behavior rather than treating this heuristic as an optimum. |
| Ports | Use a free unprivileged port or Remotion's allocation. Never take over an application callback or another development server. |
| Progress | Keep frame, encoding and stage progress live. Treat 120 seconds without advancement as a starting stall threshold, adjusting for a known legitimate slow operation. Record failures instead of silently retrying an entire film. |

Remotion 4.0.539's `if-possible` checks the encoder list, which can include NVENC without a usable GPU or driver. For a real capability probe, encode one PNG through `image2pipe` at the intended dimensions and fps, with `yuv420p`, one output frame and a bounded wait such as 15 seconds. The bundled FFmpeg used in the measured run lacked the rawvideo input demuxer and lavfi color source, so do not assume those probe recipes work. For VideoToolbox, disable its software fallback during the capability probe. Reuse a successful probe for the same native format while its runtime and device remain unchanged.

A failed probe selects the explicit software path, not a CUDA or driver installation. Suggest relevant vendor guidance only when the observed error supports a specific setup problem. A hardware failure after a successful probe is a failed render to investigate, not permission to conceal it with an automatic full CPU rerender.

Use a representative footage-and-overlay interval to tune only when performance needs investigation. Compare the same frames, dimensions, props, media and encoding profile, changing one setting at a time where practical. Inspect moving output and joins as well as native frames. Reuse unchanged recordings, audio and bundles. Do not copy one host's worker count, graphics backend, decoder cache or GPU result as a universal optimum. Chrome shared-memory capture is platform-dependent and is not available on Windows in this pinned version. Keep experimental capture flags out of the default profile.

These practices follow [Remotion's hardware support](https://www.remotion.dev/docs/hardware-acceleration), [Remotion 4 graphics guidance](https://www.remotion.dev/docs/gl-options), [Headless Shell guidance](https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell) and [shared-memory capture support](https://www.remotion.dev/docs/shared-memory-capture). Check these contracts when changing the version pin.

The measured 85-second, 1080p30 film took 588.736 seconds with the earlier profile and 226.285 seconds after the media/browser/graphics changes. Both profiles used NVENC and two workers on the same Windows host. Preserve that successful combination as a starting reference, not a universal setting, an isolated GPU speedup or evidence of better autonomous direction.

### Own the render and retain its evidence

Use the execution host's process ownership and cancellation facilities. Establish ownership before starting native work, and retain it if the rendering worker exits unexpectedly. Scope any termination to this production's actual processes, never executable names or unrelated sessions.

On Windows, a Job Object can retain ownership of descendants after the worker dies. On POSIX, a process-group stop only covers processes still in that group: Remotion normally detaches Chrome into another group. Keep that browser within the owned group or account for its separate group explicitly. Release owned processes on success, failure and interruption, and verify that native work and listening ports have stopped.

Remotion 4.0.539's cancellation signal can reject the public promise after frame rendering while native encoding or muxing continues. Neither that rejection nor the worker's exit proves shutdown. Check the browser, encoder and serving processes before treating a stopped run as released. Preserve any shutdown failure and the actual remaining process identities. A partial output is not a completed film.

Keep progress live, including an elapsed-time heartbeat during a long operation. Retain the selected versions, browser/graphics/encoder settings, fallback reasons, last progress, timings, bundle paths, completed outputs and failures in the existing production record. Read saved results instead of repeating work merely to collect or reformat them.

For props-only revisions, reuse `serveUrl` only after checking that source, dependencies, configuration and bundled assets are unchanged. Rebundle when those inputs change. Use Remotion Player/Studio for immediate motion review without encoding. Changed visuals still need rendering for video delivery. Reuse encoded clips only when their content, audio, timing and joins remain compatible.

Verify the encoded file's native dimensions, frame count, fps, duration and expected audio, then decode the entire output. For unchanged narration, compare the decoded audio rather than assuming a mux preserved it. The measured bundled FFmpeg lacked the default `wrapped_avframe` null-output encoder: explicitly selecting a supported encoder such as `libx264` allows a full decode check. These are checks of the actual production artifact, not a requirement to add a test suite.

Batch the native-resolution review frames and transition frames needed to answer specific visual questions. Contact-sheet thumbnails may help navigation but do not replace native-size inspection or moving review. Use the playable composition to review a moving section with its actual audio across the relevant capture/authored joins before the full render, not only isolated scene entrances. Keep this within the director's existing review, not another gate. Check that the focal evidence remains identifiable through each handoff and that motion communicates its relationship rather than merely changing the layout.

At native size, check highlight bounds after crop, scale and translation: borders must clear the intended text and exclude the following heading or unrelated content. Verify framing keeps an actionable control visible when it is used. Inspect source-derived crops for unrelated names, stale labels and burned-in overlays. Check readable excerpts against their exact source and ensure they do not obscure the operation. Correct only the affected composition or framing, retain the observed defect and corrected output in the existing record, then rerun the affected interval and joins. Apply the director's issue-driven revision policy instead of fixed-count critique rounds.

## Keep results and scope intact

Keep captures, dependencies, benchmarks and media in the authorized external artifact location, never in the repository or installed skill. Preserve unchanged source, recordings and approved audio. Save full tool output once, inspect targeted results, and rerun only for changed inputs or a specific failed check. Record prompt-to-draft timing separately from renderer timing and approval waits. A fast render is not a measured end-to-end draft.
