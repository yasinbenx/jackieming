// Dorfbewohner: Tagesabläufe auf dem Wegenetz (gehen, arbeiten, sitzen, abends nach Hause), Ansprechen mit
// Spruch und Lernwort, Aufträge und Laden. Darstellung in zwei Stufen: Die nächsten Bewohner (Anzahl je
// Qualitätsstufe) sind volle Figuren mit Animation; alle anderen sind einfache instanzierte Figuren
// (4 Draw-Calls für alle), weit weg gar nichts. Volle Figuren werden im Hintergrund vorbereitet.
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import type { World } from './world';
import { makeFigure } from './figure';
import type { Figure } from './figure';
import type { Action, Look } from './character';
import { GUEST_LOOKS_OLD, PLAYER_LOOKS_OLD } from './looks';
import { groundY } from './nav';
import { scatter } from './scatter';
import { villageSpots } from './village';
import type { Spot } from './village';
import { avoidance } from './avoid';
import { buildWayGraph, nearestNode, route } from './waygraph';
import type { WayGraph } from './waygraph';
import { ERRANDS, VILLAGERS } from '../content/villagers';
import type { Villager, VillagerLook } from '../content/villagers';
import type { Speaker } from '../ui/bubbles';
import { store } from '../state/store';

export interface VillagerContext {
  world: World;
  say: (sp: Speaker, text: string, hold?: number) => Promise<void>;
  icon: (sp: Speaker, symbol: string) => void;
  award: (wordId: string) => void;
  toast: (html: string) => void;
  /** Gespräch, Mini-Spiel o. Ä. läuft */
  busy: () => boolean;
  /** Ist es Nacht? */
  night: () => boolean;
  /** Laden öffnen */
  openShop: (who: Speaker) => void;
  /** Aufgaben des Teemeisters mitzählen lassen (z. B. „Sprich mit drei Leuten“) */
  onTalk?: (id: string) => void;
  /** Für Raumklang und Untertitel */
  addSpeaker?: (sp: Speaker) => void;
}

/** Volle Figuren gleichzeitig, je Qualitätsstufe */
const MAX_FULL: Record<number, number> = { 2: 6, 1: 4, 0: 2 };
/** Bis hier volle Figur (m) */
const FULL_R = 26;
/** Volle Figuren werfen nur in der Nähe Schatten (m) */
const SHADOW_R = 14;
/** Bis hier einfache Figur (m), je Qualitätsstufe */
const FAR_R: Record<number, number> = { 2: 150, 1: 110, 0: 75 };

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};

/** Aussehen eines Bewohners aus der Kurzbeschreibung (Grundkörper vom Spieler bzw. vom Kind) */
export function villagerLook(v: Villager): Look {
  const l: VillagerLook = v.look;
  const base = (l.child ? GUEST_LOOKS_OLD.child : PLAYER_LOOKS_OLD[0]) as Look;
  const model: Record<string, Look['hairModel']> = {
    side: [{ piece: 'Hair_SimpleParted', scale: [1.06, 1.02, 1.04] }],
    bun: [{ piece: 'Hair_Buns', scale: [1.04, 1.02, 1.04] }],
    kidBuns: [{ piece: 'Hair_Buns', scale: [1.05, 1.03, 1.05] }],
  };
  return {
    ...base,
    id: `v-${v.id}`,
    height: l.height,
    build: l.build,
    skin: l.skin,
    hair: l.hair,
    hairStyle: l.hairStyle,
    beard: l.beard,
    face: l.face,
    headSize: l.child ? 0.42 : undefined,
    hairModel: model[l.hairStyle],
    rig: base.rig ? { ...base.rig, hair: undefined, hideHair: true } : undefined,
    dress: true,
    apron: l.apron,
    top: { ...base.top, ...l.top, gold: l.top.trim },
    pants: { color: l.pants, wide: true },
    shoes: { color: l.shoes, sole: '#d9cdb5', kind: 'cloth' },
    prop: null,
  };
}

type State = 'walk' | 'act' | 'settle' | 'seated' | 'rise' | 'talk' | 'home';

