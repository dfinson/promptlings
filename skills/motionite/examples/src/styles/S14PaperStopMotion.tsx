// NxrStyle 14 · Paper Stop-Motion — cut-paper puppets animated on 12 poses/s while the camera moves on ones,
// noise-nudged cut edges, contact shadows, riso-limited palette, verlet steam rope, grain + exposure flicker + vignette.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CanvasComp} from '../lib/canvas';
import {clamp, mix, rand} from '../lib/anim';

const PAL = {bg: '#efe4cc', far: '#9cc5bd', mid: '#2f6f73', red: '#d94b3d', cream: '#fbf6ea', ink: '#2b2a33', sun: '#f2b134'};
const noise1 = (x: number, s: number) => { const i = Math.floor(x), u = x - i; return mix(rand(`${s}:${i}`), rand(`${s}:${i + 1}`), u * u * (3 - 2 * u)); };
type Pt = [number, number];
const cutPoly = (c: CanvasRenderingContext2D, pts: Pt[], seed: number, amp = 2.2) => { // subdivide every 14px + nudge = scissor edge
  const P: Pt[] = []; let k = 0;
  pts.forEach((a, i) => { const b = pts[(i + 1) % pts.length]; const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 14));
    for (let j = 0; j < n; j++) { const t = j / n; P.push([mix(a[0], b[0], t) + (noise1(k * 0.7, seed) - 0.5) * amp * 2, mix(a[1], b[1], t) + (noise1(k * 0.7, seed + 9) - 0.5) * amp * 2]); k++; } });
  c.beginPath(); P.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
};
const circlePts = (cx: number, cy: number, r: number, n = 28): Pt[] => Array.from({length: n}, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]);
const piece = (c: CanvasRenderingContext2D, fill: string, pts: Pt[], e: number, seed: number) => {
  c.save(); c.shadowColor = 'rgba(30,20,10,.3)'; c.shadowOffsetX = 5; c.shadowOffsetY = 8; c.shadowBlur = 10;
  c.translate((rand(`bx${seed}:${e}`) - 0.5) * 2.2, (rand(`by${seed}:${e}`) - 0.5) * 2.2); // boil per exposure, not per frame
  cutPoly(c, pts, seed); c.fillStyle = fill; c.fill(); c.restore();
};

export const S14PaperStopMotion: React.FC = () => (
  <AbsoluteFill>
    <CanvasComp w={1920} h={1080} draw={(c, f) => {
      const e = Math.floor((f * 12) / 30); // exposure index: puppets change pose 12x per second
      const st = f / 30; const u = 1 - Math.pow(1 - clamp(st / 4), 2.1); const z = mix(1.4, 1.05, u); // camera pull-out on ones
      const cam = (p: number) => { c.setTransform(2, 0, 0, 2, 0, 0); c.translate(480, 300); c.scale(1 + (z - 1) * p, 1 + (z - 1) * p); c.translate(-480 + (1 - u) * 50 * p, -300); };
      c.setTransform(2, 0, 0, 2, 0, 0); c.fillStyle = PAL.bg; c.fillRect(0, 0, 960, 540);
      cam(0.2); piece(c, PAL.sun, circlePts(740, 130, 62), e, 11);
      cam(0.35); piece(c, PAL.far, [[-80, 330], [120, 210], [300, 290], [520, 180], [760, 280], [1040, 200], [1040, 600], [-80, 600]], e, 1);
      cam(0.65); piece(c, PAL.mid, [[-60, 400], [200, 330], [460, 380], [700, 320], [1020, 390], [1020, 600], [-60, 600]], e, 2);
      // birds flap on 12s
      cam(0.5); for (let i = 0; i < 3; i++) { const bx = 180 + i * 70 + st * 30, by = 110 + i * 22; const up = (e + i) % 2 ? -12 : 6;
        piece(c, PAL.ink, [[bx - 22, by + up], [bx, by], [bx + 22, by + up], [bx, by + 6]], e, 30 + i); }
      cam(1);
      piece(c, PAL.cream, [[300, 470], [660, 470], [640, 500], [320, 500]], e, 5); // table cloth strip
      const beatT = st % 0.625; const sy = beatT < 0.1 ? 0.88 : 1; // kettle squashes on each note (96 BPM)
      c.save(); c.translate(480, 470); c.scale(1 / Math.sqrt(sy), sy);
      piece(c, PAL.red, [[-120, 0], [120, 0], [100, -150], [-100, -150]], e, 3);
      piece(c, PAL.ink, [[-60, -150], [60, -150], [40, -176], [-40, -176]], e, 6); // lid
      piece(c, PAL.ink, circlePts(0, -186, 12, 12), e, 7);
      c.restore();
      piece(c, PAL.red, [[575, 400], [650, 350], [662, 362], [590, 420]], e, 4); // spout
      piece(c, PAL.cream, [[330, 380], [360, 380], [360, 440], [330, 440]], e, 8);
      // verlet steam rope, simulated from frame 0 each render => deterministic
      const n = 12; let P: Pt[] = Array.from({length: n}, (_, i) => [655 + i * 12, 352]); const O: Pt[] = P.map((p) => [p[0], p[1]]);
      for (let s = 0; s <= f; s++) { for (let i = 1; i < n; i++) { const vx = (P[i][0] - O[i][0]) * 0.985, vy = (P[i][1] - O[i][1]) * 0.985; O[i] = [P[i][0], P[i][1]]; P[i] = [P[i][0] + vx + Math.sin(s * 0.3 + i) * 0.6, P[i][1] + vy - 0.35]; } P[0] = [656, 352];
        for (let it = 0; it < 8; it++) for (let i = 0; i < n - 1; i++) { const dx = P[i + 1][0] - P[i][0], dy = P[i + 1][1] - P[i][1]; const dd = Math.hypot(dx, dy) || 1; const k = (dd - 14) / dd / 2; if (i > 0) { P[i][0] += dx * k; P[i][1] += dy * k; } P[i + 1][0] -= dx * k; P[i + 1][1] -= dy * k; } }
      c.strokeStyle = PAL.cream; c.lineWidth = 10; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); P.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      // cut-paper title label
      c.setTransform(2, 0, 0, 2, 0, 0); piece(c, PAL.cream, [[60, 40], [330, 46], [326, 112], [64, 108]], e, 20);
      c.fillStyle = PAL.ink; c.font = '700 44px "Space Grotesk"'; c.fillText('slow morning', 88, 92);
      // post: grain re-rolled per exposure, flicker, vignette
      for (let i = 0; i < 1800; i++) { const x = rand(`gx${e}:${i}`) * 960, y = rand(`gy${e}:${i}`) * 540; c.fillStyle = rand(`gc${i}`) > 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.09)'; c.fillRect(x, y, 1.5, 1.5); }
      c.fillStyle = `rgba(0,0,0,${0.04 + (rand(`fl${e}`) - 0.5) * 0.04})`; c.fillRect(0, 0, 960, 540);
      const g = c.createRadialGradient(480, 270, 220, 480, 270, 640); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,20,10,.42)'); c.fillStyle = g; c.fillRect(0, 0, 960, 540);
    }} />
  </AbsoluteFill>
);
