// Tageszeit-Palette: t = 0 Tag, 0.5 goldene Stunde, 1 Nacht. Alle Werte werden weich interpoliert.
import { Color, Vector3 } from 'three';
import { clamp } from './noise';

export type TimePreset = 'day' | 'golden' | 'night';
export const PRESET_T: Record<TimePreset, number> = { day: 0, golden: 0.5, night: 1 };

interface Key {
  skyTop: string;
  skyHorizon: string;
  sun: string;
  sunIntensity: number;
  /** Höhe der Sonne über dem Horizont in Grad */
  sunElev: number;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  fog: string;
  fogDensity: number;
  lantern: number;
  window: number;
  figureTint: string;
  exposure: number;
  stars: number;
}

const KEYS: Key[] = [
  {
    skyTop: '#5f9fd6',
    skyHorizon: '#dfe9ea',
    sun: '#fff3dc',
    sunIntensity: 3.0,
    sunElev: 48,
    hemiSky: '#cfe2f2',
    hemiGround: '#8a7a55',
    hemi: 1.15,
    fog: '#d6e1e2',
    fogDensity: 0.0085,
    lantern: 0.35,
    window: 0.35,
    figureTint: '#ffffff',
    exposure: 1.0,
    stars: 0,
  },
  {
    skyTop: '#486c9a',
    skyHorizon: '#f6b46e',
    sun: '#ffb469',
    sunIntensity: 3.4,
    sunElev: 9,
    hemiSky: '#f2c493',
    hemiGround: '#5a4030',
    hemi: 0.85,
    fog: '#e8b88a',
    fogDensity: 0.0105,
    lantern: 1.0,
    window: 1.0,
    figureTint: '#ffe9cf',
    exposure: 1.05,
    stars: 0,
  },
  {
    skyTop: '#070b1d',
    skyHorizon: '#24304f',
    sun: '#9fb4e8',
    sunIntensity: 0.55,
    sunElev: 30,
    hemiSky: '#3a4a78',
    hemiGround: '#141018',
    hemi: 0.35,
    fog: '#1b2238',
    fogDensity: 0.0125,
    lantern: 1.9,
    window: 0.3,
    figureTint: '#d8d4f0',
    exposure: 1.15,
    stars: 1,
  },
];

export interface Palette {
  skyTop: Color;
  skyHorizon: Color;
  sun: Color;
  sunIntensity: number;
  sunDir: Vector3;
  hemiSky: Color;
  hemiGround: Color;
  hemi: number;
  fog: Color;
  fogDensity: number;
  lantern: number;
  window: number;
  figureTint: Color;
  exposure: number;
  stars: number;
}

const c = (a: string, b: string, t: number): Color => new Color(a).lerp(new Color(b), t);
const n = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Richtung der Sonne (bzw. des Mondes): kommt von links, leicht von vorn, damit Licht durch die Seitenfenster fällt. */
export function sunDirection(elevDeg: number): Vector3 {
  const e = (elevDeg * Math.PI) / 180;
  return new Vector3(-Math.cos(e) * 0.86, Math.sin(e), Math.cos(e) * 0.5).normalize();
}

export function palette(tRaw: number): Palette {
  const t = clamp(tRaw, 0, 1) * 2;
  const i = Math.min(1, Math.floor(t));
  const f = t - i;
  const a = KEYS[i]!;
  const b = KEYS[i + 1]!;
  const elev = n(a.sunElev, b.sunElev, f);
  return {
    skyTop: c(a.skyTop, b.skyTop, f),
    skyHorizon: c(a.skyHorizon, b.skyHorizon, f),
    sun: c(a.sun, b.sun, f),
    sunIntensity: n(a.sunIntensity, b.sunIntensity, f),
    sunDir: sunDirection(elev),
    hemiSky: c(a.hemiSky, b.hemiSky, f),
    hemiGround: c(a.hemiGround, b.hemiGround, f),
    hemi: n(a.hemi, b.hemi, f),
    fog: c(a.fog, b.fog, f),
    fogDensity: n(a.fogDensity, b.fogDensity, f),
    lantern: n(a.lantern, b.lantern, f),
    window: n(a.window, b.window, f),
    figureTint: c(a.figureTint, b.figureTint, f),
    exposure: n(a.exposure, b.exposure, f),
    stars: n(a.stars, b.stars, f),
  };
}
