// Kern der Klang-Erzeugung: AudioContext, Busse (Musik, Effekte, Ambiente), Hall und Rauschen.
// Alles wird per Web Audio API selbst erzeugt – keine Audiodateien, keine Urheberrechtsfragen.

export interface Buses {
  music: GainNode;
  sfx: GainNode;
  amb: GainNode;
  /** Stimmen (Simlish) */
  voice: GainNode;
  /** Hall-Eingang: mit Anteil zuspielen */
  reverb: GainNode;
}

type ACtor = typeof AudioContext;

export class AudioEngine {
  ctx!: AudioContext;
  buses!: Buses;
  master!: GainNode;
  analyser!: AnalyserNode;
  started = false;
  private noiseBuf!: AudioBuffer;
  private pluckCache = new Map<number, AudioBuffer>();

  /** Muss in einer Nutzer-Geste aufgerufen werden (Klick auf „Eintreten“). */
  init(): void {
    if (this.started) return;
    const AC: ACtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: ACtor }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;

    // Master: sanfter Kompressor gegen Übersteuern, Analyser für Tests
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.master.connect(comp).connect(this.analyser).connect(ctx.destination);

    const music = ctx.createGain();
    const sfx = ctx.createGain();
    const amb = ctx.createGain();
    const voice = ctx.createGain();
    const reverb = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = this.impulse(2.8, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverb.connect(conv).connect(wet).connect(this.master);
    music.connect(this.master);
    sfx.connect(this.master);
    amb.connect(this.master);
    voice.connect(this.master);
    music.gain.value = 0.6;
    sfx.gain.value = 0.8;
    amb.gain.value = 0.7;
    voice.gain.value = 0.8;
    this.buses = { music, sfx, amb, reverb, voice };

    this.noiseBuf = this.makeNoise(3);
    this.started = true;
  }

  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* Autoplay-Regel: später erneut versuchen */
      }
    }
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  /** Lautstärken 0..1 (Regler) bzw. Stumm */
  setLevels(music: number, sfx: number, muted: boolean, voices = 0.8): void {
    if (!this.started) return;
    const t = this.now;
    this.buses.voice.gain.setTargetAtTime(voices, t, 0.08);
    this.master.gain.setTargetAtTime(muted ? 0 : 1, t, 0.08);
    this.buses.music.gain.setTargetAtTime(music, t, 0.08);
    this.buses.sfx.gain.setTargetAtTime(sfx, t, 0.08);
    this.buses.amb.gain.setTargetAtTime(Math.min(1, sfx * 0.9 + 0.1), t, 0.08);
  }

  // ───────────────────────────── Bausteine
  /** Weißes Rauschen (Schleife) */
  noiseSource(loop = true): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = loop;
    s.loopStart = 0;
    s.loopEnd = this.noiseBuf.duration;
    return s;
  }

  private makeNoise(seconds: number): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.floor(sr * seconds), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, decay * 2.2);
        lp += (Math.random() * 2 - 1 - lp) * (0.35 - t * 0.28);
        d[i] = lp * env * 2.2;
      }
    }
    return buf;
  }

  /** Karplus-Strong-Zupfklang (Guzheng-artig), einmal berechnet und zwischengespeichert. */
  pluckBuffer(midi: number): { buf: AudioBuffer; rate: number } {
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const sr = this.ctx.sampleRate;
    const period = Math.max(2, Math.round(sr / freq));
    // Der Mittelwert-Filter (mit dem nächsten Wert) verkürzt die Schwingung um eine halbe Abtastung.
    const rate = freq / (sr / (period - 0.5));
    let buf = this.pluckCache.get(midi);
    if (!buf) {
      const dur = 3.4;
      const len = Math.floor(sr * dur);
      buf = this.ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const ring = new Float32Array(period);
      // Anschlag: leicht gedämpftes Rauschen (wärmer als reines Weiß)
      let lp = 0;
      for (let i = 0; i < period; i++) {
        lp += (Math.random() * 2 - 1 - lp) * 0.65;
        ring[i] = lp;
      }
      const decay = 0.9972 + Math.min(0.0022, (110 / freq) * 0.0008);
      let p = 0;
      for (let n = 0; n < len; n++) {
        const a = ring[p]!;
        const b = ring[(p + 1) % period]!;
        d[n] = a;
        ring[p] = decay * 0.5 * (a + b);
        p = (p + 1) % period;
      }
      // sanftes Einblenden verhindert Knacken
      for (let i = 0; i < 64; i++) d[i]! *= i / 64;
      this.pluckCache.set(midi, buf);
    }
    return { buf, rate };
  }

  /** Einzelner Ton mit Hüllkurve; gibt den Ausgangsknoten zurück. */
  tone(opts: {
    freq: number;
    dur: number;
    type?: OscillatorType;
    gain?: number;
    when?: number;
    attack?: number;
    bus: GainNode;
    reverb?: number;
    glideTo?: number;
    detune?: number;
    lowpass?: number;
  }): void {
    const ctx = this.ctx;
    const t0 = opts.when ?? ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(opts.freq, t0);
    if (opts.glideTo) o.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + opts.dur);
    if (opts.detune) o.detune.value = opts.detune;
    const g = ctx.createGain();
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain ?? 0.2), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    let node: AudioNode = o;
    if (opts.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.lowpass;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(opts.bus);
    if (opts.reverb) {
      const s = ctx.createGain();
      s.gain.value = opts.reverb;
      g.connect(s).connect(this.buses.reverb);
    }
    o.start(t0);
    o.stop(t0 + opts.dur + 0.05);
  }

  /** Rauschstoß durch einen Filter (Plätschern, Klopfen, Zischen) */
  noiseBurst(opts: {
    dur: number;
    type?: BiquadFilterType;
    freq: number;
    q?: number;
    gain?: number;
    when?: number;
    attack?: number;
    bus: GainNode;
    sweepTo?: number;
    reverb?: number;
  }): void {
    const ctx = this.ctx;
    const t0 = opts.when ?? ctx.currentTime;
    const src = this.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq, t0);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + opts.dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain ?? 0.2), t0 + (opts.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(f).connect(g).connect(opts.bus);
    if (opts.reverb) {
      const s = ctx.createGain();
      s.gain.value = opts.reverb;
      g.connect(s).connect(this.buses.reverb);
    }
    src.start(t0, Math.random() * 2);
    src.stop(t0 + opts.dur + 0.05);
  }
}

export const midiToFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
