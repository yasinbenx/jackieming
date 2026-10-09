// Fundstücke im Café (die früheren Easter Eggs): Teekanne, Laterne, Räucherwerk, Hängerolle, Messlatte, Koi,
// Elster und die Katze. Beim ersten Fund: Lernwort und Hinweis „Versteck entdeckt“.
import { Vector3 } from 'three';
import type { World } from './world';
import { EGGS } from '../content/extras';
import type { Egg } from '../content/extras';
import { wordById } from '../content/words';
import { bus } from '../core/bus';
import { store } from '../state/store';
import { BRIDGE, FLOOR } from './layout';
import type { FigureId } from '../content/types';

export interface FindsContext {
  world: World;
  award: (wordId: string) => void;
  toast: (html: string) => void;
  /** Kommentar von Jackie oder Yao (sobald die beiden im Café sitzen) */
  heroSay: (by: FigureId, text: string) => void;
  /** Reaktion der Figuren (z. B. Yao duckt sich) */
  heroAct: (by: FigureId, what: 'duck' | 'laugh' | 'nod') => void;
  openHeights: () => void;
}

export class Finds {
  private counters = new Map<Egg['id'], number>();
  private busy = new Set<string>();

  constructor(private ctx: FindsContext) {
    const w = ctx.world;
    const c = w.cafe;
    const add = (
      id: Egg['id'],
      label: string,
      pos: () => Vector3,
      radius: number,
      hit: () => import('three').Object3D[],
    ): void => {
      w.addInteractable({
        id: `find-${id}`,
        label: () => label,
        pos,
        radius,
        hit: hit(),
        priority: 0.5,
        use: () => this.trigger(id),
      });
    };
    add(
      'teapot',
      'Teekanne ansehen',
      () => c.teapot.getWorldPosition(new Vector3()),
      1.6,
      () => [c.teapot],
    );
    add(
      'lantern',
      'Laterne anstupsen',
      () => c.bigLantern.group.getWorldPosition(new Vector3()).setY(FLOOR),
      1.9,
      () => [c.bigLantern.group],
    );
    add(
      'incense',
      'Räucherwerk ansehen',
      () => c.incense.getWorldPosition(new Vector3()),
      1.5,
      () => [c.incense],
    );
    add(
      'scroll',
      'Hängerolle lesen',
      () => c.scroll.getWorldPosition(new Vector3()).setY(FLOOR),
      1.8,
      () => [c.scroll],
    );
    add(
      'ruler',
      'Messlatte ansehen',
      () => c.ruler.getWorldPosition(new Vector3()).setY(FLOOR),
      1.3,
      () => [c.ruler],
    );
    add(
      'koi',
      'Koi beobachten <span lang="zh">锦鲤</span>',
      () => new Vector3(BRIDGE.x, 0, (BRIDGE.z0 + BRIDGE.z1) / 2),
      2.6,
      () => [w.land.koi.group],
    );
    add(
      'magpie',
      'Elster ansehen <span lang="zh">喜鹊</span>',
      () => new Vector3(6.4, FLOOR, 5.6),
      2.0,
      () => [w.land.magpie.bird],
    );
    w.onEgg = (id) => this.trigger(id);
  }

  private trigger(id: Egg['id']): void {
    const ctx = this.ctx;
    const w = ctx.world;
    const egg = EGGS.find((e) => e.id === id);
    if (!egg) return;
    const n = this.counters.get(id) ?? 0;
    this.counters.set(id, n + 1);
    switch (id) {
      case 'teapot':
        if (this.busy.has(id)) return;
        this.busy.add(id);
        w.steam.burst(w.cafe.teapot.getWorldPosition(new Vector3()).add(new Vector3(0.15, 0.2, 0)), 14);
        bus.emit('scene:steam');
        this.wobble(w.cafe.teapot, 0.12, 0.7, () => this.busy.delete(id));
        break;
      case 'lantern':
        w.nudgeLantern(w.cafe.bigLantern, 1.3);
        bus.emit('scene:lantern');
        ctx.heroAct('yao', 'duck');
        window.setTimeout(() => bus.emit('scene:bonk'), 260);
        break;
      case 'magpie':
        if (!w.land.magpie.scare()) return;
        bus.emit('scene:bird');
        window.setTimeout(() => w.land.magpie.reset(), 26000);
        break;
      case 'koi':
        w.land.koi.scare();
        bus.emit('scene:koi');
        break;
      case 'incense':
        w.steam.burst(w.cafe.incenseTip, 12);
        bus.emit('scene:steam');
        break;
      case 'scroll':
        this.wobble(w.cafe.scroll, 0.04, 0.8);
        bus.emit('ui:click');
        break;
      case 'ruler':
        bus.emit('ui:click');
        ctx.openHeights();
        break;
      case 'cat':
        break;
    }
    w.player.ch.play(id === 'koi' || id === 'magpie' ? 'point' : 'nod', 1.4);
    // Kommentar von Jackie oder Yao
    const line = egg.lines[n % egg.lines.length]!;
    if (id !== 'ruler') {
      ctx.heroAct(line.by, line.by === 'jackie' ? 'laugh' : 'nod');
      ctx.heroSay(line.by, line.text);
    }
    if (store.addEgg(id)) {
      ctx.toast(`Fundstück entdeckt! <b>${store.eggs.size} von ${EGGS.length}</b>`);
      const word = wordById(egg.word);
      if (word) window.setTimeout(() => ctx.award(word.id), 900);
    }
  }

  private wobble(obj: import('three').Object3D, amp: number, secs: number, done?: () => void): void {
    let t = 0;
    const rest = obj.rotation.z;
    this.ctx.world.tickers.push((dt) => {
      t += dt;
      const k = Math.max(0, 1 - t / secs);
      obj.rotation.z = rest + Math.sin(t * 28) * amp * k * k;
      if (t < secs) return false;
      obj.rotation.z = rest;
      done?.();
      return true;
    });
  }
}
