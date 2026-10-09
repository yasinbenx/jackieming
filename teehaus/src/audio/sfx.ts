// Effekt-Klänge: Oberfläche, Teekanne, Anstoßen, Gong, Easter Eggs. Alles synthetisch.
import type { AudioEngine } from './engine';
import { midiToFreq } from './engine';
import type { Ambience } from './ambience';

export class Sfx {
  constructor(
    private e: AudioEngine,
    private amb: Ambience,
  ) {}

  private get b(): GainNode {
    return this.e.buses.sfx;
  }

  /** Holz-Tick (UI-Klick) */
  click(): void {
    const e = this.e;
    e.noiseBurst({ dur: 0.05, type: 'bandpass', freq: 1900, q: 4, gain: 0.16, bus: this.b });
    e.tone({ freq: 520, glideTo: 380, dur: 0.06, gain: 0.08, type: 'triangle', bus: this.b });
  }

  /** Papier raschelt (Fenster öffnet / schließt) */
  paper(open: boolean): void {
    const e = this.e;
    e.noiseBurst({
      dur: 0.28,
      type: 'bandpass',
      freq: open ? 2200 : 3200,
      sweepTo: open ? 4200 : 1500,
      q: 1.2,
      gain: 0.07,
      attack: 0.05,
      bus: this.b,
    });
  }

  select(who: 'jackie' | 'yao'): void {
    const e = this.e;
    const m = who === 'jackie' ? 78 : 66;
    e.tone({
      freq: midiToFreq(m),
      dur: 0.5,
      gain: 0.1,
      type: 'triangle',
      bus: this.b,
      reverb: 0.4,
      attack: 0.004,
    });
    e.tone({ freq: midiToFreq(m + 7), dur: 0.35, gain: 0.05, bus: this.b, reverb: 0.4, when: e.now + 0.07 });
  }

  /** Neue Frage freigeschaltet: zwei steigende Glockentöne */
  unlock(): void {
    const e = this.e;
    const t = e.now;
    this.amb.bell(midiToFreq(90), t, 0.07);
    this.amb.bell(midiToFreq(97), t + 0.12, 0.06);
  }

  /** Wort gesammelt: kleines Funkeln */
  word(): void {
    const e = this.e;
    const t = e.now;
    [86, 90, 93, 98].forEach((m, i) => this.amb.bell(midiToFreq(m), t + i * 0.07, 0.055));
  }

  /** Tee eingießen */
  pour(): void {
    const e = this.e;
    const t = e.now;
    e.noiseBurst({
      dur: 1.3,
      type: 'bandpass',
      freq: 1500,
      sweepTo: 3400,
      q: 2.5,
      gain: 0.1,
      attack: 0.1,
      bus: this.b,
      reverb: 0.1,
    });
    for (let i = 0; i < 7; i++) {
      const f = 380 + i * 70 + Math.random() * 40;
      e.tone({
        freq: f,
        glideTo: f * 1.5,
        dur: 0.07,
        gain: 0.05,
        bus: this.b,
        when: t + 0.1 + i * 0.16,
        reverb: 0.15,
      });
    }
  }

  /** Tassen stoßen aneinander */
  clink(): void {
    const e = this.e;
    const t = e.now;
    for (const [f, g, d] of [
      [2870, 0.1, 0.9],
      [4130, 0.07, 0.6],
      [6210, 0.04, 0.35],
    ] as const) {
      e.tone({ freq: f, dur: d, gain: g, bus: this.b, reverb: 0.3, attack: 0.001, when: t });
      e.tone({ freq: f * 1.012, dur: d, gain: g * 0.6, bus: this.b, reverb: 0.3, attack: 0.001, when: t });
    }
    e.noiseBurst({ dur: 0.03, type: 'highpass', freq: 5000, gain: 0.08, bus: this.b });
  }

  /** Gong zum Finale */
  gong(): void {
    const e = this.e;
    const t = e.now;
    for (const [m, g, d] of [
      [38, 0.16, 5.5],
      [45, 0.1, 4.5],
      [50.5, 0.07, 3.8],
      [57.2, 0.05, 3],
    ] as const) {
      e.tone({ freq: midiToFreq(m), dur: d, gain: g, bus: this.b, reverb: 0.8, attack: 0.012, when: t });
    }
    e.noiseBurst({ dur: 0.4, type: 'bandpass', freq: 900, q: 1, gain: 0.07, bus: this.b, reverb: 0.5 });
  }

