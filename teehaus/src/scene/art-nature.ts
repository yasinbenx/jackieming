// Natur-Details: Wolken, Vögel, Elster, Pflaumenblüten, Lotos, Koi, Trauerweide, Uferböschungen.
import { Container, Graphics } from 'pixi.js';
import { mulberry32, rand, TAU } from '../core/util';

export function buildCloud(seed: number, w: number): Container {
  const rng = mulberry32(seed);
  const c = new Container();
  const g = new Graphics();
  const n = 7 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) - 0.5) * w * 0.8 + rand(rng, -14, 14);
    const r = rand(rng, 0.14, 0.26) * w * (1 - Math.abs(i / (n - 1) - 0.5) * 0.9);
    g.ellipse(x, -r * 0.3 + rand(rng, -6, 6), r * 1.5, r * 0.8).fill({ color: 0xffffff, alpha: 0.5 });
  }
  g.ellipse(0, 8, w * 0.46, w * 0.07).fill({ color: 0xffffff, alpha: 0.45 });
  c.addChild(g);
  return c;
}

export interface Bird {
  g: Graphics;
  phase: number;
  dx: number;
  dy: number;
  s: number;
}

/** Ein Schwarm kleiner Vögel (V-Formation) – Flügel werden pro Frame neu gezeichnet. */
export class Flock {
  readonly node = new Container();
  private birds: Bird[] = [];
  private t = 0;
  active = false;
  private x = -200;
  private y = 200;
  private speed = 60;

  constructor(count = 7, seed = 7) {
    const rng = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      const row = Math.ceil(i / 2);
      const side = i % 2 ? 1 : -1;
      const g = new Graphics();
      this.node.addChild(g);
      this.birds.push({
        g,
        phase: rng() * TAU,
        dx: -row * 26,
        dy: side * row * 12 + rand(rng, -4, 4),
        s: rand(rng, 0.8, 1.15),
      });
    }
    this.node.visible = false;
  }

  launch(y: number, speed: number): void {
    this.x = -160;
    this.y = y;
    this.speed = speed;
    this.active = true;
    this.node.visible = true;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.t += dt;
    this.x += this.speed * dt;
    if (this.x > 1800) {
      this.active = false;
      this.node.visible = false;
      return;
    }
    for (const b of this.birds) {
      const f = Math.sin(this.t * 9 + b.phase);
      b.g.clear();
      const s = 9 * b.s;
      b.g
        .moveTo(-s, -f * s * 0.8)
        .quadraticCurveTo(-s * 0.4, -s * 0.5 - f * s * 0.4, 0, 0)
        .quadraticCurveTo(s * 0.4, -s * 0.5 - f * s * 0.4, s, -f * s * 0.8)
        .stroke({ width: 2.2, color: 0x2a2f3a, cap: 'round', join: 'round' });
      b.g.position.set(this.x + b.dx, this.y + b.dy + Math.sin(this.t * 1.3 + b.phase * 0.3) * 5);
    }
  }
}

/** Elster (喜鹊 xǐquè) – in China ein Glücksbote. Ursprung = Füße. */
export function buildMagpie(): Container {
  const c = new Container();
  const g = new Graphics();
  // Schwanz
  g.poly([8, -14, 52, -2, 56, 3, 48, 4, 6, -6]).fill(0x1c2f3d);
  g.poly([30, -8, 54, 0, 52, 4, 28, -3]).fill(0x2e6d6a);
  // Körper
  g.ellipse(0, -18, 18, 14).fill(0x1b2530);
  g.ellipse(-3, -13, 11, 9).fill(0xf4f1ea);
  // Flügel
  g.ellipse(6, -20, 13, 7).fill(0x1c3347);
  g.ellipse(10, -21, 5, 3).fill(0xf4f1ea);
  // Kopf
  g.circle(-14, -30, 9).fill(0x141b24);
  g.poly([-22, -31, -31, -29, -22, -27]).fill(0x0c0f14);
  g.circle(-17, -32, 1.8).fill(0xffffff);
  g.circle(-17.4, -32, 0.9).fill(0x0a0a0a);
  // Beine
  g.moveTo(-2, -5).lineTo(-2, 0).moveTo(4, -5).lineTo(4, 0).stroke({ width: 1.6, color: 0x1a1a1a });
  c.addChild(g);
  return c;
}

