// Instrumente der Spielmusik – reine Web-Audio-Synthese, keine Samples: Guzheng (Karplus-Strong-Saite mit
// Bends, Tremolo, Glissando), Erhu und Bambusflöte (gehaltene Melodiestimmen mit Portamento und Vibrato),
// Glocke/Klangschale, Bordun, Wassertropfen und eingegossener Tee. Ursprünglich im Musik-Labor entstanden;
// src/lab/musik-synth.ts nutzt dieselben Bausteine. Alle Instrumente spielen in ein „Studio“: trockener
// Ausgang plus Hall- und Echo-Sends. Gestartete Quellen werden über `track` gemeldet, damit der Besitzer
// sie stoppen bzw. nach dem Ausklingen aufräumen kann.
import { clamp, mulberry32 } from '../core/util';

export type Rng = () => number;

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
export const cents = (c: number): number => Math.pow(2, c / 1200);

/** Nächster Ton der Skala (Tonklassen pcs) oberhalb (dir = 1) bzw. unterhalb (dir = -1) */
export function neighbor(midi: number, dir: 1 | -1, pcs: number[]): number {
  let m = midi + dir;
  while (!pcs.includes(((m % 12) + 12) % 12)) m += dir;
  return m;
}

// ───────────────────────────── Studio

/** Signalkette, in die Instrumente spielen: `dry` plus Anteile an `reverb`/`echo`. */
export interface Studio {
  ctx: BaseAudioContext;
  rnd: Rng;
  dry: AudioNode;
  reverb: AudioNode;
  echo: AudioNode;
  /** Faktor für die Stereobreite (1 = unverändert) */
  width?: number;
  /** meldet eine gestartete Quelle (zum Stoppen bzw. Aufräumen) */
  track(node: AudioScheduledSourceNode): void;
}

/** Stereo-Impulsantwort: abklingendes Rauschen, das mit der Zeit dunkler wird (warmer Raum). */
export function makeImpulse(ctx: BaseAudioContext, seconds: number, rnd: Rng): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const pre = Math.floor(sr * 0.02);
  const buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const p = t / seconds;
      const env = Math.pow(10, (-3 * t) / seconds) * Math.min(1, t / 0.015);
      const a = 0.55 - 0.45 * Math.min(1, p * 1.4);
      lp += a * (rnd() * 2 - 1 - lp);
      d[i] = lp * env;
    }
  }
  return buf;
}

/** Instrumentausgang ins Stereobild setzen und an Hall/Echo schicken */
export function route(s: Studio, node: AudioNode, pan: number, verb: number, echo = 0): void {
  const p = s.ctx.createStereoPanner();
  p.pan.value = clamp(pan * (s.width ?? 1), -1, 1);
  node.connect(p);
  p.connect(s.dry);
  if (verb > 0) {
    const g = s.ctx.createGain();
    g.gain.value = verb;
    p.connect(g).connect(s.reverb);
  }
  if (echo > 0) {
    const g = s.ctx.createGain();
    g.gain.value = echo;
    p.connect(g).connect(s.echo);
  }
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    const rnd = mulberry32(7);
    buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 3), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

export function noiseSource(s: Studio, t: number, until: number): AudioBufferSourceNode {
  const src = s.ctx.createBufferSource();
  src.buffer = noiseBuffer(s.ctx);
  src.loop = true;
  src.start(t, s.rnd() * 2.5);
  src.stop(until);
  s.track(src);
  return src;
}

export function osc(s: Studio, type: OscillatorType, freq: number, t: number, until: number): OscillatorNode {
  const o = s.ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.start(t);
  o.stop(until);
  s.track(o);
  return o;
}

export function gain(ctx: BaseAudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

export function biquad(
  ctx: BaseAudioContext,
  type: BiquadFilterType,
  freq: number,
  q = 0.7,
  db = 0,
): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.gain.value = db;
  return f;
}

// ───────────────────────────── Instrument: Guzheng (Karplus-Strong)

const ksCache = new WeakMap<BaseAudioContext, Map<number, { buf: AudioBuffer; rate: number }>>();

