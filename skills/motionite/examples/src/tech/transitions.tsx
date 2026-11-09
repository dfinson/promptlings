// Transition techniques
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {E, SPR, clamp, hitPulse, lmix, mix, prog, rand, spr, tw} from '../lib/anim';
import {Center, Stage} from '../lib/ui';

const SceneA: React.FC<{label?: string}> = ({label = 'LEVEL UP!'}) => (
  <Stage bg="#f5c518"><Center style={{fontFamily: '"Press Start 2P"', fontSize: 64, color: '#111', textShadow: '6px 6px 0 #b8900f'}}>{label}</Center></Stage>
);
const Tiles: React.FC = () => (
  <Stage bg="#13161c">{[['SOCIAL', '#5fd3f3'], ['GAMING', '#c8a8ff'], ['CREATIVE', '#f5c518'], ['AI', '#5bd160']].map(([t, c], i) => (
    <div key={t} style={{position: 'absolute', left: 150 + (i % 2) * 340, top: 50 + Math.floor(i / 2) * 230, width: 320, height: 210, borderRadius: 18, background: c, fontFamily: '"Press Start 2P"', fontSize: 22, padding: 22, boxSizing: 'border-box'}}>{t}</div>))}</Stage>
);

/** X01 vertical smear wipe: outgoing stretches+blurs on Y and exits up; incoming arrives smeared */
export const SmearWipe: React.FC = () => {
  const f = useCurrentFrame(); const c = 30; const L = 6; // 6-frame smear (0.2 s)
  const qo = prog(f, c - L / 2, c + 1, E.in); const qi = prog(f, c - 1, c + L / 2 + 1, E.out);
  const out = f < c + 1; const vblur = (q: number) => `url(#vb${Math.round(q * 10)})`;
  return (
    <Stage>
      <svg width={0} height={0}><defs>{Array.from({length: 11}).map((_, i) => <filter key={i} id={`vb${i}`} x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation={`0 ${i * 6}`} /></filter>)}</defs></svg>
      {out ? <AbsoluteFill style={{filter: vblur(qo), transform: `translateY(${-qo * 260}px) scaleY(${1 + qo * 0.6})`}}><SceneA /></AbsoluteFill>
        : <AbsoluteFill style={{filter: vblur(1 - qi), transform: `translateY(${(1 - qi) * 260}px) scaleY(${1 + (1 - qi) * 0.6})`}}><Tiles /></AbsoluteFill>}
    </Stage>
  );
};

/** X02 iris punch-through: dot ring -> circle with glyph knockout -> fills frame in log-radius */
export const IrisPunch: React.FC = () => {
  const f = useCurrentFrame();
  const ring = prog(f, 0, 14, E.out); const gather = prog(f, 16, 24, E.in);
  const n = 8; const rr = mix(0, 90, ring) * (1 - gather);
  const grow = f >= 26; const r = grow ? 30 * Math.pow(1.27, f - 26) : 30 * clamp((f - 22) / 4); // x1.27 per frame
  return (
    <Stage bg="#111">
      {!grow && Array.from({length: n}).map((_, i) => { const a = (i / n) * Math.PI * 2 + f * 0.04; return <div key={i} style={{position: 'absolute', left: 480 + Math.cos(a) * rr - 7, top: 270 + Math.sin(a) * rr - 7, width: 14, height: 14, borderRadius: 7, background: '#e8412e', opacity: ring}} />; })}
      <svg width={960} height={540} style={{position: 'absolute'}}>
        <defs><mask id="ko"><rect width={960} height={540} fill="#fff" /><text x={480} y={270} dy="0.35em" textAnchor="middle" fontFamily="Montserrat" fontWeight={900} fontSize={Math.min(r * 1.1, 900)} fill="#000">E</text></mask></defs>
        {r > 0 && <circle cx={480} cy={270} r={r} fill="#e8412e" mask={r < 700 ? 'url(#ko)' : undefined} />}
      </svg>
      {f > 44 && <Center style={{fontFamily: 'Montserrat', fontWeight: 900, fontSize: 110, color: '#111', transform: `scale(${mix(1.35, 1, prog(f, 45, 49))})`}}>EVERY</Center>}
    </Stage>
  );
};

