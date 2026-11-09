# Existing component sources

Choose components to express the approved treatment, not a topic-specific template. Captions, footage framing, quotations, diagrams and transitions generalize because their content changes independently of their implementation.

| Source | Reuse | Integration |
| --- | --- | --- |
| Motionite, NxrLabs | Selected style example, `anim.ts`, `styles/kit.tsx`, typography, camera and transition examples | Bundled with Promptlings. Read its `UPSTREAM.md`, preserve notices and copy only needed source/assets into production. |
| [snapcn, Shadcn Labs](https://github.com/shadcn-labs/snapcn) | Text reveals, captions, device frames, terminal illustrations and composed scenes | MIT source-copy registry. Select components and their declared dependencies. Its `@/` alias needs bundler configuration as well as TypeScript configuration. Do not adopt its separate production workflow. |
| [Remotion Bits, av](https://github.com/av/remotion-bits) | Animated text, transitions, particles, 3D and motion utilities | Package imports or selective source retrieval. Package 0.2.1 declares React 18+ and Remotion 4+ peers and MIT licensing. At inspection its root license link was missing, so resolve applicable distribution notices before adoption. |
| [Remotion transitions](https://www.remotion.dev/docs/transitions) | `TransitionSeries` and timing/presentation primitives | Pin to the production Remotion version. Remotion runtime terms apply. |
| [Remotion shapes](https://www.remotion.dev/docs/shapes) | SVG shape components and geometry | MIT. Prefer these or existing SVG assets over reimplementing common geometry. |

These are component sources, not mandatory dependencies. Check actual exports, props, dependencies, licensing and frame behavior for the selected version. Run a small native-resolution render covering the chosen component before extending its use. A package's peer-version range is not a runtime test.

[Parameterized rendering](https://www.remotion.dev/docs/parameterized-rendering) separates reusable component code from input props. Pass text, media, theme and timing as typed props, and derive metadata with the existing Remotion API where needed. Keep composition code and the dependency lockfile stable when only content changes.

[Remotion's animation contract](https://www.remotion.dev/docs/animating-properties) requires frame-driven animation. Do not assume arbitrary React animation libraries are seek-safe. Frame-controlled components and deterministic SVG are suitable starting points. Adapt wall-clock animation rather than letting timers run during frame capture.

Retain the chosen film's palette, typography and motion rules when importing components. Use real screenshots and recordings when the film promises actual application behavior. A reusable frame may surround real evidence, but an animated imitation cannot replace it.
