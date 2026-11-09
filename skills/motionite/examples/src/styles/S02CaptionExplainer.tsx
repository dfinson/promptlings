// NxrStyle 02 · Night Caption Explainer — 9:16 VO explainer: near-black stage, karaoke captions,
// giant red count-up, polarity flip to paper with a rubber stamp.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, SPR, clamp, hitPulse, lmix, mix, prog, rand, spr} from '../lib/anim';
import {Fill} from './kit';

const C = {bg: '#0b0b0c', card: '#17171a', red: '#ff3b30', white: '#f5f5f2', grey: '#8a8a90', paper: '#ecebe6', ink: '#141414'};
// VO-first: caption words are timed to the voice (frame each word starts)
const WORDS: [string, number][] = [['He', 6], ['drained', 12], ['3.2', 22], ['million', 28], ['dollars', 36], ['in', 46], ['one', 50], ['block.', 56]];

export const S02CaptionExplainer: React.FC = () => {
  const f = useCurrentFrame();
  const flip = f >= 108; // polarity flip on the beat that changes the argument
  return flip ? <PaperBeat f={f - 108} /> : <NightBeat f={f} />;
};

const NightBeat: React.FC<{f: number}> = ({f}) => {
  const n = Math.round(mix(1803192, 3200000, prog(f, 22, 70, E.out)));
  const tick = hitPulse(f - 70, 1, 5);
  return (
    <Fill bg={`radial-gradient(ellipse at 50% 40%, #1a1a1d 0%, ${C.bg} 70%)`}>
      <div style={{position: 'absolute', top: 120, left: 0, right: 0, textAlign: 'center'}}>
        <span style={{fontFamily: 'Inter', fontWeight: 700, fontSize: 30, color: C.white, background: '#232327', padding: '14px 28px', borderRadius: 40}}>● NxrLabs Explains</span>
      </div>
      <div style={{position: 'absolute', top: 560, left: 80, right: 80, textAlign: 'center'}}>
        <div style={{fontFamily: 'Geist Mono', fontSize: 30, letterSpacing: '0.3em', color: C.grey}}>HACKER BALANCE</div>
        <div style={{fontFamily: 'Inter', fontWeight: 900, fontSize: 168, color: C.red, letterSpacing: -6, marginTop: 10, fontVariantNumeric: 'tabular-nums', transform: `scale(${1 + 0.06 * tick})`}}>${n.toLocaleString('en-US')}</div>
        {/* ledger bar fills to the number */}
        <div style={{margin: '26px auto 0', width: 760, height: 18, borderRadius: 9, background: '#26262a', overflow: 'hidden'}}>
          <div style={{width: `${prog(f, 22, 70, E.out) * 100}%`, height: '100%', background: C.red}} />
        </div>
        {[['Bridge contract', '−$1.8M'], ['Liquidity pool', '−$0.9M'], ['Hot wallet', '−$0.5M']].map(([a, v], i) => {
          const p = spr(f, 30 + i * 8, SPR.snap);
          return (
            <div key={a} style={{display: 'flex', justifyContent: 'space-between', margin: '22px auto 0', width: 760, padding: '26px 34px', background: C.card, borderRadius: 22, opacity: clamp(p * 1.5), transform: `translateY(${(1 - p) * 40}px)`,
              fontFamily: 'Inter', fontSize: 38, color: C.white}}><span>{a}</span><span style={{color: C.red, fontWeight: 800}}>{v}</span></div>
          );
        })}
      </div>
      {/* karaoke caption: bottom third, current word white + bold, spoken words grey */}
      <div style={{position: 'absolute', bottom: 330, left: 90, right: 90, textAlign: 'center', fontFamily: 'Inter', fontWeight: 800, fontSize: 76, lineHeight: 1.15}}>
        {WORDS.map(([w, t], i) => {
          const on = f >= t; const cur = on && (i === WORDS.length - 1 || f < WORDS[i + 1][1]);
          return <span key={i} style={{color: cur ? C.white : on ? '#6d6d72' : 'transparent', marginRight: 22, display: 'inline-block', transform: `scale(${cur ? 1.06 : 1})`}}>{w}</span>;
        })}
      </div>
      <div style={{position: 'absolute', bottom: 160, left: 0, right: 0, textAlign: 'center'}}>
        <span style={{fontFamily: 'Inter', fontWeight: 800, fontSize: 34, color: C.bg, background: C.red, padding: '16px 34px', borderRadius: 12, opacity: prog(f, 80, 86)}}>THE FATAL MISTAKE ↓</span>
      </div>
    </Fill>
  );
};

const PaperBeat: React.FC<{f: number}> = ({f}) => {
  const st = prog(f, 14, 18, E.in); // stamp lands in 4f with a 1.6 -> 1 log scale
  const kick = hitPulse(f - 18, 1, 4) * 14;
  return (
    <Fill bg={C.paper} style={{transform: `translateY(${kick}px)`}}>
      <div style={{position: 'absolute', top: 170, left: 0, right: 0, textAlign: 'center', fontFamily: 'Geist Mono', fontSize: 30, letterSpacing: '0.3em', color: '#6b6b66'}}>MEANWHILE · ON-CHAIN</div>
      <div style={{position: 'absolute', top: 520, left: 110, right: 110, padding: 60, background: '#fff', borderRadius: 30, boxShadow: '0 30px 70px rgba(0,0,0,.12)'}}>
        <div style={{fontFamily: 'Inter', fontSize: 34, color: '#777'}}>Your wallet</div>
        <div style={{fontFamily: 'Inter', fontWeight: 900, fontSize: 120, color: C.ink, letterSpacing: -4}}>−3,000 USDT</div>
        <div style={{fontFamily: 'Geist Mono', fontSize: 26, color: '#999', marginTop: 10}}>tx 0x9f…e21 · block 19,204,118</div>
      </div>
      <div style={{position: 'absolute', top: 980, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: st > 0 ? 1 : 0}}>
        <div style={{border: `10px solid ${C.red}`, color: C.red, fontFamily: 'Inter', fontWeight: 900, fontSize: 92, padding: '10px 40px', borderRadius: 14, letterSpacing: 4,
          transform: `rotate(-8deg) scale(${lmix(1.6, 1, st)})`, filter: `url(#rough)`}}>IRREVERSIBLE</div>
      </div>
      <svg width={0} height={0}><filter id="rough"><feTurbulence baseFrequency="0.9" numOctaves={2} seed={Math.floor(rand(3) * 9)} /><feDisplacementMap in="SourceGraphic" scale={6} /></filter></svg>
      <div style={{position: 'absolute', bottom: 330, left: 90, right: 90, textAlign: 'center', fontFamily: 'Inter', fontWeight: 800, fontSize: 76, color: C.ink}}>
        No undo. <span style={{color: C.red}}>No refund.</span>
      </div>
    </Fill>
  );
};
