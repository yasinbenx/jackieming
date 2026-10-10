// Prozedurale Musik-Vorschauen für „Das Teehaus“ – reine Web-Audio-Synthese, keine Samples, keine Dateien.
// Aufbau: Hilfsfunktionen → Studio (Hall, Echo, Master mit Begrenzer) → Instrumente (Guzheng-Zupfklang,
// Bambusflöte, Erhu, Glocke/Klangschale, Bordun, Wasser) → kleiner Phrasen-Sequenzer → drei Stücke (A, B, C).
// Alle Stücke sind auskomponiert (Vordersatz/Nachsatz, Pausen, variierte Wiederholung) und werden nur leicht
// „menschlich“ verwackelt. Die API ist so gehalten, dass eine Variante später in die Spiel-Audio-Engine wandern kann.

export type PreviewId = 'A' | 'B' | 'C';

export interface PreviewInfo {
  id: PreviewId;
  title: string;
  /** Chinesischer Untertitel */
  zh: string;
  /** Ein Satz zu Instrumenten und Stimmung */
  description: string;
  /** Tonart, Tempo, Form */
  details: string;
}

export const PREVIEW_INFO: Record<PreviewId, PreviewInfo> = {
  A: {
    id: 'A',
    title: 'Guzheng & Bambusflöte',
    zh: '古筝 · 笛子',
    description:
      'Eine gezupfte Guzheng mit Glissandi und Tremolo trägt die warme Bambusflöte, die mit Vorschlägen und wachsendem Vibrato singt – heiter und ruhig wie ein Nachmittag im Teegarten.',
    details:
      'D-Pentatonik (Gong-Modus) · 72 Schläge/min · Vorspiel, Periode A, Zwischenspiel, Periode B–A′, Nachspiel',
  },
  B: {
    id: 'B',
    title: 'Erhu & Guzheng',
    zh: '二胡 · 古筝',
    description:
      'Die zweisaitige Erhu singt mit Gleittönen und ausdrucksvollem Vibrato über einer spärlichen, weichen Guzheng-Begleitung – innig, ein wenig wehmütig, abendlich.',
    details:
      'G-Pentatonik (Gong-Modus) · 60 Schläge/min · Vorspiel, Periode A, Zwischenspiel, Periode B–A′, Nachspiel',
  },
  C: {
    id: 'C',
    title: 'Stille Teestube',
    zh: '静 · 茶室',
    description:
      'Vereinzelte Zupftöne, Klangschale und kleine Glocke über einem kaum hörbaren Bordun, dazu eingegossener Tee und Wassertropfen – viel Stille und langer Nachhall.',
    details: 'D-Pentatonik · frei im Zeitmaß · Frage-Antwort-Gesten mit langen Pausen',
  },
};

// ───────────────────────────── Hilfsfunktionen

const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
const cents = (c: number): number => Math.pow(2, c / 1200);
const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));

type Rng = () => number;

/** Kleiner, reproduzierbarer Zufallsgenerator (mulberry32) */
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nächster Ton der Skala (Tonklassen pcs) oberhalb (dir = 1) bzw. unterhalb (dir = -1) */
function neighbor(midi: number, dir: 1 | -1, pcs: number[]): number {
  let m = midi + dir;
  while (!pcs.includes(((m % 12) + 12) % 12)) m += dir;
  return m;
}

// ───────────────────────────── Studio: Hall, Echo, Master

export interface StudioConfig {
  /** Nachhallzeit des erzeugten Impulses (s) */
  reverbSeconds: number;
  /** Pegel des Hallsignals */
  reverbWet: number;
  /** Echo-Verzögerung (s) */
  echoTime: number;
  /** Echo-Rückkopplung 0..0,6 */
  echoFeedback: number;
  /** Pegel des Echos */
  echoWet: number;
  /** Grenzfrequenz des sanften Master-Tiefpasses (Hz) */
  tone: number;
}

