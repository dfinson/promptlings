// Camera techniques
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {E, SPR, clamp, hitPulse, lmix, mix, prog, rand, spr, tw} from '../lib/anim';
import {Center, Stage} from '../lib/ui';

const lerpColor = (a: string, b: string, t: number) => {
  const p = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(mix(v, B[i], t))).join(',')})`;
};
const sky = (t: number) => { // day -> dusk -> night
  const k = [['#8ec5f0', '#d8ecfa'], ['#f2a65a', '#f7d9a8'], ['#1a2350', '#3a3f7a']];
  const i = Math.min(1, Math.floor(t * 2)); const u = t * 2 - i;
  return [lerpColor(k[i][0], k[i + 1][0], u), lerpColor(k[i][1], k[i + 1][1], u)];
};

/** C01 one continuous truck through a long world strip, sky time-of-day shifts with x */
export const ContinuousPan: React.FC = () => {
  const f = useCurrentFrame();
  const t = prog(f, 0, 74, E.dolly); const x = -t * 1920;
  const [a, b] = sky(t);
  const shops = [['WARUNG', '#c0392b'], ['TOKO', '#ee4d2d'], ['RESTO', '#2d6a4f'], ['KOPI', '#6d4c41'], ['APOTEK', '#2e86de'], ['HOTEL', '#8e44ad']];
  return (
    <Stage bg={`linear-gradient(${a},${b})`}>
      <AbsoluteFill style={{transform: `translateX(${x * 0.3}px)`}}>{Array.from({length: 14}).map((_, i) => <div key={i} style={{position: 'absolute', left: i * 240, bottom: 150, width: 200, height: 120 + rand(i) * 120, background: 'rgba(40,50,90,.18)'}} />)}</AbsoluteFill>
      <AbsoluteFill style={{transform: `translateX(${x}px)`}}>
        {shops.map(([n, c], i) => <div key={n} style={{position: 'absolute', left: 120 + i * 480, bottom: 90, width: 300, height: 220, background: '#f6efe2', border: '4px solid #2a2a2a'}}>
          <div style={{background: c, color: '#fff', fontWeight: 800, fontSize: 28, textAlign: 'center', padding: 8}}>{n}</div>
          <div style={{position: 'absolute', left: 110, bottom: 0, width: 80, height: 110, background: '#2a2a2a', boxShadow: t > 0.6 ? '0 0 30px #ffd76a' : 'none'}} /></div>)}
        <div style={{position: 'absolute', left: 0, bottom: 0, width: 3200, height: 90, background: '#3b3b3b'}} />
      </AbsoluteFill>
      <div style={{position: 'absolute', left: 430, bottom: 70, width: 100, height: 160, transform: `translateY(${-Math.abs(Math.sin(f * 0.5)) * 6}px)`}}>
        <div style={{width: 60, height: 60, borderRadius: 30, background: '#f1c27d', margin: '0 auto'}} /><div style={{width: 80, height: 90, borderRadius: 16, background: '#2e86de', margin: '4px auto'}} /></div>
      <div style={{position: 'absolute', top: 30, width: '100%', textAlign: 'center', fontSize: 50, fontWeight: 800, color: t > 0.6 ? '#fff' : '#0b2545'}}>{1 + Math.floor(t * 5.99)}× Scan Pay</div>
    </Stage>
  );
};

/** C02 parallax truck with plane factors .3 / 1 / 1.6 */
export const ParallaxTruck: React.FC = () => {
  const f = useCurrentFrame(); const x = tw(f, 0, 74, 0, -600, E.cam);
  const layer = (k: number, kids: React.ReactNode, blur = 0) => <AbsoluteFill style={{transform: `translateX(${x * k}px)`, filter: blur ? `blur(${blur}px)` : undefined}}>{kids}</AbsoluteFill>;
  return (
    <Stage bg="#d9e4ef">
      {layer(0.3, Array.from({length: 8}).map((_, i) => <div key={i} style={{position: 'absolute', left: i * 260, top: 160, width: 220, height: 220, borderRadius: 110, background: '#b7c8dc'}} />), 2)}
      {layer(1, <>{Array.from({length: 6}).map((_, i) => <div key={i} style={{position: 'absolute', left: 120 + i * 300, top: 220, width: 220, height: 150, borderRadius: 16, background: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,.1)', padding: 16, boxSizing: 'border-box', fontWeight: 700}}>Card {i + 1}</div>)}</>)}
      {layer(1.6, Array.from({length: 6}).map((_, i) => <div key={i} style={{position: 'absolute', left: i * 420 - 40, top: 420, width: 140, height: 200, borderRadius: 70, background: '#2b3a55'}} />), 4)}
      <div style={{position: 'absolute', left: 20, top: 16, fontFamily: 'Geist Mono', fontSize: 13}}>far .3 · mid 1.0 · near 1.6 (+blur)</div>
    </Stage>
  );
};

/** C03 impact kick: slam word + camera shake 8px attack 1 tau 4, white flash 2f */
export const ImpactKick: React.FC = () => {
  const f = useCurrentFrame(); const hits = [12, 30, 48];
  const k = hits.reduce((s, h) => s + hitPulse(f - h, 1, 4), 0);
  const dx = k * 8 * (rand(`x${f}`) - 0.5) * 2, dy = k * 8 * (rand(`y${f}`) - 0.5) * 2;
  const words = ['ONE', 'KNOCK.', 'ENDS NOV 6'];
  const idx = hits.filter((h) => f >= h).length - 1;
  const flash = hits.some((h) => f - h >= 0 && f - h < 2);
  const p = idx >= 0 ? prog(f, hits[idx], hits[idx] + 4, E.out) : 0;
  return (
    <Stage bg="#0d1530">
      <AbsoluteFill style={{transform: `translate(${dx}px,${dy}px)`}}>
        {idx >= 0 && <Center style={{fontFamily: 'Anton', fontSize: 150, color: '#f5f0e6', transform: `scale(${mix(1.6, 1, p)})`, filter: `blur(${(1 - p) * 10}px)`}}>{words[idx]}</Center>}
      </AbsoluteFill>
      {flash && <AbsoluteFill style={{background: '#fff', opacity: 0.85}} />}
    </Stage>
  );
};

/** C04 log-zoom world camera: one camera {x,y,logScale}, scene B lives inside a tile of scene A */
export const LogZoomWorld: React.FC = () => {
  const f = useCurrentFrame();
  const p = prog(f, 10, 60, E.smooth);
  const s = lmix(1, 14, p); // scale in log space keeps zoom speed perceptually constant
  const tx = 640, ty = 160; // world point of the target tile centre
  const camX = mix(480, tx, p), camY = mix(270, ty, p);
  const radius = mix(14, 0, prog(f, 50, 62)); // tile corner -> 0 at full-bleed for an exact match cut
  return (
    <Stage bg="#0e0e10">
      <AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(480px,270px) scale(${s}) translate(${-camX}px,${-camY}px)`}}>
        {Array.from({length: 24}).map((_, i) => { const x = 60 + (i % 6) * 145, y = 60 + Math.floor(i / 6) * 110; const tgt = x + 60 === tx + 0 && false; return <div key={i} style={{position: 'absolute', left: x, top: y, width: 120, height: 90, borderRadius: 14, background: `hsl(${(i * 37) % 360},55%,${45 + (i % 3) * 8}%)`}} />; })}
        <div style={{position: 'absolute', left: tx - 34.3, top: ty - 19.3, width: 68.6, height: 38.6, borderRadius: radius / s * 3, background: '#f5c518', overflow: 'hidden'}}>
          <div style={{fontFamily: 'Anton', fontSize: 9, color: '#111', textAlign: 'center', marginTop: 12}}>WORLD INSIDE</div></div>
      </AbsoluteFill>
      <div style={{position: 'absolute', left: 16, bottom: 12, fontFamily: 'Geist Mono', fontSize: 13, color: '#fff'}}>scale {s.toFixed(2)}× (log)</div>
    </Stage>
  );
};