/**
 * Karplus-Strong-Saite: gefiltertes Rauschen in einer Verzögerungsschleife mit Mittelwertfilter.
 * Tiefe Saiten klingen länger nach als hohe; die Anzupfstelle (Kammfilter) gibt den hellen Stahlsaiten-Klang.
 */
function ksBuffer(ctx: BaseAudioContext, midi: number): { buf: AudioBuffer; rate: number } {
  let cache = ksCache.get(ctx);
  if (!cache) ksCache.set(ctx, (cache = new Map()));
  const hit = cache.get(midi);
  if (hit) return hit;
  const sr = ctx.sampleRate;
  const f = mtof(midi);
  // Der Mittelwert mit dem nächsten (jüngeren) Wert verkürzt die Schleife auf n − 0,5 Abtastungen
  const n = Math.max(4, Math.ceil(sr / f + 0.5));
  const fBase = sr / (n - 0.5);
  const t60 = clamp(7 - (midi - 38) * 0.12, 1.6, 7);
  const loss = Math.pow(10, -3 / (t60 * fBase));
  const len = Math.floor(sr * Math.min(t60 * 0.85 + 0.4, 6));
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const rnd = mulberry32(1000 + midi);
  const ex = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    lp += 0.62 * (rnd() * 2 - 1 - lp);
    ex[i] = lp;
  }
  // Anzupfstelle bei etwa einem Achtel der Saite
  const pos = Math.max(1, Math.round(n * 0.12));
  const d = new Float32Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) {
    d[i] = ex[i]! - 0.85 * ex[(i + pos) % n]!;
    mean += d[i]!;
  }
  mean /= n;
  for (let i = 0; i < n; i++) d[i]! -= mean;
  let p = 0;
  for (let i = 0; i < len; i++) {
    const a = d[p]!;
    const b = d[(p + 1) % n]!;
    out[i] = a;
    d[p] = loss * 0.5 * (a + b);
    p = (p + 1) % n;
  }
  let peak = 1e-6;
  for (let i = 0; i < Math.min(len, 4000); i++) peak = Math.max(peak, Math.abs(out[i]!));
  for (let i = 0; i < len; i++) out[i]! /= peak;
  const res = { buf, rate: f / fBase };
  cache.set(midi, res);
  return res;
}

export interface PluckOpts {
  /** Anschlagstärke 0..1 */
  vel?: number;
  pan?: number;
  /** Tonhöhe beim Anschlag in Cent relativ zum Ziel; positiv = von oben herab gleiten */
  bend?: number;
  /** Gleitdauer des Bends (Zeitkonstante, s) */
  bendTime?: number;
  /** Vibrato der linken Hand (揉弦) in Cent */
  vib?: number;
  /** Zeit bis zum Abdämpfen (s); ohne Angabe klingt die Saite natürlich aus */
  ring?: number;
  verb?: number;
  echo?: number;
}

/** Ein gezupfter Guzheng-Ton */
export function pluck(s: Studio, midi: number, t: number, o: PluckOpts = {}): void {
  const { ctx } = s;
  const vel = clamp(o.vel ?? 0.6, 0.02, 1);
  const { buf, rate } = ksBuffer(ctx, midi);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const pr = src.playbackRate;
  if (o.bend) {
    pr.setValueAtTime(rate * cents(o.bend), t);
    pr.setTargetAtTime(rate, t + 0.012, o.bendTime ?? 0.06);
  } else {
    pr.setValueAtTime(rate, t);
  }
  const natural = buf.duration / rate - 0.25;
  const ring = Math.min(o.ring ?? natural, natural);
  const end = t + ring + 0.6;
  if (o.vib) {
    const lfo = osc(s, 'sine', 4.6 + s.rnd() * 0.8, t, end);
    const depth = gain(ctx, 0);
    depth.gain.setValueAtTime(0, t);
    depth.gain.setTargetAtTime(rate * (cents(o.vib) - 1), t + 0.35, 0.3);
    lfo.connect(depth).connect(pr);
  }
  const body = biquad(ctx, 'peaking', 260, 0.9, 3);
  const lp = biquad(ctx, 'lowpass', clamp(mtof(midi) * (3 + vel * 9), 900, 9000), 0.4);
  const g = ctx.createGain();
  const level = 0.55 * Math.pow(vel, 1.5);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.003);
  g.gain.setTargetAtTime(0, t + ring, ring < 0.6 ? 0.03 : 0.12);
  src.connect(body).connect(lp).connect(g);
  route(s, g, o.pan ?? clamp((midi - 62) / 30, -0.6, 0.6), o.verb ?? 0.35, o.echo ?? 0);
  src.start(t);
  src.stop(end);
  s.track(src);
}

