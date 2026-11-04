# Visual directions

An experience looks like a set of instruments built for one subject, not like slides and not like a SaaS dashboard. The polished explainers this format learns from (Ciechanowski, Red Blob Games, Sam Rose, Seeing Theory, Distill) share four traits whatever their palette:

1. **The model is the largest thing on screen.** Text is subordinate to it.
2. **Labels sit on the part they name.** They do not float in a legend.
3. **Controls are few, literal and on the model.** Drag the thing itself; a slider is for a parameter with no natural handle.
4. **Chrome recedes once the model runs.** Navigation, headers and footers carry no visual weight during a stop.

Every experience commits to one fully specified direction before any stop is built. A direction sets the palette, type, control styling, how live elements render, how things move and the one signature device the experience is remembered by. Variation between experiences comes from this choice, made from the subject and the room, never from the model's default taste.

## Choose a direction

1. **Ground it in the subject.** List three things the subject is made of (packets, ledgers, gears, layers, a timeline) and one feeling the audience should leave with (confidence, urgency, delight). Load `frontend-design` and follow its brainstorm, explore and critique loop.
2. **Read the room.** Bright room or weak projector: favor light directions. Dark hall: dark directions work. Teams share: no fine hairlines, gradients, blur or dense textures, which compression destroys.
3. **Shortlist two directions** from the catalog, or derive one from the design presets in `hyperframes` `assets/frame-presets/`. Build the same representative mini-app in each and screenshot it twice: at rest on its entry preset, and mid-manipulation with values changing. Choose from the screenshots, because an app is judged while it moves, not only while it sits.
4. **Name the signature device.** One structural idea that recurs across stops: an entity color code shared by models, code and labels; a blueprint grid every model snaps to; an instrument bezel every stop sits in; a margin timeline. Spend spectacle there and nowhere else.
5. **Write the tokens** (palette, state colors, type scale, spacing, radius, stroke, control sizes, easing and durations) into one `:root` block and record the direction, signature device and rejected alternative in the production notes for outline approval.

## Catalog

Palettes are OKLCH: field (page background), surface (panels), ink (text), signal (the thing being explained), then the state colors ok, warn and fail. Every font is SIL OFL 1.1 and ships with the experience toolkit in [runtime](runtime.md). Directions 2 to 12 are designed to the projection rules below rather than measured from one site; check contrast and color-vision simulation before locking one.

