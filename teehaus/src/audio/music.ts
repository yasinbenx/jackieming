// Generative Spielmusik im Stil „Erhu & Guzheng“ (Variante B aus dem Musik-Labor): eine singende Erhu mit
// Gleittönen und Vibrato über einer spärlichen Guzheng-Begleitung, G-Pentatonik (Gong-Modus), gelegentlich
// nach D- oder A-Gong ausweichend.
//
// Es gibt keine Schleife: Ein Komponist wählt zur Laufzeit aus einer Phrasen-Bibliothek (Vordersatz/Nachsatz-
// Paare, Zwischenspiele, Schlüsse, stille Abschnitte) und variiert jede Phrase (Lage innerhalb der Pentatonik,
// Rhythmus, Verzierungen, Mischung von Vorder- und Nachsätzen verschiedener Paare). Dazwischen liegen Pausen
// von wenigen bis über zehn Sekunden. Tageszeit, drinnen/draußen und Gespräch steuern Tempo, Dichte,
// Instrumentierung, Klangfarbe und Hall; alle Übergänge werden über mehrere Sekunden geblendet.
//
// Technik: Abschnitte werden einige Sekunden im Voraus als Ereignisliste geplant und von einem Taktgeber
// (alle 200 ms) mit 1,6 s Vorlauf an die Instrumente übergeben. Beendete Klangquellen werden abgemeldet und
// getrennt, damit über lange Sitzungen kein Speicher anwächst.
import { clamp, lerp, mulberry32, smoothstep } from '../core/util';
import type { AudioEngine } from './engine';
import { bell, drone, erhu, gliss, makeImpulse, mtof, pluck, pour, tremolo } from './instruments';
import type { Rng, Studio } from './instruments';
import { Score, accompany, lineNotes, parse, pluckLine, tempoMap } from './sequencer';
import type { Hit, TempoMap, Tok } from './sequencer';

// ───────────────────────────── Tonmaterial

/** Pentatonik (Gong-Modus) als Halbtonabstände vom Grundton */
const SCALE = [0, 2, 4, 7, 9];
/** Bezugston der Bibliothek: alle Phrasen sind in G notiert, G4 = Stufe 0 */
const LIB_TONIC = 67;

type KeyName = 'G' | 'D' | 'A';
/** Grundton (MIDI, um die vierte Oktave) der möglichen Tonarten */
const KEYS: Record<KeyName, number> = { G: 67, D: 62, A: 69 };

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** Phrasenton als Skalenstufe (0 = Grundton, 5 = Oktave darüber, −1 = Ton darunter) */
interface DTok {
  deg: number | null;
  beats: number;
  orn: string;
}

function midiToDeg(m: number): number {
  const rel = m - LIB_TONIC;
  const oct = Math.floor(rel / 12);
  const idx = SCALE.indexOf(rel - oct * 12);
  if (idx < 0) throw new Error(`Ton außerhalb der Pentatonik: ${m}`);
  return oct * 5 + idx;
}

const degToMidi = (deg: number, tonic: number): number =>
  tonic + 12 * Math.floor(deg / 5) + SCALE[mod(deg, 5)]!;

const toDeg = (src: string): DTok[] =>
  parse(src).map((t) => ({ deg: t.midi === null ? null : midiToDeg(t.midi), beats: t.beats, orn: t.orn }));

const pcsOf = (tonic: number): number[] => SCALE.map((x) => mod(tonic + x, 12));

/** Vordersatz/Nachsatz-Paar; Akkorde je Takt als Grundton-Stufe (0 G, 1 A, 3 D, 4 E), optional halbtaktig */
interface Pair {
  id: string;
  mood: 'bright' | 'calm' | 'low';
  a: DTok[];
  c: DTok[];
  ca: number[][];
  cc: number[][];
}

const pair = (
  id: string,
  mood: Pair['mood'],
  a: string,
  ca: number[][],
  c: string,
  cc: number[][],
): Pair => ({ id, mood, a: toDeg(a), c: toDeg(c), ca, cc });

