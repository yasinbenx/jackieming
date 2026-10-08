// Generative Musik im D-Dur-Pentatonik (D E F♯ A H): Guzheng-Zupfklänge, eine Erhu-artige Streicherstimme
// und ein leiser Bordun. Dichte und Lage folgen der Tageszeit; es gibt keine feste Melodie, nur Regeln.
import { clamp, lerp, smoothstep } from '../core/util';
import type { AudioEngine } from './engine';
import { midiToFreq } from './engine';

/** Pentatonische MIDI-Noten D3 … H5 */
const NOTES = [50, 52, 54, 57, 59, 62, 64, 66, 69, 71, 74, 76, 78, 81, 83];

export class Music {
  private timer = 0;
  private nextBar = 0;
  private bar = 0;
  private idx = 8;
  private running = false;
  private tod = 0.5;
  private droneNodes: { stop: () => void } | null = null;
  private lastErhu = 69;
  /** 0 = ruhig/unauffällig (Dialog offen), 1 = voll */
  intensity = 1;

  constructor(private e: AudioEngine) {}

  setTime(t: number): void {
    this.tod = t;
  }

  start(): void {
    if (this.running || !this.e.started) return;
    this.running = true;
    this.nextBar = this.e.now + 0.4;
    this.startDrone();
    this.timer = window.setInterval(() => this.schedule(), 220);
  }

  stop(): void {
    this.running = false;
    window.clearInterval(this.timer);
    this.droneNodes?.stop();
    this.droneNodes = null;
  }

  /** Ein festlicher Akkord-Schwall (Finale / Anstoßen) */
  swell(): void {
    const e = this.e;
    const t = e.now;
    [50, 57, 62, 66, 69, 74, 78].forEach((m, i) => this.pluck(m, t + i * 0.09, 0.3, 0.012));
    this.erhu(74, t + 0.2, 4.2, 0.1);
    this.erhu(69, t + 0.3, 4.2, 0.07);
  }

  private beat(): number {
    return lerp(0.92, 1.18, smoothstep(0.4, 1, this.tod));
  }

  private startDrone(): void {
    const e = this.e;
    const ctx = e.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.05, ctx.currentTime, 2.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const oscs = [38, 45].map((m, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = midiToFreq(m);
      o.detune.value = i ? 4 : -3;
      o.connect(lp);
      o.start();
      return o;
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 0.02;
    lfo.connect(lg).connect(g.gain);
    lfo.start();
    lp.connect(g).connect(e.buses.music);
    this.droneNodes = {
      stop: () => {
        g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6);
        window.setTimeout(() => [...oscs, lfo].forEach((o) => o.stop()), 2500);
      },
    };
  }

  private schedule(): void {
    if (!this.running) return;
    const e = this.e;
    while (this.nextBar < e.now + 1.2) {
      this.playBar(this.nextBar);
      this.nextBar += this.beat() * 4;
      this.bar++;
    }
  }

  private pick(): number {
    const steps = [-2, -1, -1, 0, 1, 1, 2];
    this.idx = clamp(this.idx + steps[Math.floor(Math.random() * steps.length)]!, 3, 13);
    return NOTES[this.idx]!;
  }

  private playBar(t0: number): void {
    const beat = this.beat();
    const night = smoothstep(0.55, 1, this.tod);
    const density = lerp(0.62, 0.34, night) * lerp(1, 0.55, 1 - this.intensity);
    const vol = 0.2 * lerp(1, 0.55, 1 - this.intensity);
    // gelegentlicher Lauf (Glissando) zu Beginn einer Phrase
    if (this.bar % 4 === 0) {
      const start = 3 + Math.floor(Math.random() * 3);
      const n = 5 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++)
        this.pluck(NOTES[Math.min(14, start + i)]!, t0 + i * 0.085, vol * 0.8, 0.014, false);
      this.idx = clamp(start + n, 5, 12);
    }
    for (let b = 0; b < 8; b++) {
      const when = t0 + (b * beat) / 2 + (b % 2 ? 0.015 : 0);
      if (this.bar % 4 === 0 && b < 2) continue;
      const p = b % 2 === 0 ? density : density * 0.55;
      if (Math.random() < p)
        this.pluck(this.pick(), when, vol * (b % 2 === 0 ? 1 : 0.7), 0.014, Math.random() < 0.28);
    }
    // Erhu: lange, singende Töne alle zwei Takte (nachts seltener, dafür weicher)
    if (this.bar % 2 === 1 && Math.random() < lerp(0.7, 0.5, night) * this.intensity) {
      const cand = [66, 69, 71, 74, 78];
      const m = cand[Math.floor(Math.random() * cand.length)]!;
      this.erhu(m, t0 + beat * (Math.random() < 0.5 ? 0 : 2), beat * (2.6 + Math.random() * 1.4), 0.06);
    }
  }

  /** Gezupfte Saite. bend = Ziehen der Saite von unten (typisch für Guzheng). */
  pluck(midi: number, when: number, gain: number, reverb: number, bend = false): void {
    const e = this.e;
    const ctx = e.ctx;
    const { buf, rate } = e.pluckBuffer(midi);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (bend) {
      src.playbackRate.setValueAtTime(rate * 0.955, when);
      src.playbackRate.exponentialRampToValueAtTime(rate, when + 0.16);
    } else {
      src.playbackRate.value = rate;
    }
    const g = ctx.createGain();
    g.gain.value = gain;
    g.gain.setValueAtTime(gain, when + 2.4);
    g.gain.linearRampToValueAtTime(0, when + 3.2);
    const pan = ctx.createStereoPanner();
    pan.pan.value = clamp((midi - 66) / 22 + (Math.random() - 0.5) * 0.3, -0.8, 0.8);
    src.connect(g).connect(pan).connect(e.buses.music);
    const send = ctx.createGain();
    send.gain.value = reverb * 14;
    pan.connect(send).connect(e.buses.reverb);
    src.start(when);
    src.stop(when + 3.3);
  }

  /** Erhu-artiger Streicherton: Sägezahn, Vibrato nach kurzer Zeit, Portamento. */
  erhu(midi: number, when: number, dur: number, gain: number): void {
    const e = this.e;
    const ctx = e.ctx;
    const f = midiToFreq(midi);
    const from = midiToFreq(this.lastErhu);
    this.lastErhu = midi;
    const mk = (detune: number): OscillatorNode => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = detune;
      o.frequency.setValueAtTime(from, when);
      o.frequency.exponentialRampToValueAtTime(f, when + 0.22);
      return o;
    };
    const o1 = mk(-5);
    const o2 = mk(6);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.4;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, when);
    vg.gain.linearRampToValueAtTime(14, when + 0.9);
    vib.connect(vg);
    vg.connect(o1.detune);
    vg.connect(o2.detune);
    const bp = ctx.createBiquadFilter();
    bp.type = 'peaking';
    bp.frequency.value = 1500;
    bp.gain.value = 9;
    bp.Q.value = 1.4;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.28);
    g.gain.setValueAtTime(gain, when + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o1.connect(bp);
    o2.connect(bp);
    bp.connect(lp).connect(g).connect(e.buses.music);
    const send = ctx.createGain();
    send.gain.value = 0.9;
    g.connect(send).connect(e.buses.reverb);
    for (const o of [o1, o2, vib]) {
      o.start(when);
      o.stop(when + dur + 0.1);
    }
  }
}