| # | Direction | Palette (field, surface, ink, signal; ok, warn, fail) | Type | Controls and chrome | Live elements and motion | Fits | Fails |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Precision diagram | `0.97 0.002 90`, `0.99 0 0`, `0.38 0.01 270`, blue `0.47 0.19 258` and rust `0.62 0.17 35`; `0.62 0.15 150`, `0.75 0.17 85`, `0.58 0.21 25` | IBM Plex Sans, Inter labels | Handles drawn on the object; almost no chrome; the model sits in the page with no border | Parts color-coded once and reused in every label; physically plausible easing; a visible pause control | Mechanisms, physics, how X actually works | Live traffic, ops dashboards |
| 2 | Blueprint | `0.24 0.04 250`, `0.28 0.04 250`, `0.95 0.01 250`, drafting amber `0.80 0.13 85` and cyan `0.76 0.10 190`; `0.76 0.15 150`, `0.82 0.15 85`, `0.62 0.22 25` | Space Grotesk headings, IBM Plex Mono dimensions | Sliders as dimension lines with ticks and a readout; toggles as switch symbols; grid at 4% opacity, spacing 24px or more | Nodes as construction geometry: dashed guides, crosshair markers; snappy, plotter-like motion with no overshoot | Architecture, request tracing, protocols | Emotional or narrative stories |
| 3 | Lab instrument | `0.19 0.01 260`, `0.23 0.015 260`, `0.92 0.01 150`, phosphor green `0.85 0.20 145` and amber `0.78 0.17 60`; `0.85 0.20 145`, `0.82 0.17 70`, `0.64 0.23 25` | JetBrains Mono readouts, IBM Plex Sans labels | Rotary knobs on range inputs; backlit rocker toggles; a dark bezel around a recessed screen holding the only bright pixels | Traces with a short phosphor-decay trail; continuous sweeps | Latency, signals, failure injection, waveforms | Warm, human topics |
| 4 | Ops console | `0.19 0 0`, `0.23 0 0`, `0.93 0 0`, terminal green `0.80 0.18 150` and cyan `0.76 0.14 230`; `0.80 0.18 150`, `0.82 0.16 85`, `0.66 0.21 25` | JetBrains Mono or IBM Plex Mono only, two weights | Buttons as bracketed commands `[ run ]`; bracket gauges; one status bar for mode and time | Requests and logs stream as monospace rows colored by status; discrete, tick-based motion | Tracers, incidents, SRE and infra demos | Beginner tutorials |
| 5 | Graphics desk | `0.985 0.003 90`, `0.97 0.005 90`, `0.25 0.01 60`, editorial red `0.55 0.18 25` and ink blue `0.50 0.12 250`; `0.55 0.15 150`, `0.70 0.16 80`, `0.50 0.20 25` | Fraunces headlines, Newsreader or Inter body | Underlined text triggers, small scrubbers under a chart; wide margins, one rule above and below the model | Data marks with sequential draw-in; annotations on leader lines, never tooltip boxes | Benchmarks, metrics stories, sweeps over real data | Low-level internals |
| 6 | Notebook sketch | `0.96 0.01 95`, `0.99 0.01 95`, `0.30 0.02 50`, marker red `0.55 0.16 25` and ballpoint blue `0.50 0.14 250`; `0.55 0.15 150`, `0.70 0.16 85`, `0.50 0.20 25` | Caveat annotations, IBM Plex Sans body | Rough.js controls with a fixed seed, full-size and fully usable; wavy 2px panel edges | Simple drawn shapes with slight per-element offsets; loose timing | Workshops, onboarding, napkin math, early proposals | Audits, finance, security sign-off |
| 7 | Hardware panel | `0.93 0.01 95`, `0.97 0.005 95`, `0.20 0 0`, signal orange `0.75 0.20 55` and graphite `0.30 0 0`; `0.70 0.18 140`, `0.80 0.17 85`, `0.60 0.22 25` | Space Grotesk tracked caps labels, JetBrains Mono readouts | Knobs with a pointer notch, rocker toggles, steppers with printed labels under each control; an enclosure with real corners | Segmented LED meters; quantized motion with a slight detent overshoot | Parameter explorers, sweeps, every stop as a device | Dense text, editorial stories |
| 8 | Museum exhibit | `0.20 0.01 260` wall, `0.95 0.005 90` placard, `0.25 0.01 60` on placard, brass `0.60 0.14 50` and museum blue `0.55 0.12 220`; `0.60 0.15 150`, `0.75 0.16 80`, `0.55 0.20 25` | Fraunces display, IBM Plex Sans body | A cream placard holds the assertion and controls; brass-rimmed dials with large targets | One lit specimen per stop, everything else recedes; one thing moves at a time | A single showcase mechanism, history of an idea | Sweeps, multi-variable comparison |
| 9 | Grid lab | `0.98 0.005 250`, `0.995 0 0`, `0.30 0.02 260`, blue `0.55 0.15 260` and coral `0.70 0.16 20`; `0.60 0.15 150`, `0.75 0.16 85`, `0.58 0.20 25` | Space Grotesk headings, Inter axes | Controls inside the chart (drag the bar); flat tiles with a 2px border, one 4 to 6px radius | Many small tiles updating in lockstep with one easing curve, so comparison stays fair | Sweep grids, before and after, statistics and ML concepts | A single hero object |
| 10 | Riso print | `0.96 0.01 95`, `0.99 0.01 85`, `0.25 0.02 30`, riso red `0.65 0.22 25` and riso blue `0.60 0.15 230`; `0.65 0.18 145`, `0.78 0.17 85`, `0.55 0.22 25` | Fraunces or Instrument Serif headings, Newsreader body | Flat die-cut shapes; depth from a 2px offset duotone layer, never blur | Solid cutout particles with slight rotation; slide, flip and stack moves | Playful concepts, culture-adjacent technical topics | Telemetry, enterprise ops |
| 11 | Product console | `0.99 0 0` or dark `0.20 0.01 260`, `0.97 0.003 260` or `0.24 0.01 260`, `0.20 0.01 260` or `0.93 0.005 260`, one accent `0.52 0.22 280` and blue `0.60 0.14 220`; `0.62 0.15 150`, `0.75 0.15 85`, `0.60 0.21 25` | Inter UI, IBM Plex Mono code | Controls that match a real product system: pill toggles, 4px radius, visible focus rings; one accent only on the primary action | Crisp 2px vector shapes, no glow; 120 to 180ms ease-out | Code-to-behavior links, config explorers, product-framed tracers | Hand-drawn or museum topics |
| 12 | Notebook cells | `0.985 0.002 250`, `0.95 0.005 250`, `0.30 0.01 260`, blue `0.55 0.17 250` and orange `0.65 0.17 25`; `0.60 0.15 150`, `0.75 0.16 85`, `0.58 0.21 25` | IBM Plex Sans, JetBrains Mono | Near-native inputs in a bordered cell; a small source disclosure under each model | Instant recompute with no transition masking it, so it reads as live computation | Code-to-behavior, parameter tables, showing the recomputation | Narrative storytelling |

Glassmorphism, purple-to-blue gradient fields, neon glow and ambient particle fields are excluded. Use them only when the subject is itself that kind of interface chrome.

