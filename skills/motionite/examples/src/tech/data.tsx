// Numbers and data techniques
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, SPR, clamp, hitPulse, mix, prog, rand, spr, tw} from '../lib/anim';
import {Center, Stage} from '../lib/ui';

/** D01 scramble counter with motion-blur ghosting, lands on the real value */
export const ScrambleCounter: React.FC = () => {
  const f = useCurrentFrame();
  const land = 40; const val = (k: number) => Math.floor(1000 + rand(`n${k}`) * 8999);
  const k = Math.floor(f / 2); // new random value every 2f (on twos)
  const settled = f >= land;
  const n = settled ? 5555 : val(k);
  const prev = val(k - 1), prev2 = val(k - 2);
  const pop = settled ? 1 + 0.12 * hitPulse(f - land, 1, 5) : 1;
  const fmt = (x: number) => x.toLocaleString('en-US');
  return (
    <Stage bg="#eef3fb">
      {Array.from({length: 120}).map((_, i) => <div key={i} style={{position: 'absolute', left: (i % 20) * 48 + 4, top: Math.floor(i / 20) * 90 + 10 - f * 0.4, width: 40, height: 80, borderRadius: 6, background: ['#c9d6f0', '#d8e2f4', '#bfcde9'][i % 3]}} />)}
      <Center style={{flexDirection: 'column'}}>
        <div style={{fontFamily: 'Anton', fontSize: 26, color: '#0f1b33', letterSpacing: 2}}>NXR <span style={{color: '#3366ff'}}>BOTS</span></div>
        <div style={{position: 'relative', fontFamily: 'Anton', fontSize: 190, color: '#0f1b33', fontVariantNumeric: 'tabular-nums', transform: `scale(${pop})`}}>
          {!settled && <div style={{position: 'absolute', opacity: 0.3, transform: 'translateY(-26px)', filter: 'blur(3px)'}}>{fmt(prev)}</div>}
          {!settled && <div style={{position: 'absolute', opacity: 0.15, transform: 'translateY(-52px)', filter: 'blur(5px)'}}>{fmt(prev2)}</div>}
          <div style={{filter: settled ? 'none' : 'blur(1.5px)'}}>{fmt(n)}</div>
        </div>
      </Center>
    </Stage>
  );
};

/** D02 digit reel with detent: each column rolls like a slot reel and clicks into place */
export const DigitReel: React.FC = () => {
  const f = useCurrentFrame();
  const target = '250000000'; const H = 150;
  return (
    <Stage bg="#f3f2ee">
      <Center style={{flexDirection: 'row'}}>
        {[...target].map((d, i) => {
          const t0 = 6 + i * 3; const spins = 2 + i % 3; // full turns before landing
          const p = spr(f, t0, SPR.detent); // detent spring: tiny overshoot = the click
          const pos = (spins * 10 + Number(d)) * p; const frac = pos % 10;
          const comma = i === 2 || i === 5;
          return <React.Fragment key={i}>
            <div style={{height: H, overflow: 'hidden', width: 92, fontFamily: 'Newsreader', fontSize: 150, lineHeight: `${H}px`, color: '#111', textAlign: 'center'}}>
              <div style={{transform: `translateY(${-frac * H}px)`}}>{Array.from({length: 11}).map((_, k) => <div key={k}>{k % 10}</div>)}</div>
            </div>
            {comma && <div style={{fontFamily: 'Newsreader', fontSize: 150, lineHeight: `${H}px`}}>,</div>}
          </React.Fragment>;
        })}
        <div style={{fontFamily: 'Newsreader', fontSize: 120, background: '#f5f53a', marginLeft: 6, lineHeight: '120px', opacity: prog(f, 40, 46)}}>+</div>
      </Center>
    </Stage>
  );
};

