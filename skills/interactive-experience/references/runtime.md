# Runtime contract

The experience is a folder the presenter runs from their own machine with no internet. Write it as source files in the production workspace and assemble the folder with a project-local Node build script. The build script loads the experience toolkit from the global install (`createRequire(path.join(npmRoot, "noop.js"))` with `npmRoot` from `npm root --global`), so the workspace installs nothing. The promptlings repository holds no runtime code.

## Folder

```text
<talk>/
  index.html        audience view; ?view=presenter opens the presenter view
  app.css           all styles, fonts referenced as url(assets/fonts/...)
  app.js            one classic script (no imports): runtime, stops and bundled libraries
  assets/           fonts, images, posters, LICENSES.txt
  videos/           <id>.mp4 with <id>.chapters.vtt and <id>.captions.vtt
  data/             workshop records, one <stream>.ndjson per capture stream
  serve.mjs         the server and the handout exporter, Node built-ins only
  start.cmd         node "%~dp0serve.mjs" --open
  start.sh          exec node "$(dirname "$0")/serve.mjs" --open
  README.txt        launch commands, keys and the handout command
```

`app.js` and `app.css` never reference asset URLs other than relative paths under `assets/` and `videos/`, and `app.js` reaches videos only through the stop list. The handout exporter depends on this.

## Server

Generate `serve.mjs` per experience using only `node:http`, `node:fs`, `node:path`, `node:url` and `node:child_process`. Node 22 is installed with the agent; nothing is installed in the folder.

- **Bind and port:** listen on `127.0.0.1` only. Default to port 8765, take the next free port when it is busy, and print the audience and presenter URLs. `--port <n>` overrides. `--open` opens both URLs with the platform opener (`start`, `open` or `xdg-open`).
- **Static files:** serve the folder with explicit content types (`text/html`, `text/css`, `text/javascript`, `font/woff2`, `image/svg+xml`, `image/webp`, `image/png`, `video/mp4`, `text/vtt`, `application/json`, `text/plain`). Resolve every path against the folder root and refuse anything that escapes it, including encoded `..` segments. Serve `data/` only through the data API.
- **Range requests:** send `Accept-Ranges: bytes` on files. For `Range: bytes=start-end`, `bytes=start-` and `bytes=-suffix`, answer `206 Partial Content` with `Content-Range: bytes start-end/size` and stream that slice. Answer an unsatisfiable range with `416` and `Content-Range: bytes */size`. Treat a multi-range request as a full `200` response. Video seeking depends on this; Python's `http.server` lacks it, which is why the server is generated rather than borrowed.
- **Data API:** `POST /api/data/<stream>` with a JSON body of at most 64 KB appends one line to `data/<stream>.ndjson` with a server timestamp. `GET /api/data/<stream>` returns the stream's records as a JSON array. Stream names match `^[a-z0-9-]{1,40}$`; reject anything else with `400` and malformed JSON with `400`. Append with `fs.appendFile` so a crash loses at most the request in flight.
- **Caching:** send `Cache-Control: no-store` so a rebuilt folder is never served stale during rehearsal.
- **Handout:** `node serve.mjs --handout` writes `handout.html` (see below) and exits.

## Stage

- Author everything on a fixed 1920x1080 logical stage. Scale the stage to the window with one CSS `transform: scale()` on a wrapper and letterbox the remainder, so projectors at other sizes or aspect ratios never reflow the layout. Map pointer coordinates through the same scale for direct manipulation.
- Animate only `transform`, `opacity` and filters that composite on the GPU. Draw simulations with SVG for up to a few hundred elements and Canvas 2D beyond that, sized in stage units and scaled with the device pixel ratio.
- Honor `prefers-reduced-motion` and expose a manual toggle (`M`). Reduced motion swaps transitions for instant cuts to the same final state; simulations still run, because their motion is the content.

## Stops, beats and presets