/** Tremolo (摇指): schnell wiederholte Anschläge auf einem langen Ton, sanft an- und abschwellend */
export function tremolo(
  s: Studio,
  midi: number,
  t: number,
  dur: number,
  vel: number,
  o: PluckOpts = {},
): void {
  const rate = 10.5;
  const n = Math.max(2, Math.floor(dur * rate));
  for (let k = 0; k < n; k++) {
    const p = k / (n - 1);
    const shape = 0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, p * 1.3));
    const tt = t + k / rate + (s.rnd() - 0.5) * 0.012;
    const v = vel * shape * (k % 2 ? 0.82 : 1) * (0.92 + s.rnd() * 0.12);
    pluck(s, midi, tt, { ...o, vel: v, bend: 0, ring: k < n - 1 ? 1 / rate + 0.03 : undefined });
  }
}

/** Glissando (刮奏) über die Skalentöne */
export function gliss(s: Studio, notes: number[], t: number, step: number, v0: number, v1: number): void {
  notes.forEach((m, i) => {
    const p = i / Math.max(1, notes.length - 1);
    pluck(s, m, t + i * step * (1 - p * 0.25) + (s.rnd() - 0.5) * 0.006, {
      vel: v0 + (v1 - v0) * p,
      ring: i < notes.length - 1 ? 1.4 : undefined,
      verb: 0.45,
    });
  });
}

// ───────────────────────────── Gehaltene Melodiestimmen (Flöte, Erhu)

export interface LineNote {
  /** Einsatz (s, absolute Kontextzeit) */
  t: number;
  /** Dauer (s) */
  d: number;
  midi: number;
  /** Lautstärke 0..1 */
  v: number;
  /** Vorschlagston (MIDI) kurz vor dem Ton */
  grace?: number;
  /** gebunden: kein neuer Zungenstoß/Bogenwechsel */
  slur?: boolean;
  /** Vibrato-Tiefe am Ende des Tons (Cent) */
  vib?: number;
  /** ausdrucksvoller, langsamer Gleitton in den Ton hinein (Erhu) */
  slide?: boolean;
}

export interface LineOpts {
  pan?: number;
  verb?: number;
  echo?: number;
  level?: number;
}

const fluteWaves = new WeakMap<BaseAudioContext, PeriodicWave>();

function fluteWave(ctx: BaseAudioContext): PeriodicWave {
  let w = fluteWaves.get(ctx);
  if (!w) {
    // Grundton mit wenigen, schnell abfallenden Obertönen – runder Dizi-Kern
    const amps = [0, 1, 0.38, 0.17, 0.09, 0.05, 0.025, 0.012];
    const real = new Float32Array(amps.length);
    const imag = new Float32Array(amps);
    w = ctx.createPeriodicWave(real, imag);
    fluteWaves.set(ctx, w);
  }
  return w;
}

function phraseBounds(notes: LineNote[]): { t0: number; tEnd: number } {
  const first = notes[0]!;
  const last = notes[notes.length - 1]!;
  return { t0: first.t - 0.2, tEnd: last.t + last.d + 1.2 };
}

/**
 * Bambusflöte (Dizi): Sinus-/Obertonkern plus gefiltertes Atemrauschen, weicher Einsatz,
 * Zungenstöße zwischen Tönen, Vorschläge und ein Vibrato, das auf langen Tönen langsam wächst.
 */