/** D03 strike line + count down + land on $0 */
export const StrikeCountdown: React.FC = () => {
  const f = useCurrentFrame();
  const panel = spr(f, 0, SPR.pop);
  const strike = prog(f, 12, 17, E.ui);
  const seq = [6000, 5670, 4310, 2080, 520, 0];
  const k = clamp(Math.floor((f - 18) / 5), 0, seq.length - 1); const v = f < 18 ? 6000 : seq[k];
  const landed = v === 0; const landF = 18 + 5 * 5;
  const pop = landed ? mix(0.6, 1, spr(f, landF, SPR.pop)) : 1;
  return (
    <Stage bg="#1b1b1f">
      {Array.from({length: 12}).map((_, i) => <div key={i} style={{position: 'absolute', left: 40 + (i % 4) * 225, top: 30 + Math.floor(i / 4) * 165, width: 210, height: 150, borderRadius: 14, background: '#2a2a30', opacity: 0.4}} />)}
      <Center>
        <div style={{width: 520, height: 300, borderRadius: 28, background: '#0b0b0d', transform: `scale(${panel})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 30px 80px rgba(0,0,0,.5)'}}>
          <div style={{color: '#8a8a90', fontSize: 22, fontWeight: 600}}>12 × $500 =</div>
          <div style={{position: 'relative', fontSize: 120, fontWeight: 800, color: landed ? '#2ecc71' : '#fff', transform: `scale(${pop})`, fontVariantNumeric: 'tabular-nums', textShadow: landed ? '0 0 30px rgba(46,204,113,.6)' : 'none'}}>
            ${v.toLocaleString('en-US')}
            {!landed && <div style={{position: 'absolute', left: -10, right: -10, top: '52%', height: 8, background: '#e5484d', transformOrigin: 'left', transform: `scaleX(${strike})`}} />}
          </div>
          <div style={{color: '#cfcfd4', fontSize: 18, opacity: prog(f, landF + 15, landF + 22)}}>12 more effects. 12 free repos.</div>
        </div>
      </Center>
    </Stage>
  );
};

/** D04 spring graph: the dot and the curve come from the same spring function */
export const SpringGraph: React.FC = () => {
  const f = useCurrentFrame();
  const x0 = 180, x1 = 800, y0 = 420, y1 = 170; const N = 60; const T = 50;
  const yAt = (t: number) => mix(y0, y1, spr(t, 0, SPR.pop));
  const head = clamp(f / T) * N;
  const pts = Array.from({length: Math.floor(head) + 1}).map((_, i) => `${x0 + (i / N) * (x1 - x0)},${yAt((i / N) * T)}`).join(' ');
  const hx = x0 + (head / N) * (x1 - x0), hy = yAt((head / N) * T);
  return (
    <Stage bg="#f5f5f2">
      <svg width={960} height={540} style={{position: 'absolute'}}>
        <line x1={x0} y1={y0} x2={x1} y2={y0} stroke="#111" strokeWidth={2} /><line x1={x0} y1={y0} x2={x0} y2={110} stroke="#111" strokeWidth={2} />
        <line x1={x0} y1={y1} x2={x1} y2={y1} stroke="#bbb" strokeDasharray="6 6" />
        <polyline points={pts} fill="none" stroke="#111" strokeWidth={3} />
        <circle cx={hx} cy={hy} r={12} fill="#ff4a1c" />
      </svg>
      <div style={{position: 'absolute', left: hx + 18, top: hy - 50, fontWeight: 800, fontSize: 34, opacity: prog(f, 30, 38)}}>+22%</div>
    </Stage>
  );
};

/** D05 ledger rows stacking + progress bar that turns red */
export const LedgerStack: React.FC = () => {
  const f = useCurrentFrame();
  const rows = [['Case #1', '$2.000'], ['Case #2', '$12.000'], ['Case #3', '$40.000']];
  const bar = tw(f, 40, 66, 0.42, 0.91, E.smooth);
  return (
    <Stage bg="#0a0a0a">
      <div style={{position: 'absolute', left: 300, top: 70, width: 360}}>
        {rows.map(([a, b], i) => {
          const t0 = 4 + i * 10; const p = spr(f, t0, SPR.snap);
          const red = i === 2;
          return <div key={i} style={{display: 'flex', justifyContent: 'space-between', padding: '14px 18px', marginBottom: 10, borderRadius: 10, background: red ? '#3a1215' : '#1a1a1c', color: red ? '#ff6b6b' : '#ddd', fontSize: 24, fontWeight: 700, opacity: p, transform: `translateY(${(1 - p) * 30}px)`}}><span>{a}</span><span>{b}</span></div>;
        })}
        <div style={{marginTop: 40, color: '#888', fontSize: 14, letterSpacing: 2}}>RISIKO KETANGKEP</div>
        <div style={{height: 10, borderRadius: 5, background: '#222', marginTop: 8}}><div style={{width: `${bar * 100}%`, height: '100%', borderRadius: 5, background: bar > 0.7 ? '#e5484d' : '#3b82f6'}} /></div>
        <div style={{textAlign: 'center', fontSize: 64, fontWeight: 800, color: bar > 0.7 ? '#e5484d' : '#3b82f6', marginTop: 10}}>{Math.round(bar * 100)}%</div>
      </div>
    </Stage>
  );
};

/** D06 node graph: hub + nodes pop on stagger, edges draw out from the hub */
export const NodeGraph: React.FC = () => {
  const f = useCurrentFrame();
  const cx = 480, cy = 270; const n = 8;
  return (
    <Stage bg="#ecebe6">
      <svg width={960} height={540} style={{position: 'absolute'}}>
        {Array.from({length: n}).map((_, i) => {
          const a = (i / n) * Math.PI * 2 + 0.3; const r = 190 + rand(i) * 50; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.75;
          const pn = spr(f, 4 + i * 2, SPR.pop); const pe = prog(f, 26 + i * 3, 36 + i * 3, E.out);
          return <g key={i}><line x1={cx} y1={cy} x2={mix(cx, x, pe)} y2={mix(cy, y, pe)} stroke="#7c8cf8" strokeWidth={2} />
            <circle cx={x} cy={y} r={14 * pn} fill="#111" /></g>;
        })}
        <circle cx={cx} cy={cy} r={30 * spr(f, 0, SPR.pop)} fill="#111" stroke="#e5484d" strokeWidth={6} />
      </svg>
      <div style={{position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', fontSize: 26, fontWeight: 600, color: '#333'}}>Analis tinggal nyambungin <b style={{color: '#111'}}>titiknya.</b></div>
    </Stage>
  );
};

/** D07 ease-out count-up with tally receipt */
export const TallyCounter: React.FC = () => {
  const f = useCurrentFrame();
  const ticks = [6, 22, 38, 54];
  const n = ticks.filter((t) => f >= t).length;
  const last = ticks[Math.max(0, n - 1)];
  const pop = 1 + 0.18 * hitPulse(f - last, 1, 4);
  const pts = Math.round(tw(f, 50, 64, 0, 12, E.type));
  return (
    <Stage bg="linear-gradient(#7fb2e5,#cfe3f5)">
      <div style={{position: 'absolute', top: 40, width: '100%', textAlign: 'center', fontSize: 64, fontWeight: 800, color: '#0b2545'}}><span style={{display: 'inline-block', transform: `scale(${pop})`}}>{n}×</span> Scan Pay</div>
      <div style={{position: 'absolute', right: 60, top: 140, width: 260, background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 20px 40px rgba(0,0,0,.15)'}}>
        <div style={{fontSize: 14, fontWeight: 700, marginBottom: 8}}>Riwayat</div>
        {ticks.slice(0, n).map((t, i) => { const p = spr(f, t, SPR.snap); return <div key={i} style={{display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0', borderTop: '1px solid #eee', opacity: p, transform: `translateX(${(1 - p) * 20}px)`}}><span>Scan Pay #{i + 1}</span><span style={{color: '#0aa'}}>+3 PTS</span></div>; })}
      </div>
      <div style={{position: 'absolute', left: 90, bottom: 80, fontSize: 110, fontWeight: 800, color: '#0b2545', opacity: prog(f, 48, 54)}}>{pts} <span style={{color: '#0aa'}}>PTS</span></div>
    </Stage>
  );
};