class Resident {
  x: number;
  z: number;
  yaw = 0;
  speed = 0;
  state: State = 'act';
  step: number;
  timer: number;
  path: [number, number][] = [];
  rig: Figure | null = null;
  /** volle Figur gerade sichtbar */
  full = false;
  visible = true;
  readonly speaker: Speaker;
  readonly hit: Figure['root'][] = [];
  private actT = 0;
  private lineIdx = 0;
  private seatH = 0;
  /** wohin nach dem Gespräch weiter */
  private resume: State = 'act';
  private node: number;
  /** kleine feste Abweichung am Zielort, damit sich Leute am selben Ort nicht überdecken */
  private jx: number;
  private jz: number;

  constructor(
    readonly v: Villager,
    private m: Villagers,
  ) {
    const r = hash(v.id);
    this.step = Math.floor(r * v.schedule.length);
    const sp = m.spot(v.schedule[this.step]!.spot);
    this.jx = (hash(v.id + 'x') - 0.5) * 1.2;
    this.jz = (hash(v.id + 'z') - 0.5) * 1.2;
    const p = this.target(sp);
    this.x = p[0];
    this.z = p[1];
    this.yaw = sp.yaw;
    this.timer = v.schedule[this.step]!.dur * (0.3 + r * 0.7);
    this.node = m.graph.spotNode[v.schedule[this.step]!.spot] ?? nearestNode(m.graph, this.x, this.z);
    if (sp.seat !== undefined) {
      this.state = 'seated';
      this.seatH = sp.seat;
    }
    const height = v.look.height;
    this.speaker = {
      id: `v-${v.id}`,
      name: v.zh,
      label: v.name,
      anchor: () =>
        this.rig && this.full
          ? this.rig.headWorld().add(new Vector3(0, this.rig.H * 0.12 + 0.12, 0))
          : new Vector3(this.x, this.y + height * (this.state === 'seated' ? 0.8 : 1.08), this.z),
      onBlip: () => {
        if (this.rig) this.rig.talk = 1;
      },
      onEnd: () => {
        if (this.rig) this.rig.talk = 0;
      },
    };
  }

  get y(): number {
    return groundY(this.x, this.z);
  }

  private target(sp: Spot): [number, number] {
    if (sp.seat !== undefined || sp.inside) return [sp.x, sp.z];
    return [sp.x + this.jx, sp.z + this.jz];
  }

  /** Nächster Programmpunkt (abends: nach Hause) */
  private next(): void {
    const v = this.v;
    const goHome = this.m.ctx.night();
    let name: string;
    if (goHome) name = v.home;
    else {
      this.step = (this.step + 1) % v.schedule.length;
      name = v.schedule[this.step]!.spot;
    }
    const to = this.m.graph.spotNode[name];
    if (to === undefined) {
      this.timer = 5;
      return;
    }
    const r = route(this.m.graph, this.node, to) ?? [];
    const sp = this.m.spot(name);
    const end = this.target(sp);
    if (r.length) r[r.length - 1] = end;
    else r.push(end);
    this.path = r;
    this.node = to;
    this.state = 'walk';
    this.homeBound = goHome;
  }
  private homeBound = false;

  private arrive(): void {
    if (this.homeBound) {
      this.state = 'home';
      this.visible = false;
      return;
    }
    const s = this.v.schedule[this.step]!;
    const sp = this.m.spot(s.spot);
    this.timer = s.dur * (0.8 + hash(this.v.id + this.step) * 0.5);
    this.actT = 0;
    if (s.act === 'sit' && sp.seat !== undefined && !this.m.seatTaken(s.spot, this)) {
      this.state = 'settle';
      this.seatH = sp.seat;
      this.yaw = sp.yaw;
      this.rig?.sitDown(sp.seat);
      this.actT = 0;
      return;
    }
    this.state = 'act';
    this.yaw = sp.yaw;
  }

