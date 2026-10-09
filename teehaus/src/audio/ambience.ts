// Ambiente: Wind, plätscherndes Wasser, Vögel (tagsüber), Grillen (nachts), leises Windspiel, Wasserkocher.
import { clamp, smoothstep } from '../core/util';
import type { AudioEngine } from './engine';
import { midiToFreq } from './engine';

export class Ambience {
  private running = false;
  private timers: number[] = [];
  private tod = 0.5;
  private inside = false;
  private windGain!: GainNode;
  private waterGain!: GainNode;
  private kettleGain!: GainNode;
  private cricketGain!: GainNode;
  private outLp!: BiquadFilterNode;
  private nodes: AudioScheduledSourceNode[] = [];

  constructor(private e: AudioEngine) {}

  start(): void {
    if (this.running || !this.e.started) return;
    this.running = true;
    const e = this.e;
    const ctx = e.ctx;
    // Außengeräusche laufen durch einen Tiefpass: im Haus klingen sie gedämpft.
    this.outLp = ctx.createBiquadFilter();
    this.outLp.type = 'lowpass';
    this.outLp.frequency.value = 7000;
    this.outLp.connect(e.buses.amb);

    // Wind: gefiltertes Rauschen mit langsamen Böen
    const wind = e.noiseSource();
    const wbp = ctx.createBiquadFilter();
    wbp.type = 'bandpass';
    wbp.frequency.value = 520;
    wbp.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lg = ctx.createGain();
    lg.gain.value = 0.03;
    lfo.connect(lg).connect(this.windGain.gain);
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.05;
    const lg2 = ctx.createGain();
    lg2.gain.value = 260;
    lfo2.connect(lg2).connect(wbp.frequency);
    wind.connect(wbp).connect(this.windGain).connect(this.outLp);
    // Wasser: feines Rauschen in hohen Lagen
    const water = e.noiseSource();
    const whp = ctx.createBiquadFilter();
    whp.type = 'highpass';
    whp.frequency.value = 2400;
    const wlp = ctx.createBiquadFilter();
    wlp.type = 'lowpass';
    wlp.frequency.value = 6500;
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0.012;
    water.connect(whp).connect(wlp).connect(this.waterGain).connect(this.outLp);
    // Wasserkocher: tiefes Zischen, nur im Haus hörbar
    const kettle = e.noiseSource();
    const kbp = ctx.createBiquadFilter();
    kbp.type = 'bandpass';
    kbp.frequency.value = 3200;
    kbp.Q.value = 0.9;
    this.kettleGain = ctx.createGain();
    this.kettleGain.gain.value = 0.0001;
    kettle.connect(kbp).connect(this.kettleGain).connect(e.buses.amb);
    // Grillen: schnell gepulste hohe Sinus-Töne
    const cr = ctx.createOscillator();
    cr.frequency.value = 4700;
    const cAm = ctx.createGain();
    cAm.gain.value = 0;
    const crLfo = ctx.createOscillator();
    crLfo.frequency.value = 28;
    const crLg = ctx.createGain();
    crLg.gain.value = 0.5;
    crLfo.connect(crLg).connect(cAm.gain);
    const crGate = ctx.createOscillator();
    crGate.frequency.value = 2.3;
    const crGateG = ctx.createGain();
    crGateG.gain.value = 0.5;
    crGate.connect(crGateG).connect(cAm.gain);
    this.cricketGain = ctx.createGain();
    this.cricketGain.gain.value = 0.0001;
    cr.connect(cAm).connect(this.cricketGain).connect(this.outLp);

    for (const n of [wind, water, kettle, lfo, lfo2, cr, crLfo, crGate]) {
      n.start();
      this.nodes.push(n);
    }
    this.apply();
    this.loopDrops();
    this.loopBirds();
    this.loopChimes();
    this.loopDishes();
  }