export function flute(s: Studio, notes: LineNote[], o: LineOpts = {}): void {
  if (!notes.length) return;
  const { ctx } = s;
  const L = o.level ?? 0.16;
  const { t0, tEnd } = phraseBounds(notes);

  const tone = ctx.createOscillator();
  tone.setPeriodicWave(fluteWave(ctx));
  tone.frequency.setValueAtTime(mtof(notes[0]!.midi), t0);
  tone.start(t0);
  tone.stop(tEnd);
  s.track(tone);

  const lfo = osc(s, 'sine', 5.0, t0, tEnd);
  lfo.frequency.setValueAtTime(4.8, t0);
  lfo.frequency.linearRampToValueAtTime(5.5, tEnd);
  const vibC = gain(ctx, 0);
  lfo.connect(vibC).connect(tone.detune);
  const trem = gain(ctx, 1);
  const tremD = gain(ctx, 0);
  lfo.connect(tremD).connect(trem.gain);
  const amp = gain(ctx, 0);
  tone.connect(trem).connect(amp);

  // Atem: Band um den Ton plus etwas hohe „Luft“
  const noise = noiseSource(s, t0, tEnd);
  const bp = biquad(ctx, 'bandpass', mtof(notes[0]!.midi) * 2, 1.8);
  const air = biquad(ctx, 'highpass', 3800, 0.5);
  const airG = gain(ctx, 0.3);
  const nAmp = gain(ctx, 0);
  noise.connect(bp).connect(nAmp);
  noise.connect(air).connect(airG).connect(nAmp);

  const mix = ctx.createGain();
  const lp = biquad(ctx, 'lowpass', 5200, 0.5);
  amp.connect(mix);
  nAmp.connect(mix);
  mix.connect(lp);
  route(s, lp, o.pan ?? 0.15, o.verb ?? 0.5, o.echo ?? 0.18);

  notes.forEach((n, i) => {
    const f = mtof(n.midi);
    const prev = notes[i - 1];
    const next = notes[i + 1];
    const fresh = !prev || n.t - (prev.t + prev.d) > 0.06;
    const leaveGap = !next || next.t - (n.t + n.d) > 0.06;
    const ta = n.grace !== undefined ? n.t - 0.075 : n.t;
    const v = n.v * L;
    const fp = tone.frequency;
    // Tonhöhe (mit Vorschlag)
    if (n.grace !== undefined) {
      if (fresh) fp.setTargetAtTime(mtof(n.grace), ta - 0.01, 0.004);
      else fp.setTargetAtTime(mtof(n.grace), ta, 0.006);
      fp.setTargetAtTime(f, n.t, 0.008);
    } else if (fresh) {
      fp.setTargetAtTime(f, ta - 0.01, 0.004);
    } else {
      fp.setTargetAtTime(f, n.t - 0.004, 0.012);
    }
    bp.frequency.setTargetAtTime(f * 2, ta, 0.02);
    // Lautstärke: weicher Einsatz, Zungenstoß, Anschwellen langer Töne
    if (fresh) {
      amp.gain.setTargetAtTime(v, ta, 0.05);
      nAmp.gain.setTargetAtTime(v * 0.55, ta, 0.012);
      nAmp.gain.setTargetAtTime(v * 0.12, ta + 0.07, 0.08);
    } else if (!n.slur) {
      amp.gain.setTargetAtTime(v * 0.5, ta - 0.035, 0.01);
      amp.gain.setTargetAtTime(v, ta, 0.022);
      nAmp.gain.setTargetAtTime(v * 0.35, ta, 0.01);
      nAmp.gain.setTargetAtTime(v * 0.1, ta + 0.045, 0.06);
    } else {
      amp.gain.setTargetAtTime(v, ta, 0.04);
    }
    if (n.d > 1) {
      amp.gain.setTargetAtTime(v * 1.15, n.t + 0.35, n.d * 0.25);
      amp.gain.setTargetAtTime(v * 0.88, n.t + n.d * 0.7, n.d * 0.12);
    }
    if (leaveGap) {
      const r = n.t + n.d - 0.06;
      amp.gain.setTargetAtTime(0, r, 0.07);
      nAmp.gain.setTargetAtTime(0, r, 0.05);
    }
    // Vibrato: setzt verzögert ein und wächst mit der Tonlänge
    vibC.gain.setTargetAtTime(3, ta, 0.03);
    tremD.gain.setTargetAtTime(0.005, ta, 0.03);
    if (n.d > 0.5) {
      const depth = (n.vib ?? 20) * Math.min(1, n.d / 2);
      vibC.gain.setTargetAtTime(depth, n.t + 0.25, n.d * 0.35);
      tremD.gain.setTargetAtTime(depth * 0.0025, n.t + 0.25, n.d * 0.35);
    }
  });
}

