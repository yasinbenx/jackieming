// Verdrahtet Welt, Oberfläche, Ton und Spielstand. NPCs, Dialog und Fundstücke hängen sich hier an.
import type { World } from './world/world';
import { store } from './state/store';
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
import { Npcs } from './world/npcs';
import { Finds } from './world/finds';
import { Heroes } from './world/heroes';
import { TalkPanel } from './ui/talk';
import { seat } from './world/layout';
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
    this.info = new InfoPage(
      () => this.refresh(),
      () => {
        this.info.modal.close();
        this.credits.open();
      },
    );
    this.sound = new SoundPanel(() => this.onSoundChange());
    this.hud = createHud(world, {
      onWords: () => this.dict.open(),
      onInfo: () => this.info.open(),
      onToast: () => undefined,
      onSound: (a) => this.sound.toggle(a),
    });
    this.hud.setSoundIcon(store.settings.muted);
    world.onInsideChange = (inside) => this.audio.setInside(inside);
    this.bubbles = new Bubbles((v) => world.toScreenLoose(v));
    this.npcs = new Npcs({
      world,
      say: (sp, text, hold) => this.bubbles.say(sp, text, { hold }),
      icon: (sp, sym) => this.bubbles.icon(sp, sym),
      award: (id) => this.award(id),
      busy: () => this.talking,
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
    let calm = store.settings.calm;
    let quality = store.settings.quality;
    store.subscribe(() => {
      if (store.settings.calm !== calm) {
        calm = store.settings.calm;
        world.setCalm(calm);
      }
      if (store.settings.quality !== quality) {
        quality = store.settings.quality;
        if (quality !== 'auto') world.setQuality(quality);
      }
    });
    this.refresh();
  }

  refresh(): void {
    this.hud.setProgress(store.asked.size, TOTAL_QUESTIONS, store.words.size, WORDS.length);
    this.hud.setToastReady(false);
  }

  /** Gespräch mit Jackie oder Yao: Figur dreht sich zum Gast, Kamera fährt heran, Fragenliste öffnet sich */
  startTalk(id: FigureId): void {
    const w = this.world;
    const hero = this.heroes.get(id);
    const other = this.heroes.get(id === 'jackie' ? 'yao' : 'jackie');
    const first = !this.talking;
    this.talking = true;
    w.mode = 'dialog';
    this.bubbles.dismissAll();
    this.bubbles.history = 3;
    // Der Gast setzt sich auf den freien Hocker am Haupttisch (falls frei), sonst bleibt er stehen
    const guest = seat('main-2');
    const pl = w.player;
    const atSeat = pl.seated && pl.seat?.id === guest.id;
    if (first && !atSeat) {
      if (pl.seated) pl.standUp();
      this.sittingForTalk = pl.sitAt(guest);
    }
    const P = new Vector3(guest.x, 0, guest.z);
    hero.agent.faceTo(P.x, P.z);
    window.setTimeout(() => {
      hero.ch.lookAt(w.playerTarget());
      other.ch.lookAt(hero.face());
    }, 600);
    this.talk.show(id);
    this.frameTalk(id);
    if (first) {
      hero.ch.play('wave', 1.4);
      const g = hero.profile.greetings[Math.floor(Math.random() * hero.profile.greetings.length)]!;
      void this.bubbles.say(hero.speaker, g, { hold: 0 });
    }
  }

  /** Kamera über die Schulter des Gastes auf das Gesicht der Figur */
  private frameTalk(id: FigureId): void {
    const w = this.world;
    const hero = this.heroes.get(id);
    const guest = seat('main-2');
    const F = hero.face();
    const P = new Vector3(guest.x, F.y, guest.z);
    const dir = P.clone().sub(F).setY(0).normalize();
    const side = new Vector3(-dir.z, 0, dir.x).multiplyScalar(id === 'jackie' ? -1 : 1);
    const panel = this.talk.el.getBoundingClientRect().height / window.innerHeight;
    // Zweier-Einstellung: seitlich hinter dem Gast, Blick auf das Gesicht der Figur
    const pos = P.clone()
      .addScaledVector(dir, 1.35)
      .addScaledVector(side, 1.25)
      .setY(Math.max(1.95, F.y + 0.3));
    const look = new Vector3(F.x * 0.8 + P.x * 0.2, F.y - 0.12, F.z * 0.8 + P.z * 0.2);
    look.y -= Math.max(0, panel - 0.3) * 1.4;
    w.cam.setShot({ pos, look }, w.calm ? 0.01 : 1.3);
  }

  private endTalk(): void {
    const w = this.world;
    this.talking = false;
    w.mode = 'free';
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

  openHeights(): void {
    this.heights.open();
  }
}