/** Phrasen-Bibliothek: jeweils 2 + 2 Takte à 4 Schläge. Vordersätze enden offen, Nachsätze auf dem Grundton. */
const PAIRS: Pair[] = [
  pair(
    'P1',
    'calm',
    'B4/:1.5 A4:.5 G4:1 E4:1 | G4:.75 A4:.25 B4:1 D5~:1.5 -:.5',
    [[0], [3]],
    'E5/:1.5 D5:.5 B4:1 A4:.5 B4:.5 | A4:.75 G4s:.25 E4:1 G4~:1.5 -:.5',
    [[4], [0]],
  ),
  pair(
    'P2',
    'calm',
    'D5:1 E5/:.5 D5:.5 B4~:2 | A4:1 B4:.5 A4s:.5 E4~:1.5 -:.5',
    [[0], [1]],
    'G4:1 A4:.5 B4:.5 D5/:1.5 B4:.5 | A4:.75 B4:.25 A4:.5 E4:.5 G4~:2',
    [[4], [3, 0]],
  ),
  pair(
    'P3',
    'bright',
    'G4:.5 A4:.5 B4:1 D5:.5 E5:.5 D5:1 | B4:.5 A4:.5 B4/:1 A4~:1.5 -:.5',
    [[0], [1]],
    'B4:.5 D5:.5 E5:1 D5:.5 B4:.5 A4:1 | G4:.5 E4:.5 A4/:1 G4~:1.5 -:.5',
    [[3], [4, 0]],
  ),
  pair(
    'P4',
    'bright',
    'D5:1 G5/:1 E5:.5 D5:.5 E5:1 | D5:.75 B4:.25 A4:1 B4~:1.5 -:.5',
    [[0], [4]],
    'A4:1 B4:.5 D5:.5 E5:.5 D5:.5 B4:1 | A4:.5 G4:.5 E4:1 G4~:1.5 -:.5',
    [[3], [0]],
  ),
  pair(
    'P5',
    'low',
    'E4:1.5 G4:.5 A4:1 G4:.5 E4:.5 | D4:1 E4:.5 G4:.5 A4~:1.5 -:.5',
    [[4], [3]],
    'B4:1 A4:.5 G4:.5 E4/:1 D4:1 | E4:.5 G4:.5 A4:.5 B4:.5 G4~:1.5 -:.5',
    [[1], [0]],
  ),
  pair(
    'P6',
    'bright',
    'B4:.5 D5:.5 B4:.5 A4:.5 G4:1 A4:.5 B4:.5 | D5:.5 E5:.5 D5:1 A4~:1.5 -:.5',
    [[0], [3]],
    'G5/:1 E5:.5 D5:.5 B4:.5 A4:.5 B4:1 | A4:.5 G4:.5 E4:.5 A4:.5 G4~:1.5 -:.5',
    [[4], [0]],
  ),
  pair(
    'P7',
    'calm',
    'D5/:2 B4:1 A4:1 | B4:1.5 G4:.5 A4~:1.5 -:.5',
    [[0], [1]],
    'E5/:2 D5:1 B4:1 | A4:1 B4s:.5 A4:.5 G4~:1.5 -:.5',
    [[4], [0]],
  ),
  pair(
    'P8',
    'low',
    'G4:1 D5/:1.5 B4:.5 A4:1 | G4:.5 A4:.5 E4:1 D4~:1.5 -:.5',
    [[0], [3]],
    'E4:1 G4:.5 A4:.5 B4:1 D5:1 | E5/:1 D5:.5 B4:.5 G4~:1.5 -:.5',
    [[1], [0]],
  ),
];

/** Kurze Guzheng-Zwischenspiele (1 Takt) mit Bass-Stufe */
const INTERLUDES: { id: string; toks: DTok[]; root: number }[] = [
  { id: 'I1', root: 0, toks: toDeg('G4:.5 A4:.5 B4:1 D5^:.5 B4:.5 A4:1') },
  { id: 'I2', root: 3, toks: toDeg('D5:.5 E5:.5 D5:.5 B4:.5 A4:1 -:1') },
  { id: 'I3', root: 4, toks: toDeg('E5:.5 D5:.5 B4:.5 A4:.5 G4:1 E4:1') },
  { id: 'I4', root: 3, toks: toDeg('B4:1 A4:.5 G4:.5 E4v:1 D4:1') },
  { id: 'I5', root: 0, toks: toDeg('G5:.5 E5:.5 D5:1 B4^:.5 A4:.5 G4:1') },
  { id: 'I6', root: 0, toks: toDeg('D5~:2 B4:1 A4:1') },
  { id: 'I7', root: 1, toks: toDeg('A4:.5 B4:.5 D5:.5 E5:.5 G5^:1 E5:1') },
  { id: 'I8', root: 4, toks: toDeg('E4:1 G4:.5 A4:.5 B4~:2') },
];

/** Begleitmuster: [Schlag, Akkordton, Stärke] – von dicht (Tag) bis karg (Nacht/Gespräch) */
const PAT_FULL: Hit[][] = [
  [
    [0, 0, 0.85],
    [1.5, 2, 0.42],
    [2, 3, 0.45],
    [3, 2, 0.38],
  ],
  [
    [0, 0, 0.85],
    [0.5, 1, 0.38],
    [2, 2, 0.42],
    [2.5, 4, 0.4],
  ],
  [
    [0, 0, 0.85],
    [1, 1, 0.38],
    [2, 3, 0.42],
    [3, 4, 0.36],
  ],
  [
    [0, 0, 0.85],
    [0.5, 1, 0.34],
    [1, 2, 0.38],
    [2, 4, 0.38],
    [2.5, 3, 0.34],
    [3.5, 2, 0.3],
  ],
];
const PAT_SPARSE: Hit[][] = [
  [
    [0, 0, 0.8],
    [2, 2, 0.4],
  ],
  [
    [0, 0, 0.8],
    [1.5, 3, 0.35],
    [3, 2, 0.3],
  ],
  [[0, 0, 0.75]],
];

// ───────────────────────────── Zustand und Mischung

export interface MusicState {
  /** Tageszeit 0 = Tag, 0,5 = Abend, 1 = Nacht */
  t: number;
  inside: boolean;
  dialog: boolean;
}

interface Mood {
  day: number;
  eve: number;
  night: number;
}

function moodOf(t: number): Mood {
  const day = 1 - smoothstep(0.15, 0.5, t);
  const night = smoothstep(0.6, 0.95, t);
  return { day, night, eve: clamp(1 - day - night) };
}

/** Zielwerte der Mischpult-Regler für einen Zustand */
function mixOf(s: MusicState): {
  mel: number;
  zheng: number;
  acc: number;
  tone: number;
  wet: number;
  echo: number;
  width: number;
  master: number;
} {
  const m = moodOf(s.t);
  const w = (d: number, e: number, n: number): number => m.day * d + m.eve * e + m.night * n;
  const talk = s.dialog;
  return {
    mel: w(1, 0.82, 0.5) * (talk ? 0.2 : 1),
    zheng: w(1, 0.9, 0.8) * (talk ? 0.62 : 1),
    acc: w(0.85, 1, 1.1) * (talk ? 0.6 : 1),
    tone: w(7200, 4700, 3300) * (s.inside ? 0.72 : 1) * (talk ? 0.75 : 1),
    wet: (s.inside ? 0.3 : 0.56) + m.night * 0.08,
    echo: s.inside ? 0.12 : 0.26,
    width: s.inside ? 0.72 : 1.12,
    master: talk ? 0.72 : 1,
  };
}

