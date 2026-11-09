// Typography techniques
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {E, SPR, blurIn, blurOut, clamp, mix, prog, rand, spr, tw, hitPulse} from '../lib/anim';
import {Brackets, Center, Stage} from '../lib/ui';

/** T01 anchor + blur swap */
export const BlurSwap: React.FC = () => {
  const f = useCurrentFrame();
  const words = ['POST.', 'STREAM.', 'GAME.', 'BUILD.'];
  const per = 17; // ~0.55 s per phrase
  const k = Math.min(words.length - 1, Math.floor(f / per));
  const lf = f - k * per;
  const pin = prog(lf, 1, 8, E.out); // new word: 7f E.out, blurIn 12px, scale 1.25->1, x drift 24->0
  const pout = prog(lf, per - 3, per, E.in); // old word: 3f E.in, blurOut
  const last = k === words.length - 1;
  const anchorBlur = lf < 3 && k > 0 ? 6 * (1 - lf / 3) : 0; // the anchor re-blurs on each swap
  return (
    <Stage bg="#dfe9f5">
      <Center style={{flexDirection: 'row', gap: 26, fontFamily: 'Anton', fontSize: 120, color: '#0f1b33', letterSpacing: 1}}>
        <span style={{filter: `blur(${anchorBlur}px)`}}>EVERY</span>
        <span style={{color: '#3366ff', display: 'inline-block', width: 420, filter: `blur(${blurIn(pin, 14) + (last ? 0 : blurOut(pout, 14))}px)`,
          opacity: clamp(pin * 1.6) * (last ? 1 : 1 - pout), transform: `translateX(${mix(24, 0, pin) - (last ? 0 : 30 * pout)}px) scale(${mix(1.25, 1, pin)})`, transformOrigin: 'left center'}}>{words[k]}</span>
      </Center>
    </Stage>
  );
};

/** T02 editorial grey->ink word build + highlighter swipe */
export const EditorialHighlighter: React.FC = () => {
  const f = useCurrentFrame();
  const l1 = 'The next chapter of AI,'.split(' ');
  const l2 = ['written', 'by', 'people.'];
  const word = (w: string, i: number, start: number, italic = false) => {
    const t0 = start + i * 5; const p = prog(f, t0, t0 + 8, E.outSoft);
    const ink = prog(f, t0 + 3, t0 + 9, E.smooth); // grey -> ink over ~6f
    const c = Math.round(mix(190, 17, ink));
    return <span key={w + i} style={{display: 'inline-block', marginRight: 16, opacity: p, color: `rgb(${c},${c},${c})`, transform: `translateY(${mix(14, 0, p)}px)`, filter: `blur(${blurIn(p, 6)}px)`, fontStyle: italic ? 'italic' : 'normal'}}>{w}</span>;
  };
  const hl = prog(f, 44, 54, E.ui); // swipe L->R ~0.33 s
  return (
    <Stage bg="#f3f2ee">
      <Center style={{fontFamily: 'Newsreader, serif', fontSize: 64, flexDirection: 'column'}}>
        <div>{l1.map((w, i) => word(w, i, 2))}</div>
        <div style={{position: 'relative'}}>
          <div style={{position: 'absolute', left: -6, right: 0, top: 14, bottom: 6, background: '#f5f53a', transformOrigin: 'left', transform: `scaleX(${hl})`}} />
          <div style={{position: 'relative'}}>{l2.map((w, i) => word(w, i, 24, true))}</div>
        </div>
      </Center>
    </Stage>
  );
};

/** T03 karaoke caption build: newest word white, older words grey */
export const KaraokeCaption: React.FC = () => {
  const f = useCurrentFrame();
  const words = 'Dia baru nyolong tiga koma dua juta dolar.'.split(' ');
  const every = 8; // ~0.27 s per word
  const n = Math.min(words.length, Math.floor(f / every) + 1);
  return (
    <Stage bg="#0a0a0a">
      <div style={{position: 'absolute', top: 30, width: '100%', textAlign: 'center'}}><span style={{background: '#1d4ed8', color: '#fff', fontSize: 14, padding: '4px 10px', borderRadius: 6, fontWeight: 700}}>LeftCurve Labs</span></div>
      <Center style={{top: -60}}><div style={{color: '#e5484d', fontWeight: 800, fontSize: 92, fontVariantNumeric: 'tabular-nums'}}>${Math.round(tw(f, 0, 50, 1803192, 3200000, E.type)).toLocaleString('en-US')}</div></Center>
      <div style={{position: 'absolute', bottom: 90, left: 120, right: 120, textAlign: 'center', fontSize: 34, fontWeight: 600, lineHeight: 1.3}}>
        {words.slice(0, n).map((w, i) => {
          const newest = i === n - 1; const p = prog(f, i * every, i * every + 4);
          return <span key={i} style={{color: newest ? '#fff' : '#7a7a7a', fontWeight: newest ? 800 : 600, opacity: p, marginRight: 10}}>{w}</span>;
        })}
      </div>
    </Stage>
  );
};

