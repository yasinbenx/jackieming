// Gäste, Teemeister und Katze: einfache Zustandsmaschinen (Idle, Arbeiten, Gehen, Sitzen, Reagieren) und kleine
// Interaktionen (Ansprechen, Tee bestellen, Katze streicheln, Hinsetzen, Winken).
import { Group, LatheGeometry, Mesh, Vector2, Vector3 } from 'three';
import type { World } from './world';
import { Agent } from './agent';
import type { Action } from './character';
import { Cat } from './cat';
import { GUEST_LOOKS, MASTER_LOOK } from './looks';
import { vinyl } from './materials';
import { COUNTER, FLOOR, HALL, SEATS, seat, TABLES } from './layout';
import { NPCS, TEA_LINES } from '../content/dialogs';
import type { NpcProfile } from '../content/dialogs';
import type { Speaker } from '../ui/bubbles';
import { bus } from '../core/bus';

/** Was die NPCs von außen brauchen */
export interface NpcContext {
  world: World;
  say: (sp: Speaker, text: string, hold?: number) => Promise<void>;
  icon: (sp: Speaker, symbol: string) => void;
  /** Lernwort vergeben (zeigt die Karte beim ersten Mal) */
  award: (wordId: string) => void;
  /** Wird gerade ein Gespräch mit Jackie/Yao geführt? */
  busy: () => boolean;
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;

export class Npc {
  readonly agent: Agent;
  readonly speaker: Speaker;
  private lineIdx = 0;
  /** Zeitpunkt der letzten Reaktion auf den Spieler */
  lastReact = -99;
  /** Nächster Routine-Schritt */
  next = rand(2, 6);
  state = 'idle';
  /** Spricht der Spieler gerade mit dieser Figur? */
  engaged = false;

  constructor(
    protected ctx: NpcContext,
    look: typeof MASTER_LOOK,
    readonly profile: NpcProfile,
  ) {
    this.agent = new Agent(look, ctx.world.nav);
    const ch = this.agent.ch;
    this.speaker = {
      id: profile.id,
      name: profile.zh,
      anchor: () => ch.headWorld().add(new Vector3(0, ch.H * 0.12 + 0.12, 0)),
      onBlip: () => (ch.talk = 1),
      onEnd: () => (ch.talk = 0),
    };
    ctx.world.scene.add(ch.root);
    ctx.world.agents.push(this.agent);
  }

  get ch(): Agent['ch'] {
    return this.agent.ch;
  }

  get pos(): Vector3 {
    return this.agent.ch.root.position;
  }

  /** Spieler spricht die Figur an: nächster Spruch, ggf. Lernwort */
  talk(): void {
    const line = this.profile.lines[this.lineIdx % this.profile.lines.length]!;
    this.lineIdx++;
    const pl = this.ctx.world.player;
    if (!this.agent.seated) this.agent.faceTo(pl.x, pl.z);
    this.ch.lookAt(this.ctx.world.playerTarget());
    pl.faceTo(this.pos.x, this.pos.z);
    this.ch.play(this.agent.seated ? 'nod' : 'bow', 1.2);
    this.lastReact = this.ctx.world.clock;
    void this.ctx.say(this.speaker, line.text, 2.5).then(() => {
      if (line.word) this.ctx.award(line.word);
    });
  }

  /** Antwort auf Winken */
  waveBack(): void {
    this.ch.lookAt(this.ctx.world.playerTarget());
    this.ch.play(this.agent.seated ? 'nod' : 'wave', 1.4);
    this.ctx.icon(this.speaker, pick(['♪', '!', '☺']));
  }

  /** Allgemeines Verhalten: zum Spieler schauen, wenn er nahe ist */
  protected attend(dt: number): number {
    void dt;
    const w = this.ctx.world;
    const pl = w.player.ch.root.position;
    const d = Math.hypot(pl.x - this.pos.x, pl.z - this.pos.z);
    if (d < 2.6 && w.mode === 'free') {
      this.ch.lookAt(w.playerTarget());
      if (w.clock - this.lastReact > 30 && d < 1.8) {
        this.lastReact = w.clock;
        this.ch.play(this.agent.seated ? 'nod' : 'wave', 1.3);
      }
    } else if (!this.engaged) this.ch.lookAt(null);
    return d;
  }

