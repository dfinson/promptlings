// Hand-drawn, stop-motion, texture and procedural techniques (canvas / svg)
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, clamp, hitPulse, mix, onTwos, prog, rand, tw} from '../lib/anim';
import {CanvasComp} from '../lib/canvas';
import {Center, Stage} from '../lib/ui';

/** H01 self-drawing line + boil on twos + Caveat marker note */
export const SelfDrawBoil: React.FC = () => {
  const f = useCurrentFrame(); const d = onTwos(f, 2) / 2; // drawing index changes every 2 frames (12 drawings/s)
  const jit = (i: number, amp = 2.2) => (rand(`${d}:${i}`) - 0.5) * 2 * amp;
  const N = 40; const pts = Array.from({length: N}).map((_, i) => { const t = i / (N - 1); return [140 + t * 680 + jit(i), 330 - Math.sin(t * Math.PI * 1.2) * 150 + t * 40 + jit(i + 99)]; });
  const path = 'M' + pts.map((p) => p.join(',')).join(' L');
  const draw = prog(onTwos(f, 2), 2, 34, E.smooth); // the draw-on itself also advances on twos
  const circ = Array.from({length: 30}).map((_, i) => { const a = (i / 29) * Math.PI * 2.1 - 0.4; return `${700 + Math.cos(a) * (70 + jit(i + 200, 3))},${150 + Math.sin(a) * (44 + jit(i + 300, 3))}`; }).join(' L');
  const note = prog(onTwos(f, 2), 36, 54, E.linear);
  return (
    <Stage bg="#f4efe3">
      <svg width={960} height={540} style={{position: 'absolute'}}>
        <path d={path} stroke="#222" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        <path d={'M' + circ} stroke="#e8412e" strokeWidth={4} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog(onTwos(f, 2), 30, 40, E.out)} />
        <text x={560} y={70} fontFamily="Caveat" fontSize={46} fill="none" stroke="#e8412e" strokeWidth={1.5} pathLength={1} strokeDasharray={600} strokeDashoffset={600 * (1 - note)}>the peak!</text>
        <text x={560} y={70} fontFamily="Caveat" fontSize={46} fill="#e8412e" opacity={clamp((note - 0.7) / 0.3)}>the peak!</text>
      </svg>
      <div style={{position: 'absolute', left: 20, bottom: 14, fontFamily: 'Geist Mono', fontSize: 12, color: '#777'}}>boil on twos · drawing #{d}</div>
    </Stage>
  );
};

// ----- cut-paper helpers -----
const noise1 = (x: number, s: number) => { const i = Math.floor(x), u = x - i; const a = rand(`${s}:${i}`), b = rand(`${s}:${i + 1}`); return mix(a, b, u * u * (3 - 2 * u)); };
const cutRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) => { // noise-nudged cut-paper edge
  const P: [number, number][] = []; const step = 16; const amp = 1.2;
  const push = (px: number, py: number, k: number) => P.push([px + (noise1(k * 0.7, seed) - 0.5) * 2 * amp * 2, py + (noise1(k * 0.7, seed + 9) - 0.5) * 2 * amp * 2]);
  let k = 0; for (let t = 0; t <= w; t += step) push(x + t, y, k++); for (let t = 0; t <= h; t += step) push(x + w, y + t, k++);
  for (let t = w; t >= 0; t -= step) push(x + t, y + h, k++); for (let t = h; t >= 0; t -= step) push(x, y + t, k++);
  c.beginPath(); P.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath();
};
const paper = (c: CanvasRenderingContext2D, fill: string, draw: () => void, e: number, seed: number) => {
  c.save(); // contact shadow
  c.shadowColor = 'rgba(30,20,10,.3)'; c.shadowOffsetX = 6; c.shadowOffsetY = 9; c.shadowBlur = 11;
  // boil per exposure: ±1.1px jitter, ±.003 rad
  c.translate((rand(`bx${seed}:${e}`) - 0.5) * 2.2, (rand(`by${seed}:${e}`) - 0.5) * 2.2); c.rotate((rand(`br${seed}:${e}`) - 0.5) * 0.006);
  draw(); c.fillStyle = fill; c.fill(); c.restore();
};

