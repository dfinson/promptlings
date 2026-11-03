# Sources

Reviewed on 2026-11-04. Strength reflects the research base behind each claim, not how often it is repeated.

## Simulations and explorables

| Source | Supports | Strength |
| --- | --- | --- |
| [PhET Interactive Simulations research](https://phet.colorado.edu/en/research); Perkins and Moore (2014), ICLS, "Blending Implicit Scaffolding and Games in PhET Interactive Simulations"; [PhysPort, PhET in lecture](https://www.physport.org/methods/method.cfm?G=PhET) | Working models with loaded defaults, implicit scaffolding instead of instructions, guided use in lecture | Moderate to strong |
| de Jong and van Joolingen (1998), *Review of Educational Research*; Alfieri et al. (2011), *Journal of Educational Psychology* | Simulation learning works when guided; unassisted discovery underperforms | Strong |
| [Hohman, Conlen, Heer and Chau, Communicating with Interactive Articles](https://distill.pub/2020/communicating-with-interactive-articles/) | Survey of interactive explanation techniques and their evidence | Review |
| [Bret Victor, Explorable Explanations](https://worrydream.com/ExplorableExplanations/), [Ladder of Abstraction](https://worrydream.com/LadderOfAbstraction/), [Tangle](https://worrydream.com/Tangle/) | Linked representations, scrubbing, one adjustable variable with full recomputation | Practitioner canon |
| [Bartosz Ciechanowski, Mechanical Watch](https://ciechanow.ski/mechanical-watch/), [Moon](https://ciechanow.ski/moon/) | Linked views on one state, direct manipulation, entity color coding, simplify then compose, global pause | Practitioner canon |
| [Sam Rose, Load Balancing](https://samwho.dev/load-balancing/), [Encore, Queueing](https://encore.dev/blog/queueing) | System simulations per concept with presets that make the failure visible | Practitioner canon |
| [Red Blob Games, A* introduction](https://www.redblobgames.com/pathfinding/a-star/introduction.html), [making-of notes](https://www.redblobgames.com/making-of/line-drawing/) | Algorithm steppers with linked state; build the model before the diagram | Practitioner canon |
| [Distill, How to Use t-SNE Effectively](https://distill.pub/2016/misread-tsne/), [Research Debt](https://distill.pub/2017/research-debt/) | Small multiples over a parameter sweep; moving interpretive labor from audience to author | Practitioner canon |

## Interaction craft

| Source | Supports | Strength |
| --- | --- | --- |
| [Nielsen, Response Times: The 3 Important Limits](https://www.nngroup.com/articles/response-times-3-important-limits/); [web.dev, RAIL](https://web.dev/articles/rail) | 100ms direct response, 1s flow, feedback budgets per frame | Strong |
| [NN/g, Fitts's Law](https://www.nngroup.com/articles/fitts-law/), [Touch Target Size](https://www.nngroup.com/articles/touch-target-size/), [Animation Duration](https://www.nngroup.com/articles/animation-duration/) | Control size and placement; durations short enough to follow without waiting | Strong |
| [MDN, setPointerCapture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture), [devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio), [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API) | Drag that never escapes, sharp canvases on any display, seekable sequenced motion | Documentation |
| [Glenn Fiedler, Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/) | Fixed simulation step with an accumulator and a clamped frame delta | Practitioner canon |
| Heer and Robertson (2007), "Animated Transitions in Statistical Data Graphics", *IEEE TVCG* | Staged transitions, one change at a time, consistent mapping across states | Strong |
| Shneiderman (1996), "The Eyes Have It", IEEE Symposium on Visual Languages | Overview first, then filter and details on demand | Moderate to strong |
| Tversky, Morrison and Betrancourt (2002), *International Journal of Human-Computer Studies* | Animation helps only when it carries change statics cannot, at a controlled pace | Moderate |

## Visual

| Source | Supports | Strength |
| --- | --- | --- |
| [Ciechanowski archives](https://ciechanow.ski/archives/), [Seeing Theory](https://seeing-theory.brown.edu/basic-probability/index.html), [The Pudding](https://pudding.cool/), [Josh Comeau](https://www.joshwcomeau.com/react/why-react-re-renders/), [Linear Method](https://linear.app/method), [Teenage Engineering](https://teenage.engineering/), [Stripe Docs](https://stripe.com/docs), [Observable Framework](https://observablehq.com/framework/) | Exemplars behind the app directions: palettes, type, control styling and how live elements look | Practitioner canon |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Contrast floors for text and graphics, color not the only cue | Standard |
| [Radix Colors](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale); [Evil Martians, OKLCH in CSS](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl) | Role scales; perceptual palettes and lightness spacing between states | Design system |
| [C4 model notation](https://c4model.com/diagrams/notation) | One abstraction level per diagram, typed elements | Practitioner canon |
| [Anthropic frontend-design skill](https://github.com/anthropics/skills/tree/41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/skills/frontend-design) (Apache 2.0) | Subject-grounded direction and critique loop | Practitioner canon |
| Murrell, "The Age of Average"; Chayka, *Filterworld* (2024) | Default convergence as the cause of generic looks | Practitioner commentary |

## Live delivery

| Source | Supports | Strength |
| --- | --- | --- |
| Crouch, Fagen, Callan and Mazur (2004), *American Journal of Physics* 72(6); [PhysPort, Interactive Lecture Demonstrations](https://www.physport.org/methods/method.cfm?G=ILD), [Peer Instruction](https://www.physport.org/methods/method.cfm?G=Peer_Instruction) | Watching a demo passively yields no gain; predicting first does; timings for predict, discuss, reveal | Strong |
| [Cornell CTI, short peer discussions](https://teaching.cornell.edu/teaching-resources/active-collaborative-learning/collaborative-learning/incorporating-short-peer) | Pair talk before a vote, timeboxed captures | Moderate |
| [Rowe (1986), *Journal of Teacher Education*](https://doi.org/10.1177/002248718603700110) | Wait three seconds or more after a question | Strong |
| [NN/g, Thinking Aloud](https://www.nngroup.com/articles/thinking-aloud-the-1-usability-tool/) | Narrate intent before acting while driving | Practitioner canon |
| [Hanselman, 11 Top Tips](https://www.hanselman.com/blog/11-top-tips-for-a-successful-technical-presentation), [Preparing for a Technical Presentation](https://www.hanselman.com/blog/tips-for-preparing-for-a-technical-presentation) | One-click reset, must-keep and droppable segments, time-blocked notes | Practitioner canon |
| [speaking.io, Live Demos](https://speaking.io/prep/live-demos/), [Your Voice](https://speaking.io/deliver/your-voice/), [Recovering from Mistakes](https://speaking.io/deliver/fucking-up/) | Rehearsed fallbacks, pacing, parking a failure with a return point | Practitioner canon |
| [VirtualSpeech, average speaking rate](https://virtualspeech.com/blog/average-speaking-rate-words-per-minute) | Presentation pace around 110 to 130 words per minute | Moderate |

## Video

| Source | Supports | Strength |
| --- | --- | --- |
| Mayer and Moreno (2003), "Nine Ways to Reduce Cognitive Load in Multimedia Learning", *Educational Psychologist* | Live speech over a muted clip; no clip narration competing with the presenter | Strong |
| [Teams, share content in meetings](https://support.microsoft.com/en-us/office/share-content-in-microsoft-teams-meetings-fcc2bf59-aecd-4481-8f99-ce55dd836ce8) | "Include sound" when a clip carries audio | Documentation |
| [WCAG 2.2 Understanding 1.2.2, Captions (Prerecorded)](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html) | Captions for narrated clips | Standard |

## Learning

| Source | Supports | Strength |
| --- | --- | --- |
| Mayer, *Multimedia Learning* (2nd ed., 2009); Richter, Scheiter and Eitel (2016), *Educational Research Review* | Redundancy, signaling, segmenting, pre-training, contiguity | Strong |
| Sweller, van Merriënboer and Paas (1998), *Educational Psychology Review* | Cognitive load, split attention, element interactivity | Strong |
| Höffler and Leutner (2007), *Learning and Instruction* | Animation helps most when it represents the content and for procedures | Moderate |
| Loewenstein (1994), *Psychological Bulletin*; Roediger and Karpicke (2006), *Psychological Science* | Curiosity gaps and retrieval behind predict-then-run | Moderate to strong |
| Bradbury (2016), *Advances in Physiology Education* | Vary activity instead of designing for a fixed attention span | Moderate |
| Pashler et al. (2008), *Psychological Science in the Public Interest* | Learning-style matching is unsupported | Strong (against) |

## Runtime

| Source | Supports | Strength |
| --- | --- | --- |
| [MDN Range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests); [CPython issue 86809](https://github.com/python/cpython/issues/86809) | 206 and 416 semantics for video seeking; Python's `http.server` lacks Range | Documentation |
| [MDN WebVTT API](https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API), [MDN Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) | Chapter and caption tracks; sound needs a user gesture | Documentation |
| [MDN BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) | Same-origin sync between audience and presenter windows | Documentation |
| [esbuild API](https://esbuild.github.io/api/) | IIFE bundling, `nodePaths` resolution, legal comments | Documentation |
| [Shiki](https://shiki.style/), [Magic Move](https://github.com/shikijs/shiki-magic-move) | Build-time highlighting, token morphs rendered from precompiled snapshots | Documentation |
| [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing), [axe-core](https://github.com/dequelabs/axe-core) (MPL-2.0, verification only) | Automated axe scans per stop | Documentation |

## Licenses of shipped components

| Source | Supports | Strength |
| --- | --- | --- |
| [esbuild](https://github.com/evanw/esbuild/blob/main/LICENSE.md), [Shiki](https://github.com/shikijs/shiki/blob/main/LICENSE), [Magic Move](https://github.com/shikijs/shiki-magic-move/blob/main/LICENSE), [diff-match-patch-es](https://github.com/antfu/diff-match-patch-es/blob/main/LICENSE) (Apache-2.0), [ohash](https://github.com/unjs/ohash/blob/main/LICENSE), [Flubber](https://github.com/veltman/flubber/blob/master/LICENSE), [Rough.js](https://github.com/rough-stuff/rough/blob/master/LICENSE), [D3](https://github.com/d3/d3/blob/main/LICENSE), [dagre](https://github.com/dagrejs/dagre/blob/master/LICENSE) | MIT, ISC and Apache-2.0 for the build tool and bundled libraries | License |
| [Fontsource](https://fontsource.org/), [google/fonts OFL directory](https://github.com/google/fonts/tree/main/ofl), [Lucide](https://lucide.dev/license), [Tabler Icons](https://github.com/tabler/tabler-icons/blob/main/LICENSE) | OFL-1.1 fonts, ISC and MIT icons | License |
