// NxrStyle 06 · PRESS START Game Menu — flat 8-bit colour bands, pixel type with a hard drop shadow,
// stepped (never eased) motion on whole pixels, a blinking prompt, a vertical smear wipe into LEVEL UP stat tiles.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {clamp, onTwos} from '../lib/anim';
import {Fill, SPRITES, Sprite} from './kit';

const P = {k: '#1a1c2c', sky1: '#3b5dc9', sky2: '#41a6f6', sky3: '#73eff7', grass: '#38b764', grass2: '#257179', y: '#ffcd75', o: '#ef7d57', r: '#b13e53', w: '#f4f4f4', s: '#f8c8a0', b: '#5d275d', e: '#1a1c2c', g: '#a7f070'};
const PX = 8; // one art pixel = 8 screen px; every position snaps to it
const snap = (v: number) => Math.round(v / PX) * PX;

const PixelText: React.FC<{text: string; size: number; color: string; shadow: string; x: number; y: number; family?: string}> = ({text, size, color, shadow, x, y, family = '"Press Start 2P"'}) => (
  <div style={{position: 'absolute', left: snap(x), top: snap(y), fontFamily: family, fontSize: size, color, textShadow: `${PX}px ${PX}px 0 ${shadow}`, whiteSpace: 'nowrap', lineHeight: 1}}>{text}</div>
);

const CLOUD = ['......wwww..........', '....wwwwwwww........', '...wwwwwwwwww.wwww..', '.wwwwwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwwwwww', '.ccccccccccccccccccc.'];
const Cloud: React.FC<{x: number; y: number}> = ({x, y}) => <Sprite map={CLOUD.map((r) => r.padEnd(21, '.'))} pal={{w: P.w, c: P.sky3}} px={PX} x={snap(x)} y={snap(y)} />;

export const S06PressStart: React.FC = () => {
  const f = useCurrentFrame();
  if (f >= 72) return <LevelUp f={f - 72} />;
  const g = onTwos(f, 2); // whole-pixel steps on twos
  const smear = clamp((f - 62) / 10);
  return (
    <Fill bg={P.sky1}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 360, height: 200, background: P.sky2}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 560, height: 200, background: P.sky3}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 760, height: 320, background: P.grass}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 760, height: 24, background: P.grass2}} />
      <Cloud x={120 - g * 2} y={100} /><Cloud x={1500 - g * 1.5} y={160} /><Cloud x={1560 - g} y={560} />
      <PixelText text="MOTIONITE" size={150} color={P.y} shadow={P.r} x={960 - 675} y={250 + (f < 12 ? (12 - f) * -40 : 0)} />
      <PixelText text="QUEST" size={72} color={P.w} shadow={P.k} x={960 - 180} y={440} />
      {Math.floor(f / 15) % 2 === 0 && <PixelText text="PRESS START" size={44} color={P.w} shadow={P.k} x={960 - 242} y={880} />}
      <div style={{position: 'absolute', left: 0, right: 0, top: 1000, textAlign: 'center', fontFamily: 'Silkscreen', fontSize: 28, color: P.k}}>© NXRLABS 2026</div>
      {/* party walks in on a bob of exactly one art pixel */}
      {[['hero', 640], ['slime', 860], ['coin', 1080], ['lantern', 1240]].map(([k, x], i) => (
        <Sprite key={k} map={SPRITES[k as keyof typeof SPRITES]} pal={P} px={PX} x={snap(Number(x))} y={snap(660 - (Math.floor((f + i * 7) / 8) % 2) * PX)} />
      ))}
      {/* X01 vertical smear wipe: columns fall at staggered speeds */}
      {smear > 0 && Array.from({length: 24}).map((_, i) => (
        <div key={i} style={{position: 'absolute', left: i * 80, top: 0, width: 80, height: snap(1080 * clamp(smear * 1.6 - (i % 5) * 0.12)), background: [P.b, P.r, P.k][i % 3]}} />
      ))}
    </Fill>
  );
};

const STATS: [string, number, string][] = [['ATK', 42, P.r], ['DEF', 31, P.sky2], ['SPD', 57, P.grass], ['LUCK', 77, P.y]];
const LevelUp: React.FC<{f: number}> = ({f}) => (
  <Fill bg={P.b}>
    <PixelText text="LEVEL UP!" size={110} color={P.y} shadow={P.k} x={960 - 495} y={110 + (f < 8 ? -PX * (8 - f) : 0)} />
    {STATS.map(([k, v, c], i) => {
      const on = f >= 10 + i * 6; const n = Math.min(v, Math.max(0, Math.floor((f - 10 - i * 6) * 3)));
      return on ? (
        <div key={k} style={{position: 'absolute', left: 240 + (i % 2) * 760, top: 340 + Math.floor(i / 2) * 300, width: 680, height: 240, background: P.k, boxShadow: `${PX}px ${PX}px 0 ${P.r}`, border: `${PX}px solid ${P.w}`}}>
          <PixelText text={k} size={44} color={P.w} shadow={P.b} x={40} y={40} />
          <PixelText text={`+${n}`} size={88} color={c} shadow={P.b} x={360} y={88} />
          <div style={{position: 'absolute', left: 40, bottom: 40, width: snap(280 * (n / 80)), height: 24, background: c}} />
        </div>
      ) : null;
    })}
  </Fill>
);