/** H02 paper cut-out stop-motion: puppets on 12 poses/s, camera moves every frame, parallax, grain + flicker + vignette */
export const PaperStopMotion: React.FC = () => (
  <CanvasComp draw={(c, f) => {
    const e = Math.floor((f * 12) / 30); // exposure index: 12 poses per second
    const st = f / 30; const u = 1 - Math.pow(1 - clamp(st / 2.5), 2.1); const z = mix(1.52, 1.1, u); // cam(st) pull-out
    const cam = (p: number) => { c.setTransform(1, 0, 0, 1, 0, 0); c.translate(480, 300); c.scale(1 + (z - 1) * p, 1 + (z - 1) * p); c.translate(-480 + (1 - u) * 40 * p, -300); }; // setCam(c,cam,p) parallax
    c.fillStyle = '#efe4cc'; c.fillRect(0, 0, 960, 540);
    cam(0.3); paper(c, '#7fb7b0', () => cutRect(c, -60, 60, 1100, 260, 1), e, 1); // far hills
    cam(0.6); paper(c, '#2f6f73', () => cutRect(c, -40, 300, 1050, 260, 2), e, 2);
    cam(1);
    // kettle body squashes on the "note" (beat at 96 BPM = every 0.625 s); sy .88 for 0.1s
    const beatT = st % 0.625; const sy = beatT < 0.1 ? 0.88 : 1;
    c.save(); c.translate(480, 360); c.scale(1 / Math.sqrt(sy), sy); paper(c, '#d94b3d', () => cutRect(c, -110, -150, 220, 150, 3), e, 3); c.restore();
    paper(c, '#d94b3d', () => cutRect(c, 560, 260, 70, 22, 4), e, 4); // spout
    // verlet rope (steam string) simulated from frame 0 every render => deterministic
    const n = 10; let P = Array.from({length: n}).map((_, i) => [580 + i * 12, 250]); let O = P.map((p) => [...p]);
    for (let s = 0; s <= f; s++) { const ax = 600, ay = 255; for (let i = 1; i < n; i++) { const vx = (P[i][0] - O[i][0]) * 0.985, vy = (P[i][1] - O[i][1]) * 0.985; O[i] = [...P[i]]; P[i] = [P[i][0] + vx + Math.sin(s * 0.3 + i) * 0.6, P[i][1] + vy - 0.35]; } P[0] = [ax, ay];
      for (let it = 0; it < 8; it++) for (let i = 0; i < n - 1; i++) { const dx = P[i + 1][0] - P[i][0], dy = P[i + 1][1] - P[i][1]; const dd = Math.hypot(dx, dy) || 1; const k = (dd - 14) / dd / 2; if (i > 0) { P[i][0] += dx * k; P[i][1] += dy * k; } P[i + 1][0] -= dx * k; P[i + 1][1] -= dy * k; } }
    c.strokeStyle = '#fbf6ea'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); P.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    c.setTransform(1, 0, 0, 1, 0, 0);
    // post: grain re-offset per exposure, flicker, vignette
    for (let i = 0; i < 1400; i++) { const x = rand(`gx${e}:${i}`) * 960, y = rand(`gy${e}:${i}`) * 540; c.fillStyle = rand(`gc${i}`) > 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.08)'; c.fillRect(x, y, 2, 2); }
    c.fillStyle = `rgba(0,0,0,${0.05 + (rand(`fl${e}`) - 0.5) * 0.05})`; c.fillRect(0, 0, 960, 540);
    const g = c.createRadialGradient(480, 270, 200, 480, 270, 620); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,20,10,.45)'); c.fillStyle = g; c.fillRect(0, 0, 960, 540);
  }} />
);

