// Tageszeit-Stimmung: eine kontinuierliche Zahl t (0 = Tag, 0.5 = goldene Stunde, 1 = Nacht)
// wird zu einer Palette gemischt, die alle Szenen-Ebenen einfärbt.
import { clamp, lerp, mixColor, smoothstep, TAU } from '../core/util';

export interface Palette {
  skyTop: number;
  skyMid: number;
  skyBottom: number;
  /** Multiplikations-Tönung je Tiefe (Berge, Haus, Vordergrund, Innenraum) */
  tintFar: number;
  tintMid: number;
  tintNear: number;
  tintRoom: number;
  haze: number;
  hazeAlpha: number;
  sunColor: number;
  sunGlow: number;
  sunX: number;
  sunY: number;
  moonAlpha: number;
  moonX: number;
  moonY: number;
  starAlpha: number;
  /** 0 = Laternen aus, 1 = voll an */
  lamp: number;
  water: number;
  shaft: number;
  shaftAlpha: number;
  vignette: number;
  vignetteAlpha: number;
}

type NumKeys = Exclude<keyof Palette, never>;

const DAY: Palette = {
  skyTop: 0x5ea6dc,
  skyMid: 0xa8d3ee,
  skyBottom: 0xe9f3ee,
  tintFar: 0xf2f7fa,
  tintMid: 0xf6f8f6,
  tintNear: 0xffffff,
  tintRoom: 0xfff6e8,
  haze: 0xeaf3f5,
  hazeAlpha: 0.5,
  sunColor: 0xfff3c8,
  sunGlow: 0.55,
  sunX: 1180,
  sunY: 150,
  moonAlpha: 0,
  moonX: 520,
  moonY: 700,
  starAlpha: 0,
  lamp: 0,
  water: 0x6fa6b4,
  shaft: 0xfff0c8,
  shaftAlpha: 0.3,
  vignette: 0x1a1008,
  vignetteAlpha: 0.35,
};

const GOLDEN: Palette = {
  skyTop: 0x3c4b7c,
  skyMid: 0xe0865a,
  skyBottom: 0xffd28c,
  tintFar: 0xf1b690,
  tintMid: 0xf2ae80,
  tintNear: 0xf6b98d,
  tintRoom: 0xffc994,
  haze: 0xffc78f,
  hazeAlpha: 0.55,
  sunColor: 0xffbd6a,
  sunGlow: 1,
  sunX: 1010,
  sunY: 440,
  moonAlpha: 0,
  moonX: 520,
  moonY: 700,
  starAlpha: 0,
  lamp: 0.5,
  water: 0xd68b62,
  shaft: 0xffb45e,
  shaftAlpha: 0.55,
  vignette: 0x2a0d06,
  vignetteAlpha: 0.5,
};

const NIGHT: Palette = {
  skyTop: 0x060a1c,
  skyMid: 0x13214a,
  skyBottom: 0x2b3b70,
  tintFar: 0x3a4a7c,
  tintMid: 0x34436f,
  tintNear: 0x3a477a,
  tintRoom: 0x56628f,
  haze: 0x2a3868,
  hazeAlpha: 0.5,
  sunColor: 0xffb060,
  sunGlow: 0,
  sunX: 900,
  sunY: 720,
  moonAlpha: 1,
  moonX: 520,
  moonY: 300,
  starAlpha: 1,
  lamp: 1,
  water: 0x203a68,
  shaft: 0x9db4ff,
  shaftAlpha: 0.2,
  vignette: 0x02030c,
  vignetteAlpha: 0.6,
};

const COLOR_KEYS: NumKeys[] = [
  'skyTop',
  'skyMid',
  'skyBottom',
  'tintFar',
  'tintMid',
  'tintNear',
  'tintRoom',
  'haze',
  'sunColor',
  'water',
  'shaft',
  'vignette',
];

function mixPalette(a: Palette, b: Palette, t: number): Palette {
  const out = { ...a };
  for (const k of Object.keys(a) as NumKeys[]) {
    out[k] = COLOR_KEYS.includes(k) ? mixColor(a[k], b[k], t) : lerp(a[k], b[k], t);
  }
  return out;
}

export function paletteAt(t: number): Palette {
  const p =
    t <= 0.5
      ? mixPalette(DAY, GOLDEN, smoothstep(0, 0.5, t))
      : mixPalette(GOLDEN, NIGHT, smoothstep(0.5, 1, t));
  // Sonne und Mond laufen auf eigenen Bögen (nicht linear gemischt).
  p.sunX = lerp(1200, 880, smoothstep(0, 0.75, t));
  p.sunY = t < 0.5 ? lerp(150, 440, smoothstep(0, 0.5, t)) : lerp(440, 760, smoothstep(0.5, 0.8, t));
  p.moonAlpha = smoothstep(0.62, 0.85, t);
  p.moonX = lerp(420, 600, smoothstep(0.6, 1, t));
  p.moonY = lerp(700, 300, smoothstep(0.6, 1, t));
  p.starAlpha = smoothstep(0.7, 1, t);
  return p;
}

export type TimePreset = 'day' | 'golden' | 'night';
const PRESET_T: Record<TimePreset, number> = { day: 0.02, golden: 0.5, night: 0.98 };

/** Steuert t: automatisch (langsamer Zyklus um die goldene Stunde) oder per Umschalter. */
export class TimeOfDay {
  t = 0.5;
  mode: 'auto' | 'manual' = 'auto';
  /** Ein voller Hin-und-Her-Zyklus Tag → Nacht → Tag dauert so viele Sekunden. */
  readonly cycleSeconds = 540;
  private phase = -0.12;
  private target = 0.5;
  private last = -1;
  palette: Palette = paletteAt(0.5);

  constructor(private onChange: (p: Palette, t: number) => void) {
    this.setAuto();
    this.t = 0.5 + 0.5 * Math.sin(this.phase);
    this.apply(true);
  }

  setPreset(p: TimePreset): void {
    this.mode = 'manual';
    this.target = PRESET_T[p];
  }

  setAuto(): void {
    this.mode = 'auto';
    // Phase so wählen, dass der Zyklus nahtlos von der aktuellen Zeit weiterläuft.
    this.phase = Math.asin(clamp((this.t - 0.5) * 2, -1, 1));
  }

  /** Direkt springen (z. B. für die Kamerafahrt). */
  jump(t: number): void {
    this.t = t;
    this.target = t;
    this.phase = Math.asin(clamp((t - 0.5) * 2, -1, 1));
    this.apply(true);
  }

  update(dt: number): void {
    if (this.mode === 'auto') {
      this.phase += (dt / this.cycleSeconds) * TAU;
      this.t = 0.5 + 0.5 * Math.sin(this.phase);
    } else {
      this.t += (this.target - this.t) * (1 - Math.exp(-dt * 1.6));
    }
    this.apply(false);
  }

  private apply(force: boolean): void {
    if (!force && Math.abs(this.t - this.last) < 0.0006) return;
    this.last = this.t;
    this.palette = paletteAt(this.t);
    this.onChange(this.palette, this.t);
  }
}
