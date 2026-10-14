// Tiere im Dorf: Hühner (picken, laufen herum, flüchten vor der Spielfigur), Enten auf Teich und Fluss, zwei
// Dorfkatzen, die in der Sonne schlafen. Alles instanziert (wenige Draw-Calls), Bewegung auf der CPU.
import {
  BoxGeometry,
  ConeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { colored } from './geo';
import { POND } from './shared';
import { RIVER, RIVER_LEVEL } from '../world/map';
import { groundY } from '../world/nav';

const merge = (parts: BufferGeometry[]): BufferGeometry => mergeGeometries(parts)!;
const MAT = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });

function chickenGeo(body: string): BufferGeometry {
  return merge([
    colored(new SphereGeometry(0.14, 7, 5).scale(1, 0.9, 1.3).translate(0, 0.2, 0), body, 0.08),
    colored(new SphereGeometry(0.075, 6, 4).translate(0, 0.33, 0.13), body, 0.05),
    colored(new BoxGeometry(0.02, 0.06, 0.07).translate(0, 0.4, 0.13), '#c8321e', 0),
    colored(new ConeGeometry(0.02, 0.06, 4).rotateX(Math.PI / 2).translate(0, 0.325, 0.21), '#e8b13a', 0),
    colored(new ConeGeometry(0.07, 0.14, 5).rotateX(-0.9).translate(0, 0.27, -0.17), body, 0.1),
    colored(new BoxGeometry(0.02, 0.1, 0.02).translate(-0.05, 0.05, 0), '#e8b13a', 0),
    colored(new BoxGeometry(0.02, 0.1, 0.02).translate(0.05, 0.05, 0), '#e8b13a', 0),
  ]);
}

function duckGeo(drake: boolean): BufferGeometry {
  return merge([
    colored(
      new SphereGeometry(0.16, 7, 5).scale(1, 0.7, 1.5).translate(0, 0.04, 0),
      drake ? '#c8c2b4' : '#8a6a4a',
      0.06,
    ),
    colored(new SphereGeometry(0.075, 6, 4).translate(0, 0.17, 0.17), drake ? '#2e6a3a' : '#7a5a3a', 0.05),
    colored(new BoxGeometry(0.05, 0.02, 0.09).translate(0, 0.15, 0.26), '#e8a43a', 0),
    colored(
      new ConeGeometry(0.05, 0.12, 4).rotateX(-1.2).translate(0, 0.08, -0.22),
      drake ? '#3a3a3a' : '#6a4a2a',
      0.05,
    ),
  ]);
}

function catGeo(fur: string): BufferGeometry {
  // zusammengerollt schlafend
  return merge([
    colored(new SphereGeometry(0.2, 8, 6).scale(1.2, 0.55, 1).translate(0, 0.1, 0), fur, 0.08),
    colored(new SphereGeometry(0.09, 7, 5).translate(0.16, 0.12, 0.08), fur, 0.05),
    colored(new ConeGeometry(0.03, 0.06, 3).translate(0.13, 0.21, 0.1), fur, 0),
    colored(new ConeGeometry(0.03, 0.06, 3).translate(0.2, 0.21, 0.05), fur, 0),
    colored(new SphereGeometry(0.05, 5, 4).scale(3.2, 0.7, 1).translate(-0.05, 0.05, 0.17), fur, 0.06),
  ]);
}

interface Chicken {
  x: number;
  z: number;
  yaw: number;
  tx: number;
  tz: number;
  peck: number;
  wait: number;
  cx: number;
  cz: number;
  r: number;
}

interface Duck {
  /** Teich: Winkel auf der Ellipse; Fluss: Lage entlang */
  a: number;
  speed: number;
  ring: number;
  pond: boolean;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Quaternion();
const _v = new Vector3();
const _s = new Vector3(1, 1, 1);
const UP = new Vector3(0, 1, 0);
const SIDE = new Vector3(1, 0, 0);

/** Hühnergruppen: Mitte, Radius, Anzahl */
const FLOCKS: [number, number, number, number][] = [
  [20.5, 64.5, 3.5, 5],
  [61.5, 60, 2.2, 3],
  [9.5, 55.5, 2.8, 4],
];
/** Schlafende Katzen: Ort, Drehung, Fellfarbe */
export const VILLAGE_CATS: [number, number, number, string][] = [
  [38.2, 46.6, 0.4, '#d9893a'],
  [53.4, 69.4, 2.2, '#3a3430'],
];

export class Critters {
  readonly group = new Group();
  private hens: InstancedMesh[];
  private chickens: Chicken[] = [];
  private duckMesh: InstancedMesh[];
  private ducks: Duck[] = [];
  private cats: InstancedMesh[];

  constructor(private walkable: (x: number, z: number) => boolean) {
    this.group.name = 'critters';
    const colors = ['#f2ece0', '#a8642e', '#3a3230'];
    this.hens = colors.map((c) => new InstancedMesh(chickenGeo(c), MAT, 8));
    let k = 0;
    for (const [cx, cz, r, n] of FLOCKS)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + k;
        const x = cx + Math.cos(a) * r * 0.5;
        const z = cz + Math.sin(a) * r * 0.5;
        this.chickens.push({ x, z, yaw: a, tx: x, tz: z, peck: 0, wait: Math.random() * 3, cx, cz, r });
        k++;
      }
    this.duckMesh = [new InstancedMesh(duckGeo(true), MAT, 6), new InstancedMesh(duckGeo(false), MAT, 6)];
    for (let i = 0; i < 5; i++)
      this.ducks.push({ a: i * 1.3, speed: 0.08 + i * 0.015, ring: 0.45 + (i % 3) * 0.15, pond: true });
    for (let i = 0; i < 4; i++)
      this.ducks.push({
        a: 0.25 + i * 0.03,
        speed: 0.0015 + i * 0.0004,
        ring: (i % 2 ? 1 : -1) * 1.6,
        pond: false,
      });
    this.cats = VILLAGE_CATS.map(([, , , fur]) => new InstancedMesh(catGeo(fur), MAT, 1));
    for (const im of [...this.hens, ...this.duckMesh, ...this.cats]) {
      im.castShadow = true;
      im.frustumCulled = false;
      this.group.add(im);
    }
  }