- Describe the storyline as an ordered list of stops. Each stop has a stable identifier (for example `queue`), a section, a kind (`app`, `video`, `capture` or `evidence`), a title for the map and the next preview, and an ordered list of beats.
- A beat has an identifier, presenter notes, a focal element and the state it sets: a named preset, a patch to the stop state, a revealed layer or control, or a video chapter.
- A mini-app stop declares its presets, including `entry`. A preset is a complete state object: every control value, the random seed and, for simulations, the tick to run to. Applying a preset always produces the same frame, whatever happened before.
- Render through one function, `show(stopId, beatIndex, state)`, that sets the complete visual state. Transitions may animate from the current frame to the target, but the target never depends on the route. Going backward, jumping by deep link and reloading produce the same frame as walking forward.
- Each mini-app implements `mount(root, ctx)` returning `{ setState(state, { animate }), getState(), tick(), dispose() }`. `ctx` supplies `rng(seed)`, the fixed-step clock, `save(stream, record)`, `load(stream)` and the reduced-motion flag.
- **Randomness:** use only `ctx.rng(seed)`, a seeded generator such as mulberry32. `Math.random`, `Date.now` and `performance.now` never influence a model's state.
- **Time:** simulations advance in fixed ticks (for example 60 per simulated second) from the clock, never from frame timing. Play, pause, single-step and speed change the tick rate only, so a preset run to tick N is identical on every machine.
- **Exploration:** the presenter can move any visible control or drag any manipulable element at any time. The state changes, the URL keeps the stop and beat, and `0` returns to the beat's state. `S` saves the current state to the `snapshots` stream with the stop identifier; the presenter view lists saved snapshots for recall.
- Update the URL hash on every beat with `history.replaceState` (for example `#queue/2`) and restore from it on load.

## Controls

| Key | Action |
| --- | --- |
| `ArrowRight`, `PageDown`, `Space` | Next beat, then the next stop |
| `ArrowLeft`, `PageUp` | Previous beat |
| `Home`, `End` | First, last stop |
| `1` to `9` | Apply preset by number in the current stop |
| `0` | Reset the current beat's state |
| `K` | Play or pause the simulation or video |
| `J`, `L` | Step the simulation one tick back or forward; in a video, seek 5 seconds back or forward |
| `[`, `]` | Previous, next video chapter |
| `E` | Show or hide the stop's control panel |
| `S` | Save a snapshot of the current state |
| `O` | Storyline map: every stop, current position, jump by click or number |
| `H` | Home stop |
| `G` | Go to stop by identifier or number |
| `B`, `.` | Toggle blackout |
| `F` | Fullscreen through the Fullscreen API |
| `P` | Toggle the in-page presenter layout |
| `M` | Toggle reduced motion |
| `R` | Cut the current live step to its recorded fallback |

Most clickers send `PageUp`, `PageDown`, `B` and `.`, so the storyline works from a clicker alone. Ignore key repeat during a running transition by jumping straight to its end state rather than queueing. Keys never act while focus is in a text field of a capture stop.

Stepping backward through a simulation replays from the preset to tick N-1, which stays exact because the model is deterministic.

## Presenter view

- `index.html?view=presenter` shows the current beat scaled down, the next-beat preview, the notes, the stop's presets with their keys, saved snapshots, elapsed and wall-clock time and the section time budget. Both windows are served from the same origin and sync through `BroadcastChannel`: either window can drive, and the other follows with the same stop, beat, state, video time and play state.
- `P` switches the audience page into the same layout for single-screen or screen-share delivery.
- Notes come from the same stop list the experience renders, so the script cues and the screen cannot drift.

## Video stops

- Embed the clip from the `technical-demo` agent's output as `videos/<id>.mp4`, H.264 video with AAC audio for universal hardware decoding, with a poster frame in `assets/`. Never inline video as base64.
- Add `<track kind="chapters">` from `<id>.chapters.vtt`, generated from the clip's chapter or scene data, and `<track kind="captions">` from its narration. Bind beats to chapters so the storyline map, the presenter view and `[`/`]` share one chapter list.
- Start playback only from a presenter key or click, which satisfies browser autoplay rules with sound. Show no native controls on the stage; the presenter view shows the playhead and chapter list.
- Record whether each clip plays with its own narration or muted under the presenter's voice; the script follows that choice.