/** T04 word slam inside corner brackets with motion-blur arc */
export const BracketSlam: React.FC = () => {
  const f = useCurrentFrame();
  const slam = (t0: number) => { const p = prog(f, t0, t0 + 4, E.out); return {p, s: mix(1.35, 1, p), blur: (1 - p) * 18}; };
  const a = slam(4), b = slam(16), c = slam(30);
  // FRAME swings in on an arc: rotate from -28deg about a pivot far below; blur scales with angular speed
  const sw = prog(f, 16, 24, E.out); const ang = mix(-28, 0, sw); const vel = Math.abs(28 * (prog(f, 16, 24, E.out) - prog(f - 1, 16, 24, E.out)));
  const kick = hitPulse(f - 30, 1, 4) * 8;
  return (
    <Stage bg="#e8412e">
      <AbsoluteFill style={{transform: `translate(${kick}px, ${-kick * 0.5}px)`}}>
        <div style={{position: 'absolute', left: 120, top: 150, fontFamily: 'Montserrat, Inter', fontWeight: 900, fontSize: 104, color: '#111', lineHeight: 1}}>
          <span style={{display: 'inline-block', opacity: a.p, transform: `scale(${a.s})`, filter: `blur(${a.blur}px)`}}>EVERY</span>{' '}
          <span style={{display: 'inline-block', position: 'relative', padding: '0 18px', transformOrigin: '50% 600%', transform: `rotate(${ang}deg)`, opacity: sw, filter: `blur(${Math.min(14, vel * 1.4)}px)`}}>
            FRAME<Brackets x={-4} y={-6} w={430} h={116} c="#111" s={22} t={5} />
          </span>
          <div style={{opacity: c.p, transform: `scale(${c.s})`, transformOrigin: 'left', filter: `blur(${c.blur}px)`}}>ON PURPOSE.</div>
        </div>
      </AbsoluteFill>
      <div style={{position: 'absolute', left: 24, top: 18, fontFamily: 'Geist Mono', fontSize: 12, color: '#111', letterSpacing: 2}}>MOTIONITE MOTION REEL 2026</div>
      <div style={{position: 'absolute', right: 24, top: 18, fontFamily: 'Geist Mono', fontSize: 12, color: '#111', letterSpacing: 2}}>BAR 2/8 · 128 BPM</div>
      <div style={{position: 'absolute', right: 24, bottom: 18, fontFamily: 'Geist Mono', fontSize: 12, color: '#111'}}>F{String(f).padStart(4, '0')}</div>
    </Stage>
  );
};

/** T05 masked baseline rise, staggered lines */
export const MaskRise: React.FC = () => {
  const f = useCurrentFrame();
  const lines = ['Text rises', 'out of a', 'mask line.'];
  return (
    <Stage bg="#f5f5f2">
      <Center style={{flexDirection: 'column', alignItems: 'flex-start', left: 140}}>
        {lines.map((l, i) => {
          const t0 = 6 + i * 3; const p = prog(f, t0, t0 + 6 + 4, E.out); const q = prog(f, 58 + i * 2, 66 + i * 2, E.in);
          return <div key={i} style={{overflow: 'hidden', height: 96}}><div style={{fontFamily: 'Archivo Black, Inter', fontSize: 84, lineHeight: '96px', color: '#0e0e10', transform: `translateY(${(1 - p) * 110 - q * 110}%)`}}>{l}</div></div>;
        })}
      </Center>
    </Stage>
  );
};

