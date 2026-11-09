// NxrStyle 07 · Frost Collectible — icy pale gradient, heavy condensed caps in navy/royal blue,
// anchor-word + blur swap, icons orbiting in depth, a scramble counter and a glossy card flip with specular sweep.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, SPR, clamp, mix, prog, rand, spr} from '../lib/anim';
import {Fill, SPRITES, Sprite} from './kit';

const C = {navy: '#0d1b4c', royal: '#2f5bff', ice1: '#dbe8f7', ice2: '#f7fbff', silver: '#9fb2cf', gold: '#f2c14e'};
const SWAPS = ['STREAM.', 'DROP.', 'HOLDER.'];
const ICONS = ['▶', '♪', '★', '#', '◆', '⚡'];

export const S07FrostCollectible: React.FC = () => {
  const f = useCurrentFrame();
  const k = Math.min(2, Math.floor(Math.max(0, f - 6) / 22)); const loc = (f - 6) - k * 22;
  const pin = prog(loc, 0, 6, E.out); const pout = k < 2 ? prog(loc, 18, 22, E.in) : 0;
  const n = Math.round(mix(0, 5555, prog(f, 10, 70, E.out)));
  const digits = String(n).padStart(4, '0').split('').map((d, i) => (f < 70 - i * 6 ? String(Math.floor(rand(`${f}:${i}`) * 10)) : d));
  const flip = spr(f, 60, SPR.firm); const ang = mix(0, 180, flip); const back = ang > 90;
  return (
    <Fill bg={`linear-gradient(160deg, ${C.ice1} 0%, ${C.ice2} 55%, #e6eefb 100%)`}>
      {Array.from({length: 70}).map((_, i) => { const x = (rand(`sx${i}`) * 1920 + f * (0.4 + rand(`sv${i}`))) % 1920; const y = (rand(`sy${i}`) * 1080 + f * (1 + rand(`sv${i}`) * 2)) % 1080; const r = 2 + rand(`sr${i}`) * 5;
        return <div key={i} style={{position: 'absolute', left: x, top: y, width: r, height: r, borderRadius: r, background: '#fff', opacity: 0.9, boxShadow: '0 0 6px rgba(47,91,255,.25)'}} />; })}
      <div style={{position: 'absolute', left: 120, top: 240, fontFamily: 'Anton', fontSize: 230, lineHeight: 0.9, color: C.navy, letterSpacing: 2}}>
        <div>EVERY</div>
        <div style={{color: C.royal, filter: `blur(${(1 - pin) * 18 + pout * 18}px)`, opacity: clamp(pin * 1.5) * (1 - pout), transform: `translateY(${(1 - pin) * 30 - pout * 30}px)`}}>{SWAPS[k]}</div>
      </div>
      <div style={{position: 'absolute', left: 130, top: 730, fontFamily: 'Geist Mono', fontSize: 30, color: C.navy, letterSpacing: '0.2em'}}>
        MINTED <span style={{fontFamily: 'Anton', fontSize: 96, letterSpacing: 6, color: C.navy}}>{digits.join('')}</span> / 5555
      </div>
      {/* orbit ring in depth: scale + z-order from the sine */}
      {ICONS.map((ic, i) => { const a = (i / ICONS.length) * Math.PI * 2 + f * 0.035; const z = Math.sin(a); const s = mix(0.65, 1.15, (z + 1) / 2);
        return <div key={i} style={{position: 'absolute', left: 1420 + Math.cos(a) * 380 - 50, top: 540 + z * 90 - 50, width: 100, height: 100, borderRadius: 50, zIndex: z > 0 ? 3 : 1,
          background: `linear-gradient(145deg, #fff, ${C.silver})`, boxShadow: '0 12px 24px rgba(13,27,76,.22)', transform: `scale(${s})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 44, color: C.royal, fontFamily: 'Inter', fontWeight: 800}}>{ic}</div>; })}
      {/* glossy collectible card with specular sweep, flips on the beat */}
      <div style={{position: 'absolute', left: 1420 - 190, top: 540 - 260, width: 380, height: 520, perspective: 1600, zIndex: 2}}>
        <div style={{width: '100%', height: '100%', borderRadius: 28, transform: `rotateY(${ang}deg) rotateZ(-4deg)`, background: back ? `linear-gradient(145deg, ${C.navy}, ${C.royal})` : `linear-gradient(145deg, #ffffff, #cfdcf2)`,
          boxShadow: '0 40px 80px rgba(13,27,76,.35)', overflow: 'hidden', position: 'relative', border: '3px solid rgba(255,255,255,.8)'}}>
          {!back && <>
            <div style={{position: 'absolute', left: 30, top: 28, fontFamily: 'Geist Mono', fontSize: 20, color: C.navy, letterSpacing: '0.2em'}}>PASS · #0042</div>
            <Sprite map={SPRITES.bot} pal={{k: C.navy, b: C.royal, w: '#fff'}} px={30} x={70} y={120} />
            <div style={{position: 'absolute', left: 30, bottom: 28, fontFamily: 'Anton', fontSize: 54, color: C.navy}}>NXR BOT</div>
          </>}
          {back && <div style={{position: 'absolute', inset: 0, transform: 'scaleX(-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Anton', fontSize: 80, color: '#fff'}}>HOLDER</div>}
          <div style={{position: 'absolute', top: -200, bottom: -200, width: 120, left: mix(-300, 600, ((f % 45) / 45)), background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent)', transform: 'rotate(18deg)'}} />
        </div>
      </div>
    </Fill>
  );
};
