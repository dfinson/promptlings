// NxrStyle 09 · Live Bento Grid — 1:1 feed post. Frame 0 is already the poster (headline + full grid),
// every tile is a live seamless loop (L=60f, film = 180f so last frame == first), price chips flip red $500 -> green $0 on the beat, payoff strike at the end.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, SPR, clamp, hitPulse, mix, prog, spr} from '../lib/anim';
import {Fill} from './kit';

const C = {bg: '#0e0f12', tile: '#17181d', line: '#26272e', red: '#ff4d4d', green: '#2ee59d', white: '#f3f3f0', dim: '#8b8c93'};
const L = 60; // loop length in frames: every tile is periodic in L, so the film loops seamlessly
const TAU = Math.PI * 2;
type Tile = (ph: number) => React.ReactNode;
const tiles: [string, Tile][] = [
  ['Spinner', (ph) => <svg viewBox="-50 -50 100 100" width="70%">{Array.from({length: 12}).map((_, i) => <rect key={i} x={-4} y={-40} width={8} height={18} rx={4} fill={C.white} opacity={((i / 12 - ph + 1) % 1)} transform={`rotate(${i * 30})`} />)}</svg>],
  ['Wave dots', (ph) => <svg viewBox="0 0 100 60" width="80%">{Array.from({length: 9}).map((_, i) => <circle key={i} cx={10 + i * 10} cy={30 + Math.sin(TAU * ph + i * 0.7) * 16} r={4} fill={C.green} />)}</svg>],
  ['Orbit', (ph) => <svg viewBox="-50 -50 100 100" width="70%"><circle r={30} fill="none" stroke={C.line} strokeWidth={2} /><circle r={8} fill={C.white} /><circle cx={Math.cos(TAU * ph) * 30} cy={Math.sin(TAU * ph) * 30} r={7} fill={C.red} /></svg>],
  ['EQ bars', (ph) => <svg viewBox="0 0 100 60" width="80%">{Array.from({length: 7}).map((_, i) => { const h = 10 + 40 * Math.abs(Math.sin(TAU * ph * 2 + i)); return <rect key={i} x={8 + i * 13} y={55 - h} width={9} height={h} rx={2} fill={C.white} />; })}</svg>],
  ['Morph', (ph) => { const r = mix(0, 50, 0.5 + 0.5 * Math.sin(TAU * ph)); return <div style={{width: 110, height: 110, background: C.green, borderRadius: `${r}%`, transform: `rotate(${ph * 360}deg)`}} />; }],
  ['Ripple', (ph) => <svg viewBox="-50 -50 100 100" width="75%">{[0, 1 / 3, 2 / 3].map((o) => { const p = (ph + o) % 1; return <circle key={o} r={p * 44} fill="none" stroke={C.white} strokeWidth={3} opacity={1 - p} />; })}</svg>],
  ['Checker', (ph) => <svg viewBox="0 0 100 100" width="65%">{Array.from({length: 16}).map((_, i) => { const x = i % 4, y = Math.floor(i / 4); const on = Math.sin(TAU * ph + (x + y) * 0.8) > 0; return <rect key={i} x={x * 25 + 2} y={y * 25 + 2} width={21} height={21} rx={4} fill={on ? C.red : C.line} />; })}</svg>],
  ['Sine', (ph) => <svg viewBox="0 0 100 60" width="85%"><path d={Array.from({length: 51}).map((_, i) => `${i ? 'L' : 'M'}${i * 2},${30 + Math.sin(i / 50 * TAU * 1.5 - TAU * ph) * 20}`).join(' ')} stroke={C.green} strokeWidth={3} fill="none" /></svg>],
  ['Typing', (ph) => <div style={{fontFamily: 'Geist Mono', fontSize: 40, color: C.white}}>{'npx motion'.slice(0, Math.floor(ph * 13))}<span style={{opacity: ph % 0.25 < 0.125 ? 1 : 0}}>▌</span></div>],
  ['Toggle', (ph) => { const on = ph > 0.5; const p = clamp(Math.sin(TAU * ph) * -3 + 0.5); return <div style={{width: 140, height: 72, borderRadius: 36, background: on ? C.green : C.line, position: 'relative'}}><div style={{position: 'absolute', top: 8, left: 8 + p * 68, width: 56, height: 56, borderRadius: 28, background: '#fff'}} /></div>; }],
  ['Pulse', (ph) => { const s = 1 + 0.25 * Math.max(0, Math.sin(TAU * ph * 2)) ** 8; return <div style={{fontSize: 90, color: C.red, transform: `scale(${s})`}}>♥</div>; }],
  ['Marquee', (ph) => <div style={{width: '100%', overflow: 'hidden'}}><div style={{whiteSpace: 'nowrap', fontFamily: 'Archivo Black', fontSize: 40, color: C.white, transform: `translateX(${-ph * 50}%)`}}>NEW • NEW • NEW • NEW • </div></div>],
];

