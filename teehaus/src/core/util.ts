// Kleine, abhängigkeitsfreie Helfer: Mathe, Farben, Zufall.

export const TAU = Math.PI * 2;

export const clamp = (v: number, a = 0, b = 1): number => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Deterministischer Zufallsgenerator – gleiche Szene bei jedem Start. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Linear zwischen zwei 0xRRGGBB-Farben mischen. */
export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Farbe heller (f > 1) oder dunkler (f < 1) machen. */
export function scaleColor(c: number, f: number): number {
  const r = clamp(Math.round(((c >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((c >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((c & 255) * f), 0, 255);
  return (r << 16) | (g << 8) | b;
}

export const cssColor = (c: number): string => '#' + c.toString(16).padStart(6, '0');

export const rand = (rng: () => number, a: number, b: number): number => a + (b - a) * rng();
export const pick = <T>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
