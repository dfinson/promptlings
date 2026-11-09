// NxrStyle 11 · One-Take Portal Zoom — a single unbroken log-space zoom through nested worlds:
// city window -> desk monitor -> RGB subpixels -> the city again. Constant perceived speed (scale = 8^u),
// no cuts, last frame == first frame.
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {CanvasComp} from '../lib/canvas';
import {rand} from '../lib/anim';

const W = 1920, H = 1080, Z = 8, PW = W / Z, PH = H / Z; // portal = centred 240x135 rect in every level
const PX = (W - PW) / 2, PY = (H - PH) / 2;
const PER = 50; // frames per level; 3 levels -> 150f loop

const city = (c: CanvasRenderingContext2D) => {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a0f2c'); g.addColorStop(1, '#2a2350'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + rand(`s${i}`) * 0.6})`; c.fillRect(rand(`x${i}`) * W, rand(`y${i}`) * 380, 3, 3); }
  for (let b = 0; b < 9; b++) { const x = b * 230 - 60, h = 380 + rand(`h${b}`) * 380; c.fillStyle = b % 2 ? '#141a3a' : '#1b2148'; c.fillRect(x, H - h, 200, h);
    for (let wy = H - h + 30; wy < H - 30; wy += 46) for (let wx = x + 22; wx < x + 180; wx += 40) if (rand(`w${b}:${wx}:${wy}`) > 0.55) { c.fillStyle = '#f5c96b'; c.fillRect(wx, wy, 20, 26); } }
  c.fillStyle = '#20285a'; c.fillRect(700, 260, 520, H - 260); // hero tower holding the portal window
  for (let wy = 300; wy < H; wy += 70) for (let wx = 730; wx < 1200; wx += 90) { c.fillStyle = rand(`t${wx}:${wy}`) > 0.5 ? '#f5c96b' : '#2d3672'; c.fillRect(wx, wy, 50, 36); }
  c.fillStyle = '#20285a'; c.fillRect(PX - 30, PY - 30, PW + 60, PH + 60); c.fillStyle = '#ffd98a'; c.fillRect(PX - 8, PY - 8, PW + 16, PH + 16);
};
const room = (c: CanvasRenderingContext2D) => {
  c.fillStyle = '#e8d8c0'; c.fillRect(0, 0, W, H); c.fillStyle = '#d9c4a5'; for (let x = 0; x < W; x += 120) c.fillRect(x, 0, 6, H * 0.72);
  c.fillStyle = '#7a4e2d'; c.fillRect(0, H * 0.72, W, H); c.fillStyle = '#5d3a20'; c.fillRect(0, H * 0.72, W, 18);
  c.fillStyle = '#2f6f4f'; c.beginPath(); c.ellipse(320, 640, 110, 170, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#c0583a'; c.fillRect(260, 720, 120, 120); // plant
  c.fillStyle = '#222'; c.fillRect(1500, 470, 14, 310); c.fillStyle = '#f2b84b'; c.beginPath(); c.moveTo(1420, 470); c.lineTo(1600, 470); c.lineTo(1550, 380); c.lineTo(1470, 380); c.fill(); // lamp
  c.fillStyle = '#1c1c1f'; c.fillRect(PX - 24, PY - 22, PW + 48, PH + 44); c.fillRect(W / 2 - 14, PY + PH + 22, 28, 150); c.fillRect(W / 2 - 90, H * 0.72 - 8, 180, 16); // monitor
  c.fillStyle = '#333'; c.fillRect(760, 830, 400, 50); // keyboard
};
const subpixels = (c: CanvasRenderingContext2D) => {
  c.fillStyle = '#050505'; c.fillRect(0, 0, W, H);
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const x = PX + i * PW, y = PY + j * PH; const d = Math.hypot(i, j * 1.4);
    const v = Math.max(0.12, 1 - d / 5.5); ['#ff2a2a', '#2aff5a', '#2a6bff'].forEach((col, k) => { c.globalAlpha = v * (0.6 + 0.4 * rand(`p${i}:${j}:${k}`)); c.fillStyle = col; c.fillRect(x + 12 + k * 74, y + 12, 64, PH - 24); }); }
  c.globalAlpha = 1;
};
const LEVELS = [city, room, subpixels];

export const S11PortalZoom: React.FC = () => {
  const f = useCurrentFrame();
  const T = f / PER; const L = Math.floor(T); const s = Math.pow(Z, T - L); // log-space: equal time = equal ratio
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <CanvasComp w={W} h={H} draw={(c) => {
        let sc = s;
        for (let d = 0; d < 3; d++) {
          c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.translate(W / 2, H / 2); c.scale(sc, sc); c.translate(-W / 2, -H / 2);
          if (d > 0) { const ps = sc * Z; c.setTransform(1, 0, 0, 1, 0, 0); c.beginPath(); c.rect(W / 2 - (PW / 2) * ps, H / 2 - (PH / 2) * ps, PW * ps, PH * ps); c.clip();
            c.translate(W / 2, H / 2); c.scale(sc, sc); c.translate(-W / 2, -H / 2); }
          LEVELS[(L + d) % 3](c); c.restore();
          // keep the clip chain: each deeper level is clipped by its parent's portal
          sc /= Z;
        }
      }} />
      <div style={{position: 'absolute', left: 60, top: 50, fontFamily: 'Geist Mono', fontSize: 24, letterSpacing: '0.2em', color: '#fff', mixBlendMode: 'difference'}}>ONE TAKE · NO CUTS</div>
      <div style={{position: 'absolute', right: 60, top: 50, fontFamily: 'Geist Mono', fontSize: 24, letterSpacing: '0.2em', color: '#fff', mixBlendMode: 'difference'}}>{['CITY', 'ROOM', 'PIXEL'][L % 3]} · ×{s.toFixed(2)}</div>
    </AbsoluteFill>
  );
};
