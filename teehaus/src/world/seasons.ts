// Jahreszeiten (P3d): Frühling (viele Blüten), Sommer (Glühwürmchen), Herbst (gelb-orange Laub), Winter
// (Schnee statt Regen, Schneedecke auf Boden, Bäumen und Dächern, Fußspuren). Automatisch alle zwei Spieltage
// weiter oder fest gewählt (Einstellungen, ?jahreszeit=winter). Alles über zwei gemeinsame Shader-Werte.
import { CircleGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { SHARED } from '../three/shared';
import { store } from '../state/store';
import { groundY } from './nav';
import type { World } from './world';

export type Season = 'fruehling' | 'sommer' | 'herbst' | 'winter';

export const SEASONS: { id: Season; de: string; zh: string; word: string }[] = [
  { id: 'fruehling', de: 'Frühling', zh: '春天', word: 'chuntian' },
  { id: 'sommer', de: 'Sommer', zh: '夏天', word: 'xiatian' },
  { id: 'herbst', de: 'Herbst', zh: '秋天', word: 'qiutian' },
  { id: 'winter', de: 'Winter', zh: '冬天', word: 'dongtian' },
];

/** Gewählte Jahreszeit: -1 automatisch, sonst Index in SEASONS */
export function seasonChoice(): number {
  const q = new URLSearchParams(location.search).get('jahreszeit');
  const i = SEASONS.findIndex((s) => s.id === q);
  if (i >= 0) return i;
  return store.progress.games['jahreszeit-wahl'] ?? -1;
}

const N = 90;
const _m = new Matrix4();
const _q = new Quaternion();
const _v = new Vector3();
const _s = new Vector3();
const UP = new Vector3(0, 1, 0);

export class Seasons {
  season: Season = 'fruehling';
  /** Wechsel melden (Hinweis, Wort) */
  onChange?: (s: Season) => void;
  private prints: InstancedMesh;
  private ring = 0;
  private lastX = 0;
  private lastZ = 0;
  private left = false;
  private snowCover = 0;
  private autumn = 0;

  constructor(
    private w: World,
    /** Spieltag (vom Dorfplatz gezählt) */
    private day: () => number,
  ) {
    this.prints = new InstancedMesh(
      new CircleGeometry(0.09, 8).rotateX(-Math.PI / 2).scale(1, 1, 1.7),
      new MeshBasicMaterial({
        color: new Color('#9aa6b8'),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
      N,
    );
    this.prints.count = 0;
    this.prints.frustumCulled = false;
    this.prints.renderOrder = 1;
    w.scene.add(this.prints);
    this.season = this.target();
    this.apply(true);
    w.tickers.push((dt) => this.update(dt));
    w.debug?.lines.push(
      () =>
        `Jahreszeit ${SEASONS.find((s) => s.id === this.season)!.de} · Schnee ${this.snowCover.toFixed(2)} · Herbst ${this.autumn.toFixed(2)}`,
    );
  }

  private target(): Season {
    const c = seasonChoice();
    if (c >= 0) return SEASONS[c]!.id;
    return SEASONS[Math.floor(this.day() / 2) % 4]!.id;
  }

  /** Fest wählen (-1 = automatisch) */
  choose(i: number): void {
    store.setGame('jahreszeit-wahl', i);
    this.check();
  }

  private check(): void {
    const t = this.target();
    if (t === this.season) return;
    this.season = t;
    this.apply(false);
    this.onChange?.(t);
  }

  private apply(instant: boolean): void {
    const w = this.w;
    w.weather.winter = this.season === 'winter';
    // Blüten nur im Frühling richtig, im Sommer wenige
    w.seasonPetals = this.season === 'fruehling' ? 1 : this.season === 'sommer' ? 0.3 : 0;
    if (instant) {
      this.snowCover = this.season === 'winter' ? 1 : 0;
      this.autumn = this.season === 'herbst' ? 1 : 0;
    }
    store.setGame(`jahreszeit-${this.season}`, 1);
  }

  private checkT = 0;

  private update(dt: number): void {
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 2;
      this.check();
    }
    // weiche Übergänge (etwa eine halbe Minute); im Winter liegt der Schnee, Schneefall verstärkt ihn
    const snowT = this.season === 'winter' ? 0.75 + this.w.weather.snow * 0.25 : 0;
    this.snowCover += (snowT - this.snowCover) * Math.min(1, dt / 20);
    const autT = this.season === 'herbst' ? 1 : 0;
    this.autumn += (autT - this.autumn) * Math.min(1, dt / 20);
    SHARED.uSnow.value = this.snowCover;
    SHARED.uAutumn.value = this.autumn;
    this.footprints();
  }

  /** Fußspuren hinter der Spielfigur, solange Schnee liegt (Ringpuffer, älteste verschwinden) */
  private footprints(): void {
    const p = this.w.player;
    if (this.snowCover < 0.4 || this.w.isInside) {
      if (this.snowCover < 0.4) this.prints.count = 0;
      return;
    }
    const d = Math.hypot(p.x - this.lastX, p.z - this.lastZ);
    if (d < 0.42) return;
    const yaw = Math.atan2(p.x - this.lastX, p.z - this.lastZ);
    this.lastX = p.x;
    this.lastZ = p.z;
    if (d > 3) return; // Schnellreise: keine Spur quer durchs Tal
    this.left = !this.left;
    const side = this.left ? 0.1 : -0.1;
    const x = p.x + Math.cos(yaw) * side;
    const z = p.z - Math.sin(yaw) * side;
    _q.setFromAxisAngle(UP, yaw);
    this.prints.setMatrixAt(this.ring, _m.compose(_v.set(x, groundY(x, z) + 0.03, z), _q, _s.set(1, 1, 1)));
    this.ring = (this.ring + 1) % N;
    this.prints.count = Math.max(this.prints.count, this.ring === 0 ? N : this.ring);
    this.prints.instanceMatrix.needsUpdate = true;
  }
}