/** Zweig mit Pflaumenblüten (梅花 méihuā). Gibt Blütenpositionen für fallende Blütenblätter zurück. */
export function buildBlossomBranch(seed: number): { node: Container; spots: [number, number][] } {
  const rng = mulberry32(seed);
  const node = new Container();
  const wood = new Graphics();
  const bloom = new Graphics();
  const spots: [number, number][] = [];

  const twig = (x0: number, y0: number, x1: number, y1: number, w: number, depth: number): void => {
    const mx = (x0 + x1) / 2 + rand(rng, -20, 20);
    const my = (y0 + y1) / 2 + rand(rng, -12, 14);
    wood.moveTo(x0, y0).quadraticCurveTo(mx, my, x1, y1).stroke({ width: w, color: 0x34241d, cap: 'round' });
    if (depth > 0) {
      const a = Math.atan2(y1 - y0, x1 - x0);
      for (let k = 0; k < 2; k++) {
        const na = a + (k ? 1 : -1) * rand(rng, 0.35, 0.8);
        const len = Math.hypot(x1 - x0, y1 - y0) * rand(rng, 0.32, 0.5);
        twig(x1, y1, x1 + Math.cos(na) * len, y1 + Math.sin(na) * len, Math.max(1.2, w * 0.6), depth - 1);
      }
    }
    if (depth <= 1) {
      for (let k = 0; k < 4; k++) {
        const t = rng();
        const bx = x0 + (x1 - x0) * t + rand(rng, -8, 8);
        const by = y0 + (y1 - y0) * t + rand(rng, -8, 8);
        const r = rand(rng, 6, 10);
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * TAU + rand(rng, -0.1, 0.1);
          bloom
            .circle(bx + Math.cos(a) * r * 0.75, by + Math.sin(a) * r * 0.75, r * 0.62)
            .fill(p % 2 ? 0xf9cdd6 : 0xf4b6c2);
        }
        bloom.circle(bx, by, r * 0.35).fill(0xf0d36a);
        if (rng() < 0.35) spots.push([bx, by]);
      }
    }
  };
  twig(1760, 70, 1420, 190, 12, 3);
  twig(1640, 110, 1500, 26, 7, 2);
  node.addChild(wood, bloom);
  return { node, spots };
}

export interface Koi {
  node: Container;
  tail: Graphics;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  speed: number;
  phase: number;
}

export function buildKoi(
  x: number,
  y: number,
  rx: number,
  ry: number,
  speed: number,
  phase: number,
  color: number,
): Koi {
  const node = new Container();
  const body = new Graphics();
  body.ellipse(0, 0, 26, 9).fill(color);
  body.ellipse(-6, -2, 9, 4).fill(0xfff3e4);
  body.ellipse(10, 1, 6, 3).fill({ color: 0x1b1b1b, alpha: 0.8 });
  body.poly([-4, -7, -14, -16, -10, -6]).fill({ color, alpha: 0.9 });
  body.poly([-4, 7, -14, 16, -10, 6]).fill({ color, alpha: 0.9 });
  body.circle(-19, -3, 1.4).fill(0x101010);
  const tail = new Graphics();
  tail.poly([0, 0, 24, -11, 20, 0, 24, 11]).fill({ color, alpha: 0.92 });
  tail.position.set(24, 0);
  node.addChild(body, tail);
  return { node, tail, cx: x, cy: y, rx, ry, speed, phase };
}

export function updateKoi(k: Koi, t: number): void {
  const a = t * k.speed + k.phase;
  const x = k.cx + Math.cos(a) * k.rx;
  const y = k.cy + Math.sin(a) * k.ry;
  const dx = -Math.sin(a) * k.rx * k.speed;
  const dy = Math.cos(a) * k.ry * k.speed;
  k.node.position.set(x, y);
  k.node.rotation = Math.atan2(dy, dx) + Math.PI; // Kopf zeigt in Fahrtrichtung (Kopf liegt auf -x)
  k.tail.rotation = Math.sin(t * 5 + k.phase * 3) * 0.45;
}

export function buildLotus(seed: number): Container {
  const rng = mulberry32(seed);
  const c = new Container();
  const g = new Graphics();
  for (let i = 0; i < 7; i++) {
    const x = rand(rng, -90, 90);
    const y = rand(rng, -20, 24);
    const r = rand(rng, 18, 32);
    g.ellipse(x, y, r, r * 0.34).fill(0x3f7a3a);
    g.ellipse(x - r * 0.15, y - 1, r * 0.8, r * 0.22).fill({ color: 0x6aa45a, alpha: 0.6 });
    g.moveTo(x, y)
      .lineTo(x + r * 0.9, y - 2)
      .stroke({ width: 1.2, color: 0x2c5a2c, alpha: 0.7 });
  }
  for (let i = 0; i < 2; i++) {
    const x = rand(rng, -60, 60);
    const y = rand(rng, -10, 14);
    for (let p = -2; p <= 2; p++) {
      g.poly([
        x,
        y,
        x + p * 7 - 5,
        y - 14 + Math.abs(p) * 3,
        x + p * 9,
        y - 22 + Math.abs(p) * 4,
        x + p * 7 + 5,
        y - 14 + Math.abs(p) * 3,
      ]).fill(p % 2 ? 0xf7c9d6 : 0xfbdde6);
    }
    g.circle(x, y - 8, 3).fill(0xf2d46a);
  }
  c.addChild(g);
  return c;
}