/** Signalkette einer Vorschau. Instrumente spielen in `dry` und schicken Anteile an `reverb`/`echo`. */
export interface Studio {
  ctx: BaseAudioContext;
  rnd: Rng;
  dry: AudioNode;
  reverb: AudioNode;
  echo: AudioNode;
  /** Ausgangspegel (Ein-/Ausblenden) */
  out: GainNode;
  /** alle gestarteten Quellen, damit „Stopp“ sie beenden kann */
  nodes: AudioScheduledSourceNode[];
}

/** Stereo-Impulsantwort: abklingendes Rauschen, das mit der Zeit dunkler wird (warmer Raum). */
function makeImpulse(ctx: BaseAudioContext, seconds: number, rnd: Rng): AudioBuffer {
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

function createStudio(ctx: BaseAudioContext, dest: AudioNode, cfg: StudioConfig, rnd: Rng): Studio {
  const bus = ctx.createGain();
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 38;
  const warm = ctx.createBiquadFilter();
  warm.type = 'lowshelf';
  warm.frequency.value = 220;
  warm.gain.value = 1.5;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = cfg.tone;
  tone.Q.value = 0.5;
  // Sanfter Begrenzer: greift nur bei Spitzen, damit nichts übersteuert
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -15;
  comp.knee.value = 10;
  comp.ratio.value = 8;
  comp.attack.value = 0.004;
  comp.release.value = 0.35;
  const out = ctx.createGain();
  out.gain.value = 0;
  bus.connect(hp).connect(warm).connect(tone).connect(comp).connect(out).connect(dest);

  const dry = ctx.createGain();
  dry.connect(bus);

  const reverb = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.buffer = makeImpulse(ctx, cfg.reverbSeconds, rnd);
  const wet = ctx.createGain();
  wet.gain.value = cfg.reverbWet;
  reverb.connect(conv).connect(wet).connect(bus);

  // Echo mit gedämpfter Rückkopplung, das zusätzlich in den Hall läuft
  const echo = ctx.createGain();
  const delay = ctx.createDelay(2);
  delay.delayTime.value = cfg.echoTime;
  const fbLp = ctx.createBiquadFilter();
  fbLp.type = 'lowpass';
  fbLp.frequency.value = 2200;
  const fb = ctx.createGain();
  fb.gain.value = cfg.echoFeedback;
  const echoWet = ctx.createGain();
  echoWet.gain.value = cfg.echoWet;
  const echoVerb = ctx.createGain();
  echoVerb.gain.value = 0.5;
  echo.connect(delay).connect(fbLp).connect(fb).connect(delay);
  fbLp.connect(echoWet).connect(bus);
  echoWet.connect(echoVerb).connect(reverb);

  return { ctx, rnd, dry, reverb, echo, out, nodes: [] };
}

/** Instrumentausgang ins Stereobild setzen und an Hall/Echo schicken */
function route(s: Studio, node: AudioNode, pan: number, verb: number, echo = 0): void {
  const p = s.ctx.createStereoPanner();
  p.pan.value = clamp(pan, -1, 1);
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

function noiseSource(s: Studio, t: number, until: number): AudioBufferSourceNode {
  const src = s.ctx.createBufferSource();
  src.buffer = noiseBuffer(s.ctx);
  src.loop = true;
  src.start(t, s.rnd() * 2.5);
  src.stop(until);
  s.nodes.push(src);
  return src;
}

function osc(s: Studio, type: OscillatorType, freq: number, t: number, until: number): OscillatorNode {
  const o = s.ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.start(t);
  o.stop(until);
  s.nodes.push(o);
  return o;
}

function gain(ctx: BaseAudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

function biquad(
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
  s.nodes.push(src);
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
  s.nodes.push(tone);

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
  s.nodes.push(fq);
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

// ───────────────────────────── Sequenzer

interface Ev {
  t: number;
  fn: () => void;
}

/** Ereignisliste: wird vorab aufgebaut und dann mit Vorlauf abgespielt */
class Score {
  readonly evs: Ev[] = [];
  at(t: number, fn: () => void): void {
    this.evs.push({ t, fn });
  }
}

interface Tok {
  midi: number | null;
  beats: number;
  /** Verzierungen: ^ Vorschlag von oben, v von unten, ~ Vibrato/Tremolo, s gebunden, / Gleitton */
  orn: string;
}

const NOTE_RE = /^([A-G])(#|b)?(\d)([^:]*):([\d.]+)$/;
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Notenschrift wie „A4:1 B4^:.5 -:1“ (Taktstriche „|“ werden ignoriert) */
function parse(src: string): Tok[] {
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

type TempoMap = (beat: number) => number;

/** Schlag → Zeit, mit Ritardandi [Endschlag, Länge in Schlägen, Stärke] vor Phrasenenden */
function tempoMap(bpm: number, rits: [number, number, number][], t0: number): TempoMap {
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
function lineNotes(
  s: Studio,
  src: string,
  start: number,
  tm: TempoMap,
  pcs: number[],
  vel: number,
): LineNote[] {
  const toks = parse(src);
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
function pluckLine(
  s: Studio,
  sc: Score,
  src: string,
  start: number,
  tm: TempoMap,
  pcs: number[],
  vel: number,
  o: PluckOpts = {},
): void {
  let b = start;
  for (const tok of parse(src)) {
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
type Hit = [number, number, number];

interface AccompOpts {
  bars: { bar: number; chord: number[]; chord2?: number[]; pat: Hit[]; trem?: [number, number, number] }[];
  beatsPerBar: number;
  vel: number;
  pan: number;
}

/** Leise, variierende Zupfbegleitung; Basston auf der Eins, manchmal mit Oktave darunter */
function accompany(s: Studio, sc: Score, tm: TempoMap, a: AccompOpts): void {
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

// ───────────────────────────── Stücke

const D_PENTA = [2, 4, 6, 9, 11];
const G_PENTA = [7, 9, 11, 2, 4];

interface Piece {
  studio: StudioConfig;
  seed: number;
  /** baut die Partitur auf und gibt das Ende (absolute Zeit) zurück */
  build(s: Studio, sc: Score, t0: number): number;
}

/** A: Guzheng & Bambusflöte, D-Gong-Pentatonik, 72 Schläge/min, 13 Takte */
const PIECE_A: Piece = {
  seed: 1201,
  studio: {
    reverbSeconds: 3.2,
    reverbWet: 0.42,
    echoTime: 0.417,
    echoFeedback: 0.22,
    echoWet: 0.32,
    tone: 7200,
  },
  build(s, sc, t0) {
    const tm = tempoMap(
      72,
      [
        [16, 1.5, 0.12],
        [24, 2, 0.2],
        [44, 3, 0.2],
        [52, 7, 0.6],
      ],
      t0,
    );
    const V = {
      D: [50, 57, 62, 64, 66],
      A: [45, 52, 57, 59, 64],
      B: [47, 54, 59, 62, 66],
      E: [52, 59, 64, 66, 69],
    };
    const P0: Hit[] = [
      [0, 0, 0.9],
      [1, 1, 0.5],
      [1.5, 2, 0.45],
      [2, 3, 0.55],
      [3, 2, 0.45],
      [3.5, 1, 0.4],
    ];
    const P1: Hit[] = [
      [0, 0, 0.9],
      [0.5, 1, 0.45],
      [1, 2, 0.5],
      [2, 4, 0.5],
      [2.5, 3, 0.42],
      [3, 2, 0.45],
    ];
    const P2: Hit[] = [
      [0, 0, 0.9],
      [1, 2, 0.48],
      [2, 1, 0.45],
      [2.5, 3, 0.48],
      [3.5, 2, 0.38],
    ];
    const PT: Hit[] = [
      [0, 0, 0.9],
      [1, 2, 0.45],
      [1.5, 1, 0.4],
    ];

    // Vorspiel: Glissando aufwärts bis D5, dann tiefe Eins
    const up = [50, 52, 54, 57, 59, 62, 64, 66, 69, 71, 74];
    sc.at(tm(0), () => gliss(s, up, tm(0) + 0.05, 0.062, 0.22, 0.55));
    sc.at(tm(2), () => pluck(s, 38, tm(2), { vel: 0.7, bend: 30, verb: 0.3 }));
    sc.at(tm(2.5), () => pluck(s, 57, tm(2.5) + 0.01, { vel: 0.4, verb: 0.3 }));
    sc.at(tm(3), () => pluck(s, 62, tm(3), { vel: 0.42, verb: 0.3 }));

    accompany(s, sc, tm, {
      beatsPerBar: 4,
      vel: 0.52,
      pan: -0.28,
      bars: [
        { bar: 1, chord: V.D, pat: P1 },
        { bar: 2, chord: V.D, pat: P0 },
        { bar: 3, chord: V.A, pat: P2 },
        { bar: 4, chord: V.B, pat: P0 },
        { bar: 5, chord: V.D, pat: PT, trem: [2, 2, 1.8] },
        { bar: 7, chord: V.D, pat: P2 },
        { bar: 8, chord: V.E, pat: P0 },
        { bar: 9, chord: V.A, pat: P1 },
        { bar: 10, chord: V.D, pat: PT, trem: [2, 2, 1.9] },
      ],
    });

    // Melodie der Flöte: Periode A (Frage endet auf A, Antwort auf D), dann B (Frage auf H) und A′
    const phrases: [string, number, number][] = [
      ['A4:1 B4:.5 D5:.5 E5^:1.5 F#5:.5 | E5:.75 D5:.25 B4:1 A4v~:1.5 -:.5', 8, 0.8],
      ['A4:1 B4:.5 D5:.5 E5:1 F#5:.5 E5:.5 | B4:.75 D5:.25 E5:.5 B4:.5 D5~:2', 16, 0.85],
      ['F#5:1 A5:.5 F#5:.5 E5^:1.5 D5:.5 | E5:1 F#5s:.5 E5:.5 B4~:1.5 -:.5', 28, 0.95],
      ['A4:.75 B4:.25 D5:1 E5^:.5 D5:.5 B4:.75 A4:.25 | B4:.5 D5:.5 E5:1 D5~:3', 36, 0.82],
    ];
    for (const [src, beat, vel] of phrases) {
      const notes = lineNotes(s, src, beat, tm, D_PENTA, vel);
      sc.at(notes[0]!.t - 0.3, () => flute(s, notes, { pan: 0.18, verb: 0.5, echo: 0.2, level: 0.13 }));
    }

    // Zwischenspiel (Takt 6): die Guzheng antwortet allein, kurzer Aufschwung in Teil B
    sc.at(tm(24), () => pluck(s, 50, tm(24), { vel: 0.75, bend: 30, pan: -0.3 }));
    pluckLine(s, sc, 'D5:.5 B4:.5 A4:1 F#4^:.5 E4:.5 D4:.5', 24, tm, D_PENTA, 0.62, {
      pan: -0.05,
      verb: 0.4,
    });
    sc.at(tm(27.5), () => gliss(s, [57, 59, 62, 64, 66, 69], tm(27.5), 0.055, 0.18, 0.36));

    // Nachspiel: das Kopfmotiv leise auf der Guzheng, dann gebrochener Schlussakkord mit Tremolo
    sc.at(tm(44), () => pluck(s, 50, tm(44), { vel: 0.6, pan: -0.3 }));
    pluckLine(s, sc, 'A4:1 B4:.5 D5:.5 E5^:1 D5:1', 44, tm, D_PENTA, 0.5, { pan: 0, verb: 0.45 });
    const fin = [38, 45, 50, 57, 62, 66];
    fin.forEach((m, i) => {
      const t = tm(48) + i * 0.075;
      sc.at(t, () => pluck(s, m, t, { vel: 0.62 - i * 0.05, bend: i === 0 ? 30 : 0, verb: 0.45 }));
    });
    sc.at(tm(49), () => tremolo(s, 74, tm(49), tm(51) - tm(49), 0.32, { pan: 0.1, verb: 0.5 }));
    return tm(52) + 4.5;
  },
};

/** B: Erhu & Guzheng, G-Gong-Pentatonik, 60 Schläge/min, 11 Takte */
const PIECE_B: Piece = {
  seed: 2207,
  studio: {
    reverbSeconds: 3.8,
    reverbWet: 0.48,
    echoTime: 0.5,
    echoFeedback: 0.2,
    echoWet: 0.25,
    tone: 6600,
  },
  build(s, sc, t0) {
    const tm = tempoMap(
      60,
      [
        [12, 1, 0.1],
        [20, 2, 0.18],
        [32, 1.5, 0.12],
        [44, 6, 0.55],
      ],
      t0,
    );
    const V = {
      G: [43, 50, 55, 57, 59],
      E: [40, 47, 52, 55, 59],
      D: [38, 45, 50, 52, 57],
      A: [45, 52, 57, 59, 64],
    };
    const Q1: Hit[] = [
      [0, 0, 0.85],
      [1.5, 2, 0.42],
      [2, 3, 0.45],
      [3, 2, 0.38],
    ];
    const Q2: Hit[] = [
      [0, 0, 0.85],
      [0.5, 1, 0.38],
      [2, 2, 0.42],
      [2.5, 4, 0.4],
    ];
    const Q3: Hit[] = [
      [0, 0, 0.85],
      [1, 1, 0.38],
      [2, 3, 0.42],
      [3, 4, 0.36],
    ];

    // Vorspiel: gebrochener G-Akkord und ein kleines Abwärtsmotiv
    [43, 50, 55, 59, 62].forEach((m, i) => {
      const t = tm(0) + 0.05 + i * 0.09;
      sc.at(t, () => pluck(s, m, t, { vel: 0.58 - i * 0.04, bend: i === 0 ? 30 : 0, pan: -0.25 }));
    });
    pluckLine(s, sc, 'D5:.5 E5:.5 D5:.5 B4:.5', 2, tm, G_PENTA, 0.45, { pan: -0.1, verb: 0.45 });

    accompany(s, sc, tm, {
      beatsPerBar: 4,
      vel: 0.5,
      pan: -0.25,
      bars: [
        { bar: 1, chord: V.G, pat: Q1 },
        { bar: 2, chord: V.D, pat: Q2 },
        { bar: 3, chord: V.E, pat: Q1 },
        { bar: 4, chord: V.G, pat: Q3 },
        { bar: 6, chord: V.G, pat: Q2 },
        { bar: 7, chord: V.A, pat: Q1 },
        { bar: 8, chord: V.E, pat: Q3 },
        { bar: 9, chord: V.D, chord2: V.G, pat: Q2 },
      ],
    });

    // Erhu: Periode A (Frage auf D, Antwort auf G), Periode B–A′ (Frage auf E, Antwort auf G)
    const phrases: [string, number, number][] = [
      ['B4/:1.5 A4:.5 G4:1 E4:1 | G4:.75 A4:.25 B4:1 D5~:1.5 -:.5', 4, 0.75],
      ['E5/:1.5 D5:.5 B4:1 A4:.5 B4:.5 | A4:.75 G4s:.25 E4:1 G4~:1.5 -:.5', 12, 0.8],
      ['D5:1 E5/:.5 D5:.5 B4~:2 | A4:1 B4:.5 A4s:.5 E4~:1.5 -:.5', 24, 0.9],
      ['G4:1 A4:.5 B4:.5 D5/:1.5 B4:.5 | A4:.75 B4:.25 A4:.5 E4:.5 G4~:3', 32, 0.78],
    ];
    for (const [src, beat, vel] of phrases) {
      const notes = lineNotes(s, src, beat, tm, G_PENTA, vel);
      sc.at(notes[0]!.t - 0.3, () => erhu(s, notes, { pan: 0.1, verb: 0.45, echo: 0.12, level: 0.072 }));
    }

    // Zwischenspiel (Takt 5): Guzheng allein, endet offen auf A
    sc.at(tm(20), () => pluck(s, 43, tm(20), { vel: 0.7, bend: 30, pan: -0.3 }));
    pluckLine(s, sc, 'G4:.5 A4:.5 B4:1 D5^:.5 B4:.5 A4:1', 20, tm, G_PENTA, 0.55, { pan: -0.05, verb: 0.4 });

    // Nachspiel: Bass, zwei hohe Töne, gebrochener Schlussakkord
    sc.at(tm(40), () => pluck(s, 43, tm(40), { vel: 0.65, pan: -0.3 }));
    sc.at(tm(41.5), () => pluck(s, 74, tm(41.5), { vel: 0.35, pan: 0.2, verb: 0.55 }));
    sc.at(tm(42), () => pluck(s, 71, tm(42), { vel: 0.32, pan: 0.15, verb: 0.55 }));
    [31, 43, 50, 55, 59, 67].forEach((m, i) => {
      const t = tm(43) + i * 0.085;
      sc.at(t, () => pluck(s, m, t, { vel: 0.55 - i * 0.04, bend: i === 1 ? 25 : 0, verb: 0.45 }));
    });
    return tm(44) + 5.5;
  },
};

/** C: Stille Teestube – frei im Zeitmaß, wenige Klänge mit viel Raum */
const PIECE_C: Piece = {
  seed: 3301,
  studio: {
    reverbSeconds: 6.5,
    reverbWet: 0.7,
    echoTime: 0.75,
    echoFeedback: 0.32,
    echoWet: 0.3,
    tone: 6000,
  },
  build(s, sc, t0) {
    const T = (x: number): number => t0 + x + (s.rnd() - 0.5) * 0.15;
    const end = t0 + 57;
    sc.at(t0, () => drone(s, t0, end, [38, 45, 50], 0.014));
    const p = (x: number, m: number, vel: number, o: PluckOpts = {}): void => {
      const t = T(x);
      sc.at(t, () => pluck(s, m, t, { vel, verb: 0.75, echo: 0.25, ...o }));
    };
    const b = (x: number, f: number, o: BellOpts): void => {
      const t = T(x);
      sc.at(t, () => bell(s, f, t, o));
    };
    // erste Geste: Schale, dann eine kleine Frage (A … D)
    b(0.6, mtof(62), { kind: 'bowl', vel: 0.5, decay: 10, attack: 0.9, verb: 0.7 });
    p(4.2, 69, 0.55, { bend: 35 });
    p(6.9, 74, 0.45, { vib: 12 });
    b(11.2, mtof(81), { kind: 'bell', vel: 0.35, decay: 5, pan: 0.35 });
    // Tee wird eingegossen
    sc.at(T(14.5), () => pour(s, t0 + 14.5, 3.3, 0.6, 0.3));
    // zweite Geste: offene Frage F♯ … E
    p(19.6, 66, 0.5, { bend: 30 });
    p(21.1, 64, 0.4, { vib: 16, pan: -0.15 });
    b(25.8, mtof(57), { kind: 'bowl', vel: 0.5, decay: 9, pan: -0.2 });
    // Antwort: H … A … D (Ruhe)
    p(29.5, 71, 0.45);
    p(31.0, 69, 0.48, { bend: 25 });
    p(33.4, 62, 0.55, { vib: 14, bend: -200, bendTime: 0.1 });
    // Tropfen
    [37.5, 38.15, 38.5, 40.2].forEach((x, i) => {
      const t = T(x);
      sc.at(t, () => drop(s, t, 1100 + i * 230 + s.rnd() * 200, 0.55, -0.3 + i * 0.2));
    });
    b(41.2, mtof(86), { kind: 'bell', vel: 0.25, decay: 4.5, pan: -0.3 });
    // Schluss: weiche Quinte tief, letzte Schale
    p(44.0, 57, 0.5, { pan: -0.2 });
    p(44.09, 62, 0.36, { pan: 0.1 });
    p(46.6, 74, 0.28, { vib: 10, pan: 0.3 });
    b(48.5, mtof(50), { kind: 'bowl', vel: 0.55, decay: 10, attack: 0.02, verb: 0.75 });
    return end;
  },
};

const PIECES: Record<PreviewId, Piece> = { A: PIECE_A, B: PIECE_B, C: PIECE_C };

// ───────────────────────────── Öffentliche Schnittstelle

export interface PreviewHandle {
  /** Gesamtdauer inkl. Ausklang (s) */
  readonly duration: number;
  /** Kontextzeit, zu der das Stück beginnt */
  readonly startTime: number;
  /** true, sobald das Stück beendet oder gestoppt wurde */
  readonly ended: boolean;
  /** sanft ausblenden und alle Klänge beenden */
  stop(fade?: number): void;
}

export interface PreviewOptions {
  /** anderer Startwert = andere kleine Verwacklungen */
  seed?: number;
  /** wird aufgerufen, wenn das Stück zu Ende ist (nicht bei Offline-Kontexten) */
  onEnded?: () => void;
}

/**
 * Spielt eine Vorschau über `out` ab. Funktioniert mit AudioContext (Echtzeit, Planung mit Vorlauf)
 * und OfflineAudioContext (alles sofort geplant, z. B. für Tests).
 */
export function playPreview(
  id: PreviewId,
  ctx: BaseAudioContext,
  out: AudioNode,
  opts: PreviewOptions = {},
): PreviewHandle {
  const piece = PIECES[id];
  const rnd = mulberry32(opts.seed ?? piece.seed);
  const s = createStudio(ctx, out, piece.studio, rnd);
  const now = ctx.currentTime;
  const t0 = now + 0.15;
  const sc = new Score();
  const end = piece.build(s, sc, t0);
  const duration = end - t0;

  // Einblenden und zum Schluss sanft ausblenden
  const g = s.out.gain;
  g.setValueAtTime(0, now);
  g.linearRampToValueAtTime(1, t0);
  g.setValueAtTime(1, end - 3);
  g.linearRampToValueAtTime(0, end);

  const evs = sc.evs.sort((a, b) => a.t - b.t);
  const offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
  let ended = false;
  let timer = 0;
  let endTimer = 0;

  const cleanup = (): void => {
    if (ended) return;
    ended = true;
    window.clearInterval(timer);
    window.clearTimeout(endTimer);
    for (const n of s.nodes) {
      try {
        n.stop();
      } catch {
        /* bereits beendet */
      }
    }
    s.out.disconnect();
    opts.onEnded?.();
  };

  if (offline) {
    for (const e of evs) e.fn();
  } else {
    let i = 0;
    const tick = (): void => {
      const horizon = ctx.currentTime + 1.5;
      while (i < evs.length && evs[i]!.t < horizon) evs[i++]!.fn();
      if (i >= evs.length) window.clearInterval(timer);
    };
    tick();
    timer = window.setInterval(tick, 200);
    endTimer = window.setTimeout(cleanup, (end - ctx.currentTime) * 1000 + 300);
  }

  return {
    duration,
    startTime: t0,
    get ended() {
      return ended;
    },
    stop(fade = 0.8) {
      if (ended || offline) return;
      const t = ctx.currentTime;
      window.clearInterval(timer);
      if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(t);
      else {
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
      }
      g.setTargetAtTime(0, t, fade / 5);
      window.clearTimeout(endTimer);
      endTimer = window.setTimeout(cleanup, fade * 1000 + 150);
    },
  };
}