/** C05 push-in to a door, door opens to black with glowing eyes */
export const PushInDoor: React.FC = () => {
  const f = useCurrentFrame();
  const z = lmix(1, 2.6, prog(f, 0, 34, E.cam));
  const open = prog(f, 36, 48, E.out);
  const eyes = prog(f, 52, 56) * (f >= 64 && f < 66 ? 0 : 1); // blink
  return (
    <Stage bg="#2a1f3d">
      <AbsoluteFill style={{transform: `scale(${z})`, transformOrigin: '50% 58%'}}>
        <div style={{position: 'absolute', left: 300, top: 120, width: 360, height: 420, background: '#5c3d2e'}} />
        <div style={{position: 'absolute', left: 400, top: 230, width: 160, height: 280, background: '#000', perspective: 600}}>
          {f > 52 && <><div style={{position: 'absolute', left: 50, top: 100, width: 16, height: 8, borderRadius: 8, background: '#ffd84a', boxShadow: '0 0 12px #ffd84a', opacity: eyes}} /><div style={{position: 'absolute', left: 92, top: 100, width: 16, height: 8, borderRadius: 8, background: '#ffd84a', boxShadow: '0 0 12px #ffd84a', opacity: eyes}} /></>}
          <div style={{position: 'absolute', inset: 0, background: '#8b5a3c', border: '3px solid #3b2418', transformOrigin: 'left', transform: `rotateY(${-open * 100}deg)`}}><div style={{position: 'absolute', right: 16, top: 140, width: 12, height: 12, borderRadius: 6, background: '#d4a017'}} /></div>
        </div>
      </AbsoluteFill>
      <div style={{position: 'absolute', top: 30, width: '100%', textAlign: 'center', fontFamily: 'Archivo Black', fontSize: 50, color: '#ff8a1c', opacity: 1 - prog(f, 10, 18)}}>TRICK OR TREAT</div>
    </Stage>
  );
};
