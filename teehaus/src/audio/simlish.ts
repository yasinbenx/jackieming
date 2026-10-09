// Simlish-Gemurmel: eine Fantasiesprache aus synthetischen Silben (Oszillator + zwei Formantfilter + kurzer
// Konsonant aus Rauschen). Keine Aufnahmen, keine echten Wörter, keine Nachahmung realer Stimmen.
// Jede Figur hat ein Stimmprofil (Tonhöhe, Tempo, Klangfarbe) und eine eigene Position im Raum (PannerNode).
import type { AudioEngine } from './engine';

export interface VoiceProfile {
  /** Grundton in Hz */
  base: number;
  /** Tonhöhen-Spielraum in Halbtönen */
  range: number;
  /** Dauer einer Silbe in Sekunden (Tempo) */
  rate: number;
  /** Formant-Verschiebung (größer = heller, „kleinere“ Stimme) */
  formant: number;
  wave: OscillatorType;
  /** Rauschanteil (Hauchigkeit) */
  breath: number;
  gain: number;
}

export const VOICES: Record<string, VoiceProfile> = {
  // tief und ruhig
  master: { base: 98, range: 4, rate: 0.17, formant: 0.88, wave: 'sawtooth', breath: 0.35, gain: 0.9 },
  // hell und schnell
  child: { base: 330, range: 7, rate: 0.085, formant: 1.35, wave: 'triangle', breath: 0.1, gain: 0.8 },
  // lebhaft, mittlere Lage, große Sprünge
  jackie: { base: 150, range: 8, rate: 0.105, formant: 1.05, wave: 'sawtooth', breath: 0.15, gain: 0.95 },
  // ruhig, tief, wenig Melodie
  yao: { base: 104, range: 3, rate: 0.14, formant: 0.82, wave: 'sawtooth', breath: 0.2, gain: 1 },
  boardA: { base: 118, range: 4, rate: 0.13, formant: 0.92, wave: 'sawtooth', breath: 0.25, gain: 0.8 },
  boardB: { base: 205, range: 5, rate: 0.12, formant: 1.18, wave: 'triangle', breath: 0.2, gain: 0.8 },
  poet: { base: 225, range: 6, rate: 0.135, formant: 1.22, wave: 'triangle', breath: 0.3, gain: 0.75 },
  merchant: { base: 125, range: 6, rate: 0.11, formant: 0.95, wave: 'sawtooth', breath: 0.15, gain: 0.85 },
  terrace: { base: 195, range: 4, rate: 0.15, formant: 1.12, wave: 'triangle', breath: 0.35, gain: 0.75 },
  player: { base: 175, range: 5, rate: 0.12, formant: 1.08, wave: 'triangle', breath: 0.2, gain: 0.8 },
};

/** Formanten (F1, F2) einfacher Vokale */
const VOWELS: [number, number][] = [
  [750, 1200], // a
  [450, 1900], // e
  [300, 2300], // i
  [480, 900], // o
  [330, 800], // u
];

export class Simlish {
  private panners = new Map<string, PannerNode>();
  private nextAt = new Map<string, number>();
  private phraseStep = new Map<string, number>();
  /** Für Mundbewegungen beim Hintergrundgemurmel */
  onSyllable?: (id: string) => void;

  constructor(private e: AudioEngine) {}

  private panner(id: string): PannerNode {
    let p = this.panners.get(id);
    if (!p) {
      const ctx = this.e.ctx;
      p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = 1.4;
      p.rolloffFactor = 1.3;
      p.maxDistance = 40;
      p.connect(this.e.buses.voice);
      this.panners.set(id, p);
    }
    return p;
  }