  /** Spieler spricht die Figur an */
  talk(): void {
    const m = this.m;
    const w = m.ctx.world;
    if (this.state === 'home') return;
    if (this.state !== 'talk') this.resume = this.state === 'walk' ? 'walk' : this.state;
    this.state = 'talk';
    this.timer = 7;
    this.speed = 0;
    const pl = w.player;
    if (this.resume !== 'seated') this.yaw = Math.atan2(pl.x - this.x, pl.z - this.z);
    pl.faceTo(this.x, this.z);
    this.rig?.lookAt(w.playerTarget());
    this.rig?.play(this.resume === 'seated' ? 'nod' : 'bow', 1.2);
    m.ctx.onTalk?.(this.v.id);
    const say = (text: string): Promise<void> => m.ctx.say(this.speaker, text, 2.5);
    // Aufträge: abgeben oder anbieten
    const deliver = ERRANDS.find(
      (e) => e.to === this.v.id && store.progress.quests[`dorf-${e.id}`]?.startsWith('aktiv'),
    );
    if (deliver) {
      void say(deliver.thanks).then(() => {
        store.setQuest(`dorf-${deliver.id}`, 'erledigt');
        store.addCoins(deliver.coins);
        m.ctx.award(deliver.word);
        m.ctx.toast(`<b>任务 erledigt:</b> ${deliver.de} · +${deliver.coins} Münzen`);
        this.rig?.play('laugh', 1.4);
      });
      return;
    }
    const own = this.v.errand ? ERRANDS.find((e) => e.id === this.v.errand) : undefined;
    if (own) {
      const st = store.progress.quests[`dorf-${own.id}`];
      if (!st) {
        void say(own.offer).then(() => {
          store.setQuest(`dorf-${own.id}`, 'aktiv');
          const to = VILLAGERS.find((x) => x.id === own.to)!;
          m.ctx.toast(
            `<b>任务</b> <span lang="zh">${own.zh}</span> ${own.de}: zu ${to.name} (${to.role}) bringen.`,
          );
          m.ctx.icon(this.speaker, '!');
        });
        return;
      }
      if (st.startsWith('aktiv')) {
        const to = VILLAGERS.find((x) => x.id === own.to)!;
        void say(`${to.name} im Dorf wartet schon auf die Blätter!`);
        return;
      }
    }
    const line = this.v.lines[this.lineIdx % this.v.lines.length]!;
    this.lineIdx++;
    void say(line).then(() => {
      m.ctx.award(this.v.word);
      if (this.v.shop) m.ctx.openShop(this.speaker);
    });
  }