## Workshop data capture

- A capture stop records what the room decides: a predicted outcome, a vote count, the parameters the room chose, an exercise answer, a ranked list. The presenter or a facilitator enters it with large controls on the stage or in the presenter view, and the stop shows the aggregate as it builds.
- Records go to the data API, one stream per question. Store no names or personal data unless the user explicitly asks for it; record counts, choices and free text the room agreed to share.
- Stops that use captured data (for example running the model with the room's chosen parameters, or comparing the room's prediction with the result) read it with `ctx.load` on mount, so a reload or a server restart loses nothing.
- `data/` is the raw record of the session. The handout embeds it.

## Handout

`node serve.mjs --handout` writes one `handout.html` that opens from `file://` with no network:

- Inline `app.css` with every `url(assets/...)` as a data URI, `app.js`, and every `assets/` reference in `index.html`.
- Embed every `data/*.ndjson` stream as JSON in `<script type="application/json" id="captured">`; capture stops render read-only from it.
- Set `handout` mode: controls are always visible, the reader drives at their own pace, presenter notes, the presenter view and data writes are off.
- Replace each video with its poster, its chapter list and the clip's file name, and copy the clips next to the handout when sharing them.
- Keep the license notices.

## Assets and toolkit

The promptlings installer installs this toolkit globally with the agent, at these exact versions. Use nothing outside it.

| Job | Package | License |
| --- | --- | --- |
| Syntax highlighting | `shiki@4.5.0` | MIT |
| Code morphs | `@shikijs/magic-move@4.5.0` | MIT |
| Seekable motion | `motion@14.7.1` | MIT |
| Shape morphs | `flubber@0.4.2` | MIT |
| Sketch style | `roughjs@4.6.6` | MIT |
| Data visuals, scales and forces | `d3@7.9.0` | ISC |
| Diagram layout | `@dagrejs/dagre@3.1.3` | MIT |
| Design tokens | `open-props@1.7.23` | MIT |
| Icons, one set per experience | `lucide-static@1.62.0`, `@tabler/icons@3.50.0` | ISC, MIT |
| Fonts | Fontsource: Inter, Space Grotesk, JetBrains Mono, Geist, Geist Mono, IBM Plex Sans, IBM Plex Mono, Source Serif 4, Source Sans 3, Fraunces, Instrument Serif, Archivo, Archivo Black, Space Mono, Caveat, DM Sans, Newsreader | OFL-1.1 |
| Accessibility scan (verification only, never bundled) | `axe-core@4.14.0` | MPL-2.0 |

- **Fonts:** copy the toolkit's latin `.woff2` files for the chosen pairing into `assets/fonts/`. Keep to two families and a few weights.
- **Code:** pre-highlight with Shiki at build time into static HTML. For animated code changes, precompile tokens with `@shikijs/magic-move` and bundle its renderer.
- **Diagrams:** author as inline SVG, laying out larger graphs with dagre at build time.
- **Models and simulations:** plain JavaScript state and update functions; D3 for scales, shapes and force layouts, with the force simulation stepped manually by the fixed clock.
- **Motion:** CSS transitions and the Web Animations API cover most needs. When timelines justify a library, bundle Motion.
- **Raster evidence:** screenshots as compressed WebP or PNG in `assets/`.
- **Bundling:** concatenate each library's prebuilt browser build (UMD or IIFE) and the experience code into `app.js`.

Record each bundled package's name, version and license in the production notes. Write `assets/LICENSES.txt` with the copyright line and full license text of every bundled library, font and icon set, taken from the package's `LICENSE` file, and reference it from the storyline map, since MIT, ISC and OFL require the notice to travel with copies.
