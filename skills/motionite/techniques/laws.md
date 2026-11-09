# Universal motion laws

These laws sit under every technique and every NxrStyle.

1. **Time is the only input.** `render(frame)` is pure. Seed all randomness, and use no `Date.now`, timers or CSS transitions. Physics like verlet ropes or the sand bed is re-simulated from frame 0 at a fixed step, which keeps it deterministic (H02 does this).
2. **Entrances decay, exits accelerate.**
   - Enter with E.out (cubic-bezier .16,1,.3,1) and exit with E.in (.7,0,.84,0).
   - In frames: a shot "enters already moving", covering 12–19% of the remaining distance per frame, and leaves with an accelerating move or a blur ramp.
3. **Scale moves in log space** (`lmix`). A 1→14× zoom then feels constant-speed. One world camera = focus x/y + log-scale track.
4. **A value with many targets is a sum of springs, one per change** (`track`). Never restart a spring from 0 mid-move.
5. **The secondary move starts at 55–75% of the primary**, and shape settles about 6f@60 before position.
6. **Speed limit:** about ≤25 px/frame@60 for readable motion. Faster moves need motion blur or a smear (a decaying scroll: 420, 315, 210, 170, 140, 116, 96, 81 … 0 px per frame).
7. **Overshoot budget:** at most 2 overshoots per film, and never on type. A payoff number or a chip pop may overshoot. Use it once, at the payoff.
8. **Flash budget:** one flash, at most twice per film. Never blank a full frame; cap at about 65–85%.
9. **Never two transition devices in a row.** A look change lands on a hard cut and lasts ≥1s.
10. **Cut on music:**
    - Cuts land 2f before the beat (beat k = 0.048 + 0.4838·k s at 124 BPM).
    - Scenes per bar: 1.875s = 4 beats at 128 BPM.
    - Image changes on 16th notes.
    - Cue times on a 1/12s grid.
11. **Loops:** the last frame equals the first. Use a 12f dissolve on the seam with tile phases staggered, and return to the frame-0 layout.
12. **Frame 0 is the poster.** Everything is live from frame 0.

## Taste rules Motionite adds on top
13. **Blur-in, not fade-in.** Text enters with blur 12–20 px → 0, reaching sharp at about 60 % of its move, plus a small drift or scale. A plain opacity fade is the cheapest move in motion design. Avoid it.
14. **One accent colour, and it carries a meaning** (state, money, the brand). Two accents means none.
15. **Every frame should be a poster.** Pause anywhere and the frame should be composed, with no half-transparent mush.
16. **Hold for reading.** A line of ≤ 6 words needs ≥ 0.8 s fully legible, and a number needs ≥ 0.6 s after it lands.
17. **Persistent chrome is a style choice, not a default.** HUD and frame counters belong to NxrStyle 01. Elsewhere, "no HUD chrome in the opening seconds" is the safer default.
18. **Real assets beat drawn ones.** If the brief has a logo, screens or footage, use those files. Never invent a fake UI for a real product.

## Aesthetic defaults vs deliberate breaks
Default bans for a generic product film:
- serif/italic
- orange/cream
- neon/glow
- purple gradients
- glass
- emoji
- particles
- overshoot on type

Strong films break several of these on purpose: a serif italic with a yellow highlighter, cream paper, one particle burst with a green glow, glassy cards, a cream field with a serif end card.

**Treat the bans as defaults for generic product films, not laws.** The physics laws above (log scale, the entrance/exit asymmetry, overlap, speed limits and the overshoot budget) are not optional. The aesthetic bans don't override a client's brand or mood board.
