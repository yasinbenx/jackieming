// Prozedurale Musik-Vorschauen für „Das Teehaus“ – reine Web-Audio-Synthese, keine Samples, keine Dateien.
// Aufbau: Studio (Hall, Echo, Master mit Begrenzer) → drei Stücke (A, B, C). Instrumente (Guzheng-Zupfklang,
// Bambusflöte, Erhu, Glocke/Klangschale, Bordun, Wasser) und der Phrasen-Sequenzer liegen in src/audio/
// (instruments.ts, sequencer.ts) und werden auch von der Spielmusik genutzt.
// Alle Stücke sind auskomponiert (Vordersatz/Nachsatz, Pausen, variierte Wiederholung) und werden nur leicht
// „menschlich“ verwackelt.
import { mulberry32 } from '../core/util';
import {
  bell,
  drone,
  drop,
  erhu,
  flute,
  gliss,
  makeImpulse,
  mtof,
  pluck,
  pour,
  tremolo,
} from '../audio/instruments';
import type { BellOpts, PluckOpts, Rng, Studio } from '../audio/instruments';
import { Score, accompany, lineNotes, pluckLine, tempoMap } from '../audio/sequencer';
import type { Hit } from '../audio/sequencer';

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

/** Studio einer Vorschau mit Ausgangspegel und Liste aller gestarteten Quellen (für „Stopp“) */
interface LabStudio extends Studio {
  /** Ausgangspegel (Ein-/Ausblenden) */
  out: GainNode;
  nodes: AudioScheduledSourceNode[];
}

function createStudio(ctx: BaseAudioContext, dest: AudioNode, cfg: StudioConfig, rnd: Rng): LabStudio {
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

  const nodes: AudioScheduledSourceNode[] = [];
  return { ctx, rnd, dry, reverb, echo, out, nodes, track: (n) => nodes.push(n) };
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
