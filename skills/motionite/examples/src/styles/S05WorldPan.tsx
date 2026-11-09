// NxrStyle 05 · One-Pan Flat World — a single continuous camera truck through a flat-vector street;
// the sky changes time of day with the camera x, a tally counter and receipt card ride on top.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, SPR, clamp, hitPulse, mix, prog, spr, tw} from '../lib/anim';
import {BlurWords, Fill} from './kit';

const SKY = [['#9fd3f2', '#e8f5fb'], ['#f6b37b', '#fde4c4'], ['#3a3f7a', '#e88a6b']]; // day -> golden -> dusk
const lerpHex = (a: string, b: string, t: number) => { const h = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)); const A = h(a), B = h(b);
  return `rgb(${A.map((v, i) => Math.round(mix(v, B[i], t))).join(',')})`; };
const SHOPS = [
  {x: 300, w: 420, h: 380, body: '#e9c46a', roof: '#c2553d', sign: 'WARUNG'},
  {x: 820, w: 360, h: 520, body: '#8fb9a8', roof: '#2f5d62', sign: 'KOPI'},
  {x: 1300, w: 480, h: 420, body: '#f1e3d3', roof: '#e07a5f', sign: 'BAKSO'},
  {x: 1900, w: 380, h: 560, body: '#b8a1d9', roof: '#5b4b8a', sign: 'PULSA'},
  {x: 2400, w: 460, h: 400, body: '#f4a261', roof: '#9c3d2b', sign: 'ROTI'},
  {x: 2980, w: 420, h: 500, body: '#90be6d', roof: '#386641', sign: 'BUAH'},
];
const PAYS = [40, 76, 112]; // each scan payment lands on a beat while we pass a shop

export const S05WorldPan: React.FC = () => {
  const f = useCurrentFrame();
  const camX = tw(f, 0, 150, 0, 1500, E.linear); // one take, constant speed: no cuts at all
  const t = clamp(camX / 1500) * 2; const k = Math.min(1, Math.floor(t)); const u = t - k;
  const top = lerpHex(SKY[k][0], SKY[Math.min(2, k + 1)][0], u), bot = lerpHex(SKY[k][1], SKY[Math.min(2, k + 1)][1], u);
  const count = PAYS.filter((p) => f >= p).length; const bump = hitPulse(f - (PAYS[count - 1] ?? -99), 1, 5);
  const walk = Math.sin(f * 0.5);
  return (
    <Fill bg={`linear-gradient(${top}, ${bot})`}>
      <div style={{position: 'absolute', left: 1500 - camX * 0.1, top: mix(150, 330, t / 2), width: 150, height: 150, borderRadius: 75, background: t > 1.2 ? '#ffe9b0' : '#fff6d6', boxShadow: '0 0 0 30px rgba(255,255,255,.18)'}} />
      {/* far layer (0.3x) */}
      {Array.from({length: 12}).map((_, i) => <div key={i} style={{position: 'absolute', left: i * 320 - camX * 0.3, bottom: 300, width: 260, height: 220 + (i % 3) * 70, background: 'rgba(60,70,110,.18)', borderRadius: '8px 8px 0 0'}} />)}
      {/* shop layer (1x) */}
      {SHOPS.map((s, i) => (
        <div key={i} style={{position: 'absolute', left: s.x - camX, bottom: 240, width: s.w, height: s.h}}>
          <div style={{position: 'absolute', inset: 0, background: s.body, borderRadius: 6}} />
          <div style={{position: 'absolute', left: -24, right: -24, top: -40, height: 60, background: s.roof, borderRadius: 10}} />
          <div style={{position: 'absolute', left: 40, right: 40, top: 50, height: 70, background: '#fff', borderRadius: 8, fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 40, textAlign: 'center', lineHeight: '70px', color: s.roof}}>{s.sign}</div>
          <div style={{position: 'absolute', left: 40, bottom: 0, width: 120, height: 170, background: s.roof, borderRadius: '60px 60px 0 0', opacity: 0.85}} />
          <div style={{position: 'absolute', right: 40, bottom: 70, width: s.w - 220, height: 120, background: t > 1.3 ? '#ffd98a' : '#dff1ff', borderRadius: 6, border: `8px solid ${s.roof}`}} />
        </div>
      ))}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 240, background: '#3d405b'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 200, height: 40, background: '#e0e1dd'}} />
      {Array.from({length: 20}).map((_, i) => <div key={i} style={{position: 'absolute', left: i * 220 - (camX * 1.0) % 220, bottom: 100, width: 110, height: 14, background: '#f2e9e4', borderRadius: 7}} />)}
      {/* our walker stays screen-locked: the world moves past them */}
      <div style={{position: 'absolute', left: 860, bottom: 230 + Math.abs(walk) * 10, width: 90, height: 190}}>
        <div style={{position: 'absolute', left: 20, top: 0, width: 54, height: 54, borderRadius: 27, background: '#3b2a20'}} />
        <div style={{position: 'absolute', left: 10, top: 50, width: 74, height: 90, borderRadius: 24, background: '#e63946'}} />
        <div style={{position: 'absolute', left: 18, top: 130, width: 18, height: 60, background: '#1d3557', transform: `rotate(${walk * 22}deg)`, transformOrigin: 'top'}} />
        <div style={{position: 'absolute', left: 54, top: 130, width: 18, height: 60, background: '#1d3557', transform: `rotate(${-walk * 22}deg)`, transformOrigin: 'top'}} />
      </div>
      {/* tally HUD */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 70, display: 'flex', justifyContent: 'center'}}>
        <div style={{padding: '18px 40px', borderRadius: 40, background: 'rgba(255,255,255,.92)', fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 44, color: '#1d3557', transform: `scale(${1 + 0.08 * bump})`}}>
          <span style={{color: '#e63946'}}>{count}×</span> Scan Pay today</div>
      </div>
      {PAYS.map((p, i) => { const s = spr(f, p, SPR.land); return f < p ? null : (
        <div key={p} style={{position: 'absolute', right: 80, top: 190 + i * 96, width: 420, padding: '18px 26px', borderRadius: 18, background: '#fff', boxShadow: '0 14px 30px rgba(0,0,0,.15)',
          fontFamily: 'Plus Jakarta Sans', fontSize: 28, display: 'flex', justifyContent: 'space-between', transform: `translateX(${(1 - s) * 480}px)`}}>
          <span style={{fontWeight: 700}}>{SHOPS[i * 2 + 1].sign.toLowerCase()}</span><span style={{color: '#2a9d8f', fontWeight: 800}}>−Rp {[18, 25, 12][i]}.000</span></div>); })}
      <BlurWords f={f} start={8} text="One street. One wallet. Zero cash." accent={[5]} accentColor="#ffd166"
        style={{position: 'absolute', left: 0, right: 0, bottom: 44, justifyContent: 'center', fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 50, color: '#fff'}} />
    </Fill>
  );
};