  update(dt: number): void {
    const m = this.m;
    switch (this.state) {
      case 'home':
        if (!m.ctx.night()) {
          // morgens aus dem Haus
          this.visible = true;
          this.homeBound = false;
          this.step = -1;
          this.next();
        }
        return;
      case 'talk':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.rig?.lookAt(null);
          this.state = this.resume;
          if (this.state === 'act' || this.state === 'seated') this.timer = Math.max(this.timer, 3);
        }
        return;
      case 'walk': {
        const tgt = this.path[0];
        if (!tgt) {
          this.speed = 0;
          this.arrive();
          return;
        }
        const dx = tgt[0] - this.x;
        const dz = tgt[1] - this.z;
        const d = Math.hypot(dx, dz);
        // dem Spieler nicht in den Weg laufen
        const pl = m.ctx.world.player;
        const px = pl.x - this.x;
        const pz = pl.z - this.z;
        const pd = Math.hypot(px, pz);
        const blocked = pd < 0.9 && (px * dx + pz * dz) / Math.max(1e-6, d * pd) > 0.4;
        // anderen Bewohnern ausweichen
        const av =
          d > 0.01 ? avoidance(this.x, this.z, dx / d, dz / d, m.neighbors(this)) : { side: 0, slow: 0 };
        const vmax = (this.v.look.child ? 1.35 : 1.15) * (this.v.speed ?? 1) * (1 - av.slow);
        this.speed += ((blocked ? 0 : vmax) - this.speed) * Math.min(1, dt * 4);
        if (d < 0.25) {
          this.path.shift();
          return;
        }
        const stepLen = Math.min(d, this.speed * dt);
        this.x += (dx / d) * stepLen;
        this.z += (dz / d) * stepLen;
        if (av.side) {
          const sx = this.x + (dz / d) * av.side * dt;
          const sz = this.z - (dx / d) * av.side * dt;
          if (m.ctx.world.nav.walkable(sx, sz)) {
            this.x = sx;
            this.z = sz;
          }
        }
        let dy = Math.atan2(dx, dz) - this.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += dy * Math.min(1, dt * 8);
        return;
      }
      case 'settle': {
        this.actT += dt;
        if (this.actT > 0.7) this.state = 'seated';
        return;
      }
      case 'rise': {
        this.actT += dt;
        if (this.actT > 0.8) this.next();
        return;
      }
      case 'seated':
      case 'act': {
        this.speed = 0;
        this.timer -= dt;
        this.actT -= dt;
        const s = this.v.schedule[this.step];
        if (
          this.state === 'act' &&
          s &&
          s.act !== 'stand' &&
          s.act !== 'sit' &&
          this.actT <= 0 &&
          this.rig &&
          this.full
        ) {
          const dur = s.act === 'hop' ? 1.2 : 2.4;
          this.rig.play(s.act as Action, dur);
          this.actT = dur + 0.4 + hash(this.v.id + Math.floor(this.timer)) * 1.5;
        }
        if (this.state === 'seated' && this.actT <= 0 && this.rig && this.full) {
          // am Spieltisch: nachdenken, ziehen, lachen
          const acts: Action[] = s?.spot.startsWith('brett')
            ? ['think', 'play', 'nod', 'laugh']
            : ['nod', 'think'];
          this.rig.play(acts[Math.floor(Math.random() * acts.length)]!, 2);
          this.actT = 3 + Math.random() * 4;
        }
        if (this.timer <= 0) {
          if (this.state === 'seated') {
            this.state = 'rise';
            this.actT = 0;
            this.rig?.standUp();
          } else this.next();
        }
        return;
      }
    }
  }

  /** Volle Figur an Position und Haltung bringen */
  pose(dt: number): void {
    const ch = this.rig;
    if (!ch) return;
    ch.root.position.set(this.x, this.y, this.z);
    ch.yaw = this.yaw;
    ch.speed = this.speed;
    ch.talk = Math.max(0, ch.talk - dt * 5);
    ch.update(dt);
  }

  /** Volle Figur anlegen (einmalig) */
  ensureRig(): Figure {
    if (this.rig) return this.rig;
    const ch = makeFigure(villagerLook(this.v));
    ch.root.visible = false;
    this.rig = ch;
    this.hit.push(ch.root);
    this.m.ctx.world.scene.add(ch.root);
    if (this.state === 'seated' || this.state === 'settle') ch.sitDown(this.seatH);
    return ch;
  }

  /** Wechsel zwischen voller und einfacher Darstellung */
  setFull(on: boolean): void {
    if (on === this.full) return;
    this.full = on;
    if (on) {
      const ch = this.ensureRig();
      // Sitzhaltung übernehmen
      if (this.state === 'seated' || this.state === 'settle') ch.sitDown(this.seatH);
      ch.root.visible = true;
    } else if (this.rig) this.rig.root.visible = false;
  }

  private shadow = true;
  /** Schattenwurf der vollen Figur an/aus (nur bei Wechsel durchlaufen) */
  setShadow(on: boolean): void {
    if (!this.rig || on === this.shadow) return;
    this.shadow = on;
    this.rig.root.traverse((o) => {
      if ((o as { isMesh?: boolean }).isMesh) o.castShadow = on;
    });
  }

  get sitting(): boolean {
    return this.state === 'seated' || this.state === 'settle';
  }
}

// ───────────────────────────────────────── Einfache Figuren für die Ferne

class FarCrowd {
  readonly body: InstancedMesh;
  readonly head: InstancedMesh;
  readonly hair: InstancedMesh;
  readonly hat: InstancedMesh;
  private m = new Matrix4();
  private q = new Quaternion();
  private v = new Vector3();
  private s = new Vector3();
  private c = new Color();

