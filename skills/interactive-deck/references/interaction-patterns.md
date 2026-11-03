# Interaction patterns for live delivery

Most research on interactive explanations studies readers who control the pace. On stage the presenter holds the controls and the audience only watches, so a pattern earns its place only when the presenter can trigger it in one action and the change is obvious from the back of the room.

| Pattern | Use live when | Avoid when | Exemplar |
| --- | --- | --- | --- |
| Stepped reveal | Building a diagram, argument or code region one layer per click | The parts make sense only together | [Ciechanowski, Mechanical Watch](https://ciechanow.ski/mechanical-watch/) |
| Animated flow | A request, event or datum moves through components in order; narrate each hop | The relationship is structural, not temporal | Sequence diagrams animated hop by hop |
| Zoom between levels | Moving from system map to component to code and back; keeps orientation | Each level needs a different layout anyway; cut instead | [C4 model](https://c4model.com/) levels |
| Before/after toggle or morph | A change, refactor, migration or PR; one key flips or morphs between states | The two states share nothing visually | [Shiki Magic Move](https://shiki.style/packages/magic-move) |
| Code-to-visual link | A highlighted code range lights up the node or output it drives, advanced by key | Linking needs free hovering to discover | [Media for Thinking the Unthinkable](https://worrydream.com/MediaForThinkingTheUnthinkable/) |
| Presenter-scrubbed parameter | One parameter changes the outcome continuously; pre-decide two or three landing values | Several parameters interact; use small multiples | [Up and Down the Ladder of Abstraction](https://worrydream.com/LadderOfAbstraction/) |
| Small multiples | Showing the range of behavior across cases at once without running anything | The audience needs to follow one case to its end | Pre-rendered grids of real runs |
| Predict then reveal | A result the audience can guess; pause, ask, then reveal. Stronger live than self-paced | No plausible wrong answer exists | [Hohman et al.](https://distill.pub/2020/communicating-with-interactive-articles/) on belief elicitation |
| Terminal or UI replay | Showing real command or app behavior without live risk; play captured output step by step | A real live run is the point and has been rehearsed with a fallback | Replay of captured output with skipped-time markers |
| Live run with fallback | The audience must see it happen for real; one key cuts to the recorded fallback | It depends on venue network or slow builds | Keynote demo practice |

## Failure modes

- **Decoration:** an interaction that reveals nothing a still could not. Cut it.
- **Control clutter:** visible controls the audience cannot use. Show one control group at most, and only while it is in use.
- **Ambient motion:** looping animation behind speech splits attention. Animate only what the current sentence is about.
- **Latency:** any wait for computation, network or build stalls the room. Precompute.
- **Free exploration:** wandering through a slider or sandbox loses the thread. Script the path and the landing points.
- **Hover dependence:** precise mouse targets are invisible from the back row and fragile on stage. Drive highlights by key.