/** Parameter ohne Sprung zum Ziel gleiten lassen (nie NaN, nie Knacken) */
function glide(p: AudioParam, v: number, t: number, tc: number): void {
  if (!Number.isFinite(v)) return;
  if (typeof p.cancelAndHoldAtTime === 'function') p.cancelAndHoldAtTime(t);
  else {
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
  }
  p.setTargetAtTime(v, t, tc);
}

// ───────────────────────────── Variation

/** Phrase leicht abwandeln: Verzierungen, geteilte lange Töne, punktierte Achtel, selten ein Nachbarton */
function vary(src: DTok[], rnd: Rng, amt: number): DTok[] {
  const out: DTok[] = [];
  const lastNote = src.reduce((k, t, i) => (t.deg !== null ? i : k), -1);
  for (let i = 0; i < src.length; i++) {
    const t = { ...src[i]! };
    const next = src[i + 1];
    if (t.deg === null || i === lastNote) {
      out.push(t);
      continue;
    }
    const nd = next && next.deg !== null ? next.deg : null;
    if (/[\^v/]/.test(t.orn) && rnd() < 0.3 * amt) t.orn = t.orn.replace(/[\^v/]/g, '');
    else if (t.beats >= 0.5 && !t.orn && rnd() < 0.12 * amt) t.orn = rnd() < 0.5 ? '^' : 'v';
    else if (t.beats >= 1 && nd !== null && Math.abs(nd - t.deg) >= 2 && rnd() < 0.2 * amt) t.orn += '/';
    // langer Ton → Ton + Wechselnote in Richtung des Folgetons
    if (t.beats >= 1 && nd !== null && rnd() < 0.18 * amt) {
      const step = nd > t.deg ? 1 : nd < t.deg ? -1 : rnd() < 0.5 ? 1 : -1;
      out.push({ deg: t.deg, beats: t.beats - 0.5, orn: t.orn });
      out.push({ deg: t.deg + step, beats: 0.5, orn: '' });
      continue;
    }
    // zwei Achtel → punktiert
    if (
      t.beats === 0.5 &&
      next &&
      nd !== null &&
      next.beats === 0.5 &&
      i + 1 !== lastNote &&
      rnd() < 0.15 * amt
    ) {
      out.push({ deg: t.deg, beats: 0.75, orn: t.orn });
      out.push({ deg: nd, beats: 0.25, orn: next.orn });
      i++;
      continue;
    }
    if (i > 0 && rnd() < 0.05 * amt) t.deg += rnd() < 0.5 ? 1 : -1;
    out.push(t);
  }
  return out;
}

const pick = <T>(rnd: Rng, arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;

function weighted<T>(rnd: Rng, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + Math.max(0, w), 0);
  let r = rnd() * total;
  for (const [v, w] of items) {
    r -= Math.max(0, w);
    if (r <= 0) return v;
  }
  return items[items.length - 1]![0];
}

// ───────────────────────────── Kern: Mischpult, Komponist, Taktgeber

type Layer = 'mel' | 'zheng' | 'acc';

interface QEv {
  t: number;
  layer: Layer;
  fn: () => void;
}

export interface MusicLogEntry {
  /** Startzeit (Kontextzeit, s) */
  t: number;
  kind: string;
  id: string;
  key: KeyName;
  /** Verschiebung in Skalenstufen */
  shift: number;
}

/**
 * Kontextunabhängiger Kern (AudioContext oder OfflineAudioContext): Signalkette mit drei Ebenen
 * (Melodie, Guzheng, Akzente), gemeinsamer Hall/Echo, sanfter Begrenzer – und der Komponist.
 */
export class MusicCore {
  readonly out: GainNode;
  readonly log: MusicLogEntry[] = [];
  /** wird bei jedem Tonartwechsel aufgerufen (Tonklassen der aktuellen Pentatonik) */
  onKey: ((pcs: number[]) => void) | null = null;
  private readonly rnd: Rng;
  private readonly live = new Set<AudioScheduledSourceNode>();
  private q: QEv[] = [];
  private cursor = 0;
  private key: KeyName = 'G';
  private recent: string[] = [];
  private sinceCoda = 0;
  /** Abschnitte seit dem letzten Tonartwechsel */
  private inKey = 0;
  private state: MusicState = { t: 0, inside: false, dialog: false };
  private readonly layers: Record<Layer, { studio: Studio; gains: GainNode[] }>;
  private readonly tone: BiquadFilterNode;
  private readonly wet: GainNode;
  private readonly echoWet: GainNode;
  private readonly mix: GainNode;

  constructor(
    readonly ctx: BaseAudioContext,
    dest: AudioNode,
    seed = (Math.random() * 2 ** 31) | 0,
  ) {
    this.rnd = mulberry32(seed);
    const sum = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 40;
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowshelf';
    warm.frequency.value = 220;
    warm.gain.value = 1.5;
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 6000;
    this.tone.Q.value = 0.5;
    this.mix = ctx.createGain();
    // Sanfter Begrenzer: greift nur bei Spitzen
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 8;
    comp.attack.value = 0.004;
    comp.release.value = 0.35;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    sum.connect(hp).connect(warm).connect(this.tone).connect(this.mix).connect(comp).connect(this.out);
    this.out.connect(dest);

    const verbIn = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx, 3.8, mulberry32(2207));
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.45;
    verbIn.connect(conv).connect(this.wet).connect(sum);

