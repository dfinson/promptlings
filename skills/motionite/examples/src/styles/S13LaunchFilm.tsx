// NxrStyle 13 · Clean Launch Film — restrained product launch: near-white stage, one sans, ink + ONE accent with
// a meaning (red = needs rebuild), copy in fragments, scale-through cuts, numbers that are the product. No glow,
// no gradient, no overshoot on type.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, SPR, clamp, lmix, mix, prog, rand, spr} from '../lib/anim';
import {Fill} from './kit';

const C = {bg: '#fafaf9', ink: '#111111', soft: '#e6e6e3', mid: '#8a8a86', red: '#e5484d'};
const N = 494, COLS = 38;
const STILL_RED = new Set([37, 211, 402]);

const Frag: React.FC<{f: number; t: number; text: string; size?: number; color?: string}> = ({f, t, text, size = 120, color = C.ink}) => {
  const p = prog(f, t, t + 10, E.out);
  return <div style={{fontFamily: 'Inter', fontWeight: 600, fontSize: size, letterSpacing: -size * 0.035, color, overflow: 'hidden', lineHeight: 1.1}}>
    <div style={{transform: `translateY(${(1 - p) * 100}%)`}}>{text}</div></div>;
};

export const S13LaunchFilm: React.FC = () => {
  const f = useCurrentFrame();
  // shot 1 (0-36): one changed line -> scale-through cut into its own red marker
  if (f < 36) {
    const st = prog(f, 26, 36, E.in); const z = lmix(1, 40, st);
    return (
      <Fill bg={C.bg}>
        <div style={{position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '590px 548px'}}>
          <div style={{position: 'absolute', left: 260, top: 360, width: 1400, fontFamily: 'Geist Mono', fontSize: 34, color: C.mid, lineHeight: 1.9}}>
            <div>  export const cache = createCache({'{'}</div>
            <div style={{color: C.ink, background: C.soft}}><span style={{display: 'inline-block', width: 22, height: 22, background: C.red, marginRight: 22}} />  ttl: <b>3600</b>,</div>
            <div>  store: disk('.cachet'),</div><div>{'}'});</div>
          </div>
        </div>
        <div style={{position: 'absolute', left: 260, top: 180, opacity: 1 - st}}><Frag f={f} t={2} text="One changed line." size={96} /></div>
      </Fill>
    );
  }
  const g = f - 36;
  // shot 2 (36-120): the wall of 494 targets: all invalidate red, then resolve from cache to ink
  if (g < 84) {
    const cached = Math.round(mix(0, N - 3, prog(g, 30, 70, E.inOut)));
    const order = (i: number) => rand(`o${i}`);
    return (
      <Fill bg={C.bg}>
        <div style={{position: 'absolute', left: 160, top: 120}}>
          {g < 30 ? <Frag f={g} t={2} text="494 targets." /> : <Frag f={g} t={30} text={`${cached} from cache.`} />}
        </div>
        <div style={{position: 'absolute', left: 160, top: 330, display: 'grid', gridTemplateColumns: `repeat(${COLS}, 34px)`, gap: 6}}>
          {Array.from({length: N}).map((_, i) => {
            const inv = prog(g, (i % COLS) * 0.4, (i % COLS) * 0.4 + 6, E.out); // invalidation sweeps left -> right
            const hit = !STILL_RED.has(i) && order(i) * (N - 3) < cached;
            return <div key={i} style={{width: 34, height: 34, borderRadius: 4, background: hit ? C.ink : inv > 0.5 ? C.red : C.soft}} />;
          })}
        </div>
        <div style={{position: 'absolute', right: 160, top: 160, fontFamily: 'Geist Mono', fontSize: 28, color: C.mid, textAlign: 'right'}}>
          wall time<div style={{fontFamily: 'Inter', fontWeight: 600, fontSize: 84, color: C.ink, letterSpacing: -2, fontVariantNumeric: 'tabular-nums'}}>0:{String(Math.round(mix(0, 9, prog(g, 30, 70, E.inOut)))).padStart(2, '0')}</div></div>
      </Fill>
    );
  }
  const h = g - 84; const p = spr(h, 0, SPR.calm);
  return (
    <Fill bg={C.bg}>
      <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scale(${mix(1.04, 1, p)})`}}>
        <div style={{fontFamily: 'Inter', fontWeight: 700, fontSize: 220, letterSpacing: -9, color: C.ink}}>cachet<span style={{color: C.red}}>.</span></div>
        <div style={{fontFamily: 'Inter', fontSize: 44, color: C.mid, opacity: clamp(p * 1.5)}}>Builds that remember.</div>
      </div>
    </Fill>
  );
};
