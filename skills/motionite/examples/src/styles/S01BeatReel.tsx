// NxrStyle 01 · Beat Reel — flat colour fields, one idea per bar, kinetic type, HUD chrome.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, hitPulse, lmix, mix, prog} from '../lib/anim';
import {Brackets} from '../lib/ui';
import {Corners, Fill, Mono, grid} from './kit';

const {b} = grid(128); // bar = 56.25f
const C = {night: '#111111', red: '#e8412e', blue: '#2b3bff', mustard: '#f2c531', cream: '#efece4'};

const slam = (f: number, t0: number) => { const p = prog(f, t0, t0 + 4, E.out); return {opacity: Math.min(1, p * 1.5), transform: `scale(${mix(1.35, 1, p)})`, filter: `blur(${(1 - p) * 18}px)`}; };

// shape morph through polar radius functions (U04): same vertex count always
const shapes = [(a: number) => 1, (a: number) => 1 / Math.pow(Math.pow(Math.abs(Math.cos(a)), 4) + Math.pow(Math.abs(Math.sin(a)), 4), 0.25), (a: number) => 0.75 + 0.25 * Math.cos(6 * a)];
const morphPath = (k: number, p: number, R: number) => Array.from({length: 120}, (_, i) => {
  const a = (i / 120) * Math.PI * 2; const r = mix(shapes[k % 3](a), shapes[(k + 1) % 3](a), p) * R;
  return `${i ? 'L' : 'M'}${Math.cos(a) * r},${Math.sin(a) * r}`; }).join(' ') + 'Z';

export const S01BeatReel: React.FC = () => {
  const f = useCurrentFrame();
  const bar = Math.floor(f / 56.25);
  const hud = bar === 3 ? C.night : bar === 0 ? '#fff' : bar === 2 ? '#fff' : C.night;
  return (
    <Fill bg={[C.night, C.red, C.blue, C.cream][Math.min(3, bar)]}>
      {bar === 0 && <Bar0 f={f} />}
      {bar === 1 && <Bar1 f={f - b(1)} />}
      {bar === 2 && <Bar2 f={f - b(2)} />}
      {bar >= 3 && <Bar3 f={f - b(3)} />}
      <Corners c={hud} inset={36} size={34} t={4} />
      <Mono style={{left: 96, top: 44, color: hud}}>MOTIONITE REEL 2026</Mono>
      <Mono style={{right: 96, top: 44, color: hud}}>BAR {Math.min(4, bar + 1)}/4 · 128 BPM</Mono>
      <Mono style={{right: 96, bottom: 44, color: hud}}>F{String(f).padStart(4, '0')} · 00:{String((f / 30).toFixed(2)).padStart(5, '0')}</Mono>
    </Fill>
  );
};

// Bar 0: frame 0 is already a poster (ring + glyph), then the ring gathers and an iris punches through (X02)
const Bar0: React.FC<{f: number}> = ({f}) => {
  const gather = prog(f, 16, 26, E.in);
  const r = 1 + Math.max(0, f - 26); const R = f < 26 ? 0 : 30 * Math.pow(1.27, r); // geometric growth = constant perceived speed
  return (
    <Fill bg="transparent">
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <defs><mask id="ko"><rect width={1920} height={1080} fill="#fff" /><text x={960} y={700} textAnchor="middle" fontFamily="Montserrat" fontWeight={900} fontSize={560} fill="#000">E</text></mask></defs>
        {Array.from({length: 8}).map((_, i) => { const a = (i / 8) * Math.PI * 2 + f * 0.05; const rr = mix(260, 0, gather);
          return <circle key={i} cx={960 + Math.cos(a) * rr} cy={540 + Math.sin(a) * rr} r={mix(26, 10, gather)} fill={C.red} opacity={R > 600 ? 0 : 1} />; })}
        {R > 0 && <circle cx={960} cy={540} r={Math.min(R, 1400)} fill={C.red} mask={R < 700 ? 'url(#ko)' : undefined} />}
      </svg>
      <div style={{position: 'absolute', left: 120, bottom: 150, fontFamily: 'Montserrat', fontWeight: 900, fontSize: 150, color: '#fff', lineHeight: 0.9, opacity: R > 300 ? 0 : 1}}>MOTION<br /><span style={{color: C.red}}>ON BEAT.</span></div>
    </Fill>
  );
};