  update(dt: number): void {
    this.ch.talk = Math.max(0, this.ch.talk - dt * 5);
    this.attend(dt);
    this.next -= dt;
    if (this.next <= 0) this.step();
  }

  /** Ein Schritt der Routine (überschrieben pro Figur) */
  protected step(): void {
    this.next = rand(6, 12);
  }
}

// ───────────────────────────────────────── Teemeister

const HOME = new Vector2(-4.4, -5.25);
const STOVE = new Vector2(-5.85, -5.3);
const EXIT_IN = new Vector2(-2.15, -5.25);
const EXIT_OUT = new Vector2(-2.15, -3.7);
export const ORDER_SPOT = new Vector3(-4.4, FLOOR, -3.55);

class Master extends Npc {
  away = false;
  private greeted = false;
  private servedAt = 0;
  private cupOnCounter: Mesh | null = null;

  constructor(ctx: NpcContext) {
    super(ctx, MASTER_LOOK, NPCS.master!);
    this.agent.place(HOME.x, HOME.y, 0);
    this.agent.collide = false;
    this.agent.walkSpeed = 1.1;
    this.ch.hold('polish');
    this.ch.showProp('bowl', true);
    this.next = rand(8, 14);
  }

  /** Gast betritt die Halle: Verbeugung und Begrüßung */
  greet(): void {
    if (this.greeted) return;
    this.greeted = true;
    this.ch.stop('polish');
    this.ch.showProp('bowl', false);
    this.agent.faceTo(this.ctx.world.player.x, this.ctx.world.player.z);
    this.ch.lookAt(this.ctx.world.playerTarget());
    this.ch.play('bow', 1.8);
    this.lastReact = this.ctx.world.clock;
    void this.ctx.say(this.speaker, NPCS.master!.lines[0]!.text, 3).then(() => this.ctx.award('huanying'));
    this.next = 6;
  }

  get available(): boolean {
    return !this.away && !this.agent.busy && this.state !== 'order';
  }

  /** Tee bestellen: einschenken, Schale auf die Theke, der Spieler trinkt */
  order(): void {
    if (!this.available) return;
    this.state = 'order';
    const w = this.ctx.world;
    const pl = w.player;
    this.ch.stop('polish');
    this.ch.showProp('bowl', false);
    this.agent.faceYaw(0);
    pl.walkDirect([[ORDER_SPOT.x, ORDER_SPOT.z]], () => pl.faceYaw(Math.PI));
    this.ch.lookAt(w.playerTarget());
    this.ch.showProp('teapot', true);
    this.ch.play('pour', 2.6);
    window.setTimeout(() => bus.emit('scene:pour'), 500);
    const k = this.servedAt++;
    const line = TEA_LINES[k % TEA_LINES.length]!;
    // Schale erscheint auf der Theke
    window.setTimeout(() => {
      if (!this.cupOnCounter) {
        const pts = [
          new Vector2(0.0001, 0),
          new Vector2(0.03, 0),
          new Vector2(0.052, 0.04),
          new Vector2(0.049, 0.041),
        ];
        this.cupOnCounter = new Mesh(new LatheGeometry(pts, 14), vinyl('#e9ece6', { rough: 0.22 }));
        this.cupOnCounter.position.set(ORDER_SPOT.x, FLOOR + 1.04, COUNTER.z1 - 0.12);
        w.scene.add(this.cupOnCounter);
      }
      this.cupOnCounter.visible = true;
      w.steam.burst(this.cupOnCounter.position.clone().setY(FLOOR + 1.1), 8);
      this.ch.showProp('teapot', false);
    }, 2000);
    void this.ctx.say(this.speaker, line.text, 2.6).then(() => {
      if (line.word) this.ctx.award(line.word);
      // Spieler nimmt die Schale und trinkt
      window.setTimeout(() => {
        if (this.cupOnCounter) this.cupOnCounter.visible = false;
        pl.ch.play('drink', 2.4);
        bus.emit('scene:sip', { who: 'jackie' });
        bus.emit('scene:tea');
        window.setTimeout(() => {
          this.ctx.icon(this.ctx.world.playerSpeaker, '☺');
          this.state = 'idle';
          this.ch.hold('polish');
          this.ch.showProp('bowl', true);
          this.next = rand(10, 16);
        }, 2300);
      }, 600);
    });
  }