## Stop layout

- **The model takes 60 to 75 percent of the stage.** Model-dominant with docked controls is the default. Split model and code only for code-to-behavior stops; side-by-side panels only when pixel-for-pixel comparison is the point.
- **The assertion is a band, not a hero.** One sentence, at most two lines, in a fixed top-left or bottom-left band no taller than 160px. Never a centered headline over the model.
- **Controls dock to one edge for the whole experience** (a right rail or a bottom bar) so the presenter's hand learns one place. The transport strip (play, pause, step, speed, reset) has its own fixed position, separate from the parameters.
- **Readouts sit beside the model** in a strip of tabular-figure values that update in place, next to the control that changes them. No floating KPI cards.
- **Small multiples cap at 3x3 or 3x4** on the stage; beyond that, labels fall under the size floor.
- **Safe margins:** at least 80px top and bottom and 120px at the sides, so overscan and the Teams presenter overlay never clip a control.
- **Capture stops** show the input and the building aggregate together, with a written empty state ("Results appear here as the room answers") rather than blank axes.

## Projection and screen-share rules

- **Type sizes on the 1920x1080 stage:** assertion 48 to 56px, body 32px, labels and live readouts 28px, nothing read below 24px. Weight 400 or more everywhere; 600 for text the back row must read. Two weights per stop.
- **Contrast:** WCAG 4.5:1 is the floor for text and 3:1 for essential graphics; aim for 7:1 on body text and readouts, because projector blacks wash out to grey in a lit room. Dark fields stay at lightness 0.18 or above so shadow detail survives.
- **Strokes at least 2px.** Thinner lines shimmer or vanish under projector scaling and screen-share compression.
- **No gradient steeper than a 10 percent lightness change across a shape**, and none behind text; compression bands them. Prefer flat fills, an outline or one hard offset shadow.
- **Textures and grids** stay under 6 percent opacity with spacing above 8px, so they do not turn into compression noise.
- **Palette limit:** one or two signal colors plus the three state colors on screen at once. A fifth state uses shape or motion, not a new hue.
- **State colors differ in lightness as well as hue**, at least 0.12 apart in L, and pair with a shape (check and cross, filled and hollow) so color-vision deficiency and chroma subsampling both keep the meaning. Simulate protanopia, deuteranopia and tritanopia before locking the palette.
- **Every moving pixel encodes something.** If nothing is happening in the model, nothing animates.

## Generic tells and their replacements

| Tell | Replacement |
| --- | --- |
| Purple-to-blue gradient field | A flat palette from one catalog direction; gradients only as data encodings such as a heatmap |
| Frosted glass panels | Opaque surfaces with a 2px rule or one hard offset shadow |
| Emoji as icons | One line icon set at the direction's stroke weight, or a literal control metaphor |
| Centered hero headline over the model | The assertion band, with the model as the hero |
| A three-column grid of icon, title and blurb cards | A small-multiples grid where every tile is a live model |
| Soft drop shadow on everything | Shadows only where the direction's physical metaphor needs them |
| One accent color on every interactive element | Signal color only on the thing being explained; neutral chrome |
| One sans at one weight | A deliberate pairing with distinct display and label or data roles |
| Fake bevels and glows for a futuristic look | Fully flat, or one internally consistent physical metaphor |
| Decorative looping background motion | Stillness; motion only where the model is changing |
| KPI tiles with a big number and a sparkline | A readout strip tied to the live model, beside its control |
| A custom-drawn slider that ignores the keyboard | A styled native range input, enlarged for the stage |

## Exemplars to study

- [Bartosz Ciechanowski, Mechanical Watch](https://ciechanow.ski/mechanical-watch/): parts color-coded once and reused everywhere, a global animation pause, models embedded in the flow.
- [Red Blob Games, A* introduction](https://www.redblobgames.com/pathfinding/a-star/introduction.html): draggable markers on the grid, a frontier stepper, code beside the diagram.
- [Sam Rose, Load Balancing](https://samwho.dev/load-balancing/): sequential simulations with play, speed and reset, request dots on a dark field.
- [Seeing Theory, Basic Probability](https://seeing-theory.brown.edu/basic-probability/index.html): bars dragged inside the chart, synchronized small multiples.
- [Distill, How to Use t-SNE Effectively](https://distill.pub/2016/misread-tsne/): a parameter stepper tied to live plots inside editorial prose.
- [Josh Comeau, Why React Re-renders](https://www.joshwcomeau.com/react/why-react-re-renders/): an inline component tree that flashes on re-render, the code-to-behavior pattern.
- [Teenage Engineering](https://teenage.engineering/): printed-label controls, warm grey chassis, one orange signal.
- [Linear Method](https://linear.app/method): restrained product chrome with one accent.