export const S09LiveGrid: React.FC = () => {
  const f = useCurrentFrame();
  const ph = (f % L) / L;
  const BEAT = 14; const firstFlip = 18;
  return (
    <Fill bg={C.bg}>
      <div style={{position: 'absolute', left: 64, top: 52, right: 64, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div style={{fontFamily: 'Inter', fontWeight: 800, fontSize: 56, color: C.white, lineHeight: 1.08, letterSpacing: -1.5}}>
          Motion designers charge<br /><span style={{color: C.red}}>$500</span> per effect.
        </div>
        <div style={{fontFamily: 'Geist Mono', fontSize: 22, color: C.bg, background: C.white, padding: '10px 16px', borderRadius: 8}}>PART 2</div>
      </div>
      <div style={{position: 'absolute', left: 64, right: 64, top: 230, bottom: 64, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', gap: 14}}>
        {tiles.map(([name, T], i) => {
          const t = firstFlip + i * (BEAT / 2); const flip = spr(f, t, SPR.detent) - spr(f, 158 + i, SPR.detent); const done = flip >= 0.5; const pulse = hitPulse(f - t, 1, 4);
          return (
            <div key={name} style={{background: C.tile, borderRadius: 22, border: `2px solid ${C.line}`, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              {T((ph + i * 0.13) % 1)}
              <div style={{position: 'absolute', left: 14, top: 12, fontFamily: 'Geist Mono', fontSize: 16, color: C.dim}}>{name}</div>
              <div style={{position: 'absolute', right: 12, bottom: 12, padding: '6px 12px', borderRadius: 10, fontFamily: 'Inter', fontWeight: 800, fontSize: 22,
                background: done ? 'rgba(46,229,157,.14)' : 'rgba(255,77,77,.14)', color: done ? C.green : C.red, transform: `scaleY(${Math.abs(Math.cos(flip * Math.PI))}) scale(${1 + 0.15 * pulse})`}}>
                {done ? '$0' : '$500'}</div>
            </div>
          );
        })}
      </div>
      {/* payoff: total struck and counted down */}
      {f >= 110 && f < 160 && <div style={{position: 'absolute', inset: 0, background: 'rgba(14,15,18,.86)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: prog(f, 110, 114) * (1 - prog(f, 150, 158, E.in)), filter: `blur(${prog(f, 150, 158, E.in) * 20}px)`}}>
        <div style={{position: 'relative', fontFamily: 'Inter', fontWeight: 900, fontSize: 160, color: C.dim}}>$6,000
          <div style={{position: 'absolute', left: -10, right: -10, top: '52%', height: 14, background: C.red, transform: `scaleX(${prog(f, 114, 120, E.out)})`, transformOrigin: 'left'}} /></div>
        <div style={{fontFamily: 'Inter', fontWeight: 900, fontSize: 220, color: C.green, filter: `blur(${(1 - prog(f, 120, 126)) * 16}px)`}}>$0</div>
        <div style={{fontFamily: 'Geist Mono', fontSize: 26, color: C.white, letterSpacing: '0.2em'}}>ONE PROMPT · MOTIONITE</div>
      </div>}
    </Fill>
  );
};