  /** Position eines Sprechers (Weltkoordinaten) */
  place(id: string, x: number, y: number, z: number): void {
    if (!this.e.started) return;
    const p = this.panner(id);
    const t = this.e.now;
    if (p.positionX) {
      p.positionX.setTargetAtTime(x, t, 0.05);
      p.positionY.setTargetAtTime(y, t, 0.05);
      p.positionZ.setTargetAtTime(z, t, 0.05);
    } else (p as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(x, y, z);
  }

  /** Hörposition = Kamera */
  listener(px: number, py: number, pz: number, fx: number, fy: number, fz: number): void {
    if (!this.e.started) return;
    const l = this.e.ctx.listener;
    const t = this.e.now;
    if (l.positionX) {
      l.positionX.setTargetAtTime(px, t, 0.05);
      l.positionY.setTargetAtTime(py, t, 0.05);
      l.positionZ.setTargetAtTime(pz, t, 0.05);
      l.forwardX.setTargetAtTime(fx, t, 0.05);
      l.forwardY.setTargetAtTime(fy, t, 0.05);
      l.forwardZ.setTargetAtTime(fz, t, 0.05);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      const ll = l as unknown as { setPosition(...a: number[]): void; setOrientation(...a: number[]): void };
      ll.setPosition(px, py, pz);
      ll.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  /**
   * Eine Silbe für das Zeichen ch (aus dem Typewriter). Das Tempo des Profils begrenzt, wie oft gesprochen wird,
   * damit es wie Sprache klingt und nicht wie Geklapper.
   */
  syllable(id: string, ch: string, level = 1): void {
    const e = this.e;
    if (!e.started || e.ctx.state !== 'running') return;
    if (!/[\p{L}\p{N}]/u.test(ch)) {
      // Satzzeichen: kleine Pause
      if (/[.!?,;:…]/.test(ch)) this.nextAt.set(id, e.now + 0.12);
      return;
    }
    const v = VOICES[id] ?? VOICES.player!;
    const now = e.now;
    if (now < (this.nextAt.get(id) ?? 0)) return;
    this.nextAt.set(id, now + v.rate * (0.85 + Math.random() * 0.3));
    const code = ch.codePointAt(0) ?? 65;
    // Satzmelodie: leicht absteigend, mit kleinen Sprüngen
    const step = (this.phraseStep.get(id) ?? 0) + 1;
    this.phraseStep.set(id, step % 9);
    const contour = Math.sin(step * 0.9) * 0.5 - (step % 9) / 18;
    const semi = contour * v.range + ((code * 7) % 5) - 2;
    const f0 = v.base * Math.pow(2, semi / 12);
    const vowel = VOWELS[code % VOWELS.length]!;
    this.voice(id, f0, vowel, v, level, code % 3 !== 0);
    this.onSyllable?.(id);
  }

  private voice(
    id: string,
    f0: number,
    vowel: [number, number],
    v: VoiceProfile,
    level: number,
    consonant: boolean,
  ): void {
    const e = this.e;
    const ctx = e.ctx;
    const t0 = e.now + 0.005;
    const dur = v.rate * 0.85;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.panner(id));
    // etwas Hall für den Raum
    const send = ctx.createGain();
    send.gain.value = 0.12;
    out.connect(send).connect(e.buses.reverb);
    const peak = 0.22 * v.gain * level;
    const vStart = t0 + (consonant ? 0.025 : 0);
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(peak, vStart + 0.02);
    out.gain.setValueAtTime(peak, vStart + dur * 0.55);
    out.gain.exponentialRampToValueAtTime(0.0008, vStart + dur);
    // Stimmquelle
    const osc = ctx.createOscillator();
    osc.type = v.wave;
    osc.frequency.setValueAtTime(f0 * 1.03, vStart);
    osc.frequency.exponentialRampToValueAtTime(f0 * (0.94 + Math.random() * 0.08), vStart + dur);
    // zwei Formanten
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = vowel[0] * v.formant;
    f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = vowel[1] * v.formant;
    f2.Q.value = 8;
    const g2 = ctx.createGain();
    g2.gain.value = 0.55;
    const pre = ctx.createGain();
    pre.gain.value = 1.6;
    osc.connect(pre);
    pre.connect(f1).connect(out);
    pre.connect(f2).connect(g2).connect(out);
    // Hauch
    if (v.breath > 0) {
      const n = e.noiseSource(false);
      const bf = ctx.createBiquadFilter();
      bf.type = 'bandpass';
      bf.frequency.value = vowel[1] * v.formant;
      bf.Q.value = 2;
      const bg = ctx.createGain();
      bg.gain.value = v.breath * 0.25;
      n.connect(bf).connect(bg).connect(out);
      n.start(vStart, Math.random() * 2, dur);
    }
    osc.start(vStart);
    osc.stop(vStart + dur + 0.05);
    // Konsonant: kurzer, heller Rauschstoß davor
    if (consonant) {
      const n = e.noiseSource(false);
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 2800 + Math.random() * 2600;
      hp.Q.value = 1.2;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0, t0);
      cg.gain.linearRampToValueAtTime(peak * 0.5, t0 + 0.006);
      cg.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.03);
      n.connect(hp).connect(cg).connect(this.panner(id));
      n.start(t0, Math.random() * 2, 0.04);
    }
    osc.onended = () => {
      out.disconnect();
      send.disconnect();
    };
  }

  /** Leises Gemurmel im Hintergrund: eine kurze Phrase */
  murmur(id: string, syllables: number, level = 0.35): void {
    const v = VOICES[id] ?? VOICES.player!;
    const chars = 'abcdefghiklmnoprstuvwyz';
    for (let i = 0; i < syllables; i++) {
      window.setTimeout(
        () => {
          this.nextAt.set(id, 0);
          this.syllable(id, chars[Math.floor(Math.random() * chars.length)]!, level);
        },
        i * v.rate * 1000 * (1 + Math.random() * 0.25),
      );
    }
  }
}
