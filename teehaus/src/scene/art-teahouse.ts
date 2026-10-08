// Das Teehaus von außen: Terrasse, Fachwerk, geschwungene Dächer, Laternen, Fahne mit 茶馆.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { SceneCtx } from './ctx';
import { FONT_BRUSH } from './ctx';

const TILE = 0x4b565c;
const TILE_EDGE = 0x232d31;
const TIMBER = 0x5a2b1e;
const WALL = 0xeadfc6;

/** Geschwungenes Dach mit hochgezogenen Ecken (飞檐 fēiyán). */
export function roof(g: Graphics, cx: number, y: number, wb: number, wt: number, h: number): void {
  g.moveTo(cx - wb - 26, y - 18)
    .quadraticCurveTo(cx - wb + 8, y + 12, cx - wb + 64, y + 9)
    .lineTo(cx + wb - 64, y + 9)
    .quadraticCurveTo(cx + wb - 8, y + 12, cx + wb + 26, y - 18)
    .quadraticCurveTo(cx + wt + 50, y - h * 0.5, cx + wt, y - h)
    .lineTo(cx - wt, y - h)
    .quadraticCurveTo(cx - wt - 50, y - h * 0.5, cx - wb - 26, y - 18)
    .closePath()
    .fill(TILE);
  // Ziegelreihen
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const xt = cx - wt + f * wt * 2;
    const xb = cx - wb - 14 + f * (wb * 2 + 28);
    g.moveTo(xt, y - h)
      .lineTo(xb, y + 8)
      .stroke({ width: 1.4, color: TILE_EDGE, alpha: 0.45 });
  }
  // Traufkante
  g.moveTo(cx - wb - 26, y - 18)
    .quadraticCurveTo(cx - wb + 8, y + 12, cx - wb + 64, y + 9)
    .lineTo(cx + wb - 64, y + 9)
    .quadraticCurveTo(cx + wb - 8, y + 12, cx + wb + 26, y - 18)
    .stroke({ width: 4, color: TILE_EDGE, alpha: 0.85, join: 'round' });
  // First mit Aufbauten (吻 wěn)
  g.roundRect(cx - wt - 8, y - h - 7, wt * 2 + 16, 9, 3).fill(0x66727a);
  for (const s of [-1, 1]) {
    g.moveTo(cx + s * (wt + 8), y - h - 3)
      .quadraticCurveTo(cx + s * (wt + 24), y - h - 8, cx + s * (wt + 16), y - h - 26)
      .stroke({ width: 5, color: 0x66727a, cap: 'round' });
  }
}

function lattice(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  line: number,
): void {
  for (let i = 0; i <= cols; i++) g.moveTo(x + (w * i) / cols, y).lineTo(x + (w * i) / cols, y + h);
  for (let j = 0; j <= rows; j++) g.moveTo(x, y + (h * j) / rows).lineTo(x + w, y + (h * j) / rows);
  g.stroke({ width: 2, color: line });
}

export interface TeahouseResult {
  node: Container;
  /** Wehende Fahne und Laternen für die Animation */
  flag: Container;
  lanterns: Container[];
}

