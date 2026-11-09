// Loads every font the lab + style examples use from public/fonts (all SIL OFL).
// Family names match the CSS used in src/tech and src/styles, so renders are identical on any machine.
import {continueRender, delayRender, staticFile} from 'remotion';

const FACES: [family: string, file: string, desc?: FontFaceDescriptors][] = [
  ['Anton', 'Anton.woff2'],
  ['Archivo Black', 'ArchivoBlack.woff2'],
  ['Bebas Neue', 'BebasNeue.woff2'],
  ['Caveat', 'Caveat.woff2', {weight: '400 700'}],
  ['DM Sans', 'DMSans-500.woff2', {weight: '500'}],
  ['DM Sans', 'DMSans-700.woff2', {weight: '700'}],
  ['Geist Mono', 'GeistMono.woff2', {weight: '100 900'}],
  ['Instrument Serif', 'InstrumentSerif.woff2', {style: 'normal'}],
  ['Instrument Serif', 'InstrumentSerif-Italic.woff2', {style: 'italic'}],
  ['Inter', 'Inter.woff2', {weight: '100 900'}],
  ['Montserrat', 'Montserrat.woff2', {weight: '100 900'}],
  ['Newsreader', 'Newsreader.woff2', {weight: '200 800', style: 'normal'}],
  ['Newsreader', 'Newsreader-Italic.woff2', {weight: '200 800', style: 'italic'}],
  ['Pixelify Sans', 'PixelifySans.woff2', {weight: '400 700'}],
  ['Plus Jakarta Sans', 'PlusJakartaSans.woff2', {weight: '200 800'}],
  ['Press Start 2P', 'PressStart2P.woff2'],
  ['Silkscreen', 'Silkscreen-400.woff2', {weight: '400'}],
  ['Silkscreen', 'Silkscreen-700.woff2', {weight: '700'}],
  ['Space Grotesk', 'SpaceGrotesk.woff2', {weight: '300 700'}],
  ['Space Mono', 'SpaceMono.woff2'],
  ['VT323', 'VT323.woff2'],
];

let started = false;
export const loadFonts = () => {
  if (started || typeof document === 'undefined') return;
  started = true;
  const h = delayRender('motionite-fonts');
  Promise.all(
    FACES.map(([fam, file, d]) =>
      new FontFace(fam, `url(${staticFile(`fonts/${file}`)}) format('woff2')`, d).load().then((l) => (document.fonts as unknown as {add: (f: FontFace) => void}).add(l)),
    ),
  )
    .then(() => continueRender(h))
    .catch((e) => {
      console.error(e);
      continueRender(h);
    });
};