/**
 * Erhu: zwei leicht verstimmte Sägezähne durch Korpus-Formanten, langsamer Bogeneinsatz,
 * Portamento zwischen den Tönen, Bogenwechsel und weites, verzögertes Vibrato; dazu leises Bogenrauschen.
 */
export function erhu(s: Studio, notes: LineNote[], o: LineOpts = {}): void {
  if (!notes.length) return;
  const { ctx } = s;
  const L = o.level ?? 0.05;
  const { t0, tEnd } = phraseBounds(notes);

  // Gemeinsame Frequenz für beide Oszillatoren
  const fq = ctx.createConstantSource();
  fq.offset.setValueAtTime(mtof(notes[0]!.midi), t0);
  fq.start(t0);
  fq.stop(tEnd);
  s.track(fq);
  const lfo = osc(s, 'sine', 5.8, t0, tEnd);
  lfo.frequency.setValueAtTime(5.5, t0);
  lfo.frequency.linearRampToValueAtTime(6.1, tEnd);
  const vibC = gain(ctx, 0);
  lfo.connect(vibC);

  const amp = gain(ctx, 0);
  for (const det of [-5, 4]) {
    const o2 = osc(s, 'sawtooth', 0, t0, tEnd);
    o2.detune.value = det;
    fq.connect(o2.frequency);
    vibC.connect(o2.detune);
    o2.connect(amp);
  }
  // Korpus (Schlangenhaut-Resonanzen) und Bogendruck-abhängige Helligkeit
  const hp = biquad(ctx, 'highpass', 190, 0.6);
  const f1 = biquad(ctx, 'peaking', 640, 1.6, 5);
  const f2 = biquad(ctx, 'peaking', 1550, 2.2, 6);
  const f3 = biquad(ctx, 'peaking', 2900, 2.5, 2.5);
  const lp = biquad(ctx, 'lowpass', 1800, 0.6);
  const dip = biquad(ctx, 'peaking', 330, 1.2, -3);
  amp.connect(hp).connect(dip).connect(f1).connect(f2).connect(f3).connect(lp);

  const noise = noiseSource(s, t0, tEnd);
  const nbp = biquad(ctx, 'bandpass', 2400, 0.9);
  const nAmp = gain(ctx, 0);
  noise.connect(nbp).connect(nAmp);
  const mix = ctx.createGain();
  lp.connect(mix);
  nAmp.connect(mix);
  route(s, mix, o.pan ?? 0.08, o.verb ?? 0.45, o.echo ?? 0.1);

  notes.forEach((n, i) => {
    const f = mtof(n.midi);
    const prev = notes[i - 1];
    const next = notes[i + 1];
    const fresh = !prev || n.t - (prev.t + prev.d) > 0.08;
    const leaveGap = !next || next.t - (n.t + n.d) > 0.08;
    const v = n.v * L;
    const fp = fq.offset;
    // Tonhöhe: von unten anschleifen bzw. Portamento vom vorigen Ton
    if (fresh) {
      fp.setValueAtTime(f * cents(-40), n.t);
      fp.exponentialRampToValueAtTime(f, n.t + 0.14);
    } else {
      const pf = mtof(prev!.midi);
      const span = n.t - prev!.t;
      const semis = Math.abs(n.midi - prev!.midi);
      // Gleitzeit begrenzt durch beide Tonlängen, damit sich Automationen nicht überlappen
      const slide = Math.min(
        clamp(0.05 + 0.028 * semis, 0.06, 0.28) * (n.slide ? 1.9 : 1),
        span * 0.6,
        n.d * 0.5,
      );
      const lead = Math.min(slide * 0.4, span * 0.3);
      fp.setValueAtTime(pf, n.t - lead);
      fp.exponentialRampToValueAtTime(f, n.t - lead + slide);
    }
    // Bogen: langsamer Einsatz, kleiner Einbruch beim Bogenwechsel, Messa di voce auf langen Tönen
    const bright = 1300 + 2600 * n.v;
    if (fresh) {
      amp.gain.setTargetAtTime(v, n.t, 0.1);
      lp.frequency.setTargetAtTime(bright, n.t, 0.12);
      nAmp.gain.setTargetAtTime(v * 0.9, n.t, 0.03);
      nAmp.gain.setTargetAtTime(v * 0.3, n.t + 0.18, 0.12);
    } else if (!n.slur) {
      amp.gain.setTargetAtTime(v * 0.6, n.t - 0.06, 0.02);
      amp.gain.setTargetAtTime(v, n.t, 0.07);
      lp.frequency.setTargetAtTime(bright, n.t, 0.1);
      nAmp.gain.setTargetAtTime(v * 0.7, n.t, 0.02);
      nAmp.gain.setTargetAtTime(v * 0.3, n.t + 0.12, 0.1);
    } else {
      amp.gain.setTargetAtTime(v, n.t, 0.08);
      lp.frequency.setTargetAtTime(bright, n.t, 0.1);
    }
    if (n.d > 1.2) {
      amp.gain.setTargetAtTime(v * 1.25, n.t + 0.3, n.d * 0.3);
      lp.frequency.setTargetAtTime(bright + 700, n.t + 0.3, n.d * 0.3);
      amp.gain.setTargetAtTime(v * 0.85, n.t + n.d * 0.72, n.d * 0.15);
      lp.frequency.setTargetAtTime(bright - 200, n.t + n.d * 0.72, n.d * 0.15);
    }
    if (leaveGap) {
      const r = n.t + n.d - 0.1;
      amp.gain.setTargetAtTime(0, r, 0.12);
      nAmp.gain.setTargetAtTime(0, r, 0.08);
    }
    vibC.gain.setTargetAtTime(4, n.t, 0.05);
    if (n.d > 0.5) {
      const depth = (n.vib ?? 26) * Math.min(1, n.d / 1.6);
      vibC.gain.setTargetAtTime(depth, n.t + 0.18, n.d * 0.3);
    }
  });
}

