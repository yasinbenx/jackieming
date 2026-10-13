// Verdrahtet Welt, Oberfläche, Ton und Spielstand. NPCs, Dialog und Fundstücke hängen sich hier an.
import type { World } from './world/world';
import { store } from './state/store';
import { bus } from './core/bus';
import { JACKIE, YAO } from './content/dialogs';
import { WORDS } from './content/words';
import { createHud } from './ui/hud';
import type { Hud } from './ui/hud';
import { WordCard } from './ui/wordcard';
import { CreditsPage, Dictionary, HeightPanel, InfoPage } from './ui/panels';
import { SoundPanel } from './ui/sound';
import { GameAudio } from './audio';
import { Toast } from './ui/toast';
import { Bubbles } from './ui/bubbles';
import { Soundscape } from './world/soundscape';
import { Npcs } from './world/npcs';
import { Finds } from './world/finds';
import { Heroes } from './world/heroes';
import { TalkPanel } from './ui/talk';
import { TeaGame } from './ui/teagame';
import { QuestRunner } from './world/questrun';
import { SettingsPage } from './ui/settings';
import { PauseMenu } from './ui/menu';
import { Tutorial } from './ui/tutorial';
import { Captions } from './ui/captions';
import { murmurCaption } from './content/captions';
import { HALL, SEATS, TABLES } from './world/layout';
import { freeSeatAt } from './world/seating';
import type { Seat } from './world/layout';
import { Vector3 } from 'three';
import { wordById } from './content/words';
import type { FigureId } from './content/types';

const TOTAL_QUESTIONS = JACKIE.questions.length + YAO.questions.length;

export class Game {
  readonly hud: Hud;
  readonly wordCard: WordCard;
  private dict = new Dictionary();
  private heights = new HeightPanel();
  private info: InfoPage;
  readonly credits = new CreditsPage();
  readonly audio = new GameAudio();
  private sound: SoundPanel;
  readonly toast = new Toast();
  readonly bubbles: Bubbles;
  readonly npcs: Npcs;
  readonly finds: Finds;
  readonly heroes: Heroes;
  readonly talk: TalkPanel;
  private sittingForTalk = false;
  /** Jackie und Yao (ab B4); bis dahin bleiben ihre Kommentare stumm */
  heroSay: (by: FigureId, text: string) => void = () => undefined;
  heroAct: (by: FigureId, what: 'duck' | 'laugh' | 'nod') => void = () => undefined;
  /** Läuft gerade ein Gespräch mit Jackie oder Yao? */
  talking = false;

