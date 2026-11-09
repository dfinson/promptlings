// UI techniques
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {E, SPR, clamp, hitPulse, lmix, mix, prog, rand, spr, track, tw} from '../lib/anim';
import {Brackets, Center, Stage} from '../lib/ui';

/** U01 tilted 3D phone with real UI + giant number over it + chips popping out */
export const TiltedPhone: React.FC = () => {
  const f = useCurrentFrame();
  const enter = spr(f, 0, SPR.soft);
  const ry = mix(-38, -18, enter) + Math.sin(f / 30) * 2, rx = mix(16, 8, enter);
  const amt = Math.round(tw(f, 14, 36, 0, 54000, E.type));
  const slide = prog(f, 44, 56, E.ui);
  const ok = f >= 58;
  return (
    <Stage bg="radial-gradient(circle at 50% 40%,#1d2b4f,#090d1a)">
      <Center style={{perspective: 1200}}>
        <div style={{width: 230, height: 470, borderRadius: 36, background: '#0b0b0f', padding: 10, boxSizing: 'border-box', transformStyle: 'preserve-3d', transform: `translateY(${(1 - enter) * 300}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(4deg)`, boxShadow: '30px 40px 60px rgba(0,0,0,.5)'}}>
          <div style={{width: '100%', height: '100%', borderRadius: 28, background: ok ? '#e9fbf0' : '#f4f6fb', position: 'relative', overflow: 'hidden', fontSize: 12}}>
            <div style={{padding: 16, fontWeight: 700}}>Nxr Wallet</div>
            <div style={{margin: '0 16px', height: 80, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22}}>QRIS</div>
            <div style={{position: 'absolute', left: 16, right: 16, bottom: 30, height: 44, borderRadius: 22, background: '#1e1e24'}}>
              <div style={{position: 'absolute', left: 4 + slide * 150, top: 4, width: 36, height: 36, borderRadius: 18, background: '#29f0c6'}} />
              <div style={{color: '#fff', textAlign: 'center', lineHeight: '44px', opacity: 1 - slide}}>Slide to pay</div></div>
            {ok && <div style={{position: 'absolute', top: 180, width: '100%', textAlign: 'center', fontSize: 40, color: '#1aa35a', transform: `scale(${spr(f, 58, SPR.pop)})`}}>✓</div>}
          </div>
        </div>
      </Center>
      <div style={{position: 'absolute', left: 60, top: 60, fontWeight: 800, fontSize: 96, color: '#fff', opacity: prog(f, 12, 16), fontVariantNumeric: 'tabular-nums', textShadow: '0 10px 40px rgba(0,0,0,.6)'}}>{amt.toLocaleString('id-ID')} <span style={{fontSize: 40}}>IDR</span></div>
      <div style={{position: 'absolute', left: 64, top: 180, fontSize: 26, color: '#9fb3d9', opacity: prog(f, 30, 36)}}>≈ 3,0312 USDC</div>
      {[['Scan pay', 640, 140, 20], ['0 fee', 700, 330, 26], ['Instant', 180, 380, 32]].map(([t, x, y, d]) => { const p = spr(f, d as number, SPR.pop); return <div key={t as string} style={{position: 'absolute', left: x as number, top: y as number, padding: '10px 18px', borderRadius: 20, background: '#29f0c6', color: '#06231c', fontWeight: 800, fontSize: 20, transform: `scale(${p}) translateZ(0)`, opacity: clamp(p * 2)}}>{t}</div>; })}
    </Stage>
  );
};