    const echoIn = ctx.createGain();
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.5;
    const fbLp = ctx.createBiquadFilter();
    fbLp.type = 'lowpass';
    fbLp.frequency.value = 2200;
    const fb = ctx.createGain();
    fb.gain.value = 0.2;
    this.echoWet = ctx.createGain();
    this.echoWet.gain.value = 0.22;
    const echoVerb = ctx.createGain();
    echoVerb.gain.value = 0.5;
    echoIn.connect(delay).connect(fbLp).connect(fb).connect(delay);
    fbLp.connect(this.echoWet).connect(sum);
    this.echoWet.connect(echoVerb).connect(verbIn);

    const track = (n: AudioScheduledSourceNode): void => {
      this.live.add(n);
      n.addEventListener(
        'ended',
        () => {
          this.live.delete(n);
          n.disconnect();
        },
        { once: true },
      );
    };
    const layer = (): { studio: Studio; gains: GainNode[] } => {
      const dry = ctx.createGain();
      const rv = ctx.createGain();
      const ec = ctx.createGain();
      dry.connect(sum);
      rv.connect(verbIn);
      ec.connect(echoIn);
      return {
        studio: { ctx, rnd: this.rnd, dry, reverb: rv, echo: ec, width: 1, track },
        gains: [dry, rv, ec],
      };
    };
    this.layers = { mel: layer(), zheng: layer(), acc: layer() };
  }

  /** Anzahl gerade lebender Klangquellen (für Tests) */
  get voices(): number {
    return this.live.size;
  }

  get pending(): number {
    return this.q.length;
  }

  get currentKey(): KeyName {
    return this.key;
  }

  /** Zustand übernehmen und Mischung blenden (tc = Zeitkonstante, ~3·tc bis zum Ziel) */
  setState(s: Partial<MusicState>, tc = 1.6): void {
    const n = { ...this.state, ...s };
    n.t = Number.isFinite(n.t) ? clamp(n.t) : this.state.t;
    this.state = n;
    const m = mixOf(n);
    const now = this.ctx.currentTime;
    for (const [name, v] of [
      ['mel', m.mel],
      ['zheng', m.zheng],
      ['acc', m.acc],
    ] as [Layer, number][]) {
      for (const g of this.layers[name].gains) glide(g.gain, v, now, tc);
      this.layers[name].studio.width = m.width;
    }
    glide(this.tone.frequency, m.tone, now, tc);
    glide(this.wet.gain, m.wet, now, tc);
    glide(this.echoWet.gain, m.echo, now, tc);
    glide(this.mix.gain, m.master, now, tc);
  }

  get current(): MusicState {
    return { ...this.state };
  }

  /** Taktgeber: plant Abschnitte nach und übergibt fällige Ereignisse an die Instrumente */
  pump(now: number, lookahead = 1.6): void {
    if (this.cursor < now) this.cursor = now + 0.3;
    while (this.cursor < now + 3) this.planSection();
    let i = 0;
    while (i < this.q.length && this.q[i]!.t < now + lookahead) {
      const ev = this.q[i++]!;
      if (ev.t >= now - 0.05) this.exec(ev);
    }
    if (i) this.q.splice(0, i);
  }

  /** Offline: alles bis `until` planen und sofort anlegen */
  renderAll(until: number): void {
    while (this.cursor < until) this.planSection();
    for (const ev of this.q) if (ev.t < until) this.exec(ev);
    this.q = [];
  }

  /** Geplantes verwerfen (z. B. beim Stoppen) und neu beginnen lassen */
  reset(): void {
    this.q = [];
    this.cursor = 0;
  }

  /** alle klingenden Quellen sofort beenden */
  silence(): void {
    for (const n of this.live) {
      try {
        n.stop();
      } catch {
        /* bereits beendet */
      }
    }
  }

  /** Ein festlicher Schwall (Finale / Anstoßen): gebrochener Akkord, Tremolo, gehaltener Erhu-Ton */
  swell(): void {
    const t = this.ctx.currentTime + 0.08;
    const tonic = KEYS[this.key];
    const zs = this.layers.zheng.studio;
    const bass = this.bass(0);
    [bass - 12, bass, bass + 7, bass + 12, bass + 16, bass + 19, bass + 24].forEach((m, i) =>
      pluck(zs, m, t + i * 0.085, { vel: 0.6 - i * 0.04, bend: i === 1 ? 30 : 0, verb: 0.45 }),
    );
    tremolo(zs, tonic + 12, t + 0.7, 2.4, 0.38, { pan: 0.15, verb: 0.5 });
    const toks = this.toks(toDeg('B4/:1 D5~:3'), 0);
    const notes = lineNotes(this.layers.mel.studio, toks, 0, tempoMap(60, [], t + 0.4), pcsOf(tonic), 0.9);
    erhu(this.layers.mel.studio, notes, { pan: 0.1, verb: 0.5, echo: 0.12, level: 0.075 });
  }

  // ─────────── intern

  private exec(ev: QEv): void {
    // Im Gespräch schweigt die Erhu; nur Guzheng und Akzente bleiben (bereits geplante Phrasen entfallen)
    if (ev.layer === 'mel' && this.state.dialog) return;
    ev.fn();
  }

  private push(layer: Layer, sc: Score): void {
    for (const e of sc.evs) this.q.push({ t: e.t, layer, fn: e.fn });
    this.q.sort((a, b) => a.t - b.t);
  }

  private at(layer: Layer, t: number, fn: () => void): void {
    const sc = new Score();
    sc.at(t, fn);
    this.push(layer, sc);
  }

  private note(kind: string, id: string, t: number, shift = 0): void {
    this.log.push({ t, kind, id, key: this.key, shift });
    if (this.log.length > 400) this.log.splice(0, this.log.length - 400);
    // zuletzt gespielte Paare/Motive merken, damit sie nicht gleich wiederkehren
    for (const part of id.split(/[+]/)) this.recent.push(part.replace(/[ac]$/, ''));
    if (this.recent.length > 7) this.recent.splice(0, this.recent.length - 7);
  }

  /** Basston (D2 … C♯3) einer Grundton-Stufe in der aktuellen Tonart */
  private bass(deg: number): number {
    const pc = mod(KEYS[this.key] + SCALE[mod(deg, 5)]!, 12);
    let m = 36 + mod(pc - 36, 12);
    if (m < 38) m += 12;
    return m;
  }

  /** Begleitakkord: Bass, Quinte, Oktave und zwei Skalentöne darüber */
  private chord(deg: number): number[] {
    // Die dritte Stufe (Jue) hat keine reine Quinte in der Skala → Akkord der Grundstufe
    const d = mod(deg, 5) === 2 ? deg - 2 : deg;
    const b = this.bass(d);
    const pcs = pcsOf(KEYS[this.key]);
    const up = (m: number): number => {
      let x = m + 1;
      while (!pcs.includes(mod(x, 12))) x++;
      return x;
    };
    const o = b + 12;
    const c1 = up(o);
    return [b, b + 7, o, c1, up(c1)];
  }

  private toks(src: DTok[], shift: number, oct = 0): Tok[] {
    const tonic = KEYS[this.key] + oct;
    return src.map((t) => ({
      midi: t.deg === null ? null : degToMidi(t.deg + shift, tonic),
      beats: t.beats,
      orn: t.orn,
    }));
  }

  /** Stufenverschiebung wählen, bei der die Phrase im Tonumfang [lo, hi] bleibt (kleine bevorzugt) */
  private fitShift(src: DTok[], lo: number, hi: number, allowShift: boolean): number {
    const degs = src.filter((t) => t.deg !== null).map((t) => t.deg!);
    const tonic = KEYS[this.key];
    const opts: [number, number][] = [];
    for (const s of [-3, -2, -1, 0, 1, 2, 3]) {
      const lo2 = Math.min(...degs.map((d) => degToMidi(d + s, tonic)));
      const hi2 = Math.max(...degs.map((d) => degToMidi(d + s, tonic)));
      if (lo2 >= lo && hi2 <= hi)
        opts.push([s, s === 0 ? 6 : allowShift ? [0, 2, 1, 0.4][Math.abs(s)]! : 0.01]);
    }
    return opts.length ? weighted(this.rnd, opts) : 0;
  }

  private bpm(): number {
    const m = moodOf(this.state.t);
    const base = m.day * 62 + m.eve * 55 + m.night * 49;
    return base - (this.state.dialog ? 4 : 0) + (this.rnd() - 0.5) * 5;
  }

  /** Dichte der Begleitung 0..1 */
  private density(): number {
    const m = moodOf(this.state.t);
    return (m.day * 1 + m.eve * 0.7 + m.night * 0.42) * (this.state.dialog ? 0.6 : 1);
  }

  private planSection(): void {
    const r = this.rnd;
    const m = moodOf(this.state.t);
    const talk = this.state.dialog;
    let t0 = Math.max(this.cursor, this.ctx.currentTime + 0.2);

    // Ausweichung in eine verwandte Tonart (mit einem Guzheng-Lauf als Brücke); jede Tonart bleibt eine Weile
    this.inKey++;
    const leave = this.key === 'G' ? this.inKey >= 5 && r() < 0.12 : this.inKey >= 3 && r() < 0.3;
    if (leave) {
      const next: KeyName = this.key === 'G' ? (r() < 0.65 ? 'D' : 'A') : 'G';
      this.key = next;
      this.inKey = 0;
      this.onKey?.(pcsOf(KEYS[next]));
      t0 = this.bridge(t0);
    }

    // Der erste Abschnitt stellt (außer nachts / im Gespräch) die Erhu vor
    const opening = this.log.length === 0 && !talk && m.night < 0.5;
    const kind = opening
      ? 'period'
      : weighted<string>(r, [
          ['period', talk ? 0 : m.day * 5 + m.eve * 4 + m.night * 1.2],
          ['zhengPeriod', m.day * 1.4 + m.eve * 2 + m.night * 3 + (talk ? 4 : 0)],
          ['interlude', 2],
          ['still', m.day * 0.5 + m.eve * 1 + m.night * 3 + (talk ? 1.5 : 0)],
          ['coda', this.sinceCoda > 2 ? 1.5 + this.sinceCoda * 0.5 : 0],
        ]);
    let end: number;
    if (kind === 'period') end = this.period(t0, true);
    else if (kind === 'zhengPeriod') end = this.period(t0, false);
    else if (kind === 'interlude') end = this.interlude(t0);
    else if (kind === 'still') end = this.still(t0);
    else end = this.coda(t0);
    this.sinceCoda = kind === 'coda' ? 0 : this.sinceCoda + 1;

    // Pause bis zum nächsten Abschnitt: tags kurz, nachts und im Gespräch länger, manchmal lange Stille
    let rest = m.day * lerp(0.4, 2.5, r()) + m.eve * lerp(1, 4, r()) + m.night * lerp(3, 10, r());
    if (talk) rest += lerp(2, 5, r());
    if (kind === 'coda' || r() < 0.12) rest += lerp(7, 15, r());
    this.cursor = Math.max(end + rest, t0 + 1);
  }

  /** Vordersatz + Nachsatz mit Begleitung; Melodie auf der Erhu oder (karger) auf der Guzheng */
  private period(t0: number, onErhu: boolean): number {
    const r = this.rnd;
    const m = moodOf(this.state.t);
    const prefer = (p: Pair): number =>
      (p.mood === 'bright' ? m.day * 2 + m.eve * 0.6 + m.night * 0.3 : 0) +
      (p.mood === 'calm' ? m.day + m.eve * 2 + m.night : 0) +
      (p.mood === 'low' ? m.day * 0.5 + m.eve + m.night * 2 : 0) +
      0.2;
    const fresh = PAIRS.filter((p) => !this.recent.includes(p.id));
    const pool = fresh.length ? fresh : PAIRS;
    const pa = weighted(
      r,
      pool.map((p) => [p, prefer(p)] as [Pair, number]),
    );
    // manchmal Vordersatz und Nachsatz aus verschiedenen Paaren kombinieren
    const pc = r() < 0.3 ? pick(r, PAIRS) : pa;
    const amt = 0.5 + r() * 0.8;
    const a = vary(pa.a, r, amt);
    const c = vary(pc.c, r, amt);
    const oct = !onErhu && r() < 0.35 ? 12 : 0;
    const shift = this.fitShift([...a, ...c], onErhu ? 62 : 55, onErhu ? 83 : 88 - oct, r() < 0.45);
    this.note(onErhu ? 'erhu' : 'zheng', pa === pc ? pa.id : `${pa.id}a+${pc.id}c`, t0, shift);
    const pcs = pcsOf(KEYS[this.key]);

    const intro = r() < 0.35 ? 2 : 0;
    const len = intro + 16;
    const tm = tempoMap(
      this.bpm(),
      [
        [intro + 8, 1, 0.1],
        [len, 2.5, 0.25 + r() * 0.2],
      ],
      t0,
    );
    const zs = this.layers.zheng.studio;
    const zsc = new Score();
    if (intro) {
      // Vorspiel: gebrochener Akkord der ersten Harmonie
      this.chord(pa.ca[0]![0]! + shift).forEach((n, i) => {
        const t = tm(0) + 0.05 + i * 0.09;
        zsc.at(t, () => pluck(zs, n, t, { vel: 0.5 - i * 0.04, bend: i === 0 ? 30 : 0, pan: -0.25 }));
      });
    }
    // Melodie
    const ta = this.toks(a, shift, oct);
    const tc = this.toks(c, shift, oct);
    if (onErhu) {
      const ms = this.layers.mel.studio;
      for (const [toks, start, vel] of [
        [ta, intro, 0.72 + r() * 0.12],
        [tc, intro + 8, 0.76 + r() * 0.14],
      ] as [Tok[], number, number][]) {
        const notes = lineNotes(ms, toks, start, tm, pcs, vel);
        if (!notes.length) continue;
        this.at('mel', notes[0]!.t - 0.3, () =>
          erhu(ms, notes, { pan: 0.1, verb: 0.45, echo: 0.12, level: 0.07 }),
        );
      }
    } else {
      const v = 0.5 + r() * 0.1;
      pluckLine(zs, zsc, ta, intro, tm, pcs, v, { pan: -0.02, verb: 0.42 });
      pluckLine(zs, zsc, tc, intro + 8, tm, pcs, v, { pan: -0.02, verb: 0.42 });
    }
    // Begleitung: je dichter, desto vollere Muster; einzelne Takte bleiben ganz leer
    const dens = this.density() * (onErhu ? 1 : 0.7);
    const bars: { bar: number; chord: number[]; chord2?: number[]; pat: Hit[] }[] = [];
    [...pa.ca, ...pc.cc].forEach((ch, i) => {
      if (i > 0 && r() > 0.35 + dens * 0.65) return;
      const pat = r() < dens * 0.85 ? pick(r, PAT_FULL) : pick(r, PAT_SPARSE);
      bars.push({
        bar: i,
        chord: this.chord(ch[0]! + shift),
        chord2: ch[1] !== undefined ? this.chord(ch[1] + shift) : undefined,
        pat,
      });
    });
    const tmA: TempoMap = (b) => tm(b + intro);
    accompany(zs, zsc, tmA, { beatsPerBar: 4, vel: onErhu ? 0.46 : 0.36, pan: -0.25, bars });
    this.push('zheng', zsc);
    // Akzent am Phrasenende: Laternenglöckchen (selten)
    if (r() < 0.12 + m.night * 0.15) this.chime(tm(len) - 0.4);
    return tm(len) + 0.8;
  }

  /** Brücke in eine neue Tonart: kurzer Lauf aufwärts und Bass */
  private bridge(t0: number): number {
    const tonic = KEYS[this.key];
    const zs = this.layers.zheng.studio;
    const notes = [-3, -2, -1, 0, 1, 2, 3, 4, 5].map((d) => degToMidi(d, tonic - 12));
    this.note('bridge', `→${this.key}`, t0);
    this.at('zheng', t0, () => gliss(zs, notes, t0 + 0.05, 0.07, 0.18, 0.42));
    const b = this.bass(0);
    this.at('zheng', t0 + 1.0, () => pluck(zs, b, t0 + 1.0, { vel: 0.6, bend: 30, pan: -0.3 }));
    return t0 + 3.2;
  }

  /** Guzheng allein: ein bis zwei kurze Motive, manchmal mit Glissando oder Tremolo */
  private interlude(t0: number): number {
    const r = this.rnd;
    const zs = this.layers.zheng.studio;
    const pcs = pcsOf(KEYS[this.key]);
    const n = r() < 0.55 ? 1 : 2;
    const tm = tempoMap(this.bpm() * 0.95, [[n * 4, 1.5, 0.25]], t0);
    const sc = new Score();
    const ids: string[] = [];
    for (let k = 0; k < n; k++) {
      const pool = INTERLUDES.filter((x) => !this.recent.includes(x.id) && !ids.includes(x.id));
      const il = pick(r, pool.length ? pool : INTERLUDES);
      ids.push(il.id);
      const toks = vary(il.toks, r, 0.8);
      const shift = this.fitShift(toks, 55, 86, r() < 0.4);
      const b = this.bass(il.root + shift);
      const tb = tm(k * 4);
      sc.at(tb, () => pluck(zs, b, tb, { vel: 0.62, bend: r() < 0.5 ? 30 : 0, pan: -0.3 }));
      pluckLine(zs, sc, this.toks(toks, shift), k * 4, tm, pcs, 0.5 + r() * 0.1, { pan: -0.05, verb: 0.42 });
    }
    this.note('interlude', ids.join('+'), t0);
    let end = tm(n * 4);
    if (r() < 0.25) {
      const tonic = KEYS[this.key];
      const top = degToMidi(r() < 0.5 ? 3 : 0, tonic + (r() < 0.5 ? 12 : 0));
      sc.at(end, () => tremolo(zs, top, end, 1.8, 0.3, { pan: 0.1, verb: 0.5 }));
      end += 2;
    }
    this.push('zheng', sc);
    return end + 0.6;
  }

  /** Schluss: Kadenz auf dem Grundton, danach längere Pause */
  private coda(t0: number): number {
    const r = this.rnd;
    const zs = this.layers.zheng.studio;
    const tonic = KEYS[this.key];
    const b = this.bass(0);
    const sc = new Score();
    const v = r();
    const id = v < 0.35 ? 'K1' : v < 0.7 ? 'K2' : 'K3';
    this.note('coda', id, t0);
    let end: number;
    if (id === 'K1') {
      // Bass, zwei hohe Töne, gebrochener Schlussakkord
      sc.at(t0, () => pluck(zs, b, t0, { vel: 0.6, pan: -0.3 }));
      const h1 = degToMidi(3, tonic);
      const h2 = degToMidi(2, tonic);
      sc.at(t0 + 1.5, () => pluck(zs, h1, t0 + 1.5, { vel: 0.33, pan: 0.2, verb: 0.55 }));
      sc.at(t0 + 2.1, () => pluck(zs, h2, t0 + 2.1, { vel: 0.3, pan: 0.15, verb: 0.55 }));
      [b - 12, b, b + 7, b + 12, b + 16, b + 24].forEach((n, i) => {
        const t = t0 + 3.2 + i * 0.085;
        sc.at(t, () => pluck(zs, n, t, { vel: 0.5 - i * 0.04, bend: i === 1 ? 25 : 0, verb: 0.45 }));
      });
      end = t0 + 6;
    } else if (id === 'K2') {
      // leises Tremolo auf dem hohen Grundton über dem Bass
      sc.at(t0, () => pluck(zs, b, t0, { vel: 0.55, bend: 30, pan: -0.3 }));
      sc.at(t0 + 0.4, () => tremolo(zs, tonic + 12, t0 + 0.4, 2.6, 0.28, { pan: 0.1, verb: 0.5 }));
      end = t0 + 4.5;
    } else {
      // das Kopfmotiv abwärts, letzter Ton gehalten
      const tm = tempoMap(52, [[5, 2, 0.4]], t0);
      sc.at(t0, () => pluck(zs, b, t0, { vel: 0.55, pan: -0.3 }));
      pluckLine(zs, sc, this.toks(toDeg('D5:.5 B4:.5 A4:1 G4~:2'), 0), 0, tm, pcsOf(tonic), 0.45, {
        pan: 0,
        verb: 0.5,
      });
      end = tm(5);
    }
    this.push('zheng', sc);
    if (r() < 0.35) this.chime(end - 0.5);
    return end;
  }

  /** Fast-Stille: Klangschale, vereinzelte Zupftöne, nachts ein Bordun, drinnen manchmal eingegossener Tee */
  private still(t0: number): number {
    const r = this.rnd;
    const m = moodOf(this.state.t);
    const tonic = KEYS[this.key];
    const zs = this.layers.zheng.studio;
    const as = this.layers.acc.studio;
    const dur = lerp(9, 18, r()) + m.night * 4;
    const end = t0 + dur;
    const parts: string[] = [];
    if (m.night > 0.3 && r() < 0.7) {
      const b = this.bass(0);
      this.at('acc', t0, () => drone(as, t0, end + 4, [b, b + 7, b + 12], 0.012));
      parts.push('drone');
    }
    if (r() < 0.55) {
      const tb = t0 + 0.4 + r() * 1.5;
      const f = mtof(degToMidi(r() < 0.6 ? 0 : 3, tonic - 12));
      this.at('acc', tb, () =>
        bell(as, f, tb, { kind: 'bowl', vel: 0.38, decay: 9, attack: 0.5 + r() * 0.5, verb: 0.65 }),
      );
      parts.push('bowl');
    }
    // zwei bis vier einzelne Töne mit viel Raum dazwischen
    let t = t0 + 2 + r() * 2;
    const count = 2 + Math.floor(r() * 3);
    let deg = pick(r, [3, 4, 5, 6]);
    for (let k = 0; k < count && t < end - 1; k++) {
      const midi = degToMidi(deg, tonic);
      const tt = t;
      const bend = r() < 0.4 ? 25 + r() * 20 : 0;
      this.at('zheng', tt, () =>
        pluck(zs, midi, tt, { vel: 0.4 + r() * 0.15, bend, vib: r() < 0.4 ? 12 : 0, verb: 0.7, echo: 0.25 }),
      );
      deg = clamp(deg + pick(r, [-2, -1, -1, 1, 2]), 1, 8);
      t += lerp(1.6, 3.6, r());
    }
    parts.push(`${count}×pluck`);
    if (this.state.inside && r() < 0.45) {
      const tp = t0 + dur * (0.3 + r() * 0.3);
      this.at('acc', tp, () => pour(as, tp, 2.6 + r(), 0.32, 0.3));
      parts.push('pour');
    }
    if (r() < 0.3) this.chime(end - 2);
    this.note('still', parts.join('+'), t0);
    return end;
  }

  /** Laternenglöckchen: ein bis drei hohe Glockentöne der aktuellen Pentatonik */
  private chime(t0: number): void {
    const r = this.rnd;
    const tonic = KEYS[this.key];
    const n = 1 + Math.floor(r() * 3);
    const as = this.layers.acc.studio;
    for (let k = 0; k < n; k++) {
      const t = t0 + k * (0.18 + r() * 0.25);
      const f = mtof(degToMidi(10 + Math.floor(r() * 4), tonic));
      const pan = (r() - 0.5) * 0.8;
      const vel = 0.16 + r() * 0.1;
      this.at('acc', t, () => bell(as, f, t, { kind: 'bell', vel, decay: 4.5, pan, verb: 0.6 }));
    }
  }
}