  /** Aua! Holz-Klopfen + Boing */
  bonk(): void {
    const e = this.e;
    const t = e.now;
    e.noiseBurst({ dur: 0.08, type: 'bandpass', freq: 380, q: 3, gain: 0.3, bus: this.b });
    e.tone({ freq: 140, glideTo: 70, dur: 0.18, gain: 0.25, type: 'triangle', bus: this.b });
    e.tone({ freq: 300, glideTo: 640, dur: 0.22, gain: 0.07, bus: this.b, when: t + 0.1 });
  }

  bird(): void {
    this.amb.chirp(0.07);
    window.setTimeout(() => this.e.started && this.amb.chirp(0.05), 260);
  }

  koi(): void {
    const e = this.e;
    e.noiseBurst({
      dur: 0.35,
      type: 'bandpass',
      freq: 900,
      sweepTo: 400,
      q: 1.2,
      gain: 0.14,
      attack: 0.02,
      bus: this.b,
      reverb: 0.2,
    });
    for (let i = 0; i < 4; i++)
      e.tone({
        freq: 500 + i * 130,
        glideTo: 900 + i * 160,
        dur: 0.06,
        gain: 0.05,
        bus: this.b,
        when: e.now + 0.05 + i * 0.09,
      });
  }

  lantern(): void {
    const e = this.e;
    e.noiseBurst({ dur: 0.05, type: 'bandpass', freq: 2600, q: 5, gain: 0.12, bus: this.b });
    this.amb.bell(midiToFreq(81), e.now, 0.045);
  }

  /** Schnurren der Katze */
  cat(): void {
    const e = this.e;
    const ctx = e.ctx;
    const t = e.now;
    const src = e.noiseSource(false);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + 2.4);
    const am = ctx.createOscillator();
    am.frequency.value = 26;
    const amg = ctx.createGain();
    amg.gain.value = 0.07;
    am.connect(amg).connect(g.gain);
    src.connect(lp).connect(g).connect(this.b);
    src.start(t);
    am.start(t);
    src.stop(t + 2.5);
    am.stop(t + 2.5);
  }

  /** Schnurren beim Streicheln */
  purr(): void {
    this.cat();
  }

  /** Holztür knarrt auf */
  door(): void {
    const e = this.e;
    e.tone({ freq: 140, glideTo: 95, dur: 0.9, gain: 0.05, type: 'sawtooth', bus: this.b });
    e.noiseBurst({
      dur: 0.8,
      type: 'bandpass',
      freq: 600,
      sweepTo: 380,
      q: 6,
      gain: 0.08,
      attack: 0.1,
      bus: this.b,
    });
    e.noiseBurst({ dur: 0.12, type: 'lowpass', freq: 300, gain: 0.12, bus: this.b, when: e.now + 0.85 });
  }

  steam(): void {
    this.e.noiseBurst({ dur: 0.9, type: 'highpass', freq: 3200, gain: 0.09, attack: 0.08, bus: this.b });
  }

  /** Schluck Tee */
  sip(who: 'jackie' | 'yao'): void {
    const e = this.e;
    const f = who === 'jackie' ? 210 : 150;
    e.tone({ freq: f, glideTo: f * 0.6, dur: 0.14, gain: 0.07, type: 'sine', bus: this.b });
    e.noiseBurst({ dur: 0.12, type: 'lowpass', freq: 700, gain: 0.04, bus: this.b, when: e.now + 0.02 });
  }

  /** Türchen: Willkommens-Windspiel beim Eintreten */
  enter(): void {
    const e = this.e;
    const t = e.now;
    [93, 90, 88, 86, 81, 78].forEach((m, i) => this.amb.bell(midiToFreq(m), t + i * 0.12, 0.05));
    e.noiseBurst({
      dur: 0.9,
      type: 'bandpass',
      freq: 600,
      sweepTo: 1800,
      q: 0.8,
      gain: 0.06,
      attack: 0.2,
      bus: this.b,
      reverb: 0.3,
    });
  }

  right(): void {
    const e = this.e;
    const t = e.now;
    [81, 85, 88].forEach((m, i) =>
      e.tone({
        freq: midiToFreq(m),
        dur: 0.5,
        gain: 0.08,
        type: 'triangle',
        bus: this.b,
        reverb: 0.4,
        when: t + i * 0.08,
      }),
    );
  }

  wrong(): void {
    const e = this.e;
    e.tone({ freq: 300, glideTo: 190, dur: 0.35, gain: 0.08, type: 'triangle', bus: this.b, reverb: 0.2 });
  }
}
