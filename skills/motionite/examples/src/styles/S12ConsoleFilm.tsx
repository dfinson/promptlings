// NxrStyle 12 · Console-as-Film — the brand's own handheld console IS the world: warm paper field, Instrument Serif
// with one italic olive phrase, a floating real-capture console, cartridge parade, then a dolly into the LCD.
import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';
import {E, SPR, clamp, hitPulse, lmix, mix, prog, spr} from '../lib/anim';
import {BlurWords, Fill, grid} from './kit';

const C = {paper: '#f1f0e8', ink: '#2d332b', muted: '#787d70', line: '#d9dbcf', olive: '#697852', burgundy: '#803c55', lcd: '#adbc77', lcdInk: '#344b23'};
const {b} = grid(128);
const CON_W = 520, CON_H = CON_W / (741 / 1152);

export const S12ConsoleFilm: React.FC = () => {
  const f = useCurrentFrame();
  const enter = spr(f, 0, SPR.heavy);
  const press = hitPulse(f - b(2), 1, 5); // A-button press lands on bar 2
  const dq = prog(f, 112, 146, E.in); const z = lmix(1, 9, dq); // dolly into the LCD: log-space, eases in
  const lcdX = 1430, lcdY = 120 + CON_H * 0.339;
  const cover = clamp((dq - 0.55) / 0.45);
  return (
    <Fill bg={C.paper}>
      {/* paper tooth */}
      <div style={{position: 'absolute', inset: 0, opacity: 0.35, backgroundImage: 'radial-gradient(rgba(45,51,43,.18) 1px, transparent 1px)', backgroundSize: '6px 6px'}} />
      <div style={{position: 'absolute', inset: 0, transformOrigin: `${lcdX}px ${lcdY}px`, transform: `scale(${z})`, filter: dq > 0.1 && dq < 0.95 ? `blur(${Math.min(8, dq * 10)}px)` : undefined}}>
        <div style={{position: 'absolute', left: 120, top: 150, fontFamily: 'Space Mono', fontSize: 22, letterSpacing: '0.25em', color: C.muted}}>01 — THE HANDHELD PORTFOLIO</div>
        <div style={{position: 'absolute', left: 112, top: 210, fontFamily: 'Instrument Serif', fontSize: 150, lineHeight: 0.98, color: C.ink, letterSpacing: -3}}>
          <BlurWords f={f} start={6} text="Small console." />
          <BlurWords f={f} start={18} text="Endless curiosity." style={{fontStyle: 'italic', color: C.olive}} />
        </div>
        <div style={{position: 'absolute', left: 120, top: 640, fontFamily: 'DM Sans', fontWeight: 500, fontSize: 30, color: C.muted, opacity: prog(f, 30, 40)}}>
          <span style={{color: C.burgundy, fontWeight: 700}}>7 cartridges.</span> Built to be played.</div>
        {/* cartridge parade: deals in on the beat grid */}
        {[1, 2, 3, 4, 5].map((n, i) => { const p = spr(f, b(0, 2, i * 2), SPR.land); // eighth notes from beat 3
          return <Img key={n} src={staticFile(`img/nxr-cart-${n}.png`)} style={{position: 'absolute', left: 120 + i * 150, top: 720, width: 200, transform: `translateY(${(1 - p) * 300}px) rotate(${mix(-8, (i - 2) * 2.5, p)}deg)`,
            filter: 'drop-shadow(0 18px 18px rgba(35,42,30,.22))', zIndex: 5 - Math.abs(i - 2)}} />; })}
        {/* the console: real capture, floating, long soft shadow, A press pulse */}
        <div style={{position: 'absolute', left: lcdX - CON_W / 2, top: 120 + Math.sin(f / 34) * 8 + (1 - enter) * 600, width: CON_W, height: CON_H, transform: `rotate(${-3 + Math.sin(f / 50) * 0.8}deg) scale(${1 + 0.03 * press})`}}>
          <div style={{position: 'absolute', left: '8%', right: '2%', top: '6%', bottom: '-1%', borderRadius: 40, background: 'rgba(35,42,30,.3)', filter: 'blur(36px)', transform: 'translate(36px, 40px)'}} />
          <Img src={staticFile('img/nxr-console.png')} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />
        </div>
      </div>
      {cover > 0 && <div style={{position: 'absolute', inset: 0, background: C.lcd, clipPath: `circle(${cover * cover * 1200}px at ${960}px ${540}px)`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{fontFamily: 'VT323', fontSize: 150, color: C.lcdInk, letterSpacing: 6, opacity: prog(f, 140, 146)}}>PRESS START ▶</div></div>}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 44, textAlign: 'center', fontFamily: 'Space Mono', fontSize: 20, letterSpacing: '0.3em', color: C.muted, opacity: 1 - dq}}>NXRLABS · PLAY. BUILD. REPEAT.</div>
    </Fill>
  );
};