/** X03 flood from a button then contract into the next object */
export const FloodContract: React.FC = () => {
  const f = useCurrentFrame();
  const press = 1 - 0.08 * hitPulse(f - 10, 1, 3);
  const maxR = Math.hypot(480, 270) * 1.15;
  const flood = prog(f, 12, 23, E.in); // 11f ~ 0.37 s
  const contract = prog(f, 40, 56, E.out);
  const r = f < 40 ? mix(24, maxR, flood) : mix(maxR, 60, contract);
  const cy = f < 40 ? 360 : mix(360, 230, contract);
  return (
    <Stage bg="#f5f5f2">
      <div style={{position: 'absolute', left: 480 - 110, top: 336, width: 220, height: 48, borderRadius: 24, background: '#0e0e10', color: '#fff', fontWeight: 600, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${press})`}}>Order now</div>
      {f >= 12 && <div style={{position: 'absolute', left: 480 - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: r, background: '#cdf24f'}} />}
      {f >= 24 && f < 44 && <Center style={{fontSize: 70, fontWeight: 800, color: '#0e0e10', opacity: prog(f, 24, 30) * (1 - prog(f, 38, 42))}}>On its way.</Center>}
      {f >= 52 && <div style={{position: 'absolute', top: 310, width: '100%', textAlign: 'center', fontSize: 40, fontWeight: 800, opacity: prog(f, 52, 58)}}>Delivered ✓</div>}
    </Stage>
  );
};

/** X04 scale-through cut: exit accelerates down to .75, entry lands from 1.85x */
export const ScaleThroughCut: React.FC = () => {
  const f = useCurrentFrame(); const c = 30;
  if (f < c) { const q = prog(f, c - 10, c, E.in); return <AbsoluteFill style={{transform: `scale(${mix(1, 0.75, q)})`, filter: `blur(${q * 6}px)`, background: '#000'}}><SceneA label="SCENE A" /></AbsoluteFill>; }
  const p = prog(f, c, c + 18, E.out);
  return <AbsoluteFill style={{background: '#000'}}><AbsoluteFill style={{transform: `scale(${lmix(1.85, 1, p)})`, filter: `blur(${(1 - p) * 8}px)`}}><Tiles /></AbsoluteFill></AbsoluteFill>;
};

/** X05 polarity flip dark->paper + rubber stamp */
export const PolarityStamp: React.FC = () => {
  const f = useCurrentFrame(); const c = 18; const paper = f >= c;
  const st = f - 40; const sp = st >= 0 ? spr(f, 40, SPR.land) : 0;
  return (
    <Stage bg={paper ? '#ecebe6' : '#0a0a0a'}>
      {!paper && <Center style={{color: '#fff', fontSize: 52, fontWeight: 800}}>Saldo: <span style={{color: '#e5484d', marginLeft: 12}}>$0</span></Center>}
      {paper && <Center><div style={{position: 'relative', width: 460, height: 260, background: '#fff', borderRadius: 14, boxShadow: '0 20px 50px rgba(0,0,0,.12)', padding: 26, boxSizing: 'border-box', transform: `translateY(${(1 - spr(f, c, SPR.snap)) * 40}px)`}}>
        <div style={{fontSize: 13, color: '#888', letterSpacing: 2}}>WALLET SAYA</div>
        <div style={{fontSize: 46, fontWeight: 800, color: '#e5484d'}}>-$3.000 USDT</div>
        {['transfer', 'bridge', 'swap'].map((t, i) => <div key={t} style={{fontSize: 16, color: '#444', borderTop: '1px solid #eee', padding: '6px 0', opacity: prog(f, c + 4 + i * 4, c + 8 + i * 4)}}>{t} <span style={{float: 'right', color: '#2a9'}}>✓</span></div>)}
        {st >= 0 && <div style={{position: 'absolute', right: 20, top: 90, border: '5px solid #e5484d', color: '#e5484d', fontWeight: 900, fontSize: 30, padding: '6px 14px', transform: `rotate(-12deg) scale(${mix(2.2, 1, sp)})`, opacity: clamp(sp * 2) * 0.9, mixBlendMode: 'multiply'}}>TIDAK BISA<br />DIHAPUS</div>}
      </div></Center>}
    </Stage>
  );
};

/** X06 strobe sting: holds of 7,5,5,2,2,5,5,5,7f@60 alternating fields */
export const StrobeSting: React.FC = () => {
  const f = useCurrentFrame();
  const holds = [7, 5, 5, 2, 2, 5, 5, 5, 7].map((h) => h / 2); // @30
  let t = 10, k = -1; for (let i = 0; i < holds.length; i++) { if (f >= t) k = i; t += holds[i]; }
  const fields = ['#111', '#fff', '#2b3bff', '#fff', '#111', '#f2c531', '#111', '#fff', '#111'];
  const bg = k < 0 ? '#111' : fields[k]; const ink = bg === '#fff' || bg === '#f2c531' ? '#111' : '#fff';
  const end = f >= t;
  return <Stage bg={end ? '#111' : bg}><Center style={{fontFamily: 'Montserrat', fontWeight: 900, fontSize: end ? 96 : 120, color: end ? '#fff' : ink}}>{end ? 'Motionite.' : ['MOTION', 'TYPE', 'TIME', 'FORM', 'RHYTHM', 'COLOR', 'SOUND', 'SPACE', 'FRAME'][Math.max(0, k)]}</Center></Stage>;
};

/** X07 ink-blot transition: bristly noisy disc reveals the blueprint layer */
export const InkBlot: React.FC = () => {
  const f = useCurrentFrame();
  const R = tw(f, 14, 38, 0, 1200, E.out);
  const pts = Array.from({length: 90}).map((_, i) => {
    const a = (i / 90) * Math.PI * 2; const j = 1 + 0.18 * (rand(`b${i}`) - 0.5) + 0.06 * Math.sin(a * 7 + Math.floor(f / 2));
    return `${480 + Math.cos(a) * R * j},${270 + Math.sin(a) * R * j}`;
  }).join(' ');
  return (
    <Stage bg="#efe6d2">
      <Center style={{fontFamily: 'Caveat', fontSize: 96, color: '#2a2622'}}>a fruit fly</Center>
      <svg width={960} height={540} style={{position: 'absolute'}}>
        <defs><clipPath id="blot"><polygon points={pts} /></clipPath></defs>
        <g clipPath="url(#blot)"><rect width={960} height={540} fill="#1f2d52" />
          {Array.from({length: 16}).map((_, i) => <line key={i} x1={i * 64} y1={0} x2={i * 64} y2={540} stroke="#3b4d7c" />)}
          <circle cx={480} cy={270} r={120} fill="none" stroke="#e8eefc" strokeWidth={2} strokeDasharray="6 5" />
          <text x={480} y={430} textAnchor="middle" fontFamily="Geist Mono" fontSize={22} fill="#e8eefc">FIG. 1 — EGG</text></g>
      </svg>
    </Stage>
  );
};

/** X08 whip pan: accelerating horizontal move with directional blur proportional to speed */
export const WhipPan: React.FC = () => {
  const f = useCurrentFrame();
  const x = tw(f, 18, 38, 0, -960, E.whip);
  const v = Math.abs(tw(f, 18, 38, 0, -960, E.whip) - tw(f - 1, 18, 38, 0, -960, E.whip));
  const b = Math.min(10, Math.round(v / 12));
  return (
    <Stage>
      <svg width={0} height={0}><defs>{Array.from({length: 11}).map((_, i) => <filter key={i} id={`hb${i}`} x="-20%" width="140%"><feGaussianBlur stdDeviation={`${i * 5} 0`} /></filter>)}</defs></svg>
      <AbsoluteFill style={{width: 1920, transform: `translateX(${x}px)`, filter: `url(#hb${b})`, display: 'flex', flexDirection: 'row'}}>
        <div style={{width: 960, height: 540, background: '#fdfdfb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, fontWeight: 700}}>Make a launch video</div>
        <div style={{width: 960, height: 540, background: '#e6f4fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, fontWeight: 700, color: '#294376'}}>frame for frame</div>
      </AbsoluteFill>
    </Stage>
  );
};