export function buildTeahouse(ctx: SceneCtx): TeahouseResult {
  const root = new Container();
  const body = new Container();
  ctx.tint(body, 'mid');
  const g = new Graphics();
  body.addChild(g);

  // Terrasse + Stützmauer
  g.poly([-215, 0, 215, 0, 232, 30, -232, 30]).fill(0x9a9285);
  g.rect(-232, 30, 464, 46).fill(0x7c766b);
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 12; i++) {
      const off = r % 2 ? 19 : 0;
      g.rect(-232 + i * 40 + off, 32 + r * 15, 38, 13).stroke({ width: 1, color: 0x4d493f, alpha: 0.4 });
    }
  }

  // Erdgeschoss: weiße Wand, dunkles Gebälk
  g.rect(-172, -120, 344, 120).fill(WALL);
  g.rect(-172, -120, 344, 120).stroke({ width: 2, color: TIMBER });
  // Querbalken
  g.rect(-176, -124, 352, 9).fill(TIMBER);
  g.rect(-176, -6, 352, 8).fill(TIMBER);
  // Säulen
  for (const x of [-172, -58, 58, 172]) {
    g.rect(x - 7, -126, 14, 128).fill(0x7d2a1d);
    g.rect(x - 7, -126, 4, 128).fill({ color: 0xffffff, alpha: 0.12 });
    g.rect(x - 10, -2, 20, 8).fill(0x6b665c);
  }
  // Obergeschoss
  roof(g, 0, -120, 236, 168, 50);
  g.rect(-122, -226, 244, 62).fill(WALL);
  g.rect(-122, -226, 244, 62).stroke({ width: 2, color: TIMBER });
  g.rect(-126, -230, 252, 8).fill(TIMBER);
  g.rect(-126, -168, 252, 8).fill(TIMBER);
  for (const x of [-122, -40, 40, 122]) g.rect(x - 6, -232, 12, 70).fill(0x7d2a1d);
  roof(g, 0, -228, 170, 74, 58);
  // Bekrönung (宝顶 bǎodǐng)
  g.moveTo(0, -288).lineTo(0, -318).stroke({ width: 4, color: 0x8a7a50, cap: 'round' });
  g.circle(0, -300, 7).fill(0xd9a94a);

  root.addChild(body);

  // Leuchtende Fenster und Türöffnung (hinter dem Gitter)
  const glowG = new Graphics();
  for (const x of [-148, 78]) glowG.rect(x, -96, 70, 62).fill(0xffd596);
  glowG.rect(-46, -112, 92, 106).fill(0xffc86e);
  for (const x of [-100, 18]) glowG.rect(x, -216, 82, 40).fill(0xffd596);
  ctx.lit(glowG, 0.5, 0.5);
  root.addChild(glowG);
  // Lichtschein, der aus der Tür fällt
  const spill = new Sprite(ctx.glow);
  spill.anchor.set(0.5);
  spill.position.set(0, -50);
  spill.scale.set(3.4, 2.4);
  spill.tint = 0xffb050;
  spill.blendMode = 'add';
  ctx.lit(spill, 0.0, 0.7);
  root.addChild(spill);
  // Gitter über das Leuchten legen
  const grid = new Graphics();
  for (const x of [-148, 78]) lattice(grid, x, -96, 70, 62, 5, 4, 0x4a2418);
  lattice(grid, -46, -112, 92, 106, 6, 7, 0x4a2418);
  for (const x of [-100, 18]) lattice(grid, x, -216, 82, 40, 6, 3, 0x4a2418);
  ctx.tint(grid, 'mid');
  root.addChild(grid);

  // Laternen an den Traufen
  const lanterns: Container[] = [];
  const spots: [number, number][] = [
    [-228, -96],
    [228, -96],
    [-160, -214],
    [160, -214],
  ];
  for (const [x, y] of spots) {
    const l = new Container();
    l.position.set(x, y);
    const lg = new Graphics();
    lg.moveTo(0, -16).lineTo(0, 0).stroke({ width: 1.5, color: 0x3a2418 });
    lg.ellipse(0, 12, 9, 12).fill(0xc9301f);
    lg.rect(-5, 0, 10, 3).fill(0xd9a94a);
    lg.rect(-4, 24, 8, 3).fill(0xd9a94a);
    lg.moveTo(0, 27).lineTo(0, 36).stroke({ width: 1.5, color: 0xd9a94a });
    l.addChild(lg);
    const glow = new Sprite(ctx.glow);
    glow.anchor.set(0.5);
    glow.position.set(0, 12);
    glow.scale.set(1.1);
    glow.tint = 0xffa23a;
    glow.blendMode = 'add';
    ctx.lit(glow, 0.0, 0.9);
    l.addChild(glow);
    root.addChild(l);
    lanterns.push(l);
  }

  // Fahne mit 茶馆 (Pinselschrift) am Mast rechts
  const flag = new Container();
  flag.position.set(262, -190);
  const pole = new Graphics();
  pole.moveTo(262, 30).lineTo(262, -202).stroke({ width: 5, color: 0x4a2f1c, cap: 'round' });
  pole.circle(262, -204, 4).fill(0xd9a94a);
  ctx.tint(pole, 'mid');
  root.addChild(pole);
  const cloth = new Graphics();
  cloth.poly([0, 0, 46, 4, 46, 138, 23, 128, 0, 138]).fill(0xb3261a);
  cloth.poly([0, 0, 46, 4, 46, 138, 23, 128, 0, 138]).stroke({ width: 2, color: 0xd9a94a });
  flag.addChild(cloth);
  for (let i = 0; i < 2; i++) {
    const t = new Text({
      text: i === 0 ? '茶' : '馆',
      style: { fontFamily: FONT_BRUSH, fontSize: 40, fill: 0xf6e7b8, align: 'center' },
    });
    t.anchor.set(0.5);
    t.position.set(23, 32 + i * 46);
    flag.addChild(t);
  }
  ctx.tint(flag, 'mid');
  root.addChild(flag);

  return { node: root, flag, lanterns };
}

/** Steintreppe von der Terrasse hinunter zur Brücke. */
export function buildStairs(): Graphics {
  const g = new Graphics();
  const top = 30;
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const f = i / steps;
    const f2 = (i + 1) / steps;
    const w1 = 64 + f * 110;
    const w2 = 64 + f2 * 110;
    const y1 = top + f * 138;
    const y2 = top + f2 * 138;
    g.poly([-w1, y1, w1, y1, w2, y2, -w2, y2]).fill(i % 2 ? 0x9b9488 : 0xaaa396);
    g.moveTo(-w2, y2).lineTo(w2, y2).stroke({ width: 1.5, color: 0x59534a, alpha: 0.6 });
  }
  // Seitenwangen
  g.poly([-64, top, -74, top, -184, top + 138, -174, top + 138]).fill(0x7d776c);
  g.poly([64, top, 74, top, 184, top + 138, 174, top + 138]).fill(0x7d776c);
  return g;
}