  stop(): void {
    this.running = false;
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {
        /* schon gestoppt */
      }
    }
    this.nodes = [];
  }

  setTime(t: number): void {
    this.tod = t;
    this.apply();
  }

  setInside(inside: boolean): void {
    this.inside = inside;
    this.apply();
  }

  private apply(): void {
    if (!this.running) return;
    const ctx = this.e.ctx;
    const now = ctx.currentTime;
    const night = smoothstep(0.62, 0.95, this.tod);
    this.outLp.frequency.setTargetAtTime(this.inside ? 2600 : 7000, now, 0.6);
    this.windGain.gain.setTargetAtTime(this.inside ? 0.035 : 0.06, now, 1);
    this.waterGain.gain.setTargetAtTime(this.inside ? 0.01 : 0.02, now, 1);
    this.kettleGain.gain.setTargetAtTime(this.inside ? 0.006 : 0.0001, now, 1);
    this.cricketGain.gain.setTargetAtTime(0.0001 + night * (this.inside ? 0.006 : 0.012), now, 1.5);
  }

  private later(fn: () => void, ms: number): void {
    this.timers.push(window.setTimeout(fn, ms));
    if (this.timers.length > 40) this.timers.shift();
  }

  /** Geschirr im Hintergrund: Tassen auf Untertassen, ein Löffel am Porzellan (nur im Haus) */
  private loopDishes(): void {
    if (!this.running) return;
    const e = this.e;
    if (this.inside) {
      const t = e.now;
      const hits = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < hits; i++) {
        const f = 2300 + Math.random() * 1500;
        e.tone({
          freq: f,
          dur: 0.18,
          gain: 0.006,
          type: 'sine',
          bus: e.buses.amb,
          when: t + i * 0.11,
          reverb: 0.2,
        });
        e.tone({
          freq: f * 2.76,
          dur: 0.08,
          gain: 0.003,
          type: 'sine',
          bus: e.buses.amb,
          when: t + i * 0.11,
        });
      }
    }
    this.later(() => this.loopDishes(), 3500 + Math.random() * 8000);
  }

  /** Einzelne Wassertropfen */
  private loopDrops(): void {
    if (!this.running) return;
    const e = this.e;
    const f = 700 + Math.random() * 900;
    e.tone({
      freq: f,
      glideTo: f * 1.9,
      dur: 0.07,
      gain: this.inside ? 0.012 : 0.03,
      bus: e.buses.amb,
      reverb: 0.1,
    });
    this.later(() => this.loopDrops(), 500 + Math.random() * 2200);
  }

  /** Vogelgezwitscher am Tag */
  private loopBirds(): void {
    if (!this.running) return;
    const day = 1 - smoothstep(0.45, 0.8, this.tod);
    if (Math.random() < day) this.chirp(this.inside ? 0.014 : 0.035);
    this.later(() => this.loopBirds(), 3500 + Math.random() * 7000);
  }

  chirp(gain: number, when = this.e.now): void {
    const e = this.e;
    const n = 2 + Math.floor(Math.random() * 3);
    const base = 2300 + Math.random() * 1200;
    for (let i = 0; i < n; i++) {
      const t = when + i * (0.1 + Math.random() * 0.04);
      const up = Math.random() < 0.6;
      e.tone({
        freq: base,
        glideTo: up ? base * 1.45 : base * 0.75,
        dur: 0.07,
        gain: gain * clamp(1 - i * 0.12),
        bus: e.buses.amb,
        when: t,
        reverb: 0.2,
      });
    }
  }

  /** Seltenes Windspiel: pentatonische Glöckchen */
  private loopChimes(): void {
    if (!this.running) return;
    const e = this.e;
    const night = smoothstep(0.5, 1, this.tod);
    if (Math.random() < 0.45 + night * 0.3) {
      const n = 1 + Math.floor(Math.random() * 3);
      const pool = [86, 88, 90, 93, 95];
      for (let i = 0; i < n; i++) {
        const m = pool[Math.floor(Math.random() * pool.length)]!;
        this.bell(midiToFreq(m), e.now + i * (0.16 + Math.random() * 0.2), this.inside ? 0.014 : 0.026);
      }
    }
    this.later(() => this.loopChimes(), 9000 + Math.random() * 14000);
  }

  bell(freq: number, when: number, gain: number): void {
    const e = this.e;
    e.tone({ freq, dur: 3.2, gain, bus: e.buses.amb, when, reverb: 0.5, attack: 0.003 });
    e.tone({
      freq: freq * 2.76,
      dur: 1.4,
      gain: gain * 0.35,
      bus: e.buses.amb,
      when,
      reverb: 0.4,
      attack: 0.003,
    });
    e.tone({ freq: freq * 5.4, dur: 0.6, gain: gain * 0.12, bus: e.buses.amb, when, attack: 0.002 });
  }
}
