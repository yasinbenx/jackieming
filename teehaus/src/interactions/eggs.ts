// Versteckte Easter Eggs im Teehaus: Teekanne, Laternen, Elster, Koi, Katze, Messlatte, Räucherwerk, Hängerolle.
// Jedes Versteck hat Effekt, Zwischenruf der Gäste und beim ersten Fund ein Lernwort.
import type { Game } from '../game';
import { EGGS } from '../content/extras';
import type { Egg } from '../content/extras';
import { wordById } from '../content/words';
import { bus } from '../core/bus';
import { store } from '../state/store';
import type { Object3D } from 'three';
import { easeOutCubic } from '../core/util';
import { Vector3 } from 'three';

export class Eggs {
  private counters = new Map<Egg['id'], number>();
  private busy = new Set<string>();

  constructor(private game: Game) {
    const { stage } = game;
    const house = stage.house;
    const on = (obj: Object3D, id: Egg['id'], extra?: () => void): void => {
      stage.addPickable(obj, () => {
        this.trigger(id);
        extra?.();
      });
    };
    on(house.teapot, 'teapot');
    on(house.bigLantern.group, 'lantern', () => {
      stage.nudgeLantern(house.bigLantern, 1.2);
      stage.cast.yao.react('duck');
      window.setTimeout(() => bus.emit('scene:bonk'), 260);
    });
    for (const l of house.lanterns) {
      if (l !== house.bigLantern) on(l.group, 'lantern', () => stage.nudgeLantern(l, 1));
    }
    on(house.incense, 'incense');
    on(house.scroll, 'scroll');
    on(house.cat, 'cat');
    on(stage.land.koi.group, 'koi');
    on(house.ruler, 'ruler');
    // Elster im Blütenbaum vor dem Haus
    on(stage.land.magpie.bird, 'magpie');
  }

  /** Wie viele von allen Verstecken wurden schon gefunden? */
  static total(): number {
    return EGGS.length;
  }

  private trigger(id: Egg['id']): void {
    const g = this.game;
    const { stage } = g;
    const house = stage.house;
    const egg = EGGS.find((e) => e.id === id);
    if (!egg || g.finaleActive) return;
    const n = this.counters.get(id) ?? 0;
    this.counters.set(id, n + 1);

    // Effekte
    switch (id) {
      case 'teapot':
        if (this.busy.has(id)) return;
        this.busy.add(id);
        stage.steam.burst(house.spout, 18);
        bus.emit('scene:steam');
        this.wobble(house.teapot, 0.12, 0.7);
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
        if (!stage.land.magpie.scare()) return;
        bus.emit('scene:bird');
        window.setTimeout(() => stage.land.magpie.reset(), 26000);
        break;
      case 'koi':
        stage.land.koi.scare();
        bus.emit('scene:koi');
        break;
      case 'cat':
        bus.emit('scene:cat');
        this.stretch(house.cat);
        break;
      case 'incense':
        stage.steam.burst(house.incenseTip, 12);
        bus.emit('scene:steam');
        break;
      case 'scroll':
        this.wobble(house.scroll, 0.06, 0.8);
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
  private wobble(obj: Object3D, amp: number, secs: number): void {
    let t = 0;
    const rest = obj.rotation.z;
    this.game.stage.tickers.push((dt) => {
      t += dt;
      const k = Math.max(0, 1 - t / secs);
      obj.rotation.z = rest + Math.sin(t * 28) * amp * k * k;
      if (t < secs) return false;
      obj.rotation.z = rest;
      return true;
    });
  }

  /** Die Katze streckt sich */
  private stretch(obj: Object3D): void {
    let t = 0;
    const base = obj.scale.clone();
    this.game.stage.tickers.push((dt) => {
      t += dt;
      const k = easeOutCubic(Math.sin(Math.min(1, t / 1.6) * Math.PI));
      obj.scale.copy(base).multiply(new Vector3(1 + k * 0.12, 1 + k * 0.08, 1));
      if (t < 1.6) return false;
      obj.scale.copy(base);
      return true;
    });
  }
}
