// Kleiner Phrasen-Sequenzer für die Instrumente: Notenschrift („A4:1 B4^:.5 -:1“), Tempokarte mit Ritardandi,
// Melodiezeilen mit Phrasenbogen und eine variierende Zupfbegleitung. Wird vom Musik-Labor und der Spielmusik genutzt.
import { clamp } from '../core/util';
import { neighbor, pluck, tremolo } from './instruments';
import type { LineNote, PluckOpts, Studio } from './instruments';

export interface Ev {
  t: number;
  fn: () => void;
}

/** Ereignisliste: wird vorab aufgebaut und dann mit Vorlauf abgespielt */
export class Score {
  readonly evs: Ev[] = [];
  at(t: number, fn: () => void): void {
    this.evs.push({ t, fn });
  }
}

export interface Tok {
  midi: number | null;
  beats: number;
  /** Verzierungen: ^ Vorschlag von oben, v von unten, ~ Vibrato/Tremolo, s gebunden, / Gleitton */
  orn: string;
}

const NOTE_RE = /^([A-G])(#|b)?(\d)([^:]*):([\d.]+)$/;
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Notenschrift wie „A4:1 B4^:.5 -:1“ (Taktstriche „|“ werden ignoriert) */
export function parse(src: string): Tok[] {
  return src
    .split(/\s+/)
    .filter((x) => x && x !== '|')
    .map((tok) => {
      if (tok.startsWith('-')) return { midi: null, beats: parseFloat(tok.slice(2)), orn: '' };
      const m = NOTE_RE.exec(tok);
      if (!m) throw new Error(`Unbekannte Note: ${tok}`);
      const pc = PC[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
      return { midi: 12 * (Number(m[3]) + 1) + pc, beats: parseFloat(m[5]!), orn: m[4] ?? '' };
    });
}

export type TempoMap = (beat: number) => number;

/** Schlag → Zeit, mit Ritardandi [Endschlag, Länge in Schlägen, Stärke] vor Phrasenenden */
export function tempoMap(bpm: number, rits: [number, number, number][], t0: number): TempoMap {
  const step = 1 / 16;
  const spb = 60 / bpm;
  const count = 256 / step;
  const cum = new Float64Array(count + 2);
  for (let i = 0; i <= count; i++) {
    const x = (i + 0.5) * step;
    let f = 1;
    for (const [at, span, amt] of rits) {
      if (x > at - span && x < at) {
        const p = (x - (at - span)) / span;
        f += amt * p * p;
      }
    }
    cum[i + 1] = cum[i]! + step * spb * f;
  }
  return (b) => {
    const i = clamp(Math.floor(b / step), 0, count);
    const fr = b / step - i;
    return t0 + cum[i]! + (cum[i + 1]! - cum[i]!) * fr;
  };
}

/** Melodiezeile → gehaltene Töne mit Phrasenbogen und leichter Verwacklung */
export function lineNotes(
  s: Studio,
  src: string | Tok[],
  start: number,
  tm: TempoMap,
  pcs: number[],
  vel: number,
): LineNote[] {
  const toks = typeof src === 'string' ? parse(src) : src;
  const count = toks.filter((t) => t.midi !== null).length;
  const out: LineNote[] = [];
  let b = start;
  let k = 0;
  for (const tok of toks) {
    if (tok.midi !== null) {
      const arch = 0.85 + 0.25 * Math.sin((Math.PI * k) / Math.max(1, count - 1));
      out.push({
        t: tm(b) + (s.rnd() - 0.5) * 0.024,
        d: tm(b + tok.beats) - tm(b),
        midi: tok.midi,
        v: clamp(vel * arch * (0.92 + s.rnd() * 0.14), 0.05, 1.2),
        grace: tok.orn.includes('^')
          ? neighbor(tok.midi, 1, pcs)
          : tok.orn.includes('v')
            ? neighbor(tok.midi, -1, pcs)
            : undefined,
        vib: tok.orn.includes('~') ? 32 : undefined,
        slur: tok.orn.includes('s'),
        slide: tok.orn.includes('/'),
      });
      k++;
    }
    b += tok.beats;
  }
  return out;
}

/** Gezupfte Melodie (Guzheng solo): ^ = von oben herab, v = von unten hineindrücken, ~ = Tremolo */
export function pluckLine(
  s: Studio,
  sc: Score,
  src: string | Tok[],
  start: number,
  tm: TempoMap,
  pcs: number[],
  vel: number,
  o: PluckOpts = {},
): void {
  let b = start;
  for (const tok of typeof src === 'string' ? parse(src) : src) {
    if (tok.midi !== null) {
      const m = tok.midi;
      const t = tm(b) + (s.rnd() - 0.5) * 0.02;
      const v = vel * (0.88 + s.rnd() * 0.2);
      const dur = tm(b + tok.beats) - tm(b);
      if (tok.orn.includes('~')) {
        sc.at(t, () => tremolo(s, m, t, dur, v * 0.7, o));
      } else {
        let bend = s.rnd() < 0.3 ? 15 + s.rnd() * 20 : 0;
        let bendTime = 0.06;
        if (tok.orn.includes('^')) bend = 55;
        if (tok.orn.includes('v')) {
          bend = (neighbor(m, -1, pcs) - m) * 100;
          bendTime = 0.09;
        }
        sc.at(t, () => pluck(s, m, t, { ...o, vel: v, bend, bendTime, vib: dur > 1.2 ? 14 : 0 }));
      }
    }
    b += tok.beats;
  }
}

/** Begleitmuster: [Schlag im Takt, Index im Akkord, Stärke] */
export type Hit = [number, number, number];

export interface AccompOpts {
  bars: { bar: number; chord: number[]; chord2?: number[]; pat: Hit[]; trem?: [number, number, number] }[];
  beatsPerBar: number;
  vel: number;
  pan: number;
}

/** Leise, variierende Zupfbegleitung; Basston auf der Eins, manchmal mit Oktave darunter */
export function accompany(s: Studio, sc: Score, tm: TempoMap, a: AccompOpts): void {
  for (const { bar, chord, chord2, pat, trem } of a.bars) {
    const b0 = bar * a.beatsPerBar;
    for (const [beat, idx, w] of pat) {
      if (beat > 0 && s.rnd() < 0.14) continue;
      const ch = chord2 && beat >= a.beatsPerBar / 2 ? chord2 : chord;
      let i = idx;
      if (i >= 3 && s.rnd() < 0.3) i = i === 3 ? 4 : 3;
      const m = ch[Math.min(i, ch.length - 1)]!;
      const t = tm(b0 + beat) + (s.rnd() - 0.5) * 0.024 + (beat > 0 ? 0.008 : 0);
      const v = a.vel * w * (0.88 + s.rnd() * 0.2);
      const bend = beat === 0 && s.rnd() < 0.35 ? 25 + s.rnd() * 20 : 0;
      const pan = a.pan + (i - 2) * 0.09;
      sc.at(t, () => pluck(s, m, t, { vel: v, bend, pan, verb: 0.3 }));
      if (beat === 0 && s.rnd() < 0.3 && m - 12 >= 36) {
        sc.at(t + 0.01, () => pluck(s, m - 12, t + 0.01, { vel: v * 0.55, pan: a.pan - 0.1, verb: 0.25 }));
      }
    }
    if (trem) {
      const [beat, idx, len] = trem;
      const t = tm(b0 + beat);
      const dur = tm(b0 + beat + len) - t;
      const m = chord[idx]!;
      sc.at(t, () => tremolo(s, m, t, dur, a.vel * 0.42, { pan: a.pan, verb: 0.35 }));
    }
  }
}