// ───────────────────────────── Spiel-Anbindung (Echtzeit)

/** Spielmusik: Echtzeit-Hülle um den Kern, angeschlossen an den Musik-Bus der Engine */
export class Music {
  /** wird bei jedem Tonartwechsel aufgerufen (z. B. damit das Windspiel passt) */
  onKey: ((pcs: number[]) => void) | null = null;
  private core: MusicCore | null = null;
  private timer = 0;
  private running = false;
  private gen = 0;
  private state: MusicState = { t: 0, inside: false, dialog: false };

  constructor(private e: AudioEngine) {}

  get isRunning(): boolean {
    return this.running;
  }

  /** Test-Hilfe: Protokoll der gewählten Phrasen, Zahl lebender Quellen, Warteschlange */
  get debug(): { log: MusicLogEntry[]; voices: number; pending: number; key: string } | null {
    const c = this.core;
    return c ? { log: c.log.slice(), voices: c.voices, pending: c.pending, key: c.currentKey } : null;
  }

  start(): void {
    if (this.running || !this.e.started) return;
    this.running = true;
    this.gen++;
    const ctx = this.e.ctx;
    if (!this.core) {
      this.core = new MusicCore(ctx, this.e.buses.music);
      this.core.onKey = (pcs) => this.onKey?.(pcs);
    }
    const c = this.core;
    c.reset();
    c.setState(this.state, 0.05);
    glide(c.out.gain, 1, ctx.currentTime, 1.2);
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 200);
    this.tick();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    window.clearInterval(this.timer);
    const c = this.core;
    if (!c) return;
    c.reset();
    glide(c.out.gain, 0, this.e.ctx.currentTime, 0.35);
    const gen = this.gen;
    window.setTimeout(() => {
      if (!this.running && gen === this.gen) c.silence();
    }, 2000);
  }

  /** Tageszeit 0..1 (0 Tag, 0,5 Abend, 1 Nacht) – Übergang über einige Sekunden */
  setTime(t: number): void {
    if (!Number.isFinite(t)) return;
    this.update({ t: clamp(t) }, 2);
  }

  setInside(inside: boolean): void {
    this.update({ inside }, 1.4);
  }

  /** Gespräch: Erhu tritt zurück, nur leise Guzheng bleibt */
  setDialog(dialog: boolean): void {
    if (dialog === this.state.dialog) return;
    this.update({ dialog }, dialog ? 0.9 : 2.2);
  }

  swell(): void {
    if (this.running && this.core) this.core.swell();
  }

  private update(s: Partial<MusicState>, tc: number): void {
    this.state = { ...this.state, ...s };
    if (this.core && this.e.started) this.core.setState(this.state, tc);
  }

  private tick(): void {
    if (!this.running || !this.core) return;
    // im Hintergrund angehaltener Kontext: nichts planen
    if (this.e.ctx.state !== 'running') return;
    this.core.pump(this.e.ctx.currentTime);
  }
}

