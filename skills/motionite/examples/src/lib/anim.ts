// Motion tokens for the lab: easing curves, spring configs and helpers. Token timings are written
// at 60 fps; the lab runs at 30 fps, so every 60 fps frame count is halved via f60().
import {Easing, interpolate, spring} from 'remotion';

export const FPS = 30;
export const W = 960, H = 540;
export const D = 75; // frames per technique comp (2.5 s)
export const f60 = (n: number) => n / 2; // 60fps frames -> lab frames

export type Ease = (t: number) => number;
const bz = (a: number, b: number, c: number, d: number): Ease => Easing.bezier(a, b, c, d);
export const E = {
  linear: (t: number) => t,
  out: bz(0.16, 1, 0.3, 1), outSoft: bz(0.22, 1, 0.36, 1), in: bz(0.7, 0, 0.84, 0), exit: bz(0.55, 0.055, 0.675, 0.19),
  inOut: bz(0.87, 0, 0.13, 1), smooth: bz(0.65, 0, 0.35, 1), ui: bz(0.4, 0, 0.2, 1), cam: bz(0.48, 0.1, 0, 0.9),
  glide: bz(0.47, 0.2, 0.15, 1), rest: bz(0.45, 0, 0.1, 1), contact: bz(0.55, 0, 0.9, 0.55), whip: bz(0.6, 0, 0.15, 1),
  dolly: bz(0.35, 0, 0.65, 1), type: bz(0.5, 1, 0.89, 1),
  expo: (t: number) => (t >= 1 ? 1 : (1 - Math.exp(-6 * t)) / (1 - Math.exp(-6))),
};
export const SPR = {
  snap: {damping: 18, stiffness: 260, mass: 0.7}, pop: {damping: 11, stiffness: 180, mass: 0.6},
  soft: {damping: 26, stiffness: 120, mass: 1}, heavy: {damping: 30, stiffness: 90, mass: 1.4},
  firm: {damping: 24, stiffness: 140, mass: 1}, micro: {damping: 30, stiffness: 500, mass: 0.6},
  land: {damping: 14.5, stiffness: 200, mass: 1}, word: {damping: 20, stiffness: 170, mass: 0.9},
  detent: {damping: 24, stiffness: 380, mass: 0.6}, calm: {damping: 16, stiffness: 64, mass: 1},
};
export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const lmix = (a: number, b: number, t: number) => Math.exp(mix(Math.log(a), Math.log(b), t)); // scale in log space
export const tw = (f: number, from: number, to: number, a: number, b: number, ease: Ease = E.out) =>
  interpolate(f, [from, to], [a, b], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
export const prog = (f: number, from: number, to: number, ease: Ease = E.out) => tw(f, from, to, 0, 1, ease);
export const spr = (f: number, start: number, cfg = SPR.snap) => spring({frame: f - start, fps: FPS, config: cfg});
/** sum-of-springs track: value is a pure function of time even with many retargets */
export const track = (f: number, v0: number, steps: [number, number][], cfg = SPR.snap) =>
  steps.reduce((acc, [t, v], i) => acc + (v - (i ? steps[i - 1][1] : v0)) * spr(f, t, cfg), v0);
/** hitPulse: sine attack then exponential decay */
export const hitPulse = (t: number, attack = 2, tau = 5) =>
  t < 0 ? 0 : t < attack ? Math.sin((t / attack) * Math.PI / 2) : Math.exp(-(t - attack) / tau);
export const blurIn = (p: number, px: number) => px * clamp(1 - p / 0.6);
export const blurOut = (q: number, px: number) => px * clamp((q - 0.3) / 0.7);
export const squash = (t: number) => { const k = hitPulse(t, 1, 4); return {along: 1 - 0.1 * k, across: 1 + 0.08 * k}; };
/** deterministic hash -> [0,1) (FNV-1a + xorshift); never Math.random */
export const rand = (seed: number | string) => {
  let h = 2166136261; const s = String(seed);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296;
};
export const stagger = (i: number, n: number, span: number, ease: Ease = E.linear) => (n > 1 ? span * ease(clamp(i / (n - 1))) : 0);
/** closed-form inertia: distance travelled after release with per-frame velocity decay */
export const inertia = (f: number, start: number, v0: number, decay = 0.89) => {
  const n = Math.max(0, f - start); return (v0 * (1 - Math.pow(decay, n))) / (1 - decay);
};
export const onTwos = (f: number, n = 2) => Math.floor(f / n) * n; // hold every drawing n frames
