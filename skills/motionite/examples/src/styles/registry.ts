// One example comp per NxrStyle. `still` = the frame rendered to examples/stills/*.png by scripts/render-stills.sh.
import React from 'react';
import {S01BeatReel} from './S01BeatReel';
import {S02CaptionExplainer} from './S02CaptionExplainer';
import {S03FloatingProduct} from './S03FloatingProduct';
import {S04EditorialInk} from './S04EditorialInk';
import {S05WorldPan} from './S05WorldPan';
import {S06PressStart} from './S06PressStart';
import {S07FrostCollectible} from './S07FrostCollectible';
import {S08DuotoneStorybook} from './S08DuotoneStorybook';
import {S09LiveGrid} from './S09LiveGrid';
import {S10PixelTrailer} from './S10PixelTrailer';
import {S11PortalZoom} from './S11PortalZoom';
import {S12ConsoleFilm} from './S12ConsoleFilm';
import {S13LaunchFilm} from './S13LaunchFilm';
import {S14PaperStopMotion} from './S14PaperStopMotion';
import {S15HandDrawnInk} from './S15HandDrawnInk';

export type StyleComp = {n: number; slug: string; id: string; name: string; C: React.FC; w: number; h: number; dur: number; still: number};
// prettier-ignore
export const STYLES: StyleComp[] = [
  {n: 1, slug: 'beat-reel', id: 'NxrStyle01-BeatReel', name: 'Beat Reel', C: S01BeatReel, w: 1920, h: 1080, dur: 225, still: 92},
  {n: 2, slug: 'night-caption-explainer', id: 'NxrStyle02-NightCaption', name: 'Night Caption Explainer', C: S02CaptionExplainer, w: 1080, h: 1920, dur: 160, still: 72},
  {n: 3, slug: 'floating-product-ui', id: 'NxrStyle03-FloatingProduct', name: 'Floating Product UI', C: S03FloatingProduct, w: 1920, h: 1080, dur: 130, still: 92},
  {n: 4, slug: 'editorial-ink', id: 'NxrStyle04-EditorialInk', name: 'Editorial Ink', C: S04EditorialInk, w: 1920, h: 1080, dur: 120, still: 96},
  {n: 5, slug: 'one-pan-flat-world', id: 'NxrStyle05-WorldPan', name: 'One-Pan Flat World', C: S05WorldPan, w: 1920, h: 1080, dur: 150, still: 75},
  {n: 6, slug: 'press-start-menu', id: 'NxrStyle06-PressStart', name: 'PRESS START Game Menu', C: S06PressStart, w: 1920, h: 1080, dur: 150, still: 40},
  {n: 7, slug: 'frost-collectible', id: 'NxrStyle07-FrostCollectible', name: 'Frost Collectible', C: S07FrostCollectible, w: 1920, h: 1080, dur: 120, still: 62},
  {n: 8, slug: 'duotone-storybook', id: 'NxrStyle08-DuotoneStorybook', name: 'Duotone Storybook', C: S08DuotoneStorybook, w: 1920, h: 1080, dur: 150, still: 70},
  {n: 9, slug: 'live-bento-grid', id: 'NxrStyle09-LiveGrid', name: 'Live Bento Grid', C: S09LiveGrid, w: 1080, h: 1080, dur: 180, still: 70},
  {n: 10, slug: 'pixel-bar-grid-trailer', id: 'NxrStyle10-PixelTrailer', name: 'Pixel Bar-Grid Trailer', C: S10PixelTrailer, w: 1920, h: 1080, dur: 120, still: 36},
  {n: 11, slug: 'one-take-portal-zoom', id: 'NxrStyle11-PortalZoom', name: 'One-Take Portal Zoom', C: S11PortalZoom, w: 1920, h: 1080, dur: 150, still: 22},
  {n: 12, slug: 'console-as-film', id: 'NxrStyle12-ConsoleFilm', name: 'Console-as-Film', C: S12ConsoleFilm, w: 1920, h: 1080, dur: 150, still: 100},
  {n: 13, slug: 'clean-launch-film', id: 'NxrStyle13-LaunchFilm', name: 'Clean Launch Film', C: S13LaunchFilm, w: 1920, h: 1080, dur: 160, still: 100},
  {n: 14, slug: 'paper-stop-motion', id: 'NxrStyle14-PaperStopMotion', name: 'Paper Stop-Motion', C: S14PaperStopMotion, w: 1920, h: 1080, dur: 150, still: 75},
  {n: 15, slug: 'hand-drawn-ink', id: 'NxrStyle15-HandDrawnInk', name: 'Hand-Drawn Ink', C: S15HandDrawnInk, w: 1920, h: 1080, dur: 120, still: 76},
];