  constructor(n: number) {
    const mat = (): MeshStandardMaterial => new MeshStandardMaterial({ roughness: 0.8, flatShading: true });
    this.body = new InstancedMesh(new CylinderGeometry(0.15, 0.24, 1, 7).translate(0, 0.5, 0), mat(), n);
    this.head = new InstancedMesh(new SphereGeometry(0.5, 7, 5), mat(), n);
    this.hair = new InstancedMesh(new SphereGeometry(0.53, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(), n);
    this.hat = new InstancedMesh(new ConeGeometry(0.62, 0.32, 8).translate(0, 0.16, 0), mat(), n);
    for (const im of [this.body, this.head, this.hair, this.hat]) {
      im.count = 0;
      im.frustumCulled = false;
      im.castShadow = false;
      im.receiveShadow = true;
    }
  }

  begin(): void {
    this.body.count = this.head.count = this.hair.count = this.hat.count = 0;
  }

  add(r: Resident, t: number): void {
    const l = r.v.look;
    const H = l.height;
    const sit = r.sitting ? 0.62 : 1;
    const bob = r.speed > 0.1 ? Math.abs(Math.sin(t * 9 + r.x)) * 0.04 : 0;
    const y = r.y + bob - (r.sitting ? 0 : 0);
    this.q.setFromAxisAngle(this.v.set(0, 1, 0), r.yaw);
    const put = (
      im: InstancedMesh,
      px: number,
      py: number,
      pz: number,
      sx: number,
      sy: number,
      sz: number,
      col: string,
    ): void => {
      this.m.compose(this.v.set(px, py, pz), this.q, this.s.set(sx, sy, sz));
      im.setMatrixAt(im.count, this.m);
      im.setColorAt(im.count, this.c.set(col));
      im.count++;
    };
    const bodyH = H * 0.8 * sit;
    put(this.body, r.x, y, r.z, l.build, bodyH, l.build, l.top.color);
    const hs = H * (l.child ? 0.2 : 0.14);
    const hy = y + bodyH + hs * 0.45;
    put(this.head, r.x, hy, r.z, hs, hs * 1.1, hs, l.skin);
    if (l.hairStyle === 'straw')
      put(this.hat, r.x, hy + hs * 0.25, r.z, hs * 1.6, hs * 1.4, hs * 1.6, '#c9a86a');
    else if (l.hairStyle !== 'none')
      put(this.hair, r.x, hy + hs * 0.05, r.z, hs, hs * 1.05, hs, l.hairStyle === 'cap' ? '#2a2420' : l.hair);
  }

  end(): void {
    for (const im of [this.body, this.head, this.hair, this.hat]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }
}

// ───────────────────────────────────────── Verwaltung

export class Villagers {
  readonly list: Resident[] = [];
  readonly graph: WayGraph;
  private spots: Record<string, Spot>;
  private crowd: FarCrowd;
  private warm = 0;
  /** Dauer der Figurenerzeugung (ms, für Messungen) */
  readonly warmMs: number[] = [];

  constructor(readonly ctx: VillagerContext) {
    const w = ctx.world;
    const sc = scatter();
    this.spots = villageSpots(sc.benches);
    this.graph = buildWayGraph(
      this.spots,
      (x, z) => w.nav.walkable(x, z),
      (ax, az, bx, bz) => w.nav.path(ax, az, bx, bz),
    );
    for (const v of VILLAGERS) this.list.push(new Resident(v, this));
    this.crowd = new FarCrowd(VILLAGERS.length);
    w.scene.add(this.crowd.body, this.crowd.head, this.crowd.hair, this.crowd.hat);
    for (const r of this.list) {
      ctx.addSpeaker?.(r.speaker);
      w.addInteractable({
        id: `talk-v-${r.v.id}`,
        pos: () => new Vector3(r.x, r.y, r.z),
        radius: 1.9,
        label: () =>
          `Ansprechen: ${r.v.name}${r.v.shop ? ' · Laden' : ''}${
            ERRANDS.some((e) => e.to === r.v.id && store.progress.quests[`dorf-${e.id}`]?.startsWith('aktiv'))
              ? ' · Teeblätter abgeben'
              : ''
          }`,
        hit: r.hit,
        enabled: () => r.visible && r.state !== 'home' && !ctx.busy() && !w.player.seated,
        use: () => {
          if (!r.full) r.setFull(true);
          r.talk();
        },
      });
    }
    // Bänke und Hocker am Spieltisch: auch die Spielfigur kann sich setzen
    for (const [name, sp] of Object.entries(this.spots)) {
      if (sp.seat === undefined) continue;
      const seat = { id: name, x: sp.x, z: sp.z, yaw: sp.yaw, table: name, h: sp.seat, free: true };
      w.addInteractable({
        id: `sit-${name}`,
        pos: () => new Vector3(sp.x, groundY(sp.x, sp.z), sp.z),
        radius: 1.1,
        label: () => 'Hinsetzen',
        enabled: () => !w.player.seated && !w.player.busy && !this.occupied(sp.x, sp.z),
        use: () => {
          if (!w.player.sitAt(seat)) ctx.icon(w.playerSpeaker, '?');
        },
      });
    }
    w.tickers.push((dt) => this.update(dt));
    w.noReflect.push(() => [
      this.crowd.body,
      this.crowd.head,
      this.crowd.hair,
      this.crowd.hat,
      ...this.list.flatMap((r) => (r.rig ? [r.rig.root] : [])),
    ]);
    w.debug?.lines.push(() => {
      const vis = this.list.filter((r) => r.visible);
      return `Bewohner   ${vis.filter((r) => r.full).length} voll · ${this.crowd.body.count} einfach · ${this.list.length - vis.length} zu Hause`;
    });
    // Rückfall, falls prepare() nicht aufgerufen wird: nach und nach im Hintergrund anlegen
    const warmUp = (): void => {
      const r = this.list[this.warm++];
      if (!r) return;
      this.timeRig(r);
      window.setTimeout(warmUp, 120);
    };
    window.setTimeout(warmUp, 3000);
  }

  private timeRig(r: Resident): void {
    if (r.rig) return;
    const t0 = performance.now();
    r.ensureRig();
    this.warmMs.push(Math.round(performance.now() - t0));
  }

  /**
   * Alle vollen Figuren schon während des Ladebildschirms anlegen (sonst kostet jede beim ersten Auftauchen im
   * Dorf 30–60 ms und das Bild ruckelt). Zwischendurch ein Bild Pause, damit der Ladebalken weiterläuft.
   */
  async prepare(progress?: (f: number) => Promise<void> | void): Promise<void> {
    for (let i = 0; i < this.list.length; i++) {
      this.timeRig(this.list[i]!);
      if (i % 3 === 2) await progress?.((i + 1) / this.list.length);
    }
    this.warm = this.list.length;
  }

  spot(name: string): Spot {
    return this.spots[name] ?? { x: 40, z: 60, yaw: 0 };
  }

  /** Sitzt dort schon jemand? */
  seatTaken(name: string, me: Resident): boolean {
    const sp = this.spot(name);
    const pl = this.ctx.world.player;
    if (pl.seated && Math.hypot(pl.x - sp.x, pl.z - sp.z) < 0.4) return true;
    return this.list.some((r) => r !== me && r.sitting && Math.hypot(r.x - sp.x, r.z - sp.z) < 0.3);
  }

  private near: { x: number; z: number; moving: boolean }[] = [];
  /** andere Bewohner in der Nähe (zum Ausweichen) */
  neighbors(me: Resident): { x: number; z: number; moving: boolean }[] {
    this.near.length = 0;
    for (const r of this.list)
      if (r !== me && r.visible && Math.abs(r.x - me.x) < 2 && Math.abs(r.z - me.z) < 2)
        this.near.push({ x: r.x, z: r.z, moving: r.state === 'walk' });
    return this.near;
  }

  /** Sitzplätze der Bewohner (für den Spieler gesperrt, solange besetzt) */
  occupied(x: number, z: number): boolean {
    return this.list.some((r) => r.sitting && Math.hypot(r.x - x, r.z - z) < 0.35);
  }

  private update(dt: number): void {
    const w = this.ctx.world;
    const cam = w.camera.position;
    for (const r of this.list) r.update(dt);
    // Darstellung: die nächsten n als volle Figuren
    const q = w.quality;
    const maxFull = MAX_FULL[q] ?? 4;
    const farR = FAR_R[q] ?? 100;
    const order = this.list
      .filter((r) => r.visible)
      .map((r) => ({ r, d: Math.hypot(r.x - cam.x, r.z - cam.z) }))
      .sort((a, b) => a.d - b.d);
    let full = 0;
    let created = 0;
    this.crowd.begin();
    const shown = new Set<Resident>();
    for (const { r, d } of order) {
      if (d < FULL_R && full < maxFull && (r.rig || created < 1)) {
        if (!r.rig) created++;
        r.setFull(true);
        full++;
        shown.add(r);
        r.pose(dt);
        r.rig!.setDetail(d < 11);
        r.setShadow(d < SHADOW_R);
      } else {
        r.setFull(false);
        if (d < farR) this.crowd.add(r, w.clock);
      }
    }
    for (const r of this.list) if (!shown.has(r) && r.full) r.setFull(false);
    this.crowd.end();
  }

  /** Spieler winkt: Bewohner in der Nähe winken zurück */
  waveFrom(p: Vector3): void {
    for (const r of this.list) {
      if (!r.full || !r.rig || Math.hypot(r.x - p.x, r.z - p.z) > 6) continue;
      const ch = r.rig;
      window.setTimeout(() => ch.play(r.sitting ? 'nod' : 'wave', 1.4), 300 + Math.random() * 600);
    }
  }
}
