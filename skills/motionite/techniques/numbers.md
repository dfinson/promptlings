# Numbers and data

Demo comps: [`examples/src/tech/data.tsx`](../examples/src/tech/data.tsx). Each one is 960×540 @ 30 fps, 75 f, and also registered as its own composition, so you can render one with `npx remotion still src/index.ts <CompId> out.png --frame=50` from `examples/`.

Timings marked **@60** are 60 fps frame counts. Halve them for 30 fps (`f60(n)` in `lib/anim.ts`).

## N01 · Scramble counter with ghosting

- **Comp:** `N01-ScrambleCounter` (`examples/src/tech/data.tsx` → `ScrambleCounter`)
- **Used in:** [NxrStyle 07](../styles/NxrStyle-07-frost-collectible.md), [NxrStyle 12](../styles/NxrStyle-12-console-as-film.md)
- **Build:**
  - A new random value every 2f.
  - Two ghost copies of the previous values sit 26px and 52px above at 30% and 15% opacity with blur 3 and 5px. That fakes motion blur on a vertical roll.
  - On the landing frame the ghosts drop, then a scale pop (`1+.12·hitPulse`).
  - Behind it is a dense wall of tiny cards drifting −0.4px/f.
- **Numbers:** about 1s total; land at f40.

## N02 · Digit reel with detent

- **Comp:** `N02-DigitReel` (`examples/src/tech/data.tsx` → `DigitReel`)
- **Used in:** [NxrStyle 04](../styles/NxrStyle-04-editorial-ink.md), [NxrStyle 13](../styles/NxrStyle-13-clean-launch-film.md)
- **Build:** Each column is a strip of 0–9 translated by `(spins·10+digit)·p·H` mod 10. `p` is a stiff detent spring (damping 24, stiffness 380), whose tiny overshoot reads as the mechanical click. Columns are staggered 3f. A yellow "+" fades in last.

## N03 · Strike + count-down to $0

- **Comp:** `N03-StrikeCountdown` (`examples/src/tech/data.tsx` → `StrikeCountdown`)
- **Used in:** [NxrStyle 09](../styles/NxrStyle-09-live-bento-grid.md)
- **Build:**
  1. The panel pops (SPR.pop) and "$6,000" shows.
  2. A red strike draws L→R in 5f (E.ui).
  3. Values step every 5f: 5,670→4,310→2,080→520→0.
  4. $0 lands green with a scale pop from 0.6, then a glow.
  5. The caption follows about 15f later.
- **Pair:** H07 particle burst.

## N04 · Spring graph

- **Comp:** `N04-SpringGraph` (`examples/src/tech/data.tsx` → `SpringGraph`)
- **Used in:** —
- **Build:** The polyline samples `yAt(t)=mix(y0,y1,spr(t))` for t in [0, head]. The dot sits at the head and the label fades in at 30f.
- **Recipe:** One function drives both, so the curve and the dot can never disagree.

## N05 · Ledger rows + red progress

- **Comp:** `N05-LedgerStack` (`examples/src/tech/data.tsx` → `LedgerStack`)
- **Used in:** [NxrStyle 02](../styles/NxrStyle-02-night-caption-explainer.md)
- **Build:** Rows enter with SPR.snap from y+30, staggered 10f. The third row is red-tinted. The risk bar tweens 42%→91% with E.smooth and turns red past 70%.

## N06 · Node graph

- **Comp:** `N06-NodeGraph` (`examples/src/tech/data.tsx` → `NodeGraph`)
- **Used in:** [NxrStyle 02](../styles/NxrStyle-02-night-caption-explainer.md)
- **Build:** The hub pops first. Nodes pop with SPR.pop staggered 2f. Edges grow from the hub to each node (`mix(cx,x,pe)`), staggered 3f, starting after all nodes have landed (secondary at about 60% of primary).

## N07 · Tally counter + receipt rows

- **Comp:** `N07-TallyCounter` (`examples/src/tech/data.tsx` → `TallyCounter`)
- **Used in:** [NxrStyle 05](../styles/NxrStyle-05-one-pan-flat-world.md)
- **Build:** Each tick pops the "n×" scale by 18% (hitPulse) and adds a receipt row that slides in. The payoff number counts with E.type.
- **Numbers:** a tick every ~0.53s.