/** H03 riso halftone plates with misregistration */
export const RisoHalftone: React.FC = () => (
  <CanvasComp draw={(c, f) => {
    c.fillStyle = '#f2ead8'; c.fillRect(0, 0, 960, 540); const card = Math.floor(f / 7.5); // montage card every 0.25 s
    const plates: [string, number, number, number][] = [['rgba(255,72,120,.85)', 15, 3, -2], ['rgba(0,120,190,.8)', 75, -3, 2], ['rgba(250,200,0,.75)', 0, 1, 3]];
    c.globalCompositeOperation = 'multiply';
    plates.forEach(([col, ang, ox, oy], pi) => {
      const mis = (rand(`m${card}:${pi}`) - 0.5) * 6; c.save(); c.translate(480 + ox + mis, 270 + oy - mis); c.rotate((ang * Math.PI) / 180); c.fillStyle = col;
      const step = 9; for (let y = -420; y < 420; y += step) for (let x = -560; x < 560; x += step) {
        const cs = Math.cos((-ang * Math.PI) / 180), sn = Math.sin((-ang * Math.PI) / 180); const wx = x * cs - y * sn, wy = x * sn + y * cs; // back to screen-space
        const shape = card % 2 ? Math.hypot(wx + 60 * (pi - 1), wy) / 220 : Math.max(Math.abs(wx) / 300, Math.abs(wy - 20 * pi) / 160);
        const tone = clamp(1.15 - shape) * (0.5 + 0.5 * Math.sin(wx / 90 + pi + card));
        const r = (step / 2) * Math.sqrt(clamp(tone)); if (r > 0.4) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); } }
      c.restore();
    });
    c.globalCompositeOperation = 'source-over';
  }} />
);

/** H04 mosaic resolve: block size 48->24->12->6->3->1 holding 1 frame each @30 */
export const MosaicResolve: React.FC = () => (
  <CanvasComp draw={(c, f) => {
    const sizes = [48, 24, 12, 6, 3, 1]; const k = clamp(Math.floor((f - 20) / 1), 0, sizes.length - 1); const s = f < 20 ? 48 : sizes[k];
    const off = new OffscreenCanvas(960, 540); const o = off.getContext('2d')!;
    const g = o.createLinearGradient(0, 0, 960, 540); g.addColorStop(0, '#ff4a1c'); g.addColorStop(1, '#2f6bff'); o.fillStyle = g; o.fillRect(0, 0, 960, 540);
    o.fillStyle = '#fff'; o.font = '900 150px Montserrat'; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText('RESOLVE', 480, 270);
    const sm = new OffscreenCanvas(Math.ceil(960 / s), Math.ceil(540 / s)); const sc = sm.getContext('2d')!; sc.drawImage(off, 0, 0, sm.width, sm.height);
    c.imageSmoothingEnabled = false; c.drawImage(sm, 0, 0, sm.width * s, sm.height * s);
  }} />
);