// Bar 1: word slams + arc swing inside brackets + camera kick on the 3rd hit (T04, C03)
const Bar1: React.FC<{f: number}> = ({f}) => {
  const sw = prog(f, 14, 22, E.out); const ang = mix(-28, 0, sw);
  const vel = Math.abs(28 * (prog(f, 14, 22, E.out) - prog(f - 1, 14, 22, E.out)));
  const kick = hitPulse(f - 28, 1, 4) * 10;
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translate(${kick}px, ${-kick * 0.5}px)`}}>
      <div style={{position: 'absolute', left: 150, top: 190, fontFamily: 'Montserrat', fontWeight: 900, fontSize: 200, color: C.night, lineHeight: 0.98, letterSpacing: -4, whiteSpace: 'nowrap'}}>
        <div style={{display: 'inline-block', ...slam(f, 2)}}>EVERY</div>
        <div style={{display: 'inline-block', position: 'relative', marginLeft: 60, padding: '0 28px', transformOrigin: '50% 600%', transform: `rotate(${ang}deg)`, opacity: sw, filter: `blur(${Math.min(14, vel * 1.4)}px)`}}>
          FRAME<Brackets x={-6} y={-4} w={790} h={206} c={C.night} s={40} t={10} />
        </div>
        <div style={{transformOrigin: 'left', ...slam(f, 28)}}>LANDS <span style={{color: '#fff'}}>ON BEAT.</span></div>
      </div>
    </div>
  );
};

// Bar 2: design-tool overlay — selection box with handles around a morphing shape (U04)
const Bar2: React.FC<{f: number}> = ({f}) => {
  const k = Math.floor(f / 18); const p = prog(f % 18, 4, 14, E.inOut);
  const box = 520;
  const h = (x: number, y: number) => <rect x={x - 9} y={y - 9} width={18} height={18} fill={C.blue} stroke="#fff" strokeWidth={3} />;
  return (
    <>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <g transform={`translate(1260 540) rotate(${f * 1.6})`}><path d={morphPath(k, p, 220)} fill={[C.mustard, C.red, '#fff'][k % 3]} /></g>
        <rect x={1260 - box / 2} y={540 - box / 2} width={box} height={box} fill="none" stroke="#fff" strokeWidth={3} />
        {[[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]].map(([x, y], i) => <React.Fragment key={i}>{h(1260 + (x * box) / 2, 540 + (y * box) / 2)}</React.Fragment>)}
      </svg>
      <Mono style={{left: 1000, top: 830, color: '#fff'}}>ROT {(f * 1.6).toFixed(1).padStart(5, '0')}° · SHAPE {['CIRCLE', 'SQUIRCLE', 'FLOWER'][k % 3]}</Mono>
      <div style={{position: 'absolute', left: 150, top: 330, fontFamily: 'Montserrat', fontWeight: 900, fontSize: 190, color: '#fff', lineHeight: 0.95}}>
        <div style={slam(f, 2)}>SHAPE</div><div style={{...slam(f, 10), color: C.mustard}}>SHIFTS.</div>
      </div>
    </>
  );
};

// Bar 3: end card — serif wordmark + red dot + tracked caps (lockup holds ≥1.5 s)
const Bar3: React.FC<{f: number}> = ({f}) => {
  const p = prog(f, 0, 12, E.out); const dot = prog(f, 10, 16, E.out);
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{fontFamily: 'Newsreader', fontSize: 300, color: C.night, letterSpacing: -6, filter: `blur(${(1 - p) * 14}px)`, transform: `scale(${lmix(1.12, 1, p)})`}}>
        Motionite<span style={{display: 'inline-block', width: 54, height: 54, borderRadius: 27, background: C.red, transform: `scale(${dot})`, marginLeft: 12}} />
      </div>
      <div style={{fontFamily: 'Geist Mono', fontSize: 30, letterSpacing: '0.4em', color: C.night, opacity: prog(f, 14, 24)}}>MOTION DESIGN SKILL · BY NXRLABS</div>
    </div>
  );
};
