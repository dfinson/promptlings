// NxrStyle 15 · Hand-Drawn Ink — lines that draw themselves and BOIL on twos (new drawing every 2 frames,
// textures don't boil), marker notes in a hand font, an ink-blot transition into a riso halftone panel.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, clamp, mix, onTwos, prog, rand} from '../lib/anim';
import {Fill} from './kit';

const C = {paper: '#f4efe3', ink: '#1f1d1a', red: '#e8412e', blue: '#2f5bd3', pink: '#ff5a8a', yellow: '#f6c445'};
type Pt = [number, number];
const boil = (pts: Pt[], d: number, seed: string, amp = 3): string => 'M' + pts.map(([x, y], i) => `${x + (rand(`${seed}${d}:${i}`) - 0.5) * 2 * amp},${y + (rand(`${seed}${d}:${i}y`) - 0.5) * 2 * amp}`).join(' L');
const line = (a: Pt, b: Pt, n = 16): Pt[] => Array.from({length: n + 1}, (_, i) => [mix(a[0], b[0], i / n), mix(a[1], b[1], i / n)]);
const RIDGE: Pt[] = Array.from({length: 60}, (_, i) => { const t = i / 59; const x = 140 + t * 1640; const y = 760 - Math.max(0, Math.sin(t * Math.PI * 2.2) * 260 * Math.sin(t * Math.PI)) - Math.sin(t * 31) * 14; return [x, y]; });
const PEAK = RIDGE.reduce((a, p) => (p[1] < a[1] ? p : a));

export const S15HandDrawnInk: React.FC = () => {
  const f = useCurrentFrame();
  const d = onTwos(f, 2) / 2; // drawing index: 15 drawings / s
  const draw = prog(onTwos(f, 2), 0, 30, E.smooth);
  const flag = prog(onTwos(f, 2), 26, 36, E.out);
  const note = prog(onTwos(f, 2), 34, 50, E.linear);
  const blot = prog(f, 56, 86, E.in); // ink blot grows from the peak
  const blotR = blot * 2300;
  const blob = Array.from({length: 40}, (_, i) => { const a = (i / 40) * Math.PI * 2; const r = blotR * (0.86 + 0.14 * Math.sin(a * 5 + 1) + (rand(`b${d}:${i}`) - 0.5) * 0.08); return `${PEAK[0] + Math.cos(a) * r},${PEAK[1] + Math.sin(a) * r}`; }).join(' L');
  return (
    <Fill bg={C.paper}>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <defs>
          <filter id="pencil"><feTurbulence baseFrequency="0.8" numOctaves={2} seed={3} /><feDisplacementMap in="SourceGraphic" scale={2.5} /></filter>
          <pattern id="dotsB" width={18} height={18} patternUnits="userSpaceOnUse" patternTransform="rotate(15)"><circle cx={9} cy={9} r={6} fill={C.blue} /></pattern>
          <pattern id="dotsP" width={18} height={18} patternUnits="userSpaceOnUse" patternTransform="rotate(75) translate(4 3)"><circle cx={9} cy={9} r={4.5} fill={C.pink} /></pattern>
          <clipPath id="blot"><path d={'M' + blob + 'Z'} /></clipPath>
        </defs>
        {/* paper texture is static (textures don't boil) */}
        {Array.from({length: 26}).map((_, i) => <line key={i} x1={0} x2={1920} y1={60 + i * 40} y2={60 + i * 40} stroke="#e4dccb" strokeWidth={1.5} />)}
        <g filter="url(#pencil)">
          <path d={boil(RIDGE, d, 'r')} stroke={C.ink} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
          {[0, 1, 2, 3, 4].map((k) => <path key={k} d={boil(line([300 + k * 280, 800 + (k % 2) * 30], [420 + k * 280, 800 + (k % 2) * 30], 6), d, `h${k}`, 2.5)} stroke={C.ink} strokeWidth={4} fill="none" strokeLinecap="round" opacity={clamp(draw * 2 - k * 0.2)} />)}
          <path d={boil(line([PEAK[0], PEAK[1]], [PEAK[0], PEAK[1] - 120], 6), d, 'pole')} stroke={C.ink} strokeWidth={6} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - flag} />
          <path d={boil([[PEAK[0], PEAK[1] - 120], [PEAK[0] + 80, PEAK[1] - 100], [PEAK[0], PEAK[1] - 80]], d, 'flag', 2)} fill={C.red} opacity={flag > 0.9 ? 1 : 0} />
          {/* marker circle + arrow + note */}
          <path d={boil(Array.from({length: 30}, (_, i) => { const a = (i / 29) * Math.PI * 2.15 - 0.5; return [PEAK[0] + 30 + Math.cos(a) * 150, PEAK[1] - 70 + Math.sin(a) * 110] as Pt; }), d, 'c', 3.5)}
            stroke={C.red} strokeWidth={6} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog(onTwos(f, 2), 30, 42, E.out)} />
          <path d={boil(line([PEAK[0] + 470, PEAK[1] - 250], [PEAK[0] + 190, PEAK[1] - 120], 8), d, 'ar', 3)} stroke={C.red} strokeWidth={6} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - note} />
        </g>
        <text x={PEAK[0] + 360} y={PEAK[1] - 280} fontFamily="Caveat" fontWeight={700} fontSize={96} fill={C.red} opacity={note > 0.5 ? 1 : 0} transform={`rotate(-6 ${PEAK[0] + 360} ${PEAK[1] - 280})`}>the peak!</text>
        <text x={140} y={150} fontFamily="Caveat" fontWeight={700} fontSize={84} fill={C.ink}>day 3 · summit log</text>
        {/* ink blot transition reveals the riso plate scene */}
        {blot > 0 && <g clipPath="url(#blot)">
          <rect width={1920} height={1080} fill={C.blue} />
          <rect width={1920} height={1080} fill="url(#dotsP)" opacity={0.55} />
          <circle cx={1380} cy={470} r={330} fill={C.yellow} /><circle cx={1392} cy={462} r={330} fill="url(#dotsB)" opacity={0.35} />
          <text x={300} y={560} fontFamily="Archivo Black" fontSize={150} fill={C.paper}>made by</text>
          <text x={308} y={716} fontFamily="Archivo Black" fontSize={150} fill={C.yellow}>hand.</text>
        </g>}
        {blot > 0 && blot < 1 && <path d={'M' + blob + 'Z'} fill="none" stroke={C.ink} strokeWidth={10} />}
      </svg>
    </Fill>
  );
};
