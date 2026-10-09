// Fassade: verbindet die Klang-Bausteine mit dem Event-Bus und den gespeicherten Einstellungen.
import { bus } from '../core/bus';
import { store } from '../state/store';
import { AudioEngine } from './engine';
import { Music } from './music';
import { Ambience } from './ambience';
import { Sfx } from './sfx';
import { Simlish } from './simlish';

export class GameAudio {
  readonly engine = new AudioEngine();
  readonly music = new Music(this.engine);
  readonly amb = new Ambience(this.engine);
  readonly sfx = new Sfx(this.engine, this.amb);
  readonly voice = new Simlish(this.engine);
  private wired = false;
  private inside = false;

  /** Nach dem ersten Klick: Kontext anlegen, Musik und Ambiente starten. */
  async start(): Promise<void> {
    this.engine.init();
    if (!this.engine.started) return;
    await this.engine.resume();
    this.applySettings();
    if (!this.wired) this.wire();
    this.amb.start();
    if (!store.settings.muted) this.music.start();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.engine.ctx.suspend();
      else void this.engine.resume();
    });
  }

  applySettings(): void {
    const s = store.settings;
    this.engine.setLevels(s.music, s.sfx, s.muted, s.voices);
    if (this.engine.started) {
      if (s.muted) this.music.stop();
      else this.music.start();
    }
  }

  setInside(inside: boolean): void {
    this.inside = inside;
    this.amb.setInside(inside);
    if (inside) this.sfx.enter();
  }

  get isInside(): boolean {
    return this.inside;
  }

  private wire(): void {
    this.wired = true;
    const on = bus.on.bind(bus);
    on('ui:click', () => this.sfx.click());
    on('ui:open', () => this.sfx.paper(true));
    on('ui:close', () => this.sfx.paper(false));
    on('ui:unlock', () => this.sfx.unlock());
    on('ui:word', () => this.sfx.word());
    on('ui:select', (p) => this.sfx.select(p.who));
    on('voice:blip', (p) => this.voice.syllable(p.who, p.ch));
    on('scene:sip', (p) => this.sfx.sip(p.who));
    on('scene:pour', () => this.sfx.pour());
    on('scene:clink', () => this.sfx.clink());
    on('scene:gong', () => this.sfx.gong());
    on('scene:bonk', () => this.sfx.bonk());
    on('scene:bird', () => this.sfx.bird());
    on('scene:koi', () => this.sfx.koi());
    on('scene:lantern', () => this.sfx.lantern());
    on('scene:cat', () => this.sfx.cat());
    on('scene:steam', () => this.sfx.steam());
    on('scene:door', () => this.sfx.door());
    on('scene:purr', () => this.sfx.purr());
    on('scene:tea', () => this.sfx.clink());
    on('scene:finale', () => this.music.swell());
    on('quiz:right', () => this.sfx.right());
    on('quiz:wrong', () => this.sfx.wrong());
    on('time:changed', (p) => {
      this.amb.setTime(p.t);
      this.music.setTime(p.t);
    });
    // Beim Gespräch tritt die Musik etwas zurück
    on('ui:open', () => (this.music.intensity = 0.6));
    on('ui:close', () => (this.music.intensity = 1));
  }

  /** Test-Hilfe: aktueller Pegel 0..1 */
  level(): number {
    if (!this.engine.started) return 0;
    const a = this.engine.analyser;
    const d = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(d);
    let sum = 0;
    for (const v of d) sum += v * v;
    return Math.sqrt(sum / d.length);
  }
}
