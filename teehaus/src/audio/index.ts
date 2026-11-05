// Fassade: verbindet die Klang-Bausteine mit dem Event-Bus und den gespeicherten Einstellungen.
import { bus } from '../core/bus';
import { store } from '../state/store';
import { AudioEngine } from './engine';
import { Music, renderMusicOffline } from './music';
import type { MusicRenderResult, MusicState } from './music';
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
  /** sobald 'talk:start'/'talk:end' kommen, werden 'ui:open'/'ui:close' für die Musik ignoriert */
  private talkEvents = false;

  /** Nach dem ersten Klick: Kontext anlegen, Musik und Ambiente starten. */
  async start(): Promise<void> {
    this.engine.init();
    if (!this.engine.started) return;
    // Das Windspiel des Ambientes klingt in der Tonart, in der die Musik gerade spielt
    this.music.onKey = (pcs) => this.amb.setChimeScale(pcs);
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
    this.music.setInside(inside);
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
    // Im Gespräch tritt die Musik zurück: die Erhu schweigt, nur leise Guzheng bleibt
    on('talk:start', () => {
      this.talkEvents = true;
      this.music.setDialog(true);
    });
    on('talk:end', () => {
      this.talkEvents = true;
      this.music.setDialog(false);
    });
    // Rückfall, solange das Spiel keine talk:-Ereignisse sendet: das Gesprächsfenster meldet sich per ui:open/close
    on('ui:open', () => {
      if (!this.talkEvents) this.music.setDialog(true);
    });
    on('ui:close', () => {
      if (!this.talkEvents) this.music.setDialog(false);
    });
  }

  /** Test-Hilfe: rendert die generative Musik offline für einen Zustand (Pegel, gewählte Phrasen) */
  renderMusic(seconds: number, state: Partial<MusicState> = {}, seed = 1): Promise<MusicRenderResult> {
    return renderMusicOffline(seconds, state, seed);
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
