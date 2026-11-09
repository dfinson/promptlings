// Motionite examples root: 48 technique comps (960x540, 2.5 s) + the TechniqueReel + one comp per NxrStyle.
import React from 'react';
import {AbsoluteFill, Composition, Folder, Series} from 'remotion';
import {D, FPS, H, W} from './lib/anim';
import {loadFonts} from './lib/fonts';
import {TECHS} from './registry';
import {STYLES} from './styles/registry';

loadFonts();

const Label: React.FC<{i: number}> = ({i}) => {
  const t = TECHS[i];
  return (
    <div style={{position: 'absolute', left: 12, bottom: 12, padding: '5px 10px', borderRadius: 6, background: 'rgba(0,0,0,.72)', color: '#fff', fontFamily: 'Geist Mono, monospace', fontSize: 13}}>
      {t.id} · {t.name} · <span style={{color: '#9fd'}}>{t.cat}</span>
    </div>
  );
};

export const TechniqueReel: React.FC = () => (
  <AbsoluteFill style={{background: '#000'}}>
    <Series>{TECHS.map((t, i) => <Series.Sequence key={t.id} durationInFrames={D}><t.C /><Label i={i} /></Series.Sequence>)}</Series>
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="NxrStyles">
      {STYLES.map((s) => <Composition key={s.id} id={s.id} component={s.C} durationInFrames={s.dur} fps={30} width={s.w} height={s.h} />)}
    </Folder>
    <Folder name="Techniques">
      <Composition id="TechniqueReel" component={TechniqueReel} durationInFrames={D * TECHS.length} fps={FPS} width={W} height={H} />
      {TECHS.map((t) => <Composition key={t.id} id={`${t.id}-${t.C.name || 'tech'}`} component={t.C} durationInFrames={D} fps={FPS} width={W} height={H} />)}
    </Folder>
  </>
);
