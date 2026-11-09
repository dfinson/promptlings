import React, {useLayoutEffect, useRef} from 'react';
import {useCurrentFrame} from 'remotion';
/** Deterministic canvas: draw(ctx, frame) is a pure function of the frame (no state carried between renders). */
export const CanvasComp: React.FC<{draw: (c: CanvasRenderingContext2D, f: number) => void; w?: number; h?: number}> = ({draw, w = 960, h = 540}) => {
  const ref = useRef<HTMLCanvasElement>(null); const f = useCurrentFrame();
  useLayoutEffect(() => { const c = ref.current!.getContext('2d')!; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h); draw(c, f); }, [f, draw, w, h]);
  return <canvas ref={ref} width={w} height={h} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />;
};