  protected override attend(dt: number): number {
    const d = super.attend(dt);
    const w = this.ctx.world;
    const p = w.player.ch.root.position;
    if (!this.greeted && w.mode === 'free' && p.z < HALL.z1 - 0.4) this.greet();
    return d;
  }

  protected override step(): void {
    if (this.state === 'order' || this.ctx.busy()) {
      this.next = 3;
      return;
    }
    const r = Math.random();
    if (r < 0.35) {
      // Wasser am Ofen
      this.state = 'brew';
      this.ch.stop('polish');
      this.ch.showProp('bowl', false);
      this.agent.walkDirect([[STOVE.x, STOVE.y]], () => {
        this.agent.faceYaw(-Math.PI / 2);
        this.ch.showProp('teapot', true);
        this.ch.play('pour', 3);
        bus.emit('scene:pour');
        window.setTimeout(() => {
          this.ch.showProp('teapot', false);
          this.agent.walkDirect([[HOME.x, HOME.y]], () => {
            this.agent.faceYaw(0);
            this.ch.hold('polish');
            this.ch.showProp('bowl', true);
            this.state = 'idle';
          });
        }, 3200);
      });
      this.next = rand(18, 26);
    } else if (r < 0.65) {
      this.serve();
      this.next = rand(30, 45);
    } else {
      this.next = rand(8, 14);
    }
  }

  /** Mit der Kanne zu einem Gästetisch gehen, nachschenken, zurück */
  private serve(): void {
    const options = TABLES.filter((t) => ['board', 'poet', 'merchant'].includes(t.id));
    const t = pick(options);
    // freie Seite des Tisches (Richtung Raummitte)
    const dir = new Vector2(0.4 - t.x, 0.4 - t.z).normalize();
    const stand = new Vector2(t.x + dir.x * (t.r + 0.5), t.z + dir.y * (t.r + 0.5));
    this.state = 'serve';
    this.away = true;
    this.ch.stop('polish');
    this.ch.showProp('bowl', false);
    this.ch.showProp('teapot', true);
    this.agent.walkDirect(
      [
        [EXIT_IN.x, EXIT_IN.y],
        [EXIT_OUT.x, EXIT_OUT.y],
      ],
      () => {
        this.agent.collide = true;
        this.agent.goTo(stand.x, stand.y, false, () => {
          this.agent.faceTo(t.x, t.z);
          this.ch.play('pour', 2.6);
          bus.emit('scene:pour');
          this.ctx.world.steam.burst(new Vector3(t.x, FLOOR + t.h + 0.12, t.z), 6);
          window.setTimeout(() => {
            this.agent.goTo(EXIT_OUT.x, EXIT_OUT.y, false, () => {
              this.agent.collide = false;
              this.agent.walkDirect(
                [
                  [EXIT_IN.x, EXIT_IN.y],
                  [HOME.x, HOME.y],
                ],
                () => {
                  this.agent.faceYaw(0);
                  this.ch.showProp('teapot', false);
                  this.ch.hold('polish');
                  this.ch.showProp('bowl', true);
                  this.away = false;
                  this.state = 'idle';
                },
              );
            });
          }, 2800);
        });
      },
    );
  }
}

// ───────────────────────────────────────── Gäste

class Seated extends Npc {
  constructor(
    ctx: NpcContext,
    id: string,
    seatId: string,
    private work: Action | null,
    private pause: Action[],
  ) {
    super(ctx, GUEST_LOOKS[id]!, NPCS[id]!);
    this.agent.placeSeated(seat(seatId));
    if (work) this.ch.hold(work);
    if (id === 'poet') this.ch.showProp('brush', true);
    this.next = rand(3, 10);
  }

  protected override step(): void {
    const a = pick(this.pause);
    if (this.work) this.ch.stop(this.work);
    this.ch.play(a, a === 'drink' ? 2.4 : 2.2);
    if (a === 'drink') bus.emit('scene:sip', { who: 'yao' });
    window.setTimeout(() => {
      if (this.work) this.ch.hold(this.work);
    }, 2600);
    this.next = rand(8, 16);
  }
}

class BoardPair {
  constructor(
    private ctx: NpcContext,
    private a: Npc,
    private b: Npc,
  ) {}

