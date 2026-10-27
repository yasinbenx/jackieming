// Verdrahtet Welt, Oberfläche, Ton und Spielstand. NPCs, Dialog und Fundstücke hängen sich hier an.
import { SHOP_THANKS, WEATHER_TOASTS } from './content/lines';
import { PLACES } from './world/map';
import { Villagers } from './world/villagers';
import { VILLAGE_CATS } from './three/critters';
import { Shop } from './ui/shop';
import { OrderPanel } from './ui/order';
import { QuizPanel } from './ui/quiz';
import { BADGES, earnedBadges } from './content/badges';
import { WorldMap } from './ui/worldmap';
import type { MapMarker } from './ui/worldmap';
import type { Place } from './world/map';
import { soundZone } from './world/soundzone';
import { fader } from './world/intro';
import { QUESTS } from './content/quests';
import { ERRANDS, VILLAGERS } from './content/villagers';
import { currentQuest } from './minigames/quests';
import type { World } from './world/world';
import { store } from './state/store';
import { report } from './core/guard';
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
import { XiangqiGame } from './ui/xiangqi';
import { SettingsPage } from './ui/settings';
import { PauseMenu } from './ui/menu';
import { Tutorial } from './ui/tutorial';
import { Captions } from './ui/captions';
import { murmurCaption } from './content/captions';
import { HALL, INSIDE, SEATS, TABLES } from './world/layout';
import { freeSeatAt } from './world/seating';
import type { Seat } from './world/layout';
import { Vector3 } from 'three';
import { wordById } from './content/words';
import type { FigureId } from './content/types';
import type { Tea } from './content/teas';

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
  villagers!: Villagers;
  shop!: Shop;
  map!: WorldMap;
  orderPanel!: OrderPanel;
  quizPanel!: QuizPanel;
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
    // Fenster, in denen das Spiel nicht auf Tasten reagieren soll
    const block = (key: string) => ({
      onOpen: () => {
        world.input.lock(key);
        world.player.stopPath();
      },
      onClose: () => world.input.unlock(key),
    });
    this.orderPanel = new OrderPanel({
      ...block('bestellen'),
      serve: (tea, polite) => this.serveTea(tea, polite),
    });
    this.quizPanel = new QuizPanel({ ...block('quiz'), badge: (id) => this.badgeToast(id) });
    this.dict.onQuiz = () => {
      this.dict.modal.close();
      window.setTimeout(() => this.quizPanel.show(), 260);
    };
    this.npcs = new Npcs({
      world,
      say: (sp, text, hold) => this.bubbles.say(sp, text, { hold }),
      icon: (sp, sym) => this.bubbles.icon(sp, sym),
      award: (id) => this.award(id),
      busy: () => this.talking || this.tea.open || this.xq.open || this.orderPanel.open,
      brew: () => this.startBrew(),
      orderMenu: () => this.orderPanel.show(),
      onTalk: (id) => this.quests?.onTalk(id) ?? false,
      onCat: () => this.quests?.onCat(),
    });
    world.onWave = () => {
      this.npcs.waveFrom(world.player.ch.root.position);
      this.villagers?.waveFrom(world.player.ch.root.position);
    };
    this.heroes = new Heroes({
      world,
      say: (sp, text, hold) => this.bubbles.say(sp, text, { hold }),
      icon: (sp, sym) => this.bubbles.icon(sp, sym),
      talking: () => this.talking,
      onTalk: (id) => this.startTalk(id),
    });
    this.heroSay = (by, text) => this.heroes.say(by, text);
    // Brettspieltisch: Mini-Xiangqi
    const boardT = TABLES.find((x) => x.id === 'board')!;
    world.addInteractable({
      id: 'xiangqi',
      pos: () => new Vector3(boardT.x, 0.5, boardT.z + 0.75),
      radius: 1.4,
      priority: 3,
      label: () => 'Xiangqi spielen <span lang="zh">下象棋</span>',
      enabled: () => !world.player.seated && !this.talking,
      use: () => this.startXiangqi(),
    });
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
    // Dorf: Laden, Bewohner, Katzen
    this.shop = new Shop({
      award: (id) => this.award(id),
      toast: (html) => this.toast.show(html, 4200),
      thanks: () => {
        const wang = this.villagers.list.find((r) => r.v.shop);
        if (wang) void this.bubbles.say(wang.speaker, SHOP_THANKS, { hold: 2 });
      },
    });
    this.villagers = new Villagers({
      world,
      say: (sp, text, hold) => this.bubbles.say(sp, text, { hold }),
      icon: (sp, sym) => this.bubbles.icon(sp, sym),
      award: (id) => this.award(id),
      toast: (html) => this.toast.show(html, 5200),
      busy: () => this.talking || this.tea.open || this.xq.open || this.shop.open,
      night: () => world.pal.stars > 0.55,
      openShop: () => window.setTimeout(() => this.shop.show(), 400),
      onTalk: (id) => {
        store.setGame(`vt-${id}`, 1);
        void this.quests?.onTalk(id);
      },
      addSpeaker: (sp) => scape.add(sp),
    });
    (window as unknown as { __villagers: Villagers }).__villagers = this.villagers;
    // Karte mit Schnellreise
    this.map = new WorldMap({
      player: () => ({ x: world.player.x, z: world.player.z, yaw: world.player.ch.yaw }),
      markers: () => this.mapMarkers(),
      canTravel: () => world.mode === 'free' && !this.talking && !world.player.seated,
      travel: (p) => void this.travelTo(p),
      onOpen: () => world.input.lock('karte'),
      onClose: () => world.input.unlock('karte'),
    });
    // Klang je Ort und Wetter (zweimal pro Sekunde reicht)
    let zoneT = 0;
    world.tickers.push((dt) => {
      zoneT -= dt;
      if (zoneT > 0) return;
      zoneT = 0.5;
      this.audio.amb.setZone(soundZone(world));
    });
    // beim Schließen des Tabs die letzte Position mitnehmen (gespeichert wird sonst alle 4 s)
    window.addEventListener('pagehide', () => this.savePos(), { capture: true });
    document.addEventListener('visibilitychange', () => document.hidden && this.savePos(), { capture: true });
    world.weather.onChange = (k) => {
      const msg = k === 'regen' || k === 'nebel' ? WEATHER_TOASTS[k] : undefined;
      if (msg) this.toast.show(msg);
      if (k === 'regen') this.award('xiayu');
      if (k === 'nebel') this.award('wu');
    };
    VILLAGE_CATS.forEach((_, i) => {
      world.addInteractable({
        id: `dorfkatze-${i}`,
        pos: () => world.critters.catPos(i),
        radius: 1.2,
        priority: 1,
        label: () => 'Katze streicheln <span lang="zh">猫</span>',
        enabled: () => !world.player.seated,
        use: () => {
          const c = world.critters.catPos(i);
          world.player.faceTo(c.x, c.z);
          world.player.ch.play('pet', 2.4);
          bus.emit('scene:purr');
          this.bubbles.icon(world.playerSpeaker, '❤');
          this.award('mao');
        },
      });
    });
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
        if (world.mode === 'free' || this.map.open) this.map.toggle();
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
    let placeT = 0;
    world.tickers.push((dt) => {
      // Orte draußen (für die Karte): entdeckt, sobald man in ihre Nähe kommt
      placeT += dt;
      if (placeT > 0.5 && world.mode === 'free') {
        placeT = 0;
        const pl = world.player;
        for (const p of PLACES)
          if (
            Math.hypot(pl.x - p.x, pl.z - p.z) < Math.max(9, p.flat + 3) &&
            store.markPlace(p.id) &&
            p.id !== 'teehaus'
          )
            this.toast.show(`Neuer Ort: <span lang="zh">${p.zh}</span> ${p.de} · auf der Karte (M)`);
        // Abzeichen, die sich aus dem Spielstand ergeben
        for (const b of earnedBadges(store.progress)) if (store.addBadge(b.id)) this.badgeToast(b.id);
      }
      if (world.input.lookDX) this.tutorial.looked(world.input.lookDX);
      this.tutorial.update(dt);
      saveT += dt;
      if (saveT > 4 && world.mode === 'free' && document.body.classList.contains('is-inside')) {
        saveT = 0;
        const pl = world.player;
        this.savePos();
        const z = pl.z;
        if (Math.hypot(pl.x, z) < 16)
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
      // Notausgang: Nach 12 s wird im Stehen geredet – auch wenn die Figur noch gar nicht losgehen konnte
      // (vorher galt das Zeitlimit erst nach dem Losgehen; blieb die Figur „beschäftigt“, hing das Spiel im
      // Zwischenzustand ohne Steuerung fest)
      if (t > 12) {
        report('Gespräch: Weg zum Platz', new Error(`Zeitlimit 12 s (losgegangen: ${started})`), 'warn');
        finish(false);
        return true;
      }
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
    // Kartenbild in Leerlaufzeiten vorbereiten, damit die Karte (M) sofort aufgeht
    window.setTimeout(() => this.map.prepare(), 6000);
  }

  /** Markierungen auf der Karte: Teemeister-Aufgabe und Dorfaufträge */
  private mapMarkers(): MapMarker[] {
    const out: MapMarker[] = [];
    if (currentQuest(QUESTS, store.progress.quests)) out.push({ x: -4.4, z: -4, label: 'Teemeister' });
    for (const e of ERRANDS) {
      const st = store.progress.quests[`dorf-${e.id}`];
      if (st === 'erledigt') continue;
      const who = st?.startsWith('aktiv') ? e.to : e.from;
      const r = this.villagers.list.find((v) => v.v.id === who);
      const v = VILLAGERS.find((x) => x.id === who)!;
      if (r) out.push({ x: r.x, z: r.z, label: v.name });
    }
    return out;
  }

  /** Schnellreise: Überblenden, an den Ort setzen, Kamera dahinter */
  private async travelTo(p: Place): Promise<void> {
    const w = this.world;
    const f = fader();
    w.input.lock('reise');
    try {
      await this.travelInner(p, f);
    } finally {
      w.input.unlock('reise');
    }
  }

  private async travelInner(p: Place, f: ReturnType<typeof fader>): Promise<void> {
    const w = this.world;
    await f.to(1, 400);
    let x = p.x;
    let z = p.z;
    if (p.id === 'teehaus') {
      x = INSIDE.x;
      z = INSIDE.z;
    } else {
      // freie Stelle am Ort, leicht zum Weg hin versetzt
      const n = w.nav.nearest(p.x + 2.5, p.z + 2.5, 8);
      if (n) [x, z] = n;
    }
    w.player.stopPath();
    w.player.place(x, z, Math.atan2(p.x - x, p.z - z) || Math.PI);
    w.cam.snapBehind(w.player.ch.yaw);
    store.markPlace(p.id);
    await new Promise((r) => setTimeout(r, 250));
    await f.to(0, 600);
  }

  /** Lernwort vergeben: beim ersten Mal erscheint die Wortkarte */
  /** Position der Spielfigur merken (nur im freien Spiel, nicht mitten in einer Bewegung zum Platz) */
  savePos(): void {
    const pl = this.world.player;
    if (!document.body.classList.contains('is-inside') || pl.busy) return;
    const mode = this.pausedMode ?? this.world.mode;
    if (mode !== 'free' && mode !== 'dialog') return;
    store.setPos(pl.x, pl.z, pl.ch.yaw);
  }

  /** Neues Abzeichen melden */
  badgeToast(id: string): void {
    const b = BADGES.find((x) => x.id === id);
    if (!b) return;
    this.toast.show(`Abzeichen: <span lang="zh">${b.zh}</span> ${b.de} · ${b.how}`, 5200);
    bus.emit('ui:unlock');
  }

  /** Tee aus dem Bestellfenster: der Meister schenkt ein, die Satzwörter wandern ins Wörterbuch */
  private serveTea(tea: Tea | null, polite: boolean): void {
    this.npcs.master.order(tea, polite);
    if (!tea) return;
    const main = polite ? 'qing' : 'yao4';
    const rest = (polite ? ['gei', 'wo', 'yibei'] : ['wo', 'yibei']).filter((id) => store.addWord(id));
    if (store.addWord(tea.id)) rest.push(tea.id);
    this.award(main);
    if (rest.length)
      window.setTimeout(
        () =>
          this.toast.show(
            `Ins Wörterbuch: ${rest.map((id) => `<span lang="zh">${wordById(id)?.zh ?? id}</span>`).join(' ')}`,
          ),
        900,
      );
  }

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
    w.weather.fixed = s.weather === 'klar' ? 'klar' : w.weather.urlFixed;
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
    if (this.approach || this.talk.open || this.tea.open || this.xq.open) return false;
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
    this.savePos();
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
      { id: 'words', label: 'Wörterbuch', zh: '词典', onClick: () => this.dict.open() },
      { id: 'quiz', label: 'Quiz und Abzeichen', zh: '测验', onClick: () => this.quizPanel.show() },
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

  // ───────────────────────────────────────── Mini-Xiangqi am Brettspieltisch

  readonly xq = new XiangqiGame({
    say: (npc, text) => {
      const n = this.npcs.list.find((x) => x.profile.id === npc);
      if (n) void this.bubbles.say(n.speaker, text, { hold: 3 });
    },
    act: (npc, what) =>
      this.npcs.list.find((x) => x.profile.id === npc)?.ch.play(what, what === 'think' ? 1.6 : 1.3),
    award: (id) => this.award(id),
    onClose: () => this.endXiangqi(),
  });

  private startXiangqi(): void {
    const w = this.world;
    if (this.xq.open || w.mode !== 'free') return;
    const t = TABLES.find((x) => x.id === 'board')!;
    w.mode = 'cutscene';
    this.bubbles.dismissAll();
    const pl = w.player;
    if (pl.seated) pl.standUp();
    pl.walkDirect([[t.x, t.z + 0.95]], () => pl.faceYaw(Math.PI));
    // von links vorne: Tisch, Gegner und Spielfigur im freien Bildteil links der Brett-Leiste
    w.cam.setShot(
      { pos: new Vector3(t.x - 2.0, 2.4, t.z + 2.3), look: new Vector3(t.x + 0.9, 0.9, t.z + 0.65) },
      w.calm ? 0.01 : 1.2,
    );
    window.setTimeout(() => this.xq.start(), 900);
  }

  private endXiangqi(): void {
    const w = this.world;
    w.cam.setShot(null);
    w.mode = 'free';
    this.refresh();
  }

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
