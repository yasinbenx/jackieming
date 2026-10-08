// Bambushain (竹林 zhúlín): Halme mit Knoten und Blättern, die sich im Wind wiegen.
import { Container, Graphics } from 'pixi.js';
import { mulberry32, rand, TAU } from '../core/util';
import { bake } from './gfx';

export interface Stalk {
  node: Container;
  leaves: Container;
  phase: number;
  amp: number;
}

export interface GroveOpts {
  seed: number;
  count: number;
  x0: number;
  x1: number;
  baseY: number;
  height: [number, number];
  width: [number, number];
  stalk: number;
  stalkLight: number;
  node: number;
  leafColors: number[];
  leafSize: number;
}

function leaf(
  g: Graphics,
  x: number,
  y: number,
  angle: number,
  len: number,
  wid: number,
  color: number,
): void {
  const tx = x + Math.cos(angle) * len;
  const ty = y + Math.sin(angle) * len;
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const mx = x + Math.cos(angle) * len * 0.45;
  const my = y + Math.sin(angle) * len * 0.45;
  g.moveTo(x, y)
    .quadraticCurveTo(mx + nx * wid, my + ny * wid, tx, ty)
    .quadraticCurveTo(mx - nx * wid * 0.7, my - ny * wid * 0.7, x, y)
    .fill(color);
}

export function buildGrove(o: GroveOpts): { node: Container; stalks: Stalk[] } {
  const rng = mulberry32(o.seed);
  const node = new Container();
  const stalks: Stalk[] = [];
  for (let i = 0; i < o.count; i++) {
    const x = o.x0 + ((o.x1 - o.x0) * (i + rand(rng, 0.1, 0.9))) / o.count;
    const H = rand(rng, o.height[0], o.height[1]);
    const w = rand(rng, o.width[0], o.width[1]);
    const lean = rand(rng, -0.1, 0.1) * H;
    const root = new Container();
    root.position.set(x, o.baseY);
    const g = new Graphics();
    const leavesG = new Graphics();
    const segs = Math.max(4, Math.round(H / 82));
    const xAt = (t: number): number => lean * t * t;
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs;
      const t1 = (s + 1) / segs;
      const w0 = w * (1 - t0 * 0.3);
      const w1 = w * (1 - t1 * 0.3);
      const y0 = -H * t0;
      const y1 = -H * t1 + 3;
      g.poly([xAt(t0) - w0 / 2, y0, xAt(t0) + w0 / 2, y0, xAt(t1) + w1 / 2, y1, xAt(t1) - w1 / 2, y1]).fill(
        o.stalk,
      );
      g.poly([
        xAt(t0) - w0 / 2,
        y0,
        xAt(t0) - w0 * 0.1,
        y0,
        xAt(t1) - w1 * 0.1,
        y1,
        xAt(t1) - w1 / 2,
        y1,
      ]).fill(o.stalkLight);
      // Knoten
      g.ellipse(xAt(t1), y1, w1 * 0.62, 3.2).fill(o.node);
      // Blattbüschel an den oberen Knoten
      if (t1 > 0.42) {
        for (const side of [-1, 1]) {
          if (rng() < 0.28) continue;
          const bx = xAt(t1) + side * w1 * 0.4;
          const by = y1;
          const blen = rand(rng, 18, 46) * (o.leafSize / 60);
          const ex = bx + side * blen;
          const ey = by - blen * 0.35;
          leavesG.moveTo(bx, by).lineTo(ex, ey).stroke({ width: 1.6, color: o.node });
          const n = 3 + Math.floor(rng() * 4);
          for (let k = 0; k < n; k++) {
            const a = (side > 0 ? 0 : Math.PI) + side * rand(rng, -0.1, 1.05) + (side > 0 ? 0 : 0);
            const col = o.leafColors[Math.floor(rng() * o.leafColors.length)]!;
            leaf(
              leavesG,
              ex,
              ey,
              a,
              rand(rng, 0.7, 1.15) * o.leafSize,
              rand(rng, 0.09, 0.14) * o.leafSize,
              col,
            );
          }
        }
      }
    }
    // Spitzenbüschel
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + rand(rng, -1.2, 1.2);
      const col = o.leafColors[Math.floor(rng() * o.leafColors.length)]!;
      leaf(leavesG, xAt(1), -H, a, rand(rng, 0.8, 1.2) * o.leafSize, rand(rng, 0.09, 0.14) * o.leafSize, col);
    }
    root.addChild(bake(g));
    const leaves = new Container();
    leaves.addChild(leavesG);
    bake(leaves);
    root.addChild(leaves);
    node.addChild(root);
    stalks.push({ node: root, leaves, phase: rng() * TAU, amp: rand(rng, 0.007, 0.016) });
  }
  return { node, stalks };
}

export function swayStalks(stalks: Stalk[], time: number, wind: number): void {
  for (const s of stalks) {
    const base = Math.sin(time * 0.7 + s.phase) * s.amp * (1 + wind);
    s.node.rotation = base;
    s.leaves.rotation = Math.sin(time * 1.6 + s.phase * 1.7) * s.amp * 0.9 * (1 + wind);
  }
}