// ───────────────────────────── Test-Hilfe: Offline-Rendering

export interface MusicRenderResult {
  state: MusicState;
  seconds: number;
  peak: number;
  rms: number;
  maxWindowRms: number;
  /** Anteil (0..1) der 1-s-Fenster, die praktisch still sind (< −50 dBFS) */
  silentShare: number;
  nan: number;
  log: MusicLogEntry[];
}

/** Rendert `seconds` Sekunden der generativen Musik für einen festen Zustand (ohne Lautsprecher) */
export async function renderMusicOffline(
  seconds: number,
  state: Partial<MusicState> = {},
  seed = 1,
): Promise<MusicRenderResult> {
  const sr = 44100;
  const off = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
  const core = new MusicCore(off, off.destination, seed);
  core.setState(state, 0.01);
  core.out.gain.setValueAtTime(0, 0);
  core.out.gain.linearRampToValueAtTime(1, 0.5);
  core.renderAll(seconds);
  const buf = await off.startRendering();
  let peak = 0;
  let sum = 0;
  let nan = 0;
  let maxWin = 0;
  let silent = 0;
  let wins = 0;
  const chans = [buf.getChannelData(0), buf.getChannelData(1)];
  for (let start = 0; start < buf.length; start += sr) {
    let ws = 0;
    let wn = 0;
    for (const d of chans) {
      const stop = Math.min(d.length, start + sr);
      for (let i = start; i < stop; i++) {
        const x = d[i]!;
        if (!Number.isFinite(x)) {
          nan++;
          continue;
        }
        peak = Math.max(peak, Math.abs(x));
        ws += x * x;
        wn++;
      }
    }
    sum += ws;
    const wr = wn ? Math.sqrt(ws / wn) : 0;
    maxWin = Math.max(maxWin, wr);
    if (wr < 0.00316) silent++;
    wins++;
  }
  return {
    state: core.current,
    seconds,
    peak,
    rms: Math.sqrt(sum / (buf.length * 2)),
    maxWindowRms: maxWin,
    silentShare: wins ? silent / wins : 0,
    nan,
    log: core.log.slice(),
  };
}
