// Angeln (钓鱼 diàoyú, P3d): Angelplätze am Teich und am Fluss. Ablauf: Schwimmer auswerfen und warten → bei
// „!“ rechtzeitig anschlagen (Leertaste / E) → Drillen: Leertaste halten hebt die Markierung, loslassen senkt
// sie; solange sie im grünen Bereich des Fisches liegt, füllt sich der Fang-Balken.
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { h } from './dom';
import { store } from '../state/store';
import { FISH, fishSize, pickFish } from '../content/fish';
import type { Fish } from '../content/fish';
import { POND } from '../three/shared';
import { RIVER, RIVER_LEVEL } from '../world/map';
import { groundY } from '../world/nav';
import type { World } from '../world/world';

export interface FishingHost {
  world: World;
  toast: (html: string) => void;
  award: (wordId: string) => void;
  /** Blase über der Spielfigur (Ausruf) */
  icon: (symbol: string) => void;
  splash?: () => void;
}

export interface FishSpot {
  x: number;
  z: number;
  /** Wasserpunkt für den Schwimmer */
  wx: number;
  wz: number;
  wy: number;
  where: 'teich' | 'fluss';
}

type Phase = 'off' | 'wait' | 'bite' | 'reel' | 'done';

/** Angelplätze: am Teichufer und am Flussufer, wo man stehen kann und davor Wasser ist */
export function fishSpots(walkable: (x: number, z: number) => boolean): FishSpot[] {
  const out: FishSpot[] = [];
  const far = (x: number, z: number, d: number): boolean =>
    out.every((s) => Math.hypot(s.x - x, s.z - z) > d);
  for (let a = 0; a < Math.PI * 2; a += 0.35) {
    for (const k of [1.15, 1.25, 1.35]) {
      const x = POND.x + Math.cos(a) * POND.rx * k;
      const z = POND.z + Math.sin(a) * POND.rz * k;
      if (!walkable(x, z) || !far(x, z, 4)) continue;
      out.push({
        x,
        z,
        wx: POND.x + Math.cos(a) * POND.rx * 0.65,
        wz: POND.z + Math.sin(a) * POND.rz * 0.65,
        wy: 0.03,
        where: 'teich',
      });
      break;
    }
  }
  for (let i = 1; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i - 1]!;
    const [cx, cz] = RIVER[i]!;
    const dx = cx - ax;
    const dz = cz - az;
    const l = Math.hypot(dx, dz) || 1;
    for (const side of [-1, 1]) {
      const nx = (-dz / l) * side;
      const nz = (dx / l) * side;
      for (let d = 2; d < 10; d += 0.5) {
        const x = cx + nx * d;
        const z = cz + nz * d;
        if (!walkable(x, z)) continue;
        if (far(x, z, 14))
          out.push({
            x,
            z,
            wx: cx + nx * Math.max(0, d - 3),
            wz: cz + nz * Math.max(0, d - 3),
            wy: RIVER_LEVEL + 0.03,
            where: 'fluss',
          });
        break;
      }
    }
  }
  return out;
}

export class Fishing {
  phase: Phase = 'off';
  private spot: FishSpot | null = null;
  private fish: Fish | null = null;
  private t = 0;
  private waitFor = 0;
  private hold = false;
  private marker = 0.3;
  private vel = 0;
  private zone = 0.4;
  private zoneVel = 0;
  private progress = 0.3;
  private el: HTMLElement;
  private info: HTMLElement;
  private zoneEl: HTMLElement;
  private markEl: HTMLElement;
  private fillEl: HTMLElement;
  private meter: HTMLElement;
  private bobber: Mesh;
  private line: Line;
  readonly spots: FishSpot[];