// ───────────────────────────── Glocke, Klangschale, Bordun, Wasser

/** Teiltöne: [Verhältnis, Amplitude, relative Abklingzeit] */
type Partials = [number, number, number][];
const BOWL: Partials = [
  [1, 1, 1],
  [2.71, 0.45, 0.62],
  [5.15, 0.2, 0.38],
  [8.43, 0.07, 0.22],
];
const BELL: Partials = [
  [1, 1, 1],
  [2.01, 0.3, 0.6],
  [2.76, 0.28, 0.42],
  [5.4, 0.12, 0.25],
  [8.93, 0.05, 0.14],
];

export interface BellOpts {
  vel?: number;
  /** Nachklingzeit des Grundtons (s, bis −60 dB) */
  decay?: number;
  /** Einschwingzeit; lang = „singende“ Schale */
  attack?: number;
  pan?: number;
  verb?: number;
  kind?: 'bell' | 'bowl';
}

/** Glocke bzw. Klangschale: unharmonische Teiltöne, jeweils als schwebendes Paar */
export function bell(s: Studio, freq: number, t: number, o: BellOpts = {}): void {
  const { ctx } = s;
  const vel = o.vel ?? 0.5;
  const decay = o.decay ?? 8;
  const attack = o.attack ?? 0.004;
  const parts = o.kind === 'bowl' ? BOWL : BELL;
  const sum = ctx.createGain();
  let end = t;
  parts.forEach(([ratio, a, df], k) => {
    const f = freq * ratio;
    if (f > 12000) return;
    const g = ctx.createGain();
    const lvl = 0.06 * vel * a;
    const dec = decay * df;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(lvl, t + attack * (1 + k * 0.2));
    g.gain.setTargetAtTime(0, t + attack, dec / 6.9);
    const stop = t + attack + dec + 0.5;
    end = Math.max(end, stop);
    const beat = 0.35 + k * 0.25;
    for (const sign of [-1, 1]) {
      const o2 = osc(s, 'sine', f + (sign * beat) / 2, t, stop);
      o2.connect(g);
    }
    g.connect(sum);
  });
  route(s, sum, o.pan ?? 0, o.verb ?? 0.6, 0.1);
}