/** U02 chip-flip grid on beat: $500 chips flip to $0, staggered by beat */
export const ChipFlipGrid: React.FC = () => {
  const f = useCurrentFrame(); const beat = 5; // ~0.17 s at 30fps
  return (
    <Stage bg="#121216">
      <div style={{position: 'absolute', left: 90, top: 60, display: 'grid', gridTemplateColumns: 'repeat(4, 180px)', gap: 18, perspective: 800}}>
        {Array.from({length: 12}).map((_, i) => {
          const t0 = 8 + i * (beat / 1.25); const p = prog(f, t0, t0 + 5, E.inOut); // 10f@60 E.inOut, swap at half
          const back = p > 0.5; const ang = p * 180;
          return <div key={i} style={{height: 120, borderRadius: 14, background: back ? '#0f2a1a' : '#26262e', transform: `rotateY(${back ? ang - 180 : ang}deg) scale(${1 + 0.1 * hitPulse(f - t0 - 5, 1, 3)})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{fontSize: 12, color: '#888'}}>{['Text FX', 'Glitch', 'Liquid', 'Particles', 'Shaders', '3D Type', 'Noise', 'Blur', 'Grain', 'Ripple', 'Pixel', 'Ink'][i]}</div>
            <div style={{fontSize: 40, fontWeight: 800, color: back ? '#2ecc71' : '#fff'}}>{back ? '$0' : '$500'}</div></div>;
        })}
      </div>
    </Stage>
  );
};

/** U03 2x2 stat tiles: hard-cut in, LV ticks 1->7 with pop, bar fills */
export const StatTiles: React.FC = () => {
  const f = useCurrentFrame();
  const tiles = [['SOCIAL', '#5fd3f3'], ['GAMING', '#c8a8ff'], ['CREATIVE', '#f5c518'], ['AI', '#5bd160']];
  return (
    <Stage bg="#13161c">
      {tiles.map(([t, c], i) => {
        const on = f >= 2 + i * 3; const lv = Math.min(7, 1 + Math.floor(Math.max(0, f - 14 - i * 3) / 3)); const lvF = 14 + i * 3 + (lv - 1) * 3;
        return on && <div key={t} style={{position: 'absolute', left: 150 + (i % 2) * 340, top: 50 + Math.floor(i / 2) * 230, width: 320, height: 210, borderRadius: 18, background: c, fontFamily: '"Press Start 2P"', padding: 22, boxSizing: 'border-box'}}>
          <div style={{fontSize: 22}}>{t}</div>
          <div style={{fontSize: 34, marginTop: 40, display: 'inline-block', transform: `scale(${1 + 0.25 * hitPulse(f - lvF, 1, 3)})`, transformOrigin: 'left'}}>LV {lv}</div>
          <div style={{marginTop: 18, height: 14, background: 'rgba(0,0,0,.2)'}}><div style={{width: `${(lv / 7) * 100}%`, height: '100%', background: '#111'}} /></div></div>;
      })}
    </Stage>
  );
};

/** U04 HUD bounding box with handles; shape inside morphs circle->squircle->triangle->flower */
export const HudShapeMorph: React.FC = () => {
  const f = useCurrentFrame();
  const N = 120; const shapes = [
    (a: number) => 1, // circle
    (a: number) => 1 / Math.pow(Math.pow(Math.abs(Math.cos(a)), 4) + Math.pow(Math.abs(Math.sin(a)), 4), 0.25) * 0.9, // squircle
    (a: number) => { const k = Math.PI / 3; const b = ((a + Math.PI / 2) % (2 * k) + 2 * k) % (2 * k) - k; return 0.62 / Math.cos(b); }, // triangle
    (a: number) => 0.75 + 0.25 * Math.cos(6 * a), // flower
  ];
  const cols = ['#e8412e', '#2f6bff', '#f5c518', '#e8412e'];
  const seg = 18; const k = Math.min(2, Math.floor(f / seg)); const p = prog(f, k * seg + 6, k * seg + 16, E.inOut);
  const R = 140; const pts = Array.from({length: N}).map((_, i) => { const a = (i / N) * Math.PI * 2; const r = R * mix(shapes[k](a), shapes[k + 1](a), p); return `${480 + Math.cos(a) * r},${270 + Math.sin(a) * r}`; }).join(' ');
  const col = p > 0.5 ? cols[k + 1] : cols[k];
  return (
    <Stage bg="#f3f2ee">
      <svg width={960} height={540} style={{position: 'absolute'}}>
        <polygon points={pts} fill={col} />
        <rect x={480 - 170} y={270 - 170} width={340} height={340} fill="none" stroke="#2f6bff" strokeWidth={1.5} />
        {[[310, 100], [650, 100], [310, 440], [650, 440], [480, 100], [480, 440], [310, 270], [650, 270]].map(([x, y], i) => <rect key={i} x={x - 5} y={y - 5} width={10} height={10} fill="#fff" stroke="#2f6bff" strokeWidth={1.5} />)}
      </svg>
      <div style={{position: 'absolute', left: 660, top: 450, fontFamily: 'Geist Mono', fontSize: 12, color: '#2f6bff'}}>{['ELLIPSE', 'SQUIRCLE', 'POLYGON', 'STAR'][p > 0.5 ? k + 1 : k]} · 340×340</div>
    </Stage>
  );
};

/** U05 UI-state morph: button -> loader -> check -> pill, label swap has its own blur in/out */
export const UiStateMorph: React.FC = () => {
  const f = useCurrentFrame();
  const w = track(f, 260, [[10, 64], [44, 340]], SPR.snap); const h = 64;
  const label = f < 10 ? 'Submit' : f < 44 ? '' : 'Sent to 3 people';
  const lp = f < 10 ? 1 - prog(f, 6, 10, E.in) : prog(f, 48, 54, E.out);
  const spin = f >= 12 && f < 34; const check = prog(f, 34, 42, E.out);
  return (
    <Stage bg="#f5f5f2"><Center>
      <div style={{width: w, height: h, borderRadius: 32, background: f >= 34 ? '#16a34a' : '#0e0e10', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: 22, overflow: 'hidden', transform: `scale(${1 - 0.05 * hitPulse(f - 8, 1, 3)})`}}>
        {label && <span style={{opacity: lp, filter: `blur(${(1 - lp) * 8}px)`, whiteSpace: 'nowrap'}}>{label}</span>}
        {spin && <svg width={30} height={30} style={{transform: `rotate(${f * 24}deg)`}}><circle cx={15} cy={15} r={11} stroke="#fff" strokeWidth={3} fill="none" strokeDasharray="45 30" strokeLinecap="round" /></svg>}
        {f >= 34 && f < 44 && <svg width={34} height={34}><path d="M7 18 L14 25 L27 10" stroke="#fff" strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray={30} strokeDashoffset={30 * (1 - check)} /></svg>}
      </div></Center></Stage>
  );
};

/** U06 cursor glide + hover + press: cursor path eased, button lifts on hover, squashes on press */
export const CursorPress: React.FC = () => {
  const f = useCurrentFrame();
  const p = prog(f, 4, 30, E.glide); const x = mix(140, 520, p) + Math.sin(p * Math.PI) * 30, y = mix(440, 282, p);
  const hover = prog(f, 26, 32); const press = hitPulse(f - 36, 1, 4);
  return (
    <Stage bg="#e6f4fe"><Center>
      <div style={{width: 300, height: 76, borderRadius: 38, background: '#2f6bff', color: '#fff', fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `translateY(${-4 * hover}px) scale(${1 + 0.03 * hover - 0.07 * press})`, boxShadow: `0 ${8 + 10 * hover}px ${20 + 20 * hover}px rgba(47,107,255,.35)`}}>Generate video</div></Center>
      {f >= 36 && <div style={{position: 'absolute', left: 520 - 60 * prog(f, 36, 48), top: 282 - 60 * prog(f, 36, 48), width: 120 * prog(f, 36, 48), height: 120 * prog(f, 36, 48), borderRadius: '50%', border: '2px solid #2f6bff', opacity: 1 - prog(f, 36, 48)}} />}
      <svg width={30} height={36} style={{position: 'absolute', left: x, top: y, transform: `scale(${1 - 0.15 * press})`}}><path d="M2 2 L2 28 L9 21 L14 33 L19 31 L14 19 L24 19 Z" fill="#111" stroke="#fff" strokeWidth={2} /></svg>
    </Stage>
  );
};

/** U07 segmented toggle with two-edge springs: leading edge stiff, trailing soft -> pill stretches */
export const TwoEdgeToggle: React.FC = () => {
  const f = useCurrentFrame();
  const slots = [0, 160, 320]; const seq: [number, number][] = [[8, 2], [32, 1], [52, 0]];
  const target = (fr: number) => { let s = 0; for (const [t, k] of seq) if (fr >= t) s = k; return s; };
  // each edge = sum of springs toward the new slot edges, different stiffness
  const lead = {damping: 22, stiffness: 420, mass: 0.6}, trail = {damping: 20, stiffness: 140, mass: 0.8};
  let L = 0, R = 160; let prevK = 0;
  for (const [t, k] of seq) { const dL = slots[k] - slots[prevK]; const right = dL > 0;
    L += dL * spr(f, t, right ? trail : lead); R += dL * spr(f, t, right ? lead : trail); prevK = k; }
  return (
    <Stage bg="#f2f0ea"><Center>
      <div style={{position: 'relative', width: 480, height: 72, borderRadius: 36, background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,.08)'}}>
        <div style={{position: 'absolute', left: L + 6, width: R - L - 12, top: 6, bottom: 6, borderRadius: 30, background: '#111'}} />
        {['Daily', 'Weekly', 'Monthly'].map((t, i) => <div key={t} style={{position: 'absolute', left: slots[i], width: 160, top: 0, lineHeight: '72px', textAlign: 'center', fontWeight: 600, fontSize: 20, color: target(f) === i ? '#fff' : '#555'}}>{t}</div>)}
      </div></Center></Stage>
  );
};

/** U08 orbit icons with depth: z drives scale, blur and draw order */
export const OrbitIcons: React.FC = () => {
  const f = useCurrentFrame(); const n = 7;
  const items = Array.from({length: n}).map((_, i) => { const a = (i / n) * Math.PI * 2 + f * 0.035; const z = Math.sin(a); return {i, x: 480 + Math.cos(a) * 300, y: 270 + z * 70, z}; }).sort((a, b) => a.z - b.z);
  return (
    <Stage bg="#eef3fb">
      {items.filter((o) => o.z < 0).map((o) => <Icon key={o.i} {...o} />)}
      <Center style={{fontFamily: 'Anton', fontSize: 90, color: '#0f1b33'}}>NXR</Center>
      {items.filter((o) => o.z >= 0).map((o) => <Icon key={o.i} {...o} />)}
    </Stage>
  );
};
const Icon: React.FC<{i: number; x: number; y: number; z: number}> = ({i, x, y, z}) => { const s = mix(0.6, 1.2, (z + 1) / 2); return <div style={{position: 'absolute', left: x - 36, top: y - 36, width: 72, height: 72, borderRadius: 18, background: ['#3366ff', '#ff4a1c', '#1aa35a', '#f5c518', '#8e44ad', '#111', '#29f0c6'][i], transform: `scale(${s})`, filter: `blur(${Math.max(0, -z) * 3}px)`, opacity: mix(0.55, 1, (z + 1) / 2), boxShadow: '0 10px 20px rgba(0,0,0,.15)'}} />; };

/** U09 card deal then scatter cloud + counter */
export const CardDealScatter: React.FC = () => {
  const f = useCurrentFrame(); const n = 12;
  const sc = prog(f, 40, 62, E.smooth);
  const cnt = Math.round(tw(f, 40, 70, 176097205, 250000000, E.type));
  return (
    <Stage bg="#f3f2ee">
      {Array.from({length: n}).map((_, i) => {
        const t0 = 2 + i * 2.5; const p = spr(f, t0, SPR.snap); const gx = 160 + (i % 4) * 170, gy = 90 + Math.floor(i / 4) * 130;
        const sx = 480 + (rand(`sx${i}`) - 0.5) * 900, sy = 270 + (rand(`sy${i}`) - 0.5) * 520;
        const x = mix(mix(480, gx, p), sx, sc), y = mix(mix(700, gy, p), sy, sc);
        const r = mix((rand(i) - 0.5) * 8, (rand(`r${i}`) - 0.5) * 40, sc);
        return <div key={i} style={{position: 'absolute', left: x - 70, top: y - 50, width: 140, height: 100, borderRadius: 10, background: '#fff', boxShadow: '0 6px 16px rgba(0,0,0,.12)', transform: `rotate(${r}deg) scale(${mix(1, 0.6, sc)})`, padding: 10, boxSizing: 'border-box'}}><div style={{height: 8, width: '70%', background: '#ddd', borderRadius: 4}} /><div style={{height: 8, width: '50%', background: '#eee', borderRadius: 4, marginTop: 8}} /></div>;
      })}
      {f >= 40 && <Center style={{fontFamily: 'Newsreader', fontSize: 92, color: '#111', opacity: prog(f, 40, 46), fontVariantNumeric: 'tabular-nums'}}>{cnt.toLocaleString('en-US')}+</Center>}
    </Stage>
  );
};

/** U10 3D card flip face swap: 10f@60 E.inOut, face swaps at the midpoint + specular sweep 36f@60 E.smooth */
export const FlipSpecular: React.FC = () => {
  const f = useCurrentFrame();
  const p = prog(f, 10, 20, E.inOut); const back = p > 0.5; const ang = back ? (p - 1) * 180 : p * 180;
  const sweep = tw(f, 34, 52, -0.4, 1.4, E.smooth);
  return (
    <Stage bg="#16161a"><Center style={{perspective: 1000}}>
      <div style={{position: 'relative', width: 400, height: 250, borderRadius: 22, overflow: 'hidden', transform: `rotateY(${ang}deg)`, background: back ? 'linear-gradient(135deg,#2b2b33,#0d0d10)' : '#e6e6ea', color: back ? '#fff' : '#111', padding: 26, boxSizing: 'border-box'}}>
        <div style={{fontWeight: 800, fontSize: 26}}>{back ? 'NxrLabs Card' : 'Front'}</div>
        <div style={{position: 'absolute', bottom: 24, fontFamily: 'Geist Mono', fontSize: 20, letterSpacing: 3}}>{back ? '•••• 4021' : 'tap to flip'}</div>
        {back && <div style={{position: 'absolute', inset: 0, background: `linear-gradient(110deg, transparent ${sweep * 100 - 12}%, rgba(255,255,255,.35) ${sweep * 100}%, transparent ${sweep * 100 + 12}%)`}} />}
      </div></Center></Stage>
  );
};

/** U11 floating UI cards over a darkened world, slight 3D bob */
export const FloatingCards: React.FC = () => {
  const f = useCurrentFrame();
  const cards = [['Rewards', '+12 PTS', 140, 120, -8], ['Quest', 'One knock.', 560, 90, 6], ['Ends', 'Nov 6', 380, 300, -3]];
  return (
    <Stage bg="#0d1530">
      <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 120%, #3a2a5a, transparent 60%)'}} />
      {cards.map(([t, v, x, y, r], i) => { const p = spr(f, 4 + i * 6, SPR.soft); const bob = Math.sin((f + i * 20) / 14) * 6;
        return <div key={i} style={{position: 'absolute', left: x as number, top: (y as number) + bob + (1 - p) * 80, width: 260, height: 140, borderRadius: 20, background: 'rgba(255,255,255,.92)', transform: `perspective(800px) rotateY(${r}deg) rotateX(6deg)`, opacity: p, padding: 22, boxSizing: 'border-box', boxShadow: '0 30px 50px rgba(0,0,0,.4)'}}><div style={{fontSize: 14, color: '#777'}}>{t}</div><div style={{fontSize: 34, fontWeight: 800}}>{v}</div></div>; })}
    </Stage>
  );
};
