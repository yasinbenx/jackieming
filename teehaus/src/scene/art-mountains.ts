// Berge im Nebel: Gauß-Gipfel als Silhouetten, mit Schatten-/Lichtflächen und Pinselstrichen (皴法 cūnfǎ).
import { Container, Graphics } from 'pixi.js';
import { mulberry32, rand } from '../core/util';

export interface Peak {
  /** Mitte, Höhe, Breite des Gipfels */
  c: number;
  h: number;
  w: number;
}

export function ridgeY(x: number, base: number, peaks: Peak[], rough: number): number {
  let y = base;
  for (const p of peaks) {
    const d = Math.abs(x - p.c) / p.w;
    y -= p.h * Math.exp(-Math.pow(d, 1.7));
  }
  return (
    y +
    Math.sin(x * 0.07) * rough +
    Math.sin(x * 0.19 + 1.3) * rough * 0.6 +
    Math.sin(x * 0.43) * rough * 0.25
  );
}

export interface MountainOpts {
  seed: number;
  base: number;
  peaks: Peak[];
  color: number;
  /** Anzahl Kiefern auf dem Grat */
  pines?: number;
  rough?: number;
  strokes?: number;
  bottom?: number;
}

export function pine(g: Graphics, x: number, y: number, s: number, color: number): void {
  g.moveTo(x, y)
    .lineTo(x, y - 8 * s)
    .stroke({ width: 2 * s, color: 0x3b2a1d });
  for (let i = 0; i < 3; i++) {
    const yy = y - (8 + i * 11) * s;
    const w = (15 - i * 3.5) * s;
    g.poly([x - w, yy, x, yy - 17 * s, x + w, yy]).fill(color);
  }
}

export function buildMountain(o: MountainOpts): Container {
  const rng = mulberry32(o.seed);
  const rough = o.rough ?? 3;
  const bottom = o.bottom ?? 1000;
  const c = new Container();
  const g = new Graphics();
  const pts: number[] = [];
  for (let x = -300; x <= 1900; x += 6) pts.push(x, ridgeY(x, o.base, o.peaks, rough));
  g.poly([...pts, 1900, bottom, -300, bottom]).fill(o.color);

  // Schattenseite (links) und Lichtseite (rechts) je Gipfel
  for (const pk of o.peaks) {
    const left: number[] = [];
    for (let x = pk.c - pk.w * 1.5; x <= pk.c; x += 6) left.push(x, ridgeY(x, o.base, o.peaks, rough));
    g.poly([...left, pk.c + pk.w * 0.12, o.base + 40, pk.c - pk.w * 1.9, o.base + 40]).fill({
      color: 0x0a1420,
      alpha: 0.16,
    });
    const right: number[] = [];
    for (let x = pk.c; x <= pk.c + pk.w * 1.4; x += 6) right.push(x, ridgeY(x, o.base, o.peaks, rough));
    g.poly([...right, pk.c + pk.w * 1.9, o.base + 40, pk.c - pk.w * 0.1, o.base + 40]).fill({
      color: 0xffffff,
      alpha: 0.09,
    });
  }

  // Pinselstriche: kurze gebogene Linien, die Felsstruktur andeuten
  const n = o.strokes ?? 70;
  for (let i = 0; i < n; i++) {
    const x = rand(rng, -100, 1700);
    const ry = ridgeY(x, o.base, o.peaks, rough);
    const y = ry + rand(rng, 14, Math.max(30, o.base - ry + 10));
    const len = rand(rng, 14, 38);
    g.moveTo(x, y)
      .quadraticCurveTo(x + rand(rng, -9, 9), y + len * 0.5, x + rand(rng, -12, 12), y + len)
      .stroke({ width: rand(rng, 1, 2.2), color: 0x0a1420, alpha: rand(rng, 0.07, 0.17), cap: 'round' });
  }

  c.addChild(g);
  if (o.pines) {
    const t = new Graphics();
    const pineColor = 0x2f4a38;
    for (let i = 0; i < o.pines; i++) {
      const x = rand(rng, -80, 1680);
      pine(t, x, ridgeY(x, o.base, o.peaks, rough) + 3, rand(rng, 0.55, 1.0), pineColor);
    }
    c.addChild(t);
  }
  return c;
}
