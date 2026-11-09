// NxrStyle 08 · Duotone Storybook — engraved/hatched navy illustration on pale paper with one warm accent,
// comic SLAM type, speech bubble, slow push-in toward a door.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, SPR, clamp, hitPulse, lmix, mix, prog, spr} from '../lib/anim';
import {Fill} from './kit';

const C = {paper: '#e9ecf4', navy: '#16245c', orange: '#ff7a1a', light: '#c9d1ea'};
const Hatch: React.FC<{id: string; angle: number; gap: number; w?: number; color?: string}> = ({id, angle, gap, w = 1.6, color = C.navy}) => (
  <pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
    <line x1={0} y1={0} x2={0} y2={gap} stroke={color} strokeWidth={w} />
  </pattern>
);

export const S08DuotoneStorybook: React.FC = () => {
  const f = useCurrentFrame();
  const z = lmix(1, 1.18, prog(f, 0, 150, E.linear)); // slow continuous push-in toward the door
  const slam = prog(f, 30, 34, E.in); const kick = hitPulse(f - 34, 1, 5);
  const bub = spr(f, 50, SPR.land);
  const glow = 0.75 + 0.25 * Math.sin(f / 6);
  return (
    <Fill bg={C.paper}>
      <svg width={1920} height={1080} style={{position: 'absolute', transform: `scale(${z}) translate(${kick * 6}px, ${kick * -4}px)`, transformOrigin: '1180px 700px'}}>
        <defs>
          <Hatch id="h45" angle={45} gap={9} /><Hatch id="h-30" angle={-30} gap={7} /><Hatch id="h0" angle={0} gap={6} w={2.2} /><Hatch id="h80" angle={80} gap={12} w={1.2} />
          <Hatch id="ho" angle={45} gap={8} w={3} color={C.orange} />
          <radialGradient id="moon"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor={C.light} /></radialGradient>
        </defs>
        {/* sky engraving: horizontal lines that thicken toward the top */}
        {Array.from({length: 46}).map((_, i) => <line key={i} x1={0} x2={1920} y1={i * 13} y2={i * 13} stroke={C.navy} strokeWidth={mix(3.2, 0.4, i / 46)} />)}
        <circle cx={420} cy={220} r={120} fill="url(#moon)" />
        {Array.from({length: 7}).map((_, i) => <circle key={i} cx={420} cy={220} r={130 + i * 16} fill="none" stroke={C.paper} strokeWidth={4} opacity={0.5} />)}
        {/* hill */}
        <path d="M0 760 Q 500 640 960 720 T 1920 690 L1920 1080 L0 1080Z" fill={C.paper} />
        <path d="M0 760 Q 500 640 960 720 T 1920 690 L1920 1080 L0 1080Z" fill="url(#h80)" />
        <path d="M0 760 Q 500 640 960 720 T 1920 690" fill="none" stroke={C.navy} strokeWidth={5} />
        {/* house */}
        <g transform="translate(900 330)">
          <rect x={0} y={150} width={560} height={420} fill={C.paper} stroke={C.navy} strokeWidth={6} />
          <rect x={0} y={150} width={560} height={420} fill="url(#h0)" opacity={0.55} />
          <rect x={380} y={150} width={180} height={420} fill="url(#h45)" />
          <path d="M-40 160 L280 -60 L600 160Z" fill={C.paper} stroke={C.navy} strokeWidth={6} />
          <path d="M-40 160 L280 -60 L600 160Z" fill="url(#h-30)" />
          <rect x={60} y={230} width={130} height={120} fill={C.orange} opacity={glow} stroke={C.navy} strokeWidth={6} />
          <path d="M125 230 V350 M60 290 H190" stroke={C.navy} strokeWidth={6} />
          <rect x={360} y={230} width={130} height={120} fill={C.orange} opacity={glow} stroke={C.navy} strokeWidth={6} />
          <path d="M425 230 V350 M360 290 H490" stroke={C.navy} strokeWidth={6} />
          <path d="M215 570 V420 Q280 360 345 420 V570Z" fill={C.navy} />
          <circle cx={325} cy={500} r={8} fill={C.orange} />
        </g>
        {/* pumpkins: the warm accent, hatched orange */}
        {[[820, 900, 70], [1520, 920, 90], [1650, 960, 56]].map(([x, y, r], i) => <g key={i}>
          <ellipse cx={x} cy={y} rx={r * 1.25} ry={r} fill={C.orange} /><ellipse cx={x} cy={y} rx={r * 1.25} ry={r} fill="url(#ho)" opacity={0.7} />
          <path d={`M${x} ${y - r} V${y + r} M${x - r * 0.6} ${y - r * 0.8} Q${x - r * 0.9} ${y} ${x - r * 0.6} ${y + r * 0.8} M${x + r * 0.6} ${y - r * 0.8} Q${x + r * 0.9} ${y} ${x + r * 0.6} ${y + r * 0.8}`} stroke={C.navy} strokeWidth={4} fill="none" />
          <rect x={x - 8} y={y - r - 26} width={16} height={30} fill={C.navy} /></g>)}
      </svg>
      {/* comic SLAM title: enters oversize, lands, kicks the camera */}
      <div style={{position: 'absolute', left: 110, top: 470, transform: `rotate(-6deg) scale(${lmix(2.2, 1, slam)})`, transformOrigin: 'left center', opacity: slam > 0 ? 1 : 0}}>
        <div style={{fontFamily: 'Archivo Black', fontSize: 150, color: C.orange, lineHeight: 0.9, transform: 'skewX(-10deg)', WebkitTextStroke: `8px ${C.navy}`, paintOrder: 'stroke fill', textShadow: `10px 10px 0 ${C.navy}`}}>TRICK<br />OR TREAT!</div>
      </div>
      {/* speech bubble */}
      <div style={{position: 'absolute', left: 1260, top: 150, transform: `scale(${bub})`, transformOrigin: '20% 100%', opacity: clamp(bub * 2)}}>
        <div style={{background: '#fff', border: `6px solid ${C.navy}`, borderRadius: 40, padding: '26px 40px', fontFamily: 'Archivo Black', fontSize: 40, color: C.navy}}>Knock knock… scroll in!</div>
        <svg width={80} height={60} style={{position: 'absolute', left: 60, bottom: -54}}><path d="M0 0 L20 56 L60 0" fill="#fff" stroke={C.navy} strokeWidth={6} /></svg>
      </div>
    </Fill>
  );
};