  /** Position der Dorfkatze i (für Streicheln) */
  catPos(i: number): Vector3 {
    const [x, z] = VILLAGE_CATS[i]!;
    return new Vector3(x, groundY(x, z), z);
  }

  update(dt: number, t: number, player: Vector3, night: boolean): void {
    // Hühner schlafen nachts im Stall
    for (const h of this.hens) h.visible = !night;
    if (!night) this.updateChickens(dt, t, player);
    this.updateDucks(dt, t);
    // Katzen atmen
    VILLAGE_CATS.forEach(([x, z, rot], i) => {
      const b = 1 + Math.sin(t * 1.6 + i * 2) * 0.03;
      const cat = this.cats[i]!;
      cat.setMatrixAt(
        0,
        _m.compose(_v.set(x, groundY(x, z), z), _q.setFromAxisAngle(UP, rot), _s.set(1, b, 1)),
      );
      cat.instanceMatrix.needsUpdate = true;
    });
  }

  private updateChickens(dt: number, t: number, player: Vector3): void {
    const counts = this.hens.map(() => 0);
    this.chickens.forEach((c, i) => {
      const pd = Math.hypot(player.x - c.x, player.z - c.z);
      let speed = 0;
      if (pd < 1.6) {
        // flüchten
        const ax = c.x - player.x;
        const az = c.z - player.z;
        c.tx = c.x + (ax / (pd || 1)) * 2;
        c.tz = c.z + (az / (pd || 1)) * 2;
        c.wait = 0;
        speed = 1.8;
      }
      const dx = c.tx - c.x;
      const dz = c.tz - c.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.1) {
        speed = speed || 0.55;
        const nx = c.x + (dx / d) * Math.min(d, speed * dt);
        const nz = c.z + (dz / d) * Math.min(d, speed * dt);
        if (this.walkable(nx, nz)) {
          c.x = nx;
          c.z = nz;
        } else {
          c.tx = c.x;
          c.tz = c.z;
        }
        c.yaw = Math.atan2(dx, dz);
      } else {
        c.wait -= dt;
        if (c.wait <= 0) {
          const a = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(Math.random()) * c.r;
          c.tx = c.cx + Math.cos(a) * rr;
          c.tz = c.cz + Math.sin(a) * rr;
          c.wait = 1.5 + Math.random() * 4;
        }
      }
      // picken: Körper nach vorn kippen
      const peck = d < 0.1 ? Math.max(0, Math.sin(t * 7 + i * 1.7)) ** 6 * 0.7 : 0;
      _q.setFromAxisAngle(UP, c.yaw).multiply(_e.setFromAxisAngle(SIDE, peck));
      const mesh = this.hens[i % this.hens.length]!;
      const k = counts[i % this.hens.length]!++;
      mesh.setMatrixAt(k, _m.compose(_v.set(c.x, groundY(c.x, c.z), c.z), _q, _s.set(1, 1, 1)));
    });
    this.hens.forEach((m, i) => {
      m.count = counts[i]!;
      m.instanceMatrix.needsUpdate = true;
    });
  }

  private updateDucks(dt: number, t: number): void {
    const counts = [0, 0];
    this.ducks.forEach((d, i) => {
      d.a += d.speed * dt * (d.pond ? 1 : 1);
      let x: number;
      let z: number;
      let y: number;
      let yaw: number;
      if (d.pond) {
        x = POND.x + Math.cos(d.a) * POND.rx * d.ring;
        z = POND.z + Math.sin(d.a) * POND.rz * d.ring;
        const nx = POND.x + Math.cos(d.a + 0.05) * POND.rx * d.ring;
        const nz = POND.z + Math.sin(d.a + 0.05) * POND.rz * d.ring;
        yaw = Math.atan2(nx - x, nz - z);
        y = 0.03;
      } else {
        // Fluss: langsam stromab treiben, dann ein Stück zurückpaddeln (Pendel)
        const u = 0.42 + Math.sin(t * d.speed * 20 + i) * 0.06;
        const n = RIVER.length - 1;
        const f = u * n;
        const k = Math.min(n - 1, Math.floor(f));
        const a = RIVER[k]!;
        const b = RIVER[k + 1]!;
        const fr = f - k;
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const l = Math.hypot(dx, dz);
        x = a[0] + dx * fr - (dz / l) * d.ring;
        z = a[1] + dz * fr + (dx / l) * d.ring;
        const dir = Math.cos(t * d.speed * 20 + i) >= 0 ? 1 : -1;
        yaw = Math.atan2(dx * dir, dz * dir);
        y = RIVER_LEVEL + 0.03;
      }
      y += Math.sin(t * 2 + i) * 0.012;
      const mesh = this.duckMesh[i % 2]!;
      const k = counts[i % 2]!++;
      mesh.setMatrixAt(k, _m.compose(_v.set(x, y, z), _q.setFromAxisAngle(UP, yaw), _s.set(1, 1, 1)));
    });
    this.duckMesh.forEach((m, i) => {
      m.count = counts[i]!;
      m.instanceMatrix.needsUpdate = true;
    });
  }
}
