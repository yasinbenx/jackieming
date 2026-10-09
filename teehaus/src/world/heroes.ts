// Jackie Chan und Yao Ming am Haupttisch: Namensschilder, Verhaltensschleifen (Tee trinken, nachschenken,
// zunicken, lachen, Symbol-Blasen), Blick zum Spieler und Yaos Auftritt durch die (für ihn zu niedrige) Tür.
import { Vector3 } from 'three';
import type { World } from './world';
import { Agent } from './agent';
import type { Action } from './character';
import { JACKIE_LOOK, YAO_LOOK } from './looks';
import { DOOR, FLOOR, HALL, seat, TABLES } from './layout';
import type { Speaker } from '../ui/bubbles';
import type { FigureId, FigureProfile } from '../content/types';
import { JACKIE, YAO } from '../content/dialogs';
import { pinyinHtml } from '../content/pinyin';
import { h } from '../ui/dom';
import { bus } from '../core/bus';

export interface HeroContext {
  world: World;
  say: (sp: Speaker, text: string, hold?: number) => Promise<void>;
  icon: (sp: Speaker, symbol: string) => void;
  /** Läuft gerade ein Gespräch? Dann pausieren die Schleifen. */
  talking: () => boolean;
  /** Spieler möchte mit dieser Figur sprechen */
  onTalk: (id: FigureId) => void;
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

export class Hero {
  readonly agent: Agent;
  readonly speaker: Speaker;
  readonly tag: HTMLElement;
  lastReact = -99;

  constructor(
    ctx: HeroContext,
    readonly id: FigureId,
    readonly profile: FigureProfile,
  ) {
    this.agent = new Agent(id === 'jackie' ? JACKIE_LOOK : YAO_LOOK, ctx.world.nav);
    const ch = this.agent.ch;
    this.speaker = {
      id,
      name: profile.zh,
      anchor: () => ch.headWorld().add(new Vector3(0, ch.H * 0.1 + 0.16, 0)),
      onBlip: () => (ch.talk = 1),
      onEnd: () => (ch.talk = 0),
    };
    ctx.world.scene.add(ch.root);
    ctx.world.agents.push(this.agent);
    this.tag = h(
      'div',
      { class: `nametag nametag-${id}`, 'aria-hidden': 'true' },
      h('span', { class: 'nt-zh', lang: 'zh' }, profile.zh),
      h('span', { class: 'nt-py', html: pinyinHtml(profile.py) }),
      h('span', { class: 'nt-de' }, profile.nameDe),
    );
    document.body.appendChild(this.tag);
  }

  get ch(): Agent['ch'] {
    return this.agent.ch;
  }

  get pos(): Vector3 {
    return this.agent.ch.root.position;
  }

  /** Weltpunkt des Gesichts (für Kamera und Blicke) */
  face(): Vector3 {
    return this.ch.headWorld();
  }
}

export class Heroes {
  readonly jackie: Hero;
  readonly yao: Hero;
  private next = 6;
  private yaoInside = false;
  private yaoEntering = false;

  constructor(private ctx: HeroContext) {
    const w = ctx.world;
    this.jackie = new Hero(ctx, 'jackie', JACKIE);
    this.yao = new Hero(ctx, 'yao', YAO);
    this.jackie.agent.placeSeated(seat('main-0'));
    // Yao steht zu Beginn auf der Terrasse und schaut auf die Berge
    this.yao.agent.place(2.7, 5.5, 0.2);
    for (const hero of [this.jackie, this.yao]) {
      w.addInteractable({
        id: `talk-${hero.id}`,
        pos: () => hero.pos,
        radius: 2.5,
        priority: 3,
        label: () => `Ansprechen: <span lang="zh">${hero.profile.zh}</span> ${hero.profile.nameDe}`,
        hit: [hero.ch.root],
        enabled: () => !ctx.talking() && (hero.id === 'jackie' || this.yaoInside),
        use: () => ctx.onTalk(hero.id),
      });
    }
    w.tickers.push((dt) => this.update(dt));
  }

  get yaoHere(): boolean {
    return this.yaoInside;
  }

  get(id: FigureId): Hero {
    return id === 'jackie' ? this.jackie : this.yao;
  }

  /** Yao kommt von der Terrasse herein und duckt sich unter dem Türbalken */
  enterYao(): void {
    if (this.yaoInside || this.yaoEntering) return;
    this.yaoEntering = true;
    const yao = this.yao;
    yao.agent.goTo(0, HALL.z1 + 0.9, false, () => {
      yao.agent.faceYaw(Math.PI);
      this.ctx.icon(yao.speaker, '…');
      window.setTimeout(() => {
        yao.agent.walkDirect([[0, HALL.z1 - 0.9]], () => {
          this.yaoInside = true;
          this.yaoEntering = false;
          this.ctx.icon(this.jackie.speaker, '!');
          this.jackie.ch.play('laugh', 1.4);
          yao.agent.sitAt(seat('main-1'), () => {
            yao.ch.lookAt(this.jackie.face());
          });
        });
      }, 700);
    });
  }

