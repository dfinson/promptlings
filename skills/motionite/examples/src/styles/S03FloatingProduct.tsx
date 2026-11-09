// NxrStyle 03 · Floating Product UI — real app UI as the hero: tilted phone in 3D, a giant number
// overlapping the device, chips that detach and float, a success card.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, SPR, clamp, lmix, mix, prog, rand, spr} from '../lib/anim';
import {BlurWords, Fill} from './kit';

const C = {bg: '#071316', glow: '#0f3a3f', cyan: '#3fe0d0', white: '#f4fbfa', dim: '#7fa3a3', phone: '#0d0f12', ui: '#f6f7f5'};

const Chip: React.FC<{label: string; f: number; t0: number; x: number; y: number; float?: boolean}> = ({label, f, t0, x, y, float}) => {
  const p = spr(f, t0, SPR.land); const lift = float ? spr(f, t0 + 18, SPR.soft) : 0;
  return (
    <div style={{position: 'absolute', left: x, top: y - lift * 60, transform: `scale(${mix(0.6, 1, p) * (1 + lift * 0.12)}) rotate(${lift * -4}deg)`, opacity: clamp(p * 2),
      padding: '20px 34px', borderRadius: 22, background: '#fff', color: '#0b1f22', fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 34,
      boxShadow: `0 ${10 + lift * 40}px ${20 + lift * 50}px rgba(0,0,0,${0.25 + lift * 0.2})`}}>{label}</div>
  );
};

export const S03FloatingProduct: React.FC = () => {
  const f = useCurrentFrame();
  const enter = spr(f, 0, SPR.heavy);
  const ry = mix(-34, -18, enter) + Math.sin(f / 40) * 2; // ambient life: phone keeps drifting
  const big = prog(f, 26, 40, E.out);
  const n = Math.round(mix(0, 54000, prog(f, 26, 56, E.out)));
  const swipe = prog(f, 70, 92, E.smooth);
  const done = spr(f, 94, SPR.land);
  return (
    <Fill bg={`radial-gradient(circle at 42% 46%, ${C.glow} 0%, ${C.bg} 62%)`}>
      <div style={{position: 'absolute', left: 90, top: 70, fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 32, color: C.white}}><span style={{color: C.cyan}}>›</span> Kopi Wallet</div>
      <div style={{position: 'absolute', right: 90, top: 76, fontFamily: 'Geist Mono', fontSize: 22, color: C.dim, letterSpacing: '0.2em'}}>STEP 02 / 04</div>
      {/* phone in 3D */}
      <div style={{position: 'absolute', left: 540, top: 90, perspective: 2200}}>
        <div style={{width: 410, height: 800, borderRadius: 64, background: C.phone, padding: 18, transform: `rotateY(${ry}deg) rotateX(8deg) rotateZ(4deg) translateY(${(1 - enter) * 300}px)`,
          boxShadow: '40px 60px 90px rgba(0,0,0,.55)', transformStyle: 'preserve-3d'}}>
          <div style={{width: '100%', height: '100%', borderRadius: 48, background: C.ui, overflow: 'hidden', position: 'relative', fontFamily: 'Plus Jakarta Sans'}}>
            <div style={{padding: '60px 36px 0', fontSize: 26, color: '#58706f', fontWeight: 600}}>Pay merchant</div>
            <div style={{padding: '6px 36px', fontSize: 38, fontWeight: 800, color: '#0b1f22'}}>Warung Bu Sari</div>
            <div style={{margin: '30px 36px', height: 300, borderRadius: 28, background: '#0b1f22', display: 'grid', gridTemplateColumns: 'repeat(9,1fr)', gap: 6, padding: 26}}>
              {Array.from({length: 81}).map((_, i) => { const x = i % 9, y = Math.floor(i / 9); const finder = (x < 3 && y < 3) || (x > 5 && y < 3) || (x < 3 && y > 5);
                const on = finder ? !(x % 6 === 1 && y % 6 === 1) : rand(`qr${i}`) > 0.5; return <div key={i} style={{background: on ? C.cyan : 'transparent', borderRadius: 3}} />; })}
            </div>
            <div style={{padding: '0 36px', fontSize: 24, color: '#58706f'}}>Amount</div>
            <div style={{padding: '0 36px', fontSize: 52, fontWeight: 800, color: '#0b1f22'}}>Rp {n.toLocaleString('id-ID')}</div>
            <div style={{position: 'absolute', left: 36, right: 36, bottom: 50, height: 92, borderRadius: 46, background: '#dfe9e7'}}>
              <div style={{position: 'absolute', left: 8 + swipe * 266, top: 8, width: 76, height: 76, borderRadius: 38, background: '#0b1f22', color: C.cyan, fontSize: 40, textAlign: 'center', lineHeight: '76px'}}>→</div>
              <div style={{textAlign: 'center', lineHeight: '92px', fontWeight: 700, fontSize: 26, color: '#58706f', opacity: 1 - swipe}}>Slide to pay</div>
            </div>
            {done > 0.01 && <div style={{position: 'absolute', inset: 0, background: C.cyan, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', clipPath: `circle(${done * 120}% at 50% 92%)`}}>
              <div style={{fontSize: 120, color: '#0b1f22'}}>✓</div><div style={{fontSize: 40, fontWeight: 800, color: '#0b1f22'}}>Paid</div></div>}
          </div>
        </div>
      </div>
      {/* giant number overlapping the device: the one idea of this beat */}
      <div style={{position: 'absolute', left: 860, top: 330, fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 210, letterSpacing: -8, color: C.white, lineHeight: 1,
        filter: `blur(${(1 - big) * 16}px)`, transform: `scale(${lmix(1.4, 1, big)})`, transformOrigin: 'left center', opacity: clamp(big * 1.5), textShadow: '0 20px 60px rgba(0,0,0,.5)'}}>
        54.000<span style={{fontSize: 90, color: C.cyan, marginLeft: 20}}>IDR</span>
      </div>
      <div style={{position: 'absolute', left: 870, top: 560, fontFamily: 'Geist Mono', fontSize: 34, color: C.dim, opacity: prog(f, 40, 50)}}>≈ 3.0312 USDC · fee 0</div>
      <Chip label="Scan Pay" f={f} t0={44} x={1330} y={680} float />
      <Chip label="+1 PTS cashback" f={f} t0={54} x={1180} y={800} />
      <BlurWords f={f} start={60} text="Scan, slide, done. No cash, no change." accent={[0, 1, 2]} accentColor={C.cyan}
        style={{position: 'absolute', left: 0, right: 0, bottom: 54, justifyContent: 'center', fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 48, color: C.white}} />
    </Fill>
  );
};