/** Leiser Bordun: Sinustöne durch einen langsam atmenden Tiefpass, sanft ein- und ausgeblendet */
export function drone(s: Studio, t0: number, t1: number, midis: number[], level: number): void {
  const { ctx } = s;
  const lp = biquad(ctx, 'lowpass', 300, 0.7);
  const lfo = osc(s, 'sine', 0.045, t0, t1);
  const lfoG = gain(ctx, 90);
  lfo.connect(lfoG).connect(lp.frequency);
  midis.forEach((m, i) => {
    const o1 = osc(s, i === 0 ? 'triangle' : 'sine', mtof(m), t0, t1);
    o1.detune.value = (i % 2 ? 3 : -2) * (i + 1);
    o1.connect(gain(ctx, i === 0 ? 0.7 : 0.5 / i)).connect(lp);
  });
  const breath = gain(ctx, 1);
  const lfo2 = osc(s, 'sine', 0.07, t0, t1);
  lfo2.connect(gain(ctx, 0.25)).connect(breath.gain);
  const env = gain(ctx, 0);
  env.gain.setValueAtTime(0, t0);
  env.gain.setTargetAtTime(level, t0, 2.5);
  env.gain.setTargetAtTime(0, t1 - 7, 1.6);
  lp.connect(breath).connect(env);
  route(s, env, 0, 0.3);
}

/** Wassertropfen / Bläschen: kurzer Sinus mit schnell steigender Tonhöhe */
export function drop(s: Studio, t: number, f0: number, vel: number, pan = 0): void {
  const { ctx } = s;
  const o1 = osc(s, 'sine', f0, t, t + 0.25);
  o1.frequency.setValueAtTime(f0, t);
  o1.frequency.exponentialRampToValueAtTime(f0 * 2.3, t + 0.06);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.05 * vel, t + 0.004);
  g.gain.setTargetAtTime(0, t + 0.006, 0.022);
  o1.connect(g);
  route(s, g, pan, 0.7);
}

/** Tee eingießen: gefiltertes Rauschen, dessen Resonanz steigt, während die Schale sich füllt */
export function pour(s: Studio, t: number, dur: number, vel: number, pan = 0.25): void {
  const { ctx } = s;
  const end = t + dur + 1.2;
  const src = noiseSource(s, t, end);
  const bp1 = biquad(ctx, 'bandpass', 420, 5);
  const bp2 = biquad(ctx, 'bandpass', 700, 9);
  const env = ctx.createGain();
  const lp = biquad(ctx, 'lowpass', 2800, 0.5);
  src.connect(bp1).connect(env);
  src.connect(bp2).connect(gain(ctx, 0.6)).connect(env);
  env.connect(lp);
  const steps = Math.floor(dur / 0.11);
  bp1.frequency.setValueAtTime(420, t);
  bp2.frequency.setValueAtTime(700, t);
  for (let k = 1; k <= steps; k++) {
    const p = k / steps;
    const ff = 420 + p * 650 + (s.rnd() - 0.5) * 160;
    bp1.frequency.setTargetAtTime(ff, t + k * 0.11, 0.05);
    bp2.frequency.setTargetAtTime(ff * 1.7, t + k * 0.11, 0.05);
  }
  const v = 0.22 * vel;
  env.gain.setValueAtTime(0, t);
  env.gain.setTargetAtTime(v, t, 0.18);
  for (let tt = t + 0.5; tt < t + dur; tt += 0.07)
    env.gain.setTargetAtTime(v * (0.6 + s.rnd() * 0.4), tt, 0.03);
  env.gain.setTargetAtTime(0, t + dur, 0.22);
  route(s, lp, pan, 0.5);
  const bubbles = Math.floor(dur * 3);
  for (let k = 0; k < bubbles; k++)
    drop(s, t + 0.3 + s.rnd() * (dur - 0.2), 900 + s.rnd() * 1300, vel * (0.25 + s.rnd() * 0.3), pan);
}
