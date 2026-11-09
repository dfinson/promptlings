// NxrStyle 10 · Pixel Bar-Grid Trailer — footage-led game trailer: the real game scene is the hero, cuts land on
// 2 s bars, parallax layers ordered far to near, Bayer-dithered sky and dither transition, italic-plus-caps lower-third,
// silence -> slam title with a capped flash stutter.
import React, {useLayoutEffect, useRef} from 'react';
import {useCurrentFrame} from 'remotion';
import {E, clamp, prog, rand} from '../lib/anim';
import {Fill, SPRITES} from './kit';

const LW = 320, LH = 180, K = 6; // logical pixel canvas, upscaled x6 nearest-neighbour to 1920x1080
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];
const PAL = {sky: ['#1b1b3a', '#3b2f63', '#7a3e6d', '#d0645a', '#f4a259'], far: '#4b3b6b', mid: '#2e2546', near: '#191529', ground: '#120f1d', lamp: '#ffd27a', glow: '#ff9e4a', k: '#0b0a12'};
const hero = SPRITES.hero; const HP: Record<string, string> = {k: '#0b0a12', y: '#ffd27a', s: '#f6c7a1', e: '#0b0a12', b: '#3f6fd8'};

const draw = (c: CanvasRenderingContext2D, f: number) => {
  const cam = Math.floor(f * 0.6); // camera trucks right on whole pixels
  // banded sky with ordered dither between bands
  for (let y = 0; y < LH; y++) { const t = (y / 120) * (PAL.sky.length - 1); const i = Math.min(PAL.sky.length - 2, Math.floor(t)); const u = t - i;
    for (let x = 0; x < LW; x++) { c.fillStyle = u > bayer(x, y) ? PAL.sky[i + 1] : PAL.sky[i]; c.fillRect(x, y, 1, 1); } }
  for (let i = 0; i < 40; i++) { const x = Math.floor(rand(`st${i}`) * LW), y = Math.floor(rand(`sy${i}`) * 60); if ((f + i * 5) % 40 < 34) { c.fillStyle = '#fff'; c.fillRect(x, y, 1, 1); } }
  c.fillStyle = '#ffe3b0'; c.fillRect(230, 70, 14, 14); c.fillRect(228, 72, 18, 10); // pixel sun, square by design
  const ridge = (par: number, base: number, amp: number, freq: number, col: string, seed: string) => { c.fillStyle = col;
    for (let x = 0; x < LW; x++) { const wx = x + Math.floor(cam * par); const h = Math.floor(base - amp * (0.5 + 0.5 * Math.sin(wx * freq)) - amp * 0.4 * rand(`${seed}${Math.floor(wx / 6)}`)); c.fillRect(x, h, 1, LH - h); } };
  ridge(0.15, 118, 26, 0.03, PAL.far, 'a');
  // mid layer: temple silhouettes
  c.fillStyle = PAL.mid; ridge(0.4, 132, 10, 0.05, PAL.mid, 'b');
  for (let i = 0; i < 6; i++) { const x = i * 90 - Math.floor(cam * 0.4) % 90 + 20; c.fillRect(x, 104, 30, 30); c.fillRect(x - 6, 100, 42, 5); c.fillRect(x + 4, 92, 22, 8); c.fillRect(x + 12, 84, 6, 8); }
  ridge(0.7, 150, 8, 0.11, PAL.near, 'c');
  c.fillStyle = PAL.ground; c.fillRect(0, 150, LW, 30);
  // lanterns on the ground layer (1.0x) with flicker glow
  for (let i = 0; i < 8; i++) { const x = i * 56 - (cam % 56) + 10; const fl = rand(`fl${i}:${Math.floor(f / 3)}`) > 0.2 ? 1 : 0.6;
    c.globalAlpha = 0.25 * fl; c.fillStyle = PAL.glow; c.fillRect(x - 5, 128, 13, 13); c.globalAlpha = 1;
    c.fillStyle = PAL.k; c.fillRect(x + 1, 140, 1, 12); c.fillStyle = PAL.lamp; c.fillRect(x - 1, 132, 5, 7); }
  // hero walks on a 2-frame cycle, bob of exactly 1 px
  const bob = Math.floor(f / 6) % 2; hero.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') { c.fillStyle = HP[ch]; c.fillRect(150 + i, 137 + j - bob, 1, 1); } }));
  // letterbox
  c.fillStyle = '#000'; c.fillRect(0, 0, LW, 14); c.fillRect(0, LH - 14, LW, 14);
};

const PixelCanvas: React.FC<{f: number; dither: number}> = ({f, dither}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => { const c = ref.current!.getContext('2d')!; c.clearRect(0, 0, LW, LH); draw(c, f);
    if (dither > 0) { c.fillStyle = '#000'; for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) if (bayer(x, y) < dither) c.fillRect(x, y, 1, 1); } }, [f, dither]);
  return <canvas ref={ref} width={LW} height={LH} style={{position: 'absolute', inset: 0, width: LW * K, height: LH * K, imageRendering: 'pixelated'}} />;
};

export const S10PixelTrailer: React.FC = () => {
  const f = useCurrentFrame();
  const BAR = 60; // 2 s bar grid
  if (f < BAR) {
    const lt = prog(f, 14, 24, E.out);
    return (
      <Fill bg="#000">
        <PixelCanvas f={f} dither={clamp((f - (BAR - 8)) / 8)} />
        {/* lower-third: small italic line + big caps + a rule, pixel-aligned */}
        <div style={{position: 'absolute', right: 132, bottom: 150, textAlign: 'right', opacity: lt > 0.05 ? 1 : 0, clipPath: `inset(0 0 0 ${(1 - lt) * 100}%)`}}>
          <div style={{fontFamily: 'Pixelify Sans', fontSize: 40, color: '#f4d9b0', textShadow: '4px 4px 0 #191529'}}>~ a road of lanterns ~</div>
          <div style={{height: 6, background: '#f4d9b0', margin: '12px 0 14px', width: 600, marginLeft: 'auto'}} />
          <div style={{fontFamily: 'Pixelify Sans', fontWeight: 700, fontSize: 84, color: '#fff', lineHeight: 1, textShadow: '6px 6px 0 #3b2f63'}}>TEMPLE PLAZA</div>
        </div>
        <div style={{position: 'absolute', left: 132, top: 108, fontFamily: 'Silkscreen', fontSize: 30, color: '#f4d9b0', opacity: 0.85}}>CHAPTER II</div>
      </Fill>
    );
  }
  const g = f - BAR; // bar 2: 6 frames of pure black silence, then slam + flash stutter (2 flashes, capped 70%)
  const slam = g >= 6; const flash = g === 6 || g === 9 ? 0.7 : 0;
  return (
    <Fill bg="#000">
      {slam && <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{fontFamily: 'Pixelify Sans', fontWeight: 700, fontSize: 210, color: '#ffd27a', textShadow: '12px 12px 0 #7a3e6d', transform: `scale(${g < 8 ? 1.3 : 1})`}}>LANTERN</div>
        <div style={{fontFamily: 'Pixelify Sans', fontSize: 48, color: '#f4d9b0', marginTop: 20, opacity: g > 18 ? 1 : 0}}>coming 2027 · wishlist now</div>
      </div>}
      <div style={{position: 'absolute', inset: 0, background: '#fff', opacity: flash}} />
    </Fill>
  );
};