  /** Kommentar zu einem Fundstück: nur, wenn die Figur in der Nähe ist */
  say(by: FigureId, text: string): void {
    const hero = this.get(by);
    if (by === 'yao' && !this.yaoInside) return;
    if (hero.pos.distanceTo(this.ctx.world.player.ch.root.position) > 12) return;
    void this.ctx.say(hero.speaker, text, 3);
  }

  act(by: FigureId, what: 'duck' | 'laugh' | 'nod'): void {
    const hero = this.get(by);
    hero.ch.play(what, what === 'duck' ? 1.2 : 1.4);
  }

  private update(dt: number): void {
    const w = this.ctx.world;
    const { jackie, yao } = this;
    for (const hero of [jackie, yao]) hero.ch.talk = Math.max(0, hero.ch.talk - dt * 5);
    // Unter dem Türbalken bücken
    const yp = yao.pos;
    yao.ch.stoop = Math.abs(yp.x) < DOOR.x1 + 0.3 && yp.z > HALL.z1 - 0.7 && yp.z < HALL.z1 + 0.7 ? 1 : 0;
    // Blick zum Spieler, wenn er näher kommt
    const talking = this.ctx.talking();
    const pp = w.player.ch.root.position;
    for (const hero of [jackie, yao]) {
      const d = hero.pos.distanceTo(pp);
      if (talking) continue;
      if (hero.agent.busy) continue;
      if (d < 4.5 && w.mode === 'free') {
        hero.ch.lookAt(w.playerTarget());
        if (d < 2.8 && w.clock - hero.lastReact > 25) {
          hero.lastReact = w.clock;
          hero.ch.play(hero.id === 'jackie' ? 'wave' : 'nod', 1.4);
          this.ctx.icon(hero.speaker, hero.id === 'jackie' ? '!' : '☺');
        }
      } else if (this.yaoInside) {
        // sonst schauen sie einander an
        hero.ch.lookAt((hero === jackie ? yao : jackie).face());
      }
    }
    // Namensschilder
    for (const hero of [jackie, yao]) {
      const head = hero.ch.headWorld().add(new Vector3(0, hero.ch.H * 0.1 + 0.32, 0));
      const s = w.toScreen(head);
      const d = w.camera.position.distanceTo(head);
      const show = s.visible && d < 11 && !talking && w.mode !== 'intro';
      hero.tag.style.opacity = show ? String(Math.min(1, (11 - d) / 3)) : '0';
      hero.tag.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%) scale(${Math.max(0.75, Math.min(1.1, 4 / d))})`;
    }
    // Verhaltensschleife (nur ohne Gespräch und wenn beide sitzen)
    if (talking || !this.yaoInside || !jackie.agent.seated || !yao.agent.seated) return;
    this.next -= dt;
    if (this.next > 0) return;
    this.next = rand(5, 10);
    this.loop();
  }

  private loop(): void {
    const { jackie, yao } = this;
    const main = TABLES.find((t) => t.id === 'main')!;
    const r = Math.random();
    const both = (a: Action, b: Action): void => {
      jackie.ch.play(a, 1.6);
      yao.ch.play(b, 1.6);
    };
    if (r < 0.2) {
      jackie.ch.play('drink', 2.4);
      bus.emit('scene:sip', { who: 'jackie' });
    } else if (r < 0.36) {
      yao.ch.play('drink', 2.4);
      bus.emit('scene:sip', { who: 'yao' });
    } else if (r < 0.5) {
      // Yao schenkt Jackie nach
      yao.ch.showProp('teapot', true);
      yao.ch.play('pour', 2.4);
      bus.emit('scene:pour');
      this.ctx.world.steam.burst(new Vector3(main.x - 0.2, FLOOR + main.h + 0.1, main.z - 0.2), 6);
      window.setTimeout(() => {
        yao.ch.showProp('teapot', false);
        jackie.ch.play('nod', 1.2);
        this.ctx.icon(jackie.speaker, '☺');
      }, 2200);
    } else if (r < 0.64) {
      both('nod', 'nod');
    } else if (r < 0.76) {
      // Jackie macht eine Kung-Fu-Geste, Yao zuckt mit den Schultern, dann lachen beide
      jackie.ch.play('kungfu', 1.6);
      this.ctx.icon(jackie.speaker, '!');
      window.setTimeout(() => yao.ch.play('shrug', 1.4), 900);
      window.setTimeout(() => both('laugh', 'laugh'), 2100);
    } else if (r < 0.86) {
      // Yao lässt den Basketball auf dem Finger kreisen, Jackie klatscht
      yao.ch.play('spin', 2.6);
      window.setTimeout(() => jackie.ch.play('clap', 1.4), 900);
      this.ctx.icon(yao.speaker, '♪');
    } else if (r < 0.94) {
      this.ctx.icon(jackie.speaker, '♪');
    } else {
      this.ctx.icon(yao.speaker, '…');
      yao.ch.play('think', 2);
    }
  }
}