  private next = 4;
  private turn = 0;

  update(dt: number): void {
    this.next -= dt;
    if (this.next > 0 || this.ctx.busy()) return;
    const mover = this.turn++ % 2 ? this.b : this.a;
    const other = mover === this.a ? this.b : this.a;
    if (Math.random() < 0.15) {
      this.a.ch.play('laugh', 1.6);
      this.b.ch.play('laugh', 1.6);
      this.ctx.icon(this.a.speaker, '!');
    } else {
      mover.ch.play('play', 1.8);
      other.ch.play('think', 2.6);
      if (Math.random() < 0.3) this.ctx.icon(other.speaker, '…');
      // eine Figur auf dem Brett bewegt sich
      const pieces = this.ctx.world.cafe.boardPieces;
      const i = Math.floor(Math.random() * 20);
      const tmp = new Group();
      pieces.getMatrixAt(i, tmp.matrix);
      tmp.matrix.decompose(tmp.position, tmp.quaternion, tmp.scale);
      tmp.position.x += (Math.random() - 0.5) * 0.06;
      tmp.position.z += (Math.random() - 0.5) * 0.06;
      tmp.updateMatrix();
      pieces.setMatrixAt(i, tmp.matrix);
      pieces.instanceMatrix.needsUpdate = true;
    }
    this.next = rand(4, 8);
  }
}

class Poet extends Seated {
  private trip = rand(70, 110);

  constructor(ctx: NpcContext) {
    super(ctx, 'poet', 'poet-0', 'write', ['think', 'drink']);
  }

  override update(dt: number): void {
    super.update(dt);
    this.trip -= dt;
    if (this.trip < 0 && this.agent.seated && !this.ctx.busy()) {
      // ans Fenster gehen und hinausschauen
      this.trip = rand(90, 140);
      this.ch.stop('write');
      this.ch.showProp('brush', false);
      this.agent.goTo(-6.3, 1.0, false, () => {
        this.agent.faceYaw(-Math.PI / 2);
        this.ch.play('think', 5);
        this.ctx.icon(this.speaker, '…');
        window.setTimeout(() => {
          this.agent.sitAt(seat('poet-0'), () => {
            this.ch.hold('write');
            this.ch.showProp('brush', true);
          });
        }, 6000);
      });
    }
  }

  protected override step(): void {
    if (!this.agent.seated) {
      this.next = 3;
      return;
    }
    super.step();
  }
}

class Child extends Npc {
  private home = seat('free-2');

  constructor(
    ctx: NpcContext,
    private cat: Cat,
  ) {
    super(ctx, GUEST_LOOKS.child!, NPCS.child!);
    this.agent.placeSeated(this.home);
    this.agent.walkSpeed = 1.15;
    this.agent.runSpeed = 2.5;
    this.next = rand(6, 10);
  }

  protected override attend(dt: number): number {
    const d = super.attend(dt);
    if (d < 2.2 && this.ctx.world.clock - this.lastReact > 18) {
      this.lastReact = this.ctx.world.clock;
      this.ch.play('hop', 1);
      this.ctx.icon(this.speaker, '☺');
    }
    return d;
  }

  protected override step(): void {
    if (this.agent.busy || this.ctx.busy()) {
      this.next = 2;
      return;
    }
    const r = Math.random();
    const run = Math.random() < 0.4;
    if (r < 0.4) {
      // zur Katze
      const c = this.cat.position;
      this.agent.goTo(c.x + 0.5, c.z + 0.2, run, () => {
        this.agent.faceTo(c.x, c.z);
        this.ch.play('pet', 2.2);
        if (Math.random() < 0.5) this.cat.pet();
        this.ctx.icon(this.speaker, '❤');
      });
      this.next = rand(10, 16);
    } else if (r < 0.65) {
      const spots: [number, number][] = [
        [6.2, 0.4],
        [-1.5, 3.1],
        [3.0, 5.4],
        [-3.5, 5.6],
      ];
      const [x, z] = pick(spots);
      this.agent.goTo(x, z, run, () => this.ch.play('hop', 1.2));
      this.next = rand(8, 14);
    } else {
      this.agent.sitAt(this.home);
      this.next = rand(14, 22);
    }
  }
}

// ───────────────────────────────────────── Verwaltung

export class Npcs {
  readonly list: Npc[] = [];
  readonly master: Master;
  readonly cat: Cat;
  private pair: BoardPair;

