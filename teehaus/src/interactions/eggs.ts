// Versteckte Easter Eggs im Teehaus: Teekanne, Laternen, Elster, Koi, Katze, Messlatte, Räucherwerk, Hängerolle.
// Jedes Versteck hat Effekt, Zwischenruf der Gäste und beim ersten Fund ein Lernwort.
import type { Game } from '../game';
import { EGGS } from '../content/extras';
import type { Egg } from '../content/extras';
import { wordById } from '../content/words';
import { bus } from '../core/bus';
import { store } from '../state/store';
import { Rectangle } from 'pixi.js';
import type { Container } from 'pixi.js';
import { easeOutCubic } from '../core/util';

export class Eggs {
  private counters = new Map<Egg['id'], number>();
  private busy = new Set<string>();

  constructor(private game: Game) {
    const { stage } = game;
    const room = stage.room;
    const on = (obj: Container, id: Egg['id'], extra?: () => void): void => {
      obj.eventMode = 'static';
      obj.cursor = 'pointer';
      obj.on('pointertap', () => {
        this.trigger(id);
        extra?.();
      });
    };
    on(room.teapot, 'teapot');
    on(room.bigLantern.children[0] as Container, 'lantern', () => {
      room.nudgeLantern(room.bigLantern.children[0] as Container, 1.2);
      stage.cast.yao.react('duck');
      window.setTimeout(() => bus.emit('scene:bonk'), 260);
    });
    for (const l of room.lanternSmall) on(l, 'lantern', () => room.nudgeLantern(l, 1));
    on(room.incense, 'incense');
    on(room.scroll, 'scroll');
    on(room.cat, 'cat');
    on(room.koiBowl, 'koi');
    on(room.ruler, 'ruler');
    // Elster im Blütenzweig (Außenwelt, sichtbar durchs Fenster)
    const m = stage.world.magpie;
    m.hitArea = new Rectangle(-44, -60, 110, 70);
    on(m, 'magpie');
  }

  /** Wie viele von allen Verstecken wurden schon gefunden? */
  static total(): number {
    return EGGS.length;
  }

  private trigger(id: Egg['id']): void {
    const g = this.game;
    const { stage } = g;
    const room = stage.room;
    const egg = EGGS.find((e) => e.id === id);
    if (!egg || g.finaleActive) return;
    const n = this.counters.get(id) ?? 0;
    this.counters.set(id, n + 1);

    // Effekte
    switch (id) {
      case 'teapot':
        if (this.busy.has(id)) return;
        this.busy.add(id);
        room.steam.burst(800, 520, 18);
        bus.emit('scene:steam');
        this.wobble(room.teapot, 0.07, 0.7);
        window.setTimeout(() => bus.emit('scene:pour'), 250);
        window.setTimeout(() => {
          stage.cast.jackie.sip();
          stage.cast.yao.sip();
          this.busy.delete(id);
        }, 1500);
        break;
      case 'lantern':
        bus.emit('scene:lantern');
        break;
      case 'magpie':
        if (!stage.world.scareMagpie()) return;
        bus.emit('scene:bird');
        window.setTimeout(() => stage.world.resetMagpie(), 26000);
        break;
      case 'koi':
        room.startleKoi();
        bus.emit('scene:koi');
        break;
      case 'cat':
        bus.emit('scene:cat');
        this.stretch(room.cat);
        break;
      case 'incense':
        room.steam.burst(1078, 520, 12);
        bus.emit('scene:steam');
        break;
      case 'scroll':
        this.wobble(room.scroll, 0.05, 0.8);
        bus.emit('ui:click');
        break;
      case 'ruler':
        bus.emit('ui:click');
        g.openHeights();
        break;
    }

    // Zwischenruf der Gäste
    const line = egg.lines[n % egg.lines.length]!;
    const fig = stage.cast[line.by];
    if (id !== 'ruler') {
      fig.react(line.by === 'jackie' ? 'laugh' : 'nod');
      void g.bubbles.say(fig, line.text, 1800);
    }

    // Erster Fund: Wort sammeln
    if (store.addEgg(id)) {
      const w = wordById(egg.word);
      const found = store.eggs.size;
      g.toast.show(`Versteck entdeckt! <b>${found} von ${EGGS.length}</b>`);
      if (w) {
        const isNew = store.addWord(w.id);
        window.setTimeout(() => g.wordCard.show(w, isNew), 900);
      }
    }
  }

  /** Kurzes Wackeln um die Ruhelage */
  private wobble(obj: Container, amp: number, secs: number): void {
    const stage = this.game.stage;
    let t = 0;
    const hook = (dt: number): void => {
      t += dt;
      const k = Math.max(0, 1 - t / secs);
      obj.rotation = Math.sin(t * 28) * amp * k * k;
      if (t >= secs) {
        obj.rotation = 0;
        stage.tickers.splice(stage.tickers.indexOf(hook), 1);
      }
    };
    stage.tickers.push(hook);
  }

  private stretch(obj: Container): void {
    const stage = this.game.stage;
    let t = 0;
    const hook = (dt: number): void => {
      t += dt;
      const k = Math.sin(Math.min(1, t / 1.6) * Math.PI);
      obj.scale.set(1 + easeOutCubic(k) * 0.06, 1 + easeOutCubic(k) * 0.12);
      if (t >= 1.6) {
        obj.scale.set(1);
        stage.tickers.splice(stage.tickers.indexOf(hook), 1);
      }
    };
    stage.tickers.push(hook);
  }
}
