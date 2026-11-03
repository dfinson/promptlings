# Visual directions

Every deck commits to one fully specified visual direction before any step is built. A direction is a decision, not a skin: it sets palette, type, geometry, motion personality and the one signature device the deck is remembered by. Variation between decks comes from this choice, made from the subject and the room, never from the model's default taste.

## Choose a direction

1. **Ground it in the subject.** List three things the subject is made of (packets, ledgers, gears, layers, a timeline) and one feeling the audience should leave with (confidence, urgency, delight). Load `frontend-design` and follow its brainstorm, explore, critique loop.
2. **Read the room.** Bright daytime room or projector: favor light directions. Dark keynote hall: dark directions work. Teams or Zoom share: avoid fine hairlines, large gradients and blur, which compression destroys.
3. **Shortlist two directions** from the catalog below or from the eight named styles in `hyperframes-creative` `references/visual-styles.md` (Swiss Pulse, Velvet Standard, Deconstructed, Maximalist Type, Data Drift, Soft Signal, Folk Frequency, Shadow Cut). Render the same two representative steps (one diagram, one code or output) in each and choose from screenshots.
4. **Name the signature device.** One structural idea that recurs: a persistent entity color code, a blueprint grid the diagrams snap to, a typewriter terminal frame, a margin timeline. Spend spectacle there and nowhere else.
5. **Write the tokens** (palette, type scale, radius, stroke, easing, durations) into one `:root` block and record the direction, signature device and rejected alternative in the production notes for outline approval.

## Catalog

All fonts below are SIL OFL 1.1 and may be subset and inlined.

| Direction | Palette anchors (OKLCH) | Type | Geometry | Motion | Fits | Fails |
| --- | --- | --- | --- | --- | --- | --- |
| Swiss editorial | Paper `0.98 0 0`, ink `0.15 0 0`, one signal red `0.55 0.22 25` | Inter or Archivo at 300 and 700; JetBrains Mono for code | Strict grid, flush left, zero radius, 2px rules | Short (150 to 200ms) slides along grid axes, no blur | Architecture, research results, engineering reviews | Emotional or narrative talks |
| Cinematic dark | Base `0.14 0.01 260`, text `0.96 0 0`, one accent per act `0.70 0.16 250` | Space Grotesk or Geist display, Geist Mono | Huge headline, deep negative space, 16px radius | 300 to 500ms morphs with element continuity | Launches, keynotes, dark halls | Daylit rooms, low-bitrate screen share |
| Terminal-native | Base `0.12 0 0`, phosphor `0.80 0.17 145` or amber `0.80 0.15 75` | IBM Plex Mono or JetBrains Mono throughout | Character grid, box-drawing borders, zero radius | Typewriter reveals, instant cuts under 150ms | CLI tools, infra, DevOps | Long reading passages |
| Blueprint | Field `0.32 0.09 250`, lines `0.95 0.03 220`, callout `0.85 0.15 85` | Space Mono labels, IBM Plex Sans body, tabular numerals | Stroke weight is the hierarchy: 4px outline, 2px edge, dashed hidden lines | Line draw-on, dimension arrows extending, linear or slight ease-out | Systems, protocols, hardware, specs | Human-centered stories |
| Sketch whiteboard | Paper `0.97 0.01 90`, marker red `0.60 0.20 30`, green `0.58 0.15 150`, ink `0.25 0 0` | Caveat headings, DM Sans body, JetBrains Mono code | Rough.js shapes with fixed seed, hachure fills | Strokes drawn on at 300 to 500ms | Workshops, design reviews, early proposals | Audits, finance, security sign-off |
| Light print | Paper `0.96 0.01 80`, ink `0.20 0.02 60`, editorial red `0.52 0.18 28` | Source Serif 4 or Newsreader headings, Source Sans 3 body, IBM Plex Mono | Narrow measure, thin rules, no shadows | Gentle fades and page slides, 150 to 250ms | Academic talks, long explanations, daylight rooms | Product-launch energy |
| Data journalism | Gray chrome `0.97 0 0` and `0.30 0 0`, two or three categorical hues at equal lightness `0.65 0.15 h` | Instrument Serif or Fraunces headlines, Inter UI, tabular numerals | Sticky chart, annotation on the chart, no legend | Persistent visual, labels and highlights change per step | Benchmarks, incidents, metrics stories | Code-heavy talks |
| Bold brutalist | Black, white, one saturated block `0.65 0.25 30` | Archivo Black display, Space Mono body | Thick borders, zero radius, extreme size jumps | Hard snaps, no easing | Developer culture, opinionated manifestos | Executive or enterprise audiences |

Glassmorphism, purple-to-blue gradient fields and neon glow are excluded as defaults. Use them only when the subject is itself translucent UI chrome.

## Projection and screen-share rules

- Contrast at least 4.5:1 for text and 3:1 for large text and essential graphics, measured against the actual background.
- Font weight 400 or more for anything under 40px on the stage; 600 or more for text that must read from the back row.
- No hairlines: strokes and rules at least 2px.
- Large fills stay at chroma 0.15 or below; reserve high chroma for small accents.
- No gradients behind small text. If a gradient is essential, add a fine noise layer to prevent banding.
- Color never carries meaning alone; pair it with shape, position or a label.

## Generic tells and their replacements

| Tell | Replacement |
| --- | --- |
| Purple-to-blue gradient hero | One hue family derived from the subject, flat fields |
| Frosted glass cards everywhere | Solid surfaces separated by spacing or one rule |
| One neutral sans for everything at one weight | A deliberate display plus mono pairing with real weight contrast |
| Everything centered in identical cards | Layout chosen per step: left-aligned reading, full-bleed diagrams, asymmetric grid placement |
| Emoji bullets and stock icon rows | Typographic hierarchy, entity color codes, or one consistent line icon set |
| Ambient particles, floating orbs, looping glows | Stillness, with motion only on the element being explained |
| Vague headline copy ("Unlocking the power of...") | A full-sentence assertion with the specific claim; apply `no-ai-slop` to headlines and labels |

## Exemplars to study

- [Bartosz Ciechanowski, Mechanical Watch](https://ciechanow.ski/mechanical-watch/): consistent entity color coding, simplify then compose, global animation pause.
- [Bret Victor, Media for Thinking the Unthinkable](https://worrydream.com/MediaForThinkingTheUnthinkable/): the visual is the argument, built from the system's own data.
- [Rauno Freiberg, Craft](https://rauno.me/craft): a named catalog of small, purposeful motion studies.
- [Josh Comeau](https://www.joshwcomeau.com/blog/how-i-built-my-blog-v2/): interactive widgets sharing the typographic register of the prose around them.
- [Gapminder tools](https://www.gapminder.org/tools/): one persistent chart, one animated variable, constant color meaning.
- Apple keynotes: one subject per frame, vast negative space, element continuity between states.