/** H05 dot-grid wave: halftone dots respond to a travelling dot */
export const DotGridWave: React.FC = () => (
  <CanvasComp draw={(c, f) => {
    c.fillStyle = '#f3efe4'; c.fillRect(0, 0, 960, 540);
    const hx = tw(f, 0, 74, 120, 840, E.smooth), hy = 270 + Math.sin(f / 9) * 90;
    for (let y = 18; y < 540; y += 24) for (let x = 18; x < 960; x += 24) {
      const d = Math.hypot(x - hx, y - hy); const w = Math.sin(d / 28 - f / 3) * 0.5 + 0.5; const r = 1.5 + 8 * w * Math.exp(-d / 260);
      c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#e8412e'; c.beginPath(); c.arc(hx, hy, 18, 0, Math.PI * 2); c.fill();
  }} />
);

/** H06 cadence comparison: same move on ones, on twos, and stop-motion on 2.5s (12 poses/s); textures stay still */
export const CadenceCompare: React.FC = () => {
  const f = useCurrentFrame();
  const x = (fr: number) => tw(fr, 4, 66, 140, 820, E.smooth);
  const rows: [string, number][] = [['ones (30/s)', f], ['twos (15/s)', onTwos(f, 2)], ['stop-motion 12/s', Math.floor(Math.floor((f * 12) / 30) * 2.5)]];
  return (
    <Stage bg="#121215">
      {rows.map(([l, fr], i) => <React.Fragment key={l}>
        <div style={{position: 'absolute', left: 20, top: 110 + i * 150, color: '#888', fontFamily: 'Geist Mono', fontSize: 14}}>{l}</div>
        <div style={{position: 'absolute', left: x(fr) - 30, top: 130 + i * 150, width: 60, height: 60, borderRadius: 30, background: ['#29f0c6', '#f5c518', '#ff4a1c'][i]}} /></React.Fragment>)}
    </Stage>
  );
};

/** H07 particle burst from a card + light dust: a deliberate rule-break, used once as a payoff */
export const ParticleBurst: React.FC = () => (
  <CanvasComp draw={(c, f) => {
    c.fillStyle = '#101014'; c.fillRect(0, 0, 960, 540); const t0 = 16; const t = Math.max(0, f - t0) / 30;
    const card = f < t0 ? 1 : Math.max(0, 1 - (f - t0) / 4);
    if (card > 0) { c.save(); c.globalAlpha = card; c.fillStyle = '#26262e'; c.translate(480, 270); c.scale(1 + 0.1 * hitPulse(f - t0, 1, 3), 1); c.fillRect(-120, -80, 240, 160); c.fillStyle = '#fff'; c.font = '800 48px Inter'; c.textAlign = 'center'; c.fillText('$500', 0, 16); c.restore(); }
    if (f >= t0) for (let i = 0; i < 260; i++) {
      const a = rand(`a${i}`) * Math.PI * 2, v = 120 + rand(`v${i}`) * 520, drag = 2.2; const s = (v / drag) * (1 - Math.exp(-drag * t)); // closed-form drag
      const x = 480 + Math.cos(a) * s, y = 270 + Math.sin(a) * s + 60 * t * t; const life = clamp(1 - t / (0.8 + rand(`l${i}`) * 1.2));
      c.fillStyle = `rgba(${rand(`c${i}`) > 0.3 ? '46,204,113' : '255,255,255'},${life})`; const r = 1 + rand(`r${i}`) * 3; c.fillRect(x - r / 2, y - r / 2, r, r); }
    if (f >= t0 + 8) { c.fillStyle = `rgba(46,204,113,${prog(f, t0 + 8, t0 + 14)})`; c.font = '800 96px Inter'; c.textAlign = 'center'; c.fillText('$0', 480, 300); }
  }} />
);

/** H08 point-sphere -> wireframe cube projected by hand: rotate, perspective divide, depth-sorted alpha */
export const PointSphereCube: React.FC = () => (
  <CanvasComp draw={(c, f) => {
    c.fillStyle = '#0e0e10'; c.fillRect(0, 0, 960, 540); const ay = f * 0.04, ax = 0.4; const m = prog(f, 30, 50, E.inOut);
    const proj = (x: number, y: number, z: number) => { const x1 = x * Math.cos(ay) + z * Math.sin(ay), z1 = -x * Math.sin(ay) + z * Math.cos(ay); const y1 = y * Math.cos(ax) - z1 * Math.sin(ax), z2 = y * Math.sin(ax) + z1 * Math.cos(ax); const k = 700 / (700 + z2); return [480 + x1 * k, 270 + y1 * k, z2] as const; };
    const N = 500; for (let i = 0; i < N; i++) { // fibonacci sphere morphing to cube surface
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996; let px = Math.cos(th) * r, py = y, pz = Math.sin(th) * r;
      const mx = Math.max(Math.abs(px), Math.abs(py), Math.abs(pz)); px = mix(px, px / mx, m); py = mix(py, py / mx, m); pz = mix(pz, pz / mx, m);
      const [sx, sy, sz] = proj(px * 170, py * 170, pz * 170); c.fillStyle = `rgba(80,140,255,${mix(1, 0.25, (sz + 170) / 340)})`; c.fillRect(sx - 1.5, sy - 1.5, 3, 3); }
    if (m > 0.9) { const V = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => proj(x * 170, y * 170, z * 170)))); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.5;
      for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) if ([1, 2, 4].includes(a ^ b)) { c.beginPath(); c.moveTo(V[a][0], V[a][1]); c.lineTo(V[b][0], V[b][1]); c.stroke(); } }
  }} />
);
