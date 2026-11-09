# NxrStyle 02 · Night Caption Explainer

> A 9:16 voice-over explainer: a near-black stage, karaoke captions, one giant number, and a polarity flip to paper with a rubber stamp.

<img src="../examples/stills/NxrStyle-02-night-caption-explainer.png" width="360" alt="NxrStyle 02 still">

Example comp: [`examples/src/styles/S02CaptionExplainer.tsx`](../examples/src/styles/S02CaptionExplainer.tsx) · id `NxrStyle02-NightCaption` · **1080×1920** · 30 fps · 160 f

## Visual DNA
| Axis | Spec |
|---|---|
| Palette | stage `#0a0a0a` with a soft centre vignette · white ink · grey `#8a8a8a` for older words · blue `#3b82f6` for the question word · **red `#e5484d` for money and danger** · paper `#ecebe6` for the flip |
| Type | Geometric sans (Plus Jakarta Sans 800) at about 60 px on 1080 w. Tiny tracked grey eyebrow above each number. |
| Layout | Brand chip at the top centre, the hero object in the middle third, captions in the lower third (clear of the bottom ~300 px for app chrome). |
| Motion | Caption words build at the VO pace. The newest word is white/800 and older ones turn grey. Ledger rows enter with `SPR.snap`, staggered 10 f. |
| Transitions | Polarity flip (X05): a hard cut dark→paper is allowed **once**, followed by a stamp landing 2.2→1 with `SPR.land`, rotated −12°, `multiply`. |
| Timing | One word every 8–12 f (0.27–0.4 s) depending on the VO. The count-up runs about 50 f with `E.type`. |
| Audio | VO first; music bed at −22 dB under the VO; a soft tick per caption word; a thump on the stamp. −14 LUFS master. |

## Techniques
T03 Karaoke caption + count-up · N05 Ledger rows · N06 Node graph · X05 Polarity stamp · C03 Impact kick · T01 (for the question word).

## Do / Don't
- **Do** time caption words from the VO (frame each word starts). Never type at a fixed rate over speech.
- **Do** use `tabular-nums` on every counter.
- **Do** keep one accent per beat: blue for questions, red for money and loss, amber for a twist.
- **Don't** put captions inside the platform's UI safe zones: the top ~250 px, the bottom ~420 px and the right ~120 px.
- **Don't** flip polarity more than about once every 15 s, or it stops resetting attention.
- **Don't** add a logo animation at the end. End on the payoff chip.

## Example brief
"Explain in 5 seconds how a hacker drained $3.2M and what the fatal mistake was. Vertical, for X/TikTok."

| Frames | Beat |
|---|---|
| 0–10 | "NxrLabs Explains" chip and the HACKER BALANCE eyebrow are already on screen (frame 0 is the poster). |
| 10–60 | A red count-up to `$3,200,000`, while the ledger bar fills and 3 rows snap in. |
| 30–100 | Karaoke caption: "He drained 3.2 million dollars in one block." |
| 90–107 | A red chip, "THE FATAL MISTAKE ↓". |
| 108 | Polarity flip to paper plus a camera kick. |
| 112–160 | A "−3,000 USDT" card rises, then the IRREVERSIBLE stamp lands (log scale 1.6→1, rough edge). |

## Remotion starter
```tsx
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, tw} from '../lib/anim';
import {Fill} from './kit';

// VO-first: the frame where each word starts, measured from the voice file.
const WORDS: [string, number][] = [['He', 30], ['drained', 38], ['3.2', 48], ['million', 56], ['dollars', 64], ['in', 74], ['one', 80], ['block.', 88]];

export const CaptionStarter: React.FC = () => {
  const f = useCurrentFrame();
  const n = Math.round(tw(f, 10, 60, 0, 3_200_000, E.type));
  const newest = WORDS.filter(([, t]) => t <= f).length - 1;
  return (
    <Fill bg="radial-gradient(circle at 50% 45%, #161616 0%, #0a0a0a 70%)">
      <div style={{position: 'absolute', top: 640, width: '100%', textAlign: 'center', fontFamily: 'Plus Jakarta Sans', color: '#e5484d', fontWeight: 800, fontSize: 150, fontVariantNumeric: 'tabular-nums'}}>
        ${n.toLocaleString('en-US')}
      </div>
      <div style={{position: 'absolute', bottom: 470, left: 90, right: 90, textAlign: 'center', fontFamily: 'Plus Jakarta Sans', fontSize: 62, lineHeight: 1.2}}>
        {WORDS.map(([w, t], i) => (
          <span key={i} style={{opacity: f >= t ? 1 : 0, color: i === newest ? '#fff' : '#8a8a8a', fontWeight: i === newest ? 800 : 600}}>{w} </span>
        ))}
      </div>
    </Fill>
  );
};
```
