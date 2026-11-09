import React from 'react';
import {AbsoluteFill} from 'remotion';
export const Stage: React.FC<{bg?: string; children?: React.ReactNode; style?: React.CSSProperties}> = ({bg = '#0e0e10', children, style}) => (
  <AbsoluteFill style={{background: bg, fontFamily: 'Inter, Geist, sans-serif', overflow: 'hidden', ...style}}>{children}</AbsoluteFill>
);
export const Center: React.FC<{children?: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', ...style}}>{children}</AbsoluteFill>
);
/** corner crop brackets */
export const Brackets: React.FC<{x: number; y: number; w: number; h: number; c?: string; s?: number; t?: number}> = ({x, y, w, h, c = '#fff', s = 18, t = 3}) => {
  const b = (l: number, tp: number, bl: React.CSSProperties) => <div style={{position: 'absolute', left: l, top: tp, width: s, height: s, ...bl}} />;
  const bd = `${t}px solid ${c}`;
  return <>{b(x, y, {borderLeft: bd, borderTop: bd})}{b(x + w - s, y, {borderRight: bd, borderTop: bd})}{b(x, y + h - s, {borderLeft: bd, borderBottom: bd})}{b(x + w - s, y + h - s, {borderRight: bd, borderBottom: bd})}</>;
};
