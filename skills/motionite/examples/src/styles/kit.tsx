// Shared building blocks for the NxrStyle example comps (1920x1080 @ 30 fps unless noted).
// Everything is a pure function of the frame: no Math.random, no Date.now, no CSS transitions.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {E, blurIn, clamp, mix, prog} from '../lib/anim';

export const SW = 1920, SH = 1080, SFPS = 30;

/** Beat grid. 128 BPM @30fps: beat = 14.06f, bar = 56.25f. Every Sequence start should come from b(). */
export const grid = (bpm: number, fps = SFPS) => {
  const BEAT = (60 / bpm) * fps;
  return {BEAT, BAR: BEAT * 4, b: (bar: number, beat = 0, sub = 0) => Math.round((bar * 4 + beat) * BEAT + sub * (BEAT / 4))};
};

export const Fill: React.FC<{bg: string; children?: React.ReactNode; style?: React.CSSProperties}> = ({bg, children, style}) => (
  <AbsoluteFill style={{background: bg, overflow: 'hidden', ...style}}>{children}</AbsoluteFill>
);

/** Rule: text enters with blur, never an opacity-only fade. Per word: blur 16->0, y 20->0, 5f, expo-out, stagger 4f. */
export const BlurWords: React.FC<{
  text: string; f: number; start: number; stagger?: number; dur?: number; blur?: number; dy?: number; accent?: number[]; accentColor?: string;
  style?: React.CSSProperties; gap?: number; exitAt?: number;
}> = ({text, f, start, stagger = 4, dur = 5, blur = 16, dy = 20, accent = [], accentColor, style, gap = 0.28, exitAt}) => (
  <div style={{display: 'flex', flexWrap: 'wrap', columnGap: `${gap}em`, ...style}}>
    {text.split(' ').map((w, i) => {
      const t0 = start + i * stagger;
      const p = prog(f, t0, t0 + dur, E.out);
      const q = exitAt === undefined ? 0 : prog(f, exitAt + i * 2, exitAt + i * 2 + 4, E.in);
      return (
        <span key={i} style={{display: 'inline-block', opacity: clamp(p * 1.4) * (1 - q), color: accent.includes(i) ? accentColor : undefined,
          transform: `translateY(${mix(dy, 0, p) - q * dy}px)`, filter: `blur(${blurIn(p, blur) + q * blur}px)`}}>{w}</span>
      );
    })}
  </div>
);

/** Corner crop brackets (HUD chrome). */
export const Corners: React.FC<{inset?: number; size?: number; c?: string; t?: number}> = ({inset = 40, size = 40, c = '#fff', t = 4}) => {
  const bd = `${t}px solid ${c}`;
  const pos: React.CSSProperties[] = [
    {left: inset, top: inset, borderLeft: bd, borderTop: bd}, {right: inset, top: inset, borderRight: bd, borderTop: bd},
    {left: inset, bottom: inset, borderLeft: bd, borderBottom: bd}, {right: inset, bottom: inset, borderRight: bd, borderBottom: bd},
  ];
  return <>{pos.map((p, i) => <div key={i} style={{position: 'absolute', width: size, height: size, ...p}} />)}</>;
};

/** Tiny tracked-mono label. */
export const Mono: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{position: 'absolute', fontFamily: 'Geist Mono', fontSize: 20, letterSpacing: '0.18em', textTransform: 'uppercase', ...style}}>{children}</div>
);

/** Pixel sprite from a string map. '.' = transparent, other chars index into `pal`. Rendered as crisp SVG rects. */
export const Sprite: React.FC<{map: string[]; pal: Record<string, string>; px: number; x: number; y: number; style?: React.CSSProperties}> = ({map, pal, px, x, y, style}) => {
  const w = map[0].length, h = map.length;
  return (
    <svg width={w * px} height={h * px} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" style={{position: 'absolute', left: x, top: y, ...style}}>
      {map.flatMap((row, j) => [...row].map((ch, i) => (ch === '.' ? null : <rect key={`${i}-${j}`} x={i} y={j} width={1.02} height={1.02} fill={pal[ch]} />)))}
    </svg>
  );
};

export const SPRITES = {
  hero: [
    '....kkkk....', '...kyyyyk...', '..kyyyyyyk..', '..kssssssk..', '..ksesseskk.', '..kssssssk..', '...kkkkkk...',
    '..kbbbbbbk..', '.kbbbybbbbk.', '.ksbbbbbbsk.', '..kbbbbbbk..', '..kbk..kbk..', '..kkk..kkk..',
  ],
  coin: ['..kkkk..', '.kyyyyk.', 'kyywyyyk', 'kywyyyok', 'kyyyyyok', 'kyyyyook', '.kyoook.', '..kkkk..'],
  lantern: ['...kk...', '..kkkk..', '.kyyyyk.', 'kyywyyyk', 'kyyyyyyk', 'kyyyyyyk', '.kyyyyk.', '..kkkk..', '...kk...'],
  slime: ['...kkkk...', '..kggggk..', '.kgggwggk.', 'kgggggwggk', 'kgekggekgk', 'kggggggggk', 'kggggggggk', '.kkkkkkkk.'],
  bot: ['...k....', '...k....', '.kkkkkk.', 'kbbbbbbk', 'kbwbbwbk', 'kbbbbbbk', '.kkkkkk.', '.kb..bk.'],
};
