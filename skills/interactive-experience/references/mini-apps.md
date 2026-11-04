# Mini-app catalog

A stop earns the mini-app form when manipulating a working model shows something a still image cannot. On stage the presenter drives it; in the handout the reader does. Pick the archetype from the concept, not from what is easy to build, and give every stop its question, entry preset, landing presets and recovery.

## Archetypes

| Archetype | Use when | Presets and beats | Exemplar |
| --- | --- | --- | --- |
| Parameter explorer | One quantity drives the outcome; linked views show its effect everywhere at once | Entry at the typical value, then the threshold and the extreme | [Bret Victor, Tangle](https://worrydream.com/Tangle/), [Ladder of Abstraction](https://worrydream.com/LadderOfAbstraction/) |
| Simulation sandbox | A dynamic system (queue, cache, retry storm, scheduler, consensus) whose behavior emerges over time | Seeded presets for healthy, stressed and failing; play, pause, single-step | [Sam Rose, Queueing](https://encore.dev/blog/queueing), [Ciechanowski](https://ciechanow.ski/) |
| Request tracer | A request, event or datum moves through components; the audience follows one hop at a time | One beat per hop, a preset that injects the failure the talk is about | Sequence diagrams animated hop by hop |
| Failure injector | The point is what breaks and how the system responds | Presets that kill a node, add latency or drop messages, each with the same seed | Chaos engineering game days |
| Strategy race | Two approaches handle the same seeded input side by side | One preset per workload; both lanes share the seed and clock | [Sam Rose, Load Balancing](https://samwho.dev/load-balancing/) |
| Algorithm stepper | An algorithm or protocol whose state changes step by step (state table, pointer, tree) | Beats at the decisive steps; `J` and `L` single-step between them | [Red Blob Games](https://www.redblobgames.com/) |
| Before and after | A change, refactor, migration or PR; one key flips code and behavior together | `1` before, `2` after, with the code morph and the model sharing one state | [Shiki Magic Move](https://shiki.style/packages/magic-move) |
| Code-to-behavior link | Choosing a configuration or code variant changes the model's output | Variants as presets chosen from a list; no free typing on stage | [Media for Thinking the Unthinkable](https://worrydream.com/MediaForThinkingTheUnthinkable/) |
| Sweep grid | The range of behavior across many settings matters more than one run | Small multiples computed at build time from the same model; click one to open it full size | Small multiples |
| Trace scrubber | Real captured data (logs, traces, metrics) explains the behavior | Scrub through the real capture with chapter marks at the events the story needs | Replay of captured output with skipped-time markers |
| System map | A home view to zoom out of and back into | Each deep-dive stop opens from and returns to its node | [C4 model](https://c4model.com/) |
| Predict then run | A result the room can guess; ask, capture the call, then run the model | Capture the prediction, run to the revealing tick, show the room's call against the result | [Hohman et al.](https://distill.pub/2020/communicating-with-interactive-articles/) on belief elicitation |
| Room-tuned run | The room chooses parameters and the model runs with them | A capture beat records the choice; the run uses it, with a fallback preset if the room is silent | Workshop exercises |
| Live run with fallback | The audience must see the real system run | `R` cuts to the recorded fallback | Keynote demo practice |
| Video stop | The step cannot run live in the room (see [When to use video](#when-to-use-video)) | Chapters as beats; cut back to a mini-app for questions | `technical-demo` output |
| Evidence stop | A single real artifact (a measurement, a screenshot, a code region) makes the point | Stepped reveal of one layer per beat | [Ciechanowski, Mechanical Watch](https://ciechanow.ski/mechanical-watch/) |

## When to use video

Video is optional; most experiences have none. Every clip trades the room's attention and the presenter's control of pace for something the live stops cannot give. Propose a clip only when one of these holds:

- The live step depends on a network, cloud service, hardware or environment the venue cannot guarantee.
- The evidence is in the physical world (a device, a lab, a site).
- The point is proof that a real run happened (a recorded production run, a reproduced bug).
- An authentic voice carries it: a customer, a user or an expert in their own words.
- A slow process needs compressing (a twelve-minute build in thirty seconds).
- The exact sequence must be identical every time.

Never use a clip on a stop where the room enters data or where responding to the room is the point, and never for something a still or a mini-app shows as well. For a live run that might fail, the clip is the recorded fallback behind `R`, not a replacement for the run.

- **Length:** 15 to 45 seconds for proof or a stand-in demo; up to about 90 seconds for a testimonial. Split anything longer into separate stops with live talk between them.
- **Audio:** `muted` by default, with the presenter narrating live, because the same words spoken and heard twice overload the audience. `narrated` only for an authentic voice, with captions on and the presenter silent. `ambient` only when the sound is itself evidence. UI-only clips are always muted.
- **In use:** the presenter introduces the clip (why it is recorded, the question it answers), seeks only to chapter marks, restates the takeaway after it and bridges back to a live stop. The fallback when a clip will not play is its poster and chapter stills with a one-line outcome.

## Building a good mini-app

- **Model first, drawing second.** Write the state and the update function, check them against real measurements where the talk quantifies anything, then draw from the state.
- **Small enough to explain in one stop.** If a model needs more than one new mechanism, split it across stops that build on each other.
- **Visible state.** Show the numbers that matter (queue depth, latency, hit rate) beside the drawing, at the size floor, updating with the model.
- **Readable at presenter speed.** The default tick rate shows the behavior at a pace a person can narrate; offer `K` to pause and `J`/`L` to step at the moment that matters.
- **Recoverable.** Every reachable state returns to the beat's state with `0`. No control can leave the model in a state that breaks rendering.
- **Honest.** State on screen what the model simplifies.

## Failure modes

- **Decoration:** a mini-app that reveals nothing a still could not. Make it an evidence stop.
- **Sandbox without a question:** free play with no stated question loses the room. Script the question, the moves and the landing preset, and let exploration happen inside them.
- **Control clutter:** controls the current beat does not use. Show one control group at most, only while it is in use, and hide the panel with `E`.
- **Ambient motion:** a simulation running behind unrelated speech splits attention. Pause it when the script moves on.
- **Latency:** any wait for computation, network or build stalls the room. Precompute sweeps and long runs at build time.
- **Nondeterminism:** a run that differs between rehearsal and stage. Seed everything and drive time from ticks.
- **Hover dependence:** precise mouse targets are invisible from the back row and fragile on stage. Give every manipulable element a large hit area and a key path.
