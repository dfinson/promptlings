// NxrStyle 04 · Editorial Ink — off-white page, serif that inks grey -> black word by word, a yellow
// highlighter swipe, product UI presented as a printed document, a counter with a coloured plus.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, SPR, clamp, mix, prog, spr} from '../lib/anim';
import {Fill} from './kit';

const C = {paper: '#f3f2ee', ink: '#141414', grey: '#b9b7b0', hi: '#f5f53a', rule: '#dcdad3', red: '#d8432f'};
const LINE1 = ['Every', 'receipt', 'is'], LINE2 = ['written', 'by', 'people.'];

const Ink: React.FC<{w: string; f: number; t: number}> = ({w, f, t}) => {
  const p = prog(f, t, t + 8, E.out);
  const col = p < 1 ? `rgb(${mix(185, 20, p)},${mix(183, 20, p)},${mix(176, 20, p)})` : C.ink;
  return <span style={{color: col, display: 'inline-block', marginRight: 26, transform: `translateY(${(1 - p) * 10}px)`}}>{w}</span>;
};

export const S04EditorialInk: React.FC = () => {
  const f = useCurrentFrame();
  const hl = prog(f, 40, 52, E.inOut);
  const card = spr(f, 24, SPR.soft);
  const n = Math.round(mix(0, 250, prog(f, 50, 90, E.out)));
  return (
    <Fill bg={C.paper}>
      <div style={{position: 'absolute', left: 110, top: 80, right: 110, display: 'flex', justifyContent: 'space-between', fontFamily: 'Inter', fontSize: 22, color: '#77756e', borderBottom: `2px solid ${C.rule}`, paddingBottom: 18}}>
        <span style={{fontWeight: 600, color: C.ink}}>The Receipt Journal</span><span>Issue 06 · Field notes on proof</span><span>p. 14</span>
      </div>
      <div style={{position: 'absolute', left: 110, top: 220, width: 880, fontFamily: 'Newsreader', fontSize: 112, lineHeight: 1.05, letterSpacing: -2}}>
        <div>{LINE1.map((w, i) => <Ink key={w} w={w} f={f} t={4 + i * 5} />)}</div>
        <div style={{position: 'relative'}}>
          <div style={{position: 'absolute', left: -10, top: 26, height: 96, width: `${hl * 770}px`, background: C.hi, zIndex: 0}} />
          <span style={{position: 'relative', fontStyle: 'italic'}}>{LINE2.map((w, i) => <Ink key={w} w={w} f={f} t={20 + i * 5} />)}</span>
        </div>
        <div style={{fontFamily: 'Inter', fontSize: 30, lineHeight: 1.45, color: '#6f6d66', letterSpacing: 0, marginTop: 40, width: 700, opacity: prog(f, 36, 48), filter: `blur(${(1 - prog(f, 36, 44)) * 8}px)`}}>
          A short film about the humans who check every line before a payout goes out. No robots. Just people with yellow pens.
        </div>
      </div>
      {/* UI shown as a printed document card */}
      <div style={{position: 'absolute', left: 1130, top: 210, width: 680, background: '#fff', border: `2px solid ${C.rule}`, borderRadius: 6, padding: '42px 48px', fontFamily: 'Inter',
        transform: `translateY(${(1 - card) * 120}px) rotate(${mix(4, 1.5, card)}deg)`, opacity: clamp(card * 2), boxShadow: '0 24px 50px rgba(20,20,20,.08)'}}>
        <div style={{fontFamily: 'Newsreader', fontSize: 52, color: C.ink}}>Video receipt</div>
        <div style={{fontSize: 20, color: '#8b8880', marginBottom: 26}}>#A-2209 · verified by 2 reviewers</div>
        {[['Delivery window', '14:02 – 14:09'], ['Driver', 'R. Santoso'], ['Footage', '00:01:12'], ['Payout', 'Rp 182.000']].map(([a, b], i) => {
          const on = i === 3 ? prog(f, 60, 70, E.inOut) : 0;
          return (
            <div key={a} style={{display: 'flex', justifyContent: 'space-between', padding: '20px 0', borderTop: `1.5px solid ${C.rule}`, fontSize: 28, opacity: prog(f, 30 + i * 4, 38 + i * 4)}}>
              <span style={{color: '#6f6d66'}}>{a}</span>
              <span style={{color: C.ink, fontWeight: 600, background: `linear-gradient(90deg, ${C.hi} ${on * 100}%, transparent ${on * 100}%)`, padding: '0 6px'}}>{b}</span>
            </div>
          );
        })}
        <div style={{display: 'flex', gap: 14, marginTop: 20}}>{['✓ Footage', '✓ GPS', '✓ Signature'].map((t, i) => <span key={t} style={{fontSize: 20, padding: '8px 16px', borderRadius: 20, border: `1.5px solid ${C.ink}`, opacity: prog(f, 66 + i * 4, 72 + i * 4)}}>{t}</span>)}</div>
      </div>
      <div style={{position: 'absolute', left: 110, bottom: 90, fontFamily: 'Newsreader', fontSize: 150, color: C.ink, letterSpacing: -4, fontVariantNumeric: 'tabular-nums'}}>
        {n},000,000<span style={{color: C.red, fontStyle: 'italic'}}>+</span>
        <span style={{fontFamily: 'Inter', fontSize: 26, color: '#77756e', letterSpacing: 0, marginLeft: 26}}>receipts read by hand</span>
      </div>
    </Fill>
  );
};