/** Trauerweide (垂柳 chuíliǔ) mit schwingenden Zweigbündeln. */
export function buildWillow(seed: number): { node: Container; fronds: { c: Container; phase: number }[] } {
  const rng = mulberry32(seed);
  const node = new Container();
  const trunk = new Graphics();
  trunk
    .moveTo(-6, 0)
    .quadraticCurveTo(-26, -130, 24, -250)
    .stroke({ width: 22, color: 0x3a2a1f, cap: 'round' });
  trunk
    .moveTo(24, -250)
    .quadraticCurveTo(-30, -300, -80, -300)
    .stroke({ width: 9, color: 0x3a2a1f, cap: 'round' });
  trunk
    .moveTo(24, -250)
    .quadraticCurveTo(70, -300, 130, -290)
    .stroke({ width: 9, color: 0x3a2a1f, cap: 'round' });
  trunk
    .moveTo(0, -150)
    .quadraticCurveTo(-40, -200, -60, -210)
    .stroke({ width: 7, color: 0x3a2a1f, cap: 'round' });
  node.addChild(trunk);
  const fronds: { c: Container; phase: number }[] = [];
  const anchors: [number, number][] = [
    [-80, -300],
    [-50, -302],
    [-20, -290],
    [24, -250],
    [50, -290],
    [80, -296],
    [110, -292],
    [130, -290],
    [-60, -210],
  ];
  for (const [ax, ay] of anchors) {
    for (let k = 0; k < 3; k++) {
      const c = new Container();
      c.position.set(ax + k * 8 - 8, ay);
      const g = new Graphics();
      const len = rand(rng, 150, 250);
      for (let s = 0; s < 4; s++) {
        const ox = rand(rng, -8, 8);
        g.moveTo(ox, 0)
          .quadraticCurveTo(ox + rand(rng, -14, 14), len * 0.5, ox + rand(rng, -10, 10), len)
          .stroke({
            width: rand(rng, 1.2, 2.2),
            color: rng() < 0.5 ? 0x7aa447 : 0x5f8f3d,
            alpha: 0.9,
            cap: 'round',
          });
      }
      // Blättchen
      for (let s = 0; s < 14; s++) {
        const y = rand(rng, 20, len);
        g.ellipse(rand(rng, -12, 12), y, 2, 6).fill({ color: 0x8cb55a, alpha: 0.8 });
      }
      c.addChild(g);
      node.addChild(c);
      fronds.push({ c, phase: rng() * TAU });
    }
  }
  return { node, fronds };
}

/** Uferböschung mit Gras und Steinen. side −1 = links, +1 = rechts. */
export function buildBank(seed: number, side: -1 | 1): Container {
  const rng = mulberry32(seed);
  const c = new Container();
  const g = new Graphics();
  const edge: [number, number][] =
    side < 0
      ? [
          [-300, 672],
          [120, 680],
          [300, 690],
          [372, 708],
          [350, 760],
          [270, 820],
          [140, 880],
          [-20, 940],
          [-300, 940],
        ]
      : [
          [1900, 672],
          [1500, 680],
          [1250, 688],
          [1176, 708],
          [1210, 770],
          [1290, 830],
          [1420, 890],
          [1560, 940],
          [1900, 940],
        ];
  g.poly(edge.flat()).fill(0x3f6035);
  // Lichtkante
  g.moveTo(edge[2]![0], edge[2]![1]);
  for (let i = 3; i < edge.length - 2; i++) g.lineTo(edge[i]![0], edge[i]![1]);
  g.stroke({ width: 5, color: 0x8fb067, alpha: 0.6 });
  // Gras
  for (let i = 0; i < 90; i++) {
    const t = rng();
    const x = side < 0 ? rand(rng, -250, 340) : rand(rng, 1190, 1850);
    const y = rand(rng, 700, 920) * (0.85 + t * 0.1);
    const h = rand(rng, 8, 22);
    g.moveTo(x, y)
      .quadraticCurveTo(x + rand(rng, -4, 4), y - h * 0.6, x + rand(rng, -8, 8), y - h)
      .stroke({ width: 1.6, color: rng() < 0.5 ? 0x6f9a50 : 0x2f4a29, cap: 'round' });
  }
  // Steine am Ufer
  for (let i = 0; i < 9; i++) {
    const p = edge[2 + Math.floor(rng() * (edge.length - 5))]!;
    const r = rand(rng, 10, 26);
    g.ellipse(p[0] + rand(rng, -14, 14), p[1] + rand(rng, -4, 10), r, r * 0.6).fill(0x8a8579);
    g.ellipse(p[0] + rand(rng, -14, 14) - 3, p[1] - 3, r * 0.6, r * 0.28).fill({
      color: 0xffffff,
      alpha: 0.15,
    });
  }
  c.addChild(g);
  return c;
}