  constructor(readonly world: World) {
    this.wordCard = new WordCard(() => `${store.words.size} von ${WORDS.length} Wörtern`);
    this.info = new InfoPage({
      onCredits: () => {
        this.info.modal.close();
        this.credits.open();
      },
      onSettings: () => {
        this.info.modal.close();
        this.settings.open();
      },
      onTutorial: () => {
        this.info.modal.close();
        this.pause.hide();
        this.resumeMode();
        this.tutorial.begin(true);
      },
    });
    this.settings = new SettingsPage({
      apply: () => this.applySettings(),
      onProgressReset: () => this.onProgressReset?.(),
    });
    this.sound = new SoundPanel(() => this.onSoundChange());
    this.hud = createHud(world, {
      onWords: () => this.dict.open(),
      onInfo: () => this.info.open(),
      onToast: () => undefined,
      onSound: (a) => this.sound.toggle(a),
      onPause: () => this.togglePause(),
    });
    this.hud.setSoundIcon(store.settings.muted);
    world.onInsideChange = (inside) => this.audio.setInside(inside);
    this.bubbles = new Bubbles((v) => world.toScreenLoose(v));
    this.npcs = new Npcs({
      world,
      say: (sp, text, hold) => this.bubbles.say(sp, text, { hold }),
      icon: (sp, sym) => this.bubbles.icon(sp, sym),
      award: (id) => this.award(id),
      busy: () => this.talking || this.tea.open,
      brew: () => this.startBrew(),
      onTalk: (id) => this.quests?.onTalk(id) ?? false,
      onCat: () => this.quests?.onCat(),
    });
    world.onWave = () => this.npcs.waveFrom(world.player.ch.root.position);
    this.heroes = new Heroes({
      world,
      say: (sp, text, hold) => this.bubbles.say(sp, text, { hold }),
      icon: (sp, sym) => this.bubbles.icon(sp, sym),
      talking: () => this.talking,
      onTalk: (id) => this.startTalk(id),
    });
    this.heroSay = (by, text) => this.heroes.say(by, text);
    this.quests = new QuestRunner({
      world,
      npcs: this.npcs,
      say: (sp, text, hold) => void this.bubbles.say(sp, text, { hold }),
      icon: (sp, sym) => this.bubbles.icon(sp, sym),
      award: (id) => this.award(id),
      toast: (html) => this.toast.show(html, 5200),
    });
    const scape = new Soundscape(world, this.audio.voice, () => this.talking);
    scape.add(world.playerSpeaker);
    for (const n of this.npcs.list)
      scape.add(n.speaker, n === this.npcs.master ? undefined : () => n.agent.seated && !n.engaged);
    for (const hero of [this.heroes.jackie, this.heroes.yao])
      scape.add(hero.speaker, () => this.heroes.yaoHere && hero.agent.seated);
    this.talk = new TalkPanel({
      answer: (id, text) => this.bubbles.say(this.heroes.get(id).speaker, text, { hold: 0, cls: 'answer' }),
      banter: (by, text) => {
        if (by === 'yao' && !this.heroes.yaoHere) return;
        const h = this.heroes.get(by);
        h.ch.play('laugh', 1.2);
        void this.bubbles.say(h.speaker, text, { hold: 3.5 });
      },
      gesture: (id, mood) => {
        const ch = this.heroes.get(id).ch;
        if (mood === 'laugh') ch.play(id === 'jackie' && Math.random() < 0.4 ? 'kungfu' : 'laugh', 1.6);
        else if (mood === 'nod') ch.play('nod', 1.2);
        else if (mood === 'think') ch.play('think', 2.2);
        else if (mood === 'shrug') ch.play('shrug', 1.6);
        else if (mood === 'hello') ch.play('wave', 1.4);
      },
      skip: (id) => this.bubbles.skip(id),
      award: (id) => this.award(id),
      onClose: () => this.endTalk(),
      canSwitch: (to) => to === 'jackie' || this.heroes.yaoHere,
      onSwitch: (to) => this.startTalk(to),
    });
    this.heroAct = (by, what) => this.heroes.act(by, what);
    this.finds = new Finds({
      world,
      award: (id) => this.award(id),
      toast: (html) => this.toast.show(html),
      heroSay: (by, text) => this.heroSay(by, text),
      heroAct: (by, what) => this.heroAct(by, what),
      openHeights: () => this.openHeights(),
    });
    if (store.asked.size === 0 && store.words.size === 0) {
      store.addWord('chaguan');
      store.addWord('qingjin');
    }
    store.subscribe(() => this.refresh());
    this.applySettings();
    // Tasten für Karte, Ton und Pause
    world.input.onAction = (a) => {
      if (a === 'sound') this.sound.toggleMute();
      else if (a === 'map') {
        if (world.mode === 'free')
          this.toast.show('Die Karte kommt, sobald es draußen mehr zu entdecken gibt.');
      } else if (a === 'pause') this.togglePause();
    };
    // Esc öffnet die Pause, wenn nichts anderes offen ist (vor allen anderen Esc-Handlern prüfen)
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape') return;
        // ein Fenster über der Pause (Einstellungen, Hilfe) schließt zuerst
        if (this.pause.open && document.querySelector('.modal:not([hidden])')) return;
        if (this.pause.open) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.togglePause();
        } else if (this.canPause()) {
          e.preventDefault();
          this.togglePause();
        }
      },
      true,
    );
    // Tutorial, Untertitel, Autospeichern, entdeckte Orte
    this.tutorial = new Tutorial({
      player: () => ({ x: world.player.x, z: world.player.z, seated: world.player.seated }),
      touch: () => world.input.touch,
    });
    world.onUse = (id) => this.tutorial.used(id);
    this.captions = new Captions();
    scape.onMurmur = (sp) => {
      if (store.settings.captions) this.captions.show(sp.label ?? '', sp.name, murmurCaption(sp.id));
    };
    let saveT = 0;
    world.tickers.push((dt) => {
      if (world.input.lookDX) this.tutorial.looked(world.input.lookDX);
      this.tutorial.update(dt);
      saveT += dt;
      if (saveT > 4 && world.mode === 'free' && document.body.classList.contains('is-inside')) {
        saveT = 0;
        const pl = world.player;
        if (!pl.busy) store.setPos(pl.x, pl.z, pl.ch.yaw);
        const z = pl.z;
        store.markPlace(z < HALL.z1 ? 'teehaus' : z < 7.2 ? 'terrasse' : 'bruecke');
      }
    });
    // Esc bricht den Weg zum Platz ab
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.approach) {
        e.preventDefault();
        this.approach.cancel = true;
      }
    });
    this.refresh();
  }

  refresh(): void {
    this.hud.setProgress(store.asked.size, TOTAL_QUESTIONS, store.words.size, WORDS.length);
    this.hud.setCoins(store.coins);
    this.hud.setToastReady(false);
  }

  /**
   * „Ansprechen“: Die Spielfigur geht zum freien Hocker am Haupttisch, setzt sich, dreht sich zur Person, erst dann
   * fährt die Kamera in den Gesprächsmodus. Esc bricht den Weg ab. Ist kein Platz frei oder kein Weg da (oder dauert
   * es zu lange), beginnt das Gespräch im Stehen.
   */
  startTalk(id: FigureId): void {
    const w = this.world;
    const pl = w.player;
    if (this.talking) {
      this.openTalk(id);
      return;
    }
    if (this.approach) return;
    const spot = this.freeSeat();
    if (pl.seated && pl.seat?.table === 'main') {
      this.openTalk(id);
      return;
    }
    if (!spot) {
      this.toast.show('Am Tisch ist gerade kein Platz frei – ihr redet im Stehen.');
      this.openTalk(id);
      return;
    }
    pl.stopPath();
    if (pl.seated) pl.standUp();
    // Erst aufstehen lassen, dann losgehen
    const go = (): boolean =>
      pl.sitAt(spot, () => {
        this.sittingForTalk = true;
      });
    w.mode = 'cutscene';
    this.bubbles.dismissAll();
    const hint = document.createElement('div');
    hint.className = 'approach-hint';
    hint.setAttribute('role', 'status');
    hint.innerHTML = '<span>Du gehst zum freien Platz am Tisch …</span>';
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.className = 'btn ghost small';
    stop.innerHTML = 'Abbrechen <kbd>Esc</kbd>';
    hint.appendChild(stop);
    document.body.appendChild(hint);
    let t = 0;
    let started = false;
    const a = { cancel: false, hint };
    stop.addEventListener('click', () => (a.cancel = true));
    this.approach = a;
    const finish = (sitting: boolean): void => {
      hint.remove();
      this.approach = null;
      if (a.cancel) {
        pl.stopPath();
        if (w.mode === 'cutscene') w.mode = 'free';
        return;
      }
      if (!sitting) pl.stopPath();
      this.openTalk(id);
    };
    w.tickers.push((dt) => {
      if (a.cancel) {
        finish(false);
        return true;
      }
      t += dt;
      if (!started) {
        if (pl.busy) return false;
        started = true;
        if (!go()) {
          // kein Weg: im Stehen reden
          finish(false);
          return true;
        }
        return false;
      }
      // sitzt und hat sich zur Person gedreht
      if (pl.seated && pl.seat === spot) {
        const hero = this.heroes.get(id);
        const F = hero.face();
        pl.faceTo(F.x, F.z);
        pl.ch.lookAt(F);
        finish(true);
        return true;
      }
      if (t > 12) {
        finish(false);
        return true;
      }
      return false;
    });
  }

  private approach: { cancel: boolean; hint: HTMLElement } | null = null;

  /** Freier Hocker am Haupttisch (niemand sitzt oder steht darauf), der Spielfigur am nächsten */
  private freeSeat(): Seat | null {
    const w = this.world;
    const others = w.agents.filter((a) => a !== w.player);
    return freeSeatAt('main', SEATS, others, w.player);
  }

  /** Gesprächsmodus: Figur dreht sich zum Gast, Kamera fährt heran, Fragenliste öffnet sich */
  private openTalk(id: FigureId): void {
    const w = this.world;
    const hero = this.heroes.get(id);
    const other = this.heroes.get(id === 'jackie' ? 'yao' : 'jackie');
    const first = !this.talking;
    this.talking = true;
    w.mode = 'dialog';
    bus.emit('talk:start', { who: id });
    this.bubbles.dismissAll();
    this.bubbles.history = 3;
    const P = w.player.ch.root.position;
    hero.agent.faceTo(P.x, P.z);
    if (w.player.seated) {
      const F = hero.face();
      w.player.faceTo(F.x, F.z);
    }
    window.setTimeout(() => {
      hero.ch.lookAt(w.playerTarget());
      other.ch.lookAt(hero.face());
      w.player.ch.lookAt(hero.face());
    }, 600);
    this.talk.show(id);
    this.frameTalk(id);
    if (first) {
      hero.ch.play('wave', 1.4);
      const g = hero.profile.greetings[Math.floor(Math.random() * hero.profile.greetings.length)]!;
      void this.bubbles.say(hero.speaker, g, { hold: 0 });
    }
  }

  /**
   * Zweier-Einstellung: Gast und Figur seitlich im Bild, der Tisch dazwischen im Vordergrund. Die Kamera steht auf
   * der Seite, die vom Tischmittelpunkt wegzeigt, und rückt die beiden in den Bildteil, den das Gesprächsfenster
   * frei lässt (Desktop links, Telefon oben).
   */
  private frameTalk(id: FigureId): void {
    const w = this.world;
    const hero = this.heroes.get(id);
    const F = hero.face();
    const pp = w.player.ch.root.position;
    const G = w.playerTarget();
    const M = new Vector3((F.x + G.x) / 2, (F.y + G.y) / 2, (F.z + G.z) / 2);
    const line = new Vector3(F.x - G.x, 0, F.z - G.z);
    const span = Math.max(0.8, line.length());
    line.normalize();
    let n = new Vector3(-line.z, 0, line.x);
    const table = TABLES.find((t) => t.id === 'main')!;
    // vom Tisch weg (dann liegt der Tisch hinter den beiden) – bei großer Figur etwas mehr Abstand
    if (n.x * (M.x - table.x) + n.z * (M.z - table.z) < 0) n = n.negate();
    // Leicht schräg von der Seite des Gastes, damit sein Rücken nicht das Gesicht verdeckt
    const toHero = new Vector3(F.x - pp.x, 0, F.z - pp.z).normalize();
    const cam = w.camera;
    const vfov = (cam.fov * Math.PI) / 180;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    // Hochformat: eher über die Schulter des Gastes, dann stehen beide hintereinander statt nebeneinander
    const over = aspect < 1 ? 0.95 : 0.2;
    const dirCam = n
      .clone()
      .multiplyScalar(aspect < 1 ? 0.55 : 0.85)
      .addScaledVector(toHero, -over)
      .normalize();
    const r = this.talk.el.getBoundingClientRect();
    const sidePanel = r.left > window.innerWidth * 0.45;
    const freeW = sidePanel ? r.left / window.innerWidth : 1;
    const freeH = sidePanel ? 1 : Math.max(0.45, r.top / window.innerHeight);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect * freeW);
    const tall = Math.max(F.y, G.y) - Math.min(pp.y, F.y - 1.2);
    const across = span * Math.sqrt(Math.max(0, 1 - dirCam.dot(line) ** 2));
    const dW = (across * 0.5 + 0.5) / Math.tan(hfov / 2);
    const dH = (tall * 0.5 + 0.35) / Math.tan((vfov * freeH) / 2);
    const dist = Math.min(6.5, Math.max(2.4, dW, dH));
    const look = M.clone();
    look.y = Math.max(pp.y + 0.9, M.y - 0.15);
    const pos = look.clone().addScaledVector(dirCam, dist);
    // im Raum bleiben (nicht durch Wand oder Fenster filmen)
    const m = 0.35;
    pos.x = Math.min(HALL.x1 - m, Math.max(HALL.x0 + m, pos.x));
    pos.z = Math.min(HALL.z1 - m, Math.max(HALL.z0 + m, pos.z));
    pos.y = look.y + 0.45 + dist * 0.12;
    // Bildmitte so verschieben, dass die beiden in der Mitte der freien Fläche stehen
    const right = new Vector3().subVectors(look, pos).setY(0).normalize();
    right.set(-right.z, 0, right.x);
    const viewW = 2 * dist * Math.tan(vfov / 2) * aspect;
    const viewH = 2 * dist * Math.tan(vfov / 2);
    if (sidePanel) look.addScaledVector(right, ((1 - freeW) / 2) * viewW);
    // Hochformat: oben stehen die Sprechblasen, unten das Fenster – die beiden etwas unterhalb der Mitte der freien Fläche
    else look.y -= (0.5 - freeH * 0.62) * viewH;
    w.cam.setShot({ pos, look }, w.calm ? 0.01 : 1.3);
  }

  private endTalk(): void {
    const w = this.world;
    this.talking = false;
    w.mode = 'free';
    bus.emit('talk:end');
    this.bubbles.dismissAll();
    this.bubbles.history = 1;
    w.cam.setShot(null);
    for (const hero of [this.heroes.jackie, this.heroes.yao]) {
      if (hero.agent.seat) hero.agent.faceYaw(hero.agent.seat.yaw);
    }
    if (this.sittingForTalk) {
      this.sittingForTalk = false;
      w.player.standUp();
    }
    this.refresh();
  }

  /** Nach dem Intro: Yao kommt herein */
  onEntered(): void {
    window.setTimeout(() => this.heroes.enterYao(), 4000);
  }

  /** Lernwort vergeben: beim ersten Mal erscheint die Wortkarte */
  award(id: string): void {
    const w = wordById(id);
    if (!w) return;
    const isNew = store.addWord(id);
    if (isNew) this.wordCard.show(w, true);
  }

  private onSoundChange(): void {
    this.audio.applySettings();
    this.hud.setSoundIcon(store.settings.muted);
  }

  /** Alle Einstellungen anwenden (Ton, Grafik, Kamera, Darstellung) */
  applySettings(): void {
    const s = store.settings;
    const w = this.world;
    this.onSoundChange();
    this.sound.sync();
    w.setCalm(s.calm);
    if (s.quality !== 'auto') w.setQuality(s.quality);
    w.setAutoQuality?.(s.quality === 'auto');
    w.cam.speed = s.camSpeed;
    const b = document.body.classList;
    b.toggle('no-pinyin', !s.pinyin);
    b.toggle('high-contrast', s.contrast);
    document.documentElement.style.setProperty('--ui-scale', String(s.uiScale));
  }

  // ───────────────────────────────────────── Pause und Menü

  readonly settings: SettingsPage;
  readonly pause = new PauseMenu();
  readonly tutorial: Tutorial;
  private captions: Captions;
  private pausedMode: World['mode'] | null = null;
  /** vom Hauptprogramm gesetzt: zurück zum Hauptmenü */
  onMainMenu?: () => void;
  onProgressReset?: () => void;

  /** Darf Esc jetzt die Pause öffnen? (kein anderes Fenster offen, Spiel läuft) */
  private canPause(): boolean {
    const w = this.world;
    if (w.mode !== 'free') return false;
    if (this.approach || this.talk.open || this.tea.open) return false;
    if (document.querySelector('.quest-offer:not([hidden])')) return false;
    return !document.querySelector(
      '.modal:not([hidden]), .sound-panel:not([hidden]), .outfit, #mainmenu:not([hidden])',
    );
  }

  togglePause(): void {
    const w = this.world;
    if (this.pause.open) {
      this.pause.hide();
      this.resumeMode();
      return;
    }
    if (!document.body.classList.contains('is-inside')) return;
    if (w.mode !== 'free' && w.mode !== 'dialog') return;
    this.pausedMode = w.mode;
    w.mode = 'cutscene';
    w.player.stopPath();
    store.flush();
    this.pause.show([
      {
        id: 'resume',
        label: 'Weiter',
        zh: '继续',
        primary: true,
        onClick: () => this.togglePause(),
      },
      { id: 'settings', label: 'Einstellungen', zh: '设置', onClick: () => this.settings.open() },
      { id: 'quests', label: 'Aufgaben', zh: '任务', onClick: () => this.quests.openJournal() },
      { id: 'wardrobe', label: 'Garderobe', zh: '衣柜', onClick: () => this.quests.openWardrobe() },
      { id: 'help', label: 'Hilfe', zh: '帮助', onClick: () => this.info.open() },
      {
        id: 'menu',
        label: 'Zurück zum Hauptmenü',
        zh: '主菜单',
        onClick: () => {
          this.pause.hide();
          if (this.talk.open) this.talk.close();
          this.pausedMode = null;
          this.onMainMenu?.();
        },
      },
    ]);
  }

  /** Spielmodus nach Pause wiederherstellen */
  resumeMode(): void {
    if (this.pausedMode) this.world.mode = this.pausedMode;
    this.pausedMode = null;
  }

  // ───────────────────────────────────────── Tee-Mini-Spiel

  readonly tea = new TeaGame({
    say: (text) => void this.bubbles.say(this.npcs.master.speaker, text, { hold: 0 }),
    act: (what) => this.npcs.master.brewAct(what),
    award: (id) => this.award(id),
    onClose: () => this.endBrew(),
    onResult: (leaves) => this.quests.onBrew(leaves),
  });
  quests!: QuestRunner;

  /** An der Theke: Meister kommt herüber, Kamera auf Theke und Meister, dann die Leiste */
  private startBrew(): void {
    const w = this.world;
    if (this.tea.open || w.mode !== 'free') return;
    w.mode = 'cutscene';
    this.bubbles.dismissAll();
    this.npcs.master.beginBrew();
    w.cam.setShot(
      { pos: new Vector3(-3.0, 2.0, -2.4), look: new Vector3(-4.9, 1.25, -4.7) },
      w.calm ? 0.01 : 1.2,
    );
    window.setTimeout(() => {
      this.tea.start();
      this.tutorial.used('brew-tea');
    }, 1200);
  }

  private endBrew(): void {
    const w = this.world;
    this.bubbles.dismissAll();
    this.npcs.master.endBrew();
    w.cam.setShot(null);
    w.mode = 'free';
    this.refresh();
  }

  openInfo(): void {
    this.info.open();
  }

  openHeights(): void {
    this.heights.open();
  }
}
