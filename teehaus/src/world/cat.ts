// Die Teehaus-Katze „Mantou“: schläft eingerollt, wacht auf, streckt sich, schlendert zu ihren Lieblingsplätzen
// und schnurrt, wenn man sie streichelt.
import { ConeGeometry, Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { vinyl } from './materials';
import { groundY } from './nav';
import type { NavGrid } from './nav';
import { CAT_SPOTS } from './layout';

type CatState = 'sleep' | 'wake' | 'walk' | 'sit' | 'petted';

export class Cat {
  readonly root = new Group();
  private body: Mesh;
  private head = new Group();
  private tail: Group[] = [];
  private legs: Mesh[] = [];
  private eyes: Mesh[] = [];
  state: CatState = 'sleep';
  private t = 0;
  private timer = 30 + Math.random() * 20;
  private path: [number, number][] = [];
  private spot = 0;
  private purr = 0;
  private walkPhase = 0;
  private yaw = 0;

  constructor(private nav: NavGrid) {
    const fur = vinyl('#d9893f', { rough: 0.85 });
    const cream = vinyl('#f3dcb8', { rough: 0.85 });
    const dark = vinyl('#2a1a12', { rough: 0.3, rim: 0 });
    this.body = new Mesh(new SphereGeometry(0.16, 16, 12), fur);
    this.body.scale.set(0.85, 0.75, 1.45);
    this.body.castShadow = true;
    this.root.add(this.body);
    const belly = new Mesh(new SphereGeometry(0.13, 12, 8), cream);
    belly.scale.set(0.8, 0.6, 1.3);
    belly.position.set(0, -0.04, 0.02);
    this.body.add(belly);
    this.head.position.set(0, 0.1, 0.22);
    const skull = new Mesh(new SphereGeometry(0.1, 16, 12), fur);
    skull.castShadow = true;
    this.head.add(skull);
    const muzzle = new Mesh(new SphereGeometry(0.05, 10, 8), cream);
    muzzle.scale.set(1.2, 0.8, 0.8);
    muzzle.position.set(0, -0.03, 0.08);
    this.head.add(muzzle);
    const nose = new Mesh(new SphereGeometry(0.012, 6, 5), vinyl('#d06a6a', { rim: 0 }));
    nose.position.set(0, -0.01, 0.12);
    this.head.add(nose);
    for (const sx of [-1, 1]) {
      const ear = new Mesh(new ConeGeometry(0.035, 0.07, 4), fur);
      ear.position.set(sx * 0.055, 0.09, 0);
      ear.rotation.z = -sx * 0.25;
      this.head.add(ear);
      const eye = new Mesh(new SphereGeometry(0.016, 8, 6), dark);
      eye.position.set(sx * 0.04, 0.015, 0.088);
      this.head.add(eye);
      this.eyes.push(eye);
    }
    this.root.add(this.head);
    // Schwanz aus Segmenten
    const tailRoot = new Group();
    tailRoot.position.set(0, 0.03, -0.22);
    this.root.add(tailRoot);
    let parent: Group = tailRoot;
    for (let i = 0; i < 5; i++) {
      const seg = new Group();
      seg.position.z = i === 0 ? 0 : -0.06;
      const m = new Mesh(new SphereGeometry(0.03 - i * 0.003, 8, 6), i === 4 ? cream : fur);
      m.scale.set(1, 1, 1.6);
      m.position.z = -0.03;
      seg.add(m);
      parent.add(seg);
      this.tail.push(seg);
      parent = seg;
    }
    for (const [x, z] of [
      [-0.07, 0.14],
      [0.07, 0.14],
      [-0.07, -0.14],
      [0.07, -0.14],
    ] as const) {
      const leg = new Mesh(new SphereGeometry(0.035, 8, 6), fur);
      leg.scale.set(0.8, 1.8, 0.8);
      leg.position.set(x, -0.1, z);
      this.root.add(leg);
      this.legs.push(leg);
    }
    const [x, z] = CAT_SPOTS[0]!;
    this.root.position.set(x, groundY(x, z) + 0.09, z);
    this.root.rotation.y = -0.6;
    this.yaw = -0.6;
  }

  get position(): Vector3 {
    return this.root.position;
  }

  /** Streicheln: Katze schnurrt (wacht dafür kurz auf) */
  pet(): void {
    this.state = 'petted';
    this.purr = 3.5;
    this.path = [];
  }

  update(dt: number, time: number, motion: number): void {
    this.t += dt;
    this.timer -= dt;
    const p = this.root.position;
    let curl = 0;
    switch (this.state) {
      case 'sleep':
        curl = 1;
        if (this.timer < 0) {
          this.state = 'wake';
          this.timer = 2.5;
        }
        break;
      case 'wake':
        curl = Math.max(0, this.timer / 2.5 - 0.3);
        if (this.timer < 0) {
          this.spot = (this.spot + 1 + Math.floor(Math.random() * (CAT_SPOTS.length - 1))) % CAT_SPOTS.length;
          const [tx, tz] = CAT_SPOTS[this.spot]!;
          this.path = this.nav.path(p.x, p.z, tx, tz) ?? [];
          this.state = this.path.length ? 'walk' : 'sit';
          this.timer = 12;
        }
        break;
      case 'walk': {
        const target = this.path[0];
        if (!target) {
          this.state = 'sit';
          this.timer = 6 + Math.random() * 6;
          break;
        }
        const dx = target[0] - p.x;
        const dz = target[1] - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.08) {
          this.path.shift();
          break;
        }
        const sp = 0.55 * dt;
        p.x += (dx / d) * Math.min(sp, d);
        p.z += (dz / d) * Math.min(sp, d);
        const want = Math.atan2(dx, dz);
        let dy = want - this.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += dy * Math.min(1, dt * 6);
        this.walkPhase += dt * 9;
        break;
      }
      case 'sit':
        curl = 0.2;
        if (this.timer < 0) {
          this.state = 'sleep';
          this.timer = 50 + Math.random() * 40;
        }
        break;
      case 'petted':
        curl = 0.55;
        this.purr -= dt;
        if (this.purr < 0) {
          this.state = 'sleep';
          this.timer = 40 + Math.random() * 30;
        }
        break;
    }
    p.y = groundY(p.x, p.z) + 0.09 - curl * 0.04;
    this.root.rotation.y = this.yaw;
    // Körper: eingerollt flacher und runder, beim Gehen gestreckt
    const breathe = Math.sin(time * (this.state === 'sleep' ? 1.4 : 2.2)) * 0.03;
    const vib = this.state === 'petted' ? Math.sin(time * 60) * 0.006 : 0;
    this.body.scale.set(0.85 + curl * 0.25 + breathe, 0.75 - curl * 0.12 + breathe + vib, 1.45 - curl * 0.4);
    this.head.position.set(curl * 0.12, 0.1 - curl * 0.08, 0.22 - curl * 0.06);
    this.head.rotation.set(curl * 0.4, curl * 0.9, 0);
    for (const e of this.eyes) e.scale.y = this.state === 'sleep' || this.state === 'petted' ? 0.15 : 1;
    const walking = this.state === 'walk';
    this.legs.forEach((l, i) => {
      l.visible = curl < 0.6;
      l.rotation.x = walking
        ? Math.sin(this.walkPhase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6
        : 0;
    });
    this.tail.forEach((s, i) => {
      s.rotation.y = curl > 0.5 ? 0.45 : Math.sin(time * 1.6 + i * 0.6) * 0.18 * motion;
      s.rotation.x = curl > 0.5 ? 0 : -0.25 + (walking ? -0.1 : 0);
    });
  }
}