/** T06 type-on with caret and human rhythm: 1 char/frame, 1-frame hold every 2-3 chars */
export const TypeOn: React.FC = () => {
  const f = useCurrentFrame();
  const text = 'Make a launch video for my app';
  // build a schedule: char i appears at frame t_i; seeded holds every 2-3 chars
  let t = 8; const at: number[] = [];
  for (let i = 0; i < text.length; i++) { at.push(t); t += 1 + (i % (2 + Math.floor(rand(i) * 2)) === 0 ? 1 : 0); }
  const n = at.filter((x) => x <= f).length;
  const box = spr(f, 0, SPR.pop);
  return (
    <Stage bg="linear-gradient(#294376,#769CC2)">
      <Center>
        <div style={{width: 640, height: 170, borderRadius: 40, background: 'rgba(255,255,255,.72)', boxShadow: '0 20px 60px rgba(0,0,0,.25), inset 0 2px 0 #fff', transform: `scale(${mix(0.6, 1, box)})`, padding: 34, position: 'relative', boxSizing: 'border-box', fontSize: 34, color: '#1e2f52', fontWeight: 500}}>
          {text.slice(0, n)}<span style={{display: 'inline-block', width: 3, height: 38, background: '#2f6bff', verticalAlign: 'middle', marginLeft: 2}} />
          <div style={{position: 'absolute', right: 26, bottom: 22, width: 46, height: 46, borderRadius: 23, background: '#2f6bff', transform: `scale(${1 + 0.15 * hitPulse(f - (at[at.length - 1] + 4), 2, 5)})`}} />
        </div>
      </Center>
    </Stage>
  );
};

/** T07 scramble decode: each glyph locks one by one */
export const ScrambleDecode: React.FC = () => {
  const f = useCurrentFrame();
  const text = 'NXR OS 1.0 / V4.0.539';
  const POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return (
    <Stage bg="#0e0e10">
      <Center style={{fontFamily: 'Geist Mono, monospace', fontSize: 58, color: '#fff', letterSpacing: 4}}>
        <div>{[...text].map((ch, i) => {
          const lock = 10 + i * 2.5; const on = f >= 4 + i * 0.6;
          if (ch === ' ' || ch === '.' || ch === '/') return <span key={i} style={{opacity: on ? 1 : 0}}>{ch}</span>;
          const locked = f >= lock;
          const g = locked ? ch : POOL[Math.floor(rand(`${i}:${Math.floor(f / 2)}`) * POOL.length)];
          return <span key={i} style={{opacity: on ? 1 : 0, color: locked ? '#fff' : '#6b6b70'}}>{g}</span>;
        })}</div>
      </Center>
    </Stage>
  );
};

/** T08 pixel title with hard drop shadow + PRESS START blink */
export const PixelTitleBlink: React.FC = () => {
  const f = useCurrentFrame();
  const p = prog(f, 2, 11, E.out);
  const blinkOn = f >= 24 && Math.floor((f - 24) / 8) % 2 === 0;
  const gold = f >= 48;
  return (
    <Stage bg="#2f6bff">
      {[0, 1, 2].map((i) => <div key={i} style={{position: 'absolute', left: 0, right: 0, top: 380 + i * 54, height: 54, background: ['#5b86d0', '#8fb0e6', '#bfd9f0'][i]}} />)}
      <Center style={{flexDirection: 'column', gap: 40, top: -40}}>
        <div style={{fontFamily: '"Press Start 2P"', fontSize: 84, color: '#fff', textShadow: '8px 8px 0 #1f47b8', filter: `blur(${blurIn(p, 16)}px)`, opacity: p, transform: `translateY(${mix(20, 0, p)}px)`}}>NXR</div>
        <div style={{fontFamily: '"Press Start 2P"', fontSize: 26, color: gold ? '#f5c518' : '#fff', textShadow: '4px 4px 0 #1f47b8', opacity: blinkOn ? 1 : 0}}>PRESS START</div>
      </Center>
    </Stage>
  );
};

/** T09 3D text ring spinning */
export const TextRing: React.FC = () => {
  const f = useCurrentFrame();
  const txt = 'MOTION DESIGN · ANIMATION · ART DIRECTION · TYPE · ';
  const chars = [...txt]; const n = chars.length; const R = 230;
  const rot = f * 2.2; const tilt = tw(f, 0, 40, 70, 18, E.smooth);
  return (
    <Stage bg="#0e0e10">
      <Center style={{perspective: 900}}>
        <div style={{transformStyle: 'preserve-3d', transform: `rotateX(${tilt}deg) rotateY(${rot}deg)`}}>
          {chars.map((c, i) => {
            const a = (i / n) * 360;
            return <span key={i} style={{position: 'absolute', left: -12, top: -20, width: 24, textAlign: 'center', fontFamily: 'Anton', fontSize: 34, color: '#fff', transform: `rotateY(${a}deg) translateZ(${R}px)`, backfaceVisibility: 'visible'}}>{c}</span>;
          })}
        </div>
        <div style={{position: 'absolute', width: 18, height: 18, borderRadius: 9, background: '#ff4a1c'}} />
      </Center>
    </Stage>
  );
};