  constructor(private ctx: NpcContext) {
    const w = ctx.world;
    this.cat = new Cat(w.nav);
    w.scene.add(this.cat.root);
    this.master = new Master(ctx);
    const boardA = new Seated(ctx, 'boardA', 'board-0', null, ['nod']);
    const boardB = new Seated(ctx, 'boardB', 'board-1', null, ['drink', 'nod']);
    this.pair = new BoardPair(ctx, boardA, boardB);
    const poet = new Poet(ctx);
    const merchant = new Seated(ctx, 'merchant', 'merchant-0', 'fan', ['drink', 'laugh']);
    const terrace = new Seated(ctx, 'terrace', 'terrace-0', null, ['drink', 'drink', 'nod']);
    const child = new Child(ctx, this.cat);
    this.list.push(this.master, boardA, boardB, poet, merchant, terrace, child);
    this.registerInteractions();
    w.tickers.push((dt) => {
      for (const n of this.list) n.update(dt);
      this.pair.update(dt);
      this.cat.update(dt, w.clock, w.calm ? 0.3 : 1);
    });
  }

  private registerInteractions(): void {
    const w = this.ctx.world;
    // Ansprechen
    for (const n of this.list) {
      w.addInteractable({
        id: `talk-${n.profile.id}`,
        pos: () => n.pos,
        radius: n === this.master ? 2.2 : 1.7,
        label: () => `Ansprechen: ${n.profile.name}`,
        hit: [n.ch.root],
        enabled: () => !this.ctx.busy() && !(n === this.master && this.master.state === 'order'),
        use: () => n.talk(),
      });
    }
    // Tee bestellen
    w.addInteractable({
      id: 'order-tea',
      pos: () => ORDER_SPOT,
      radius: 1.5,
      priority: 2,
      label: () => 'Tee bestellen <span lang="zh">请喝茶</span>',
      enabled: () => this.master.available && !w.player.seated,
      use: () => this.master.order(),
    });
    // Katze streicheln
    w.addInteractable({
      id: 'cat',
      pos: () => this.cat.position,
      radius: 1.2,
      priority: 1,
      label: () => 'Katze streicheln <span lang="zh">猫</span>',
      hit: [this.cat.root],
      enabled: () => this.cat.state !== 'walk' && !w.player.seated,
      use: () => {
        const c = this.cat.position;
        w.player.faceTo(c.x, c.z);
        w.player.ch.play('pet', 2.4);
        this.cat.pet();
        bus.emit('scene:purr');
        this.ctx.icon(w.playerSpeaker, '❤');
        w.onEgg?.('cat');
      },
    });
    // Hinsetzen auf freie Hocker
    for (const s of SEATS.filter((x) => x.free)) {
      w.addInteractable({
        id: `sit-${s.id}`,
        pos: () => new Vector3(s.x, FLOOR, s.z),
        radius: 1.0,
        label: () => 'Hinsetzen',
        enabled: () => !w.player.seated && !w.player.busy && !this.occupied(s.x, s.z),
        use: () => w.player.sitAt(s),
      });
    }
    w.addInteractable({
      id: 'stand',
      pos: () => w.player.ch.root.position,
      radius: 5,
      priority: -1,
      label: () => 'Aufstehen',
      enabled: () => w.player.seated,
      use: () => w.player.standUp(),
    });
  }

  /** Sitzt dort schon jemand (z. B. das Kind)? */
  private occupied(x: number, z: number): boolean {
    return this.list.some((n) => n.agent.seated && Math.hypot(n.pos.x - x, n.pos.z - z) < 0.3);
  }

  /** Spieler winkt: Figuren in der Nähe grüßen zurück */
  waveFrom(p: Vector3): void {
    for (const n of this.list) {
      if (n.pos.distanceTo(p) < 5) window.setTimeout(() => n.waveBack(), 300 + Math.random() * 600);
    }
  }
}