  constructor(private host: FishingHost) {
    const w = host.world;
    this.spots = fishSpots((x, z) => w.nav.walkable(x, z));
    this.info = h('p', { class: 'fish-info' }, '');
    this.zoneEl = h('div', { class: 'fish-zone' });
    this.markEl = h('div', { class: 'fish-mark' });
    this.fillEl = h('div', { class: 'fish-fill' });
    this.meter = h(
      'div',
      { class: 'fish-meter', hidden: true },
      h('div', { class: 'fish-track' }, this.zoneEl, this.markEl),
      h('div', { class: 'fish-progress' }, this.fillEl),
    );
    this.el = h(
      'section',
      { class: 'fishing', hidden: true, role: 'dialog', 'aria-label': 'Angeln' },
      h('h2', {}, h('span', { lang: 'zh' }, '钓鱼'), ' ', h('i', {}, 'diàoyú'), ' · Angeln'),
      this.info,
      this.meter,
      h(
        'p',
        { class: 'fish-keys' },
        h('kbd', {}, 'Leertaste'),
        ' anschlagen / Schnur halten · ',
        h('kbd', {}, 'Esc'),
        ' aufhören',
      ),
    );
    document.body.appendChild(this.el);
    this.bobber = new Mesh(
      new SphereGeometry(0.06, 8, 6),
      new MeshStandardMaterial({ color: '#e8402a', roughness: 0.5 }),
    );
    this.line = new Line(
      new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(6), 3)),
      new LineBasicMaterial({ color: '#e8e2d6', transparent: true, opacity: 0.8 }),
    );
    this.line.frustumCulled = false;
    this.bobber.visible = this.line.visible = false;
    w.scene.add(this.bobber, this.line);

    const near = (): FishSpot | null => {
      let best: FishSpot | null = null;
      let bd = 2.2;
      for (const s of this.spots) {
        const d = Math.hypot(s.x - w.player.x, s.z - w.player.z);
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      return best;
    };
    let cur: FishSpot | null = null;
    w.addInteractable({
      id: 'angeln',
      pos: () => {
        cur = near();
        return cur ? new Vector3(cur.x, groundY(cur.x, cur.z), cur.z) : new Vector3(0, -999, 0);
      },
      radius: 2.2,
      label: () => `Angeln (${cur?.where === 'teich' ? 'Teich' : 'Fluss'})`,
      enabled: () => this.phase === 'off' && !w.player.seated && !!cur,
      use: () => cur && this.start(cur),
    });

    window.addEventListener(
      'keydown',
      (e) => {
        if (this.phase === 'off') return;
        if (e.code === 'Space' || e.code === store.settings.keys.use) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!e.repeat) this.press();
          this.hold = true;
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.stop('Du holst die Schnur ein.');
        }
      },
      true,
    );
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === store.settings.keys.use) this.hold = false;
    });
    w.tickers.push((dt) => this.update(dt));
  }

  get open(): boolean {
    return this.phase !== 'off';
  }

  start(s: FishSpot): void {
    const w = this.host.world;
    this.spot = s;
    this.phase = 'wait';
    this.t = 0;
    this.waitFor = 3 + Math.random() * 6;
    w.input.lock('angeln');
    w.player.ch.yaw = Math.atan2(s.wx - s.x, s.wz - s.z);
    w.player.ch.hold('kite');
    this.el.hidden = false;
    this.meter.hidden = true;
    this.info.textContent = 'Der Schwimmer treibt … warte, bis ein Fisch anbeißt.';
    this.bobber.visible = this.line.visible = true;
    this.host.award('diaoyu');
  }

  stop(msg?: string): void {
    const w = this.host.world;
    this.phase = 'off';
    this.el.hidden = true;
    this.bobber.visible = this.line.visible = false;
    w.player.ch.stop('kite');
    w.input.unlock('angeln');
    if (msg) this.host.toast(msg);
  }

  private press(): void {
    if (this.phase === 'bite') {
      // angeschlagen → drillen
      this.phase = 'reel';
      this.t = 0;
      this.marker = 0.3;
      this.vel = 0;
      this.zone = 0.4;
      this.progress = 0.3;
      this.meter.hidden = false;
      this.info.textContent = 'Angebissen! Halte die Markierung im grünen Bereich.';
    } else if (this.phase === 'wait') {
      this.info.textContent = 'Zu früh – der Fisch ist noch nicht da. Geduld …';
      this.waitFor += 1.5;
    } else if (this.phase === 'done') this.stop();
  }

  private update(dt: number): void {
    if (this.phase === 'off' || !this.spot) return;
    const s = this.spot;
    const w = this.host.world;
    this.t += dt;
    // Schnur von der erhobenen Hand zum Schwimmer
    const hand = w.player.ch.headWorld(new Vector3()).add(new Vector3(0, 0.35, 0));
    let bob = Math.sin(this.t * 2.2) * 0.012;
    if (this.phase === 'bite') bob = -0.06 + Math.sin(this.t * 25) * 0.03;
    if (this.phase === 'reel') bob = -0.04 + Math.sin(this.t * 14) * 0.03;
    this.bobber.position.set(s.wx, s.wy + bob, s.wz);
    const lp = this.line.geometry.attributes.position as BufferAttribute;
    lp.setXYZ(0, hand.x, hand.y, hand.z);
    lp.setXYZ(1, s.wx, s.wy + bob + 0.05, s.wz);
    lp.needsUpdate = true;

    if (this.phase === 'wait' && this.t > this.waitFor) {
      this.fish = pickFish(s.where, w.dayPhase() === 'abend' || w.dayPhase() === 'nacht');
      this.phase = 'bite';
      this.t = 0;
      this.info.textContent = '！ Jetzt anschlagen – Leertaste!';
      this.host.icon('!');
      this.host.splash?.();
    } else if (this.phase === 'bite' && this.t > 1.2) {
      this.phase = 'wait';
      this.t = 0;
      this.waitFor = 3 + Math.random() * 5;
      this.info.textContent = 'Zu spät – er hat den Köder geklaut. Noch einmal warten …';
    } else if (this.phase === 'reel') this.reel(dt);
  }

  private reel(dt: number): void {
    const f = this.fish!;
    // Markierung: Halten hebt, Loslassen senkt (mit Trägheit)
    this.vel += (this.hold ? 1.6 : -1.3) * dt;
    this.vel *= 1 - dt * 2.5;
    this.marker = Math.max(0, Math.min(1, this.marker + this.vel * dt));
    if (this.marker === 0 || this.marker === 1) this.vel = 0;
    // Fisch zerrt: Zone springt umher, wilde Fische schneller
    if (Math.random() < dt * (0.6 + f.fight * 2))
      this.zoneVel = (Math.random() - 0.5) * (0.4 + f.fight * 1.2);
    const size = 0.34 - f.fight * 0.16;
    this.zone = Math.max(0, Math.min(1 - size, this.zone + this.zoneVel * dt));
    const inside = this.marker >= this.zone && this.marker <= this.zone + size;
    this.progress += (inside ? 0.28 : -0.2) * dt;
    this.zoneEl.style.bottom = `${this.zone * 100}%`;
    this.zoneEl.style.height = `${size * 100}%`;
    this.zoneEl.classList.toggle('hit', inside);
    this.markEl.style.bottom = `calc(${this.marker * 100}% - 3px)`;
    this.fillEl.style.width = `${Math.max(0, Math.min(1, this.progress)) * 100}%`;
    if (this.progress >= 1) this.caught(f);
    else if (this.progress <= 0) {
      this.phase = 'done';
      this.meter.hidden = true;
      this.info.textContent = 'Die Schnur ist frei – der Fisch ist entwischt. (Leertaste: weiter)';
    }
  }

  private caught(f: Fish): void {
    const cm = fishSize(f);
    const g = store.progress.games;
    store.setGame(`fisch-${f.id}`, (g[`fisch-${f.id}`] ?? 0) + 1);
    if (cm * 10 > (g[`fisch-max-${f.id}`] ?? 0)) store.setGame(`fisch-max-${f.id}`, Math.round(cm * 10));
    store.addCoins(f.price);
    this.host.award(f.word);
    this.phase = 'done';
    this.meter.hidden = true;
    this.el.querySelector('.fish-catch')?.remove();
    this.info.replaceChildren(
      h(
        'span',
        { class: 'fish-catch' },
        h('b', { lang: 'zh' }, f.zh),
        ` ${f.py} – ${f.de}, ${cm} cm! Herr Gao kauft ihn dir für ${f.price} Münzen ab. (Leertaste: weiter)`,
      ),
    );
  }

  /** Für Tests und Anzeige: Arten insgesamt */
  static get kinds(): number {
    return FISH.length;
  }
}
