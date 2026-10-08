// Das Teehaus innen: Holzbalken, Papierfenster mit Ausblick, niedriger Teetisch mit Teekanne und Schalen,
// Laternen, Lichtstrahlen. Figuren werden in M2 in die Ebenen figBody / figArms eingehängt.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { clamp } from '../core/util';
import { FONT_BRUSH, FONT_ZH, SceneCtx } from './ctx';
import { Steam, Motes } from './particles';
import { gradientTexture } from './gfx';
import type { Palette } from './timeOfDay';
import { DESIGN_W } from './world';

/** Fensteröffnung (Ausblick auf die Landschaft) in Designkoordinaten */
export const WINDOW = { x0: 236, x1: 1364, y0: 124, y1: 492 };
export const TABLE_TOP_Y = 566;

const WOOD = 0x4a2d1e;
const WOOD_D = 0x2b1810;
const LACQUER = 0x7d2a1d;
const GOLD = 0xd9a94a;

export interface Hotspot {
  id: string;
  node: Container;
}

export class Room {
  readonly root = new Container();
  /** Ebenen von hinten nach vorn */
  readonly back = new Container();
  readonly figBody = new Container();
  readonly tableLayer = new Container();
  readonly figArms = new Container();
  readonly front = new Container();
  readonly ctx: SceneCtx;
  readonly steam: Steam;
  readonly dust: Motes;
  /** Klickbare Dinge (Easter Eggs) */
  readonly teapot = new Container();
  readonly lanternBig = new Container();
  readonly lanternSmall: Container[] = [];
  readonly incense = new Container();
  readonly scroll = new Container();
  readonly ruler = new Container();
  readonly cat = new Container();
  /** Ankerpunkte für Tassen in M2 */
  readonly cupSpots = { jackie: { x: 664, y: 590 }, yao: { x: 962, y: 592 } };
  steamTeapot: ReturnType<Steam['add']>;
  steamLid: ReturnType<Steam['add']>;
  steamIncense: ReturnType<Steam['add']>;

  private shafts: { s: Sprite; base: number; phase: number }[] = [];
  private lanternSwing: { c: Container; boost: number; phase: number }[] = [];
  private catZ = new Container();
  private layers: { node: Container; par: number }[] = [];
  private paperGlow = new Graphics();
  private time = 0;

  constructor(ctx?: SceneCtx) {
    this.ctx = ctx ?? new SceneCtx();
    const c = this.ctx;
    this.root.addChild(this.back, this.figBody, this.tableLayer, this.figArms, this.front);
    this.layers = [
      { node: this.back, par: 0.35 },
      { node: this.figBody, par: 0.6 },
      { node: this.tableLayer, par: 0.85 },
      { node: this.figArms, par: 0.85 },
      { node: this.front, par: 1.15 },
    ];

    this.buildBack();
    this.buildTable();
    this.buildFront();

    this.steam = new Steam(c.glow, 120);
    this.steam.node.position.set(0, 0);
    this.steamTeapot = this.steam.add({
      x: 835,
      y: 548,
      rate: 4.5,
      rise: 36,
      spread: 5,
      size: 0.55,
      life: 2.8,
      alpha: 0.3,
    });
    this.steamLid = this.steam.add({
      x: 788,
      y: 530,
      rate: 2.6,
      rise: 30,
      spread: 6,
      size: 0.5,
      life: 2.6,
      alpha: 0.24,
    });
    this.steamIncense = this.steam.add({
      x: 1078,
      y: 540,
      rate: 3.2,
      rise: 26,
      spread: 3,
      size: 0.32,
      life: 4.6,
      alpha: 0.22,
      tint: 0xd7d2c8,
    });
    this.front.addChildAt(this.steam.node, 0);

    this.dust = new Motes(
      c.glow,
      { x0: 300, x1: 1150, y0: 160, y1: 620 },
      70,
      { tint: 0xffe2a8, size: [0.05, 0.12], speed: 7, twinkle: 1.2 },
      9,
    );
    this.front.addChildAt(this.dust.node, 0);
  }

  // ─────────────────────────────────────────── Rückwand, Fenster, Balken, Boden
  private buildBack(): void {
    const c = this.ctx;
    const back = this.back;
    const { x0, x1, y0, y1 } = WINDOW;

    // Boden
    const floor = new Graphics();
    floor.rect(0, 700, DESIGN_W, 260).fill(0x5a3a24);
    const vpx = 800;
    const vpy = 330;
    for (let i = -12; i <= 12; i++) {
      const xb = vpx + i * 150;
      const xt = vpx + (i * 150 * (700 - vpy)) / (960 - vpy);
      floor.moveTo(xt, 700).lineTo(xb, 960).stroke({ width: 2, color: 0x2b1810, alpha: 0.5 });
    }
    for (let y = 716; y < 960; y += 28 + (y - 700) * 0.12)
      floor.moveTo(0, y).lineTo(DESIGN_W, y).stroke({ width: 1.2, color: 0x2b1810, alpha: 0.28 });
    floor.rect(0, 700, DESIGN_W, 10).fill({ color: 0x000000, alpha: 0.3 });
    back.addChild(c.tint(floor, 'room'));

    // Rückwand mit Fensteröffnung (Ausschnitt!)
    const wall = new Graphics();
    wall.rect(0, 0, DESIGN_W, 704).fill(WOOD);
    wall.roundRect(x0, y0, x1 - x0, y1 - y0, 6).cut();
    // Holzmaserung der Wand
    for (let x = 0; x < DESIGN_W; x += 46) {
      if (x > x0 - 20 && x < x1 + 20) {
        wall
          .moveTo(x, 0)
          .lineTo(x, y0 - 10)
          .moveTo(x, y1 + 16)
          .lineTo(x, 704);
      } else {
        wall.moveTo(x, 0).lineTo(x, 704);
      }
    }
    wall.stroke({ width: 1.2, color: WOOD_D, alpha: 0.35 });
    back.addChild(c.tint(wall, 'room'));
    // Brüstung unter dem Fenster
    const sill = new Graphics();
    sill.rect(x0 - 14, y1, x1 - x0 + 28, 18).fill(0x5d3822);
    sill.rect(x0 - 14, y1, x1 - x0 + 28, 4).fill({ color: 0xffffff, alpha: 0.15 });
    sill.rect(0, y1 + 18, DESIGN_W, 186).fill(0x3a2216);
    for (let x = 30; x < DESIGN_W; x += 140) {
      sill.roundRect(x, y1 + 36, 110, 130, 4).stroke({ width: 2, color: WOOD_D, alpha: 0.7 });
      sill.roundRect(x + 10, y1 + 46, 90, 110, 3).stroke({ width: 1, color: 0x6a4630, alpha: 0.5 });
    }
    back.addChild(c.tint(sill, 'room'));

    // Fensterrahmen + Gitter im oberen Streifen (窗格 chuānggé)
    const frame = new Graphics();
    frame.roundRect(x0 - 14, y0 - 14, x1 - x0 + 28, y1 - y0 + 14, 8).stroke({ width: 16, color: 0x5c2a1c });
    frame
      .roundRect(x0 - 14, y0 - 14, x1 - x0 + 28, y1 - y0 + 14, 8)
      .stroke({ width: 3, color: GOLD, alpha: 0.5 });
    frame.rect(x0, y0, x1 - x0, 6).fill(0x5c2a1c);
    // Gitterband
    const bandH = 62;
    for (let x = x0; x <= x1; x += 24) frame.moveTo(x, y0).lineTo(x, y0 + bandH);
    frame.stroke({ width: 3, color: 0x5c2a1c });
    for (let x = x0; x < x1; x += 48) {
      frame
        .moveTo(x, y0 + bandH / 2)
        .lineTo(x + 24, y0)
        .moveTo(x, y0 + bandH / 2)
        .lineTo(x + 24, y0 + bandH);
      frame
        .moveTo(x + 48, y0 + bandH / 2)
        .lineTo(x + 24, y0)
        .moveTo(x + 48, y0 + bandH / 2)
        .lineTo(x + 24, y0 + bandH);
    }
    frame.stroke({ width: 2.4, color: 0x5c2a1c });
    frame
      .moveTo(x0, y0 + bandH)
      .lineTo(x1, y0 + bandH)
      .stroke({ width: 8, color: 0x5c2a1c });
    // schlanke Pfosten
    for (const x of [x0 + (x1 - x0) / 3, x0 + ((x1 - x0) * 2) / 3])
      frame.rect(x - 5, y0 + bandH, 10, y1 - y0 - bandH).fill(0x5c2a1c);
    back.addChild(c.tint(frame, 'room'));

    // Papierfenster links (Schiebetür) – leuchtet warm
    const paper = new Graphics();
    paper.rect(18, 138, 180, 540).fill(0xf0e2c0);
    this.paperGlow = new Graphics();
    this.paperGlow.rect(18, 138, 180, 540).fill(0xffd9a0);
    const lat = new Graphics();
    for (let i = 0; i <= 4; i++) lat.moveTo(18 + (180 * i) / 4, 138).lineTo(18 + (180 * i) / 4, 678);
    for (let j = 0; j <= 9; j++) lat.moveTo(18, 138 + (540 * j) / 9).lineTo(198, 138 + (540 * j) / 9);
    lat.stroke({ width: 3, color: 0x4a2418 });
    lat.rect(18, 138, 180, 540).stroke({ width: 8, color: 0x5c2a1c });
    // Silhouette eines Bambuszweigs hinter dem Papier
    const bam = new Graphics();
    bam.moveTo(60, 678).quadraticCurveTo(70, 450, 52, 250).stroke({ width: 6, color: 0x4a6a3a, alpha: 0.35 });
    for (let i = 0; i < 10; i++) {
      const y = 280 + i * 38;
      const dir = i % 2 ? 1 : -1;
      bam
        .moveTo(58 + (i % 3) * 3, y)
        .quadraticCurveTo(58 + dir * 40, y - 12, 58 + dir * 70, y + 8)
        .stroke({ width: 4, color: 0x4a6a3a, alpha: 0.3 });
    }
    back.addChild(c.tint(paper, 'room'), c.lit(this.paperGlow, 0.18, 0.25), bam, lat);

    // Säulen mit Lack und Goldringen
    const cols = new Graphics();
    for (const x of [214, 1386]) {
      cols.rect(x - 22, 0, 44, 704).fill(LACQUER);
      cols.rect(x - 22, 0, 9, 704).fill({ color: 0xffffff, alpha: 0.12 });
      cols.rect(x + 12, 0, 10, 704).fill({ color: 0x000000, alpha: 0.18 });
      cols.rect(x - 24, 112, 48, 10).fill(GOLD);
      cols.rect(x - 24, 640, 48, 8).fill(GOLD);
      cols.rect(x - 30, 690, 60, 18).fill(0x6b665c);
      cols.rect(x - 34, 100, 68, 14).fill(0x2e6b5e);
      cols.rect(x - 46, 84, 92, 16).fill(0x5c2a1c);
    }
    back.addChild(c.tint(cols, 'room'));

    // Deckenbalken mit Bemalung (彩画 cǎihuà)
    const beams = new Graphics();
    beams.rect(0, 0, DESIGN_W, 96).fill(WOOD_D);
    for (let x = 40; x < DESIGN_W; x += 120) beams.rect(x, 0, 16, 60).fill({ color: 0x000000, alpha: 0.35 });
    beams.rect(0, 58, DESIGN_W, 50).fill(0x5c2a1c);
    beams.rect(0, 58, DESIGN_W, 6).fill({ color: 0xffffff, alpha: 0.14 });
    beams.rect(0, 104, DESIGN_W, 8).fill({ color: 0x000000, alpha: 0.4 });
    for (let x = 20; x < DESIGN_W; x += 70) {
      beams.poly([x, 83, x + 18, 68, x + 36, 83, x + 18, 98]).fill(0x2e6b5e);
      beams.poly([x + 8, 83, x + 18, 74, x + 28, 83, x + 18, 92]).fill(GOLD);
      beams.circle(x + 53, 83, 5).fill(0xb3261a);
    }
    back.addChild(c.tint(beams, 'room'));

    // Bonsai-Kiefer auf der Fensterbank (links)
    const bonsai = new Graphics();
    bonsai.poly([300, 474, 352, 474, 346, 492, 306, 492]).fill(0x7a4a36);
    bonsai.rect(296, 470, 60, 6).fill(0x8a5a44);
    bonsai
      .moveTo(326, 470)
      .quadraticCurveTo(310, 440, 332, 420)
      .quadraticCurveTo(350, 410, 340, 392)
      .stroke({ width: 5, color: 0x3b2a1d, cap: 'round' });
    for (const [x, y, r] of [
      [318, 412, 22],
      [346, 396, 18],
      [336, 436, 16],
    ] as const) {
      bonsai.ellipse(x, y, r, r * 0.6).fill(0x2f5a36);
      bonsai.ellipse(x - 4, y - 3, r * 0.6, r * 0.3).fill({ color: 0x6aa04e, alpha: 0.5 });
    }
    back.addChild(c.tint(bonsai, 'room'));

    // Hängerolle 茶 + Messlatte 身高 rechts
    this.buildScroll();
    this.buildRuler();
    back.addChild(this.scroll, this.ruler);

    // Schlafende Katze auf der Fensterbank rechts (Easter Egg)
    this.buildCat();
    back.addChild(this.cat);

    // Lichtstrahlen (additiv) aus dem Fenster
    const shaftTex = gradientTexture(
      64,
      4,
      [
        [0, 'rgba(255,255,255,0)'],
        [0.5, 'rgba(255,255,255,1)'],
        [1, 'rgba(255,255,255,0)'],
      ],
      true,
    );
    const defs: [number, number, number, number][] = [
      [980, 130, 120, 0.9],
      [760, 130, 86, 0.7],
      [1200, 140, 70, 0.6],
    ];
    for (const [x, y, w, a] of defs) {
      const s = new Sprite(shaftTex);
      s.anchor.set(0.5, 0);
      s.position.set(x, y);
      s.width = w;
      s.height = 760;
      s.rotation = 0.42;
      s.blendMode = 'add';
      s.alpha = 0;
      this.front.addChild(s);
      this.shafts.push({ s, base: a, phase: x });
    }
  }

  private buildScroll(): void {
    const sc = this.scroll;
    sc.position.set(1440, 142);
    const g = new Graphics();
    g.rect(0, 0, 64, 340).fill(0xeadcb8);
    g.rect(-6, -10, 76, 14).fill(0x3a2216);
    g.rect(-6, 336, 76, 14).fill(0x3a2216);
    g.rect(0, 0, 64, 340).stroke({ width: 4, color: 0x8a2a1c });
    g.moveTo(32, -10).lineTo(32, -34).stroke({ width: 2, color: 0x3a2216 });
    sc.addChild(this.ctx.tint(g, 'room'));
    const t = new Text({ text: '茶', style: { fontFamily: FONT_BRUSH, fontSize: 128, fill: 0x1c1410 } });
    t.anchor.set(0.5);
    t.position.set(32, 100);
    const t2 = new Text({
      text: '以和为贵',
      style: {
        fontFamily: FONT_BRUSH,
        fontSize: 22,
        fill: 0x1c1410,
        wordWrap: true,
        wordWrapWidth: 24,
        breakWords: true,
        lineHeight: 24,
      },
    });
    t2.anchor.set(0.5, 0);
    t2.position.set(32, 176);
    const seal = new Graphics();
    seal.rect(24, 300, 18, 18).fill(0xb3261a);
    sc.addChild(this.ctx.tint(t, 'room'), this.ctx.tint(t2, 'room'), seal);
    sc.eventMode = 'static';
    sc.cursor = 'pointer';
  }

  private buildRuler(): void {
    const r = this.ruler;
    r.position.set(1522, 0);
    const g = new Graphics();
    const ppm = 240; // Designpixel je Meter
    const floorY = 700;
    g.roundRect(0, floorY - 2.4 * ppm, 46, 2.4 * ppm, 4).fill(0xb48a5a);
    g.roundRect(0, floorY - 2.4 * ppm, 46, 2.4 * ppm, 4).stroke({ width: 3, color: 0x5c3a22 });
    for (let cm = 0; cm <= 235; cm += 5) {
      const y = floorY - (cm / 100) * ppm;
      const len = cm % 50 === 0 ? 26 : cm % 10 === 0 ? 16 : 9;
      g.moveTo(46, y)
        .lineTo(46 - len, y)
        .stroke({ width: cm % 50 === 0 ? 2.4 : 1.4, color: 0x3a2216 });
    }
    r.addChild(this.ctx.tint(g, 'room'));
    for (const m of [1, 2]) {
      const t = new Text({ text: `${m} m`, style: { fontFamily: FONT_ZH, fontSize: 13, fill: 0x2a170f } });
      t.position.set(4, floorY - m * ppm - 16);
      r.addChild(t);
    }
    r.eventMode = 'static';
    r.cursor = 'pointer';
  }

  /** Marker für die Körpergrößen (Zentimeter) auf der Messlatte */
  heightMarkerY(cm: number): number {
    return 700 - (cm / 100) * 240;
  }

  private buildCat(): void {
    const c = this.cat;
    c.position.set(1290, 488);
    const g = new Graphics();
    g.ellipse(0, -14, 44, 18).fill(0xd8a066);
    g.circle(-34, -18, 15).fill(0xd8a066);
    g.poly([-45, -28, -41, -42, -34, -30]).fill(0xd8a066);
    g.poly([-30, -30, -24, -42, -22, -26]).fill(0xd8a066);
    g.moveTo(-40, -19)
      .lineTo(-36, -18)
      .moveTo(-30, -19)
      .lineTo(-26, -18)
      .stroke({ width: 1.6, color: 0x2a1a10 });
    g.ellipse(14, -22, 18, 6).fill({ color: 0xa8743f, alpha: 0.7 });
    g.moveTo(44, -10).quadraticCurveTo(66, -2, 60, -22).stroke({ width: 8, color: 0xd8a066, cap: 'round' });
    c.addChild(this.ctx.tint(g, 'room'));
    c.eventMode = 'static';
    c.cursor = 'pointer';
    this.catZ.position.set(-20, -50);
    c.addChild(this.catZ);
  }

  // ─────────────────────────────────────────── Tisch
  private buildTable(): void {
    const c = this.ctx;
    const t = this.tableLayer;
    const T = TABLE_TOP_Y;

    // Teppich unter dem Tisch
    const rug = new Graphics();
    rug.ellipse(800, 842, 560, 74).fill(0x6e2a22);
    rug.ellipse(800, 842, 530, 62).stroke({ width: 5, color: GOLD, alpha: 0.85 });
    rug.ellipse(800, 842, 480, 50).stroke({ width: 2, color: GOLD, alpha: 0.5 });
    for (let i = 0; i < 9; i++) rug.circle(340 + i * 115, 842, 9).fill({ color: GOLD, alpha: 0.45 });
    t.addChild(c.tint(rug, 'room'));

    // Tischdecke (hängt bis zum Boden: verdeckt die Beine der Sitzenden)
    const cloth = new Graphics();
    cloth.poly([420, T + 46, 1180, T + 46, 1212, 800, 388, 800]).fill(0x24304e);
    cloth
      .poly([420, T + 46, 1180, T + 46, 1186, T + 120, 414, T + 120])
      .fill({ color: 0x000000, alpha: 0.12 });
    for (let x = 440; x < 1180; x += 70) {
      cloth
        .moveTo(x, T + 56)
        .lineTo(x - 4 + (x - 800) * 0.04, 796)
        .stroke({ width: 1.4, color: 0x0f162b, alpha: 0.5 });
    }
    // Zierborte: Wellenmuster (回纹 huíwén)
    for (let x = 408; x < 1200; x += 30) {
      cloth.rect(x, 748, 22, 4).fill(GOLD);
      cloth.rect(x, 748, 4, 22).fill(GOLD);
      cloth.rect(x, 766, 22, 4).fill(GOLD);
    }
    cloth.rect(388, 740, 824, 3).fill({ color: GOLD, alpha: 0.8 });
    t.addChild(c.tint(cloth, 'room'));

    // Tischplatte (Trapez)
    const top = new Graphics();
    top.poly([470, T - 18, 1130, T - 18, 1190, T + 46, 410, T + 46]).fill(0x8a5a36);
    top.poly([410, T + 46, 1190, T + 46, 1190, T + 62, 410, T + 62]).fill(0x5d3822);
    for (let i = 0; i < 16; i++) {
      const y = T - 12 + i * 3.6;
      top
        .moveTo(470 - (y - (T - 18)) * 0.9, y)
        .lineTo(1130 + (y - (T - 18)) * 0.9, y)
        .stroke({ width: 1, color: 0x4a2d1e, alpha: 0.25 });
    }
    top.poly([470, T - 18, 1130, T - 18, 1136, T - 12, 464, T - 12]).fill({ color: 0xffffff, alpha: 0.16 });
    // Läufer
    top.poly([560, T - 18, 1040, T - 18, 1086, T + 46, 514, T + 46]).fill({ color: 0x24304e, alpha: 0.75 });
    t.addChild(c.tint(top, 'room'));

    // Teetablett aus Bambus
    const tray = new Graphics();
    tray.poly([690, T + 4, 910, T + 4, 930, T + 34, 670, T + 34]).fill(0xc8a46a);
    for (let i = 0; i < 9; i++)
      tray
        .moveTo(690 + i * 26 - (i - 4) * 1.6, T + 4)
        .lineTo(670 + i * 32, T + 34)
        .stroke({ width: 1.4, color: 0x7c5a30, alpha: 0.6 });
    tray.poly([670, T + 34, 930, T + 34, 930, T + 40, 670, T + 40]).fill(0x7c5a30);
    t.addChild(c.tint(tray, 'room'));

    // Teekanne (紫砂壶 zǐshāhú) – klickbar
    const pot = this.teapot;
    pot.position.set(800, T + 14);
    const pg = new Graphics();
    pg.ellipse(0, 0, 46, 34).fill(0x7a3d34);
    pg.ellipse(-10, -10, 26, 14).fill({ color: 0xffffff, alpha: 0.14 });
    pg.ellipse(8, 14, 38, 14).fill({ color: 0x000000, alpha: 0.18 });
    pg.ellipse(0, -30, 26, 8).fill(0x6a322b);
    pg.ellipse(0, -35, 17, 6).fill(0x8a463c);
    pg.circle(0, -45, 6).fill(0x6a322b);
    pg.moveTo(40, -2)
      .quadraticCurveTo(76, -8, 70, -40)
      .quadraticCurveTo(66, -22, 40, -16)
      .closePath()
      .fill(0x7a3d34);
    pg.moveTo(-42, -10)
      .quadraticCurveTo(-82, -22, -76, 14)
      .quadraticCurveTo(-72, 28, -44, 18)
      .stroke({ width: 8, color: 0x7a3d34, cap: 'round' });
    pg.ellipse(0, 4, 40, 4).fill({ color: GOLD, alpha: 0.5 });
    pot.addChild(c.tint(pg, 'room'));
    pot.eventMode = 'static';
    pot.cursor = 'pointer';
    t.addChild(pot);

    // Tassen auf dem Tablett (blau-weiß 青花 qīnghuā)
    const cup = (x: number, y: number, s = 1): Graphics => {
      const g = new Graphics();
      g.ellipse(x, y, 22 * s, 8 * s).fill(0xf6f2ea);
      g.poly([x - 22 * s, y, x + 22 * s, y, x + 15 * s, y + 20 * s, x - 15 * s, y + 20 * s]).fill(0xf6f2ea);
      g.ellipse(x, y + 20 * s, 15 * s, 5 * s).fill(0xe3ddd0);
      g.poly([
        x - 20 * s,
        y + 7 * s,
        x + 20 * s,
        y + 7 * s,
        x + 17 * s,
        y + 11 * s,
        x - 17 * s,
        y + 11 * s,
      ]).fill(0x2f5f9a);
      g.ellipse(x, y, 17 * s, 5.5 * s).fill(0xb3722e);
      g.ellipse(x - 5 * s, y - 1 * s, 7 * s, 2 * s).fill({ color: 0xffffff, alpha: 0.35 });
      return g;
    };
    t.addChild(c.tint(cup(724, T + 30, 0.9), 'room'), c.tint(cup(880, T + 30, 0.9), 'room'));
    // Tassen vor den Figuren (werden in M2 aufgenommen)
    this.cupJackie = cup(this.cupSpots.jackie.x, this.cupSpots.jackie.y, 1.05);
    this.cupYao = cup(this.cupSpots.yao.x, this.cupSpots.yao.y, 1.05);
    t.addChild(c.tint(this.cupJackie, 'room'), c.tint(this.cupYao, 'room'));

    // Gebäck (包子 bāozi) auf Teller links
    const plate = new Graphics();
    plate.ellipse(556, T + 28, 56, 14).fill(0xf0ebe0);
    plate.ellipse(556, T + 27, 46, 9).fill(0xe0d9c8);
    for (const [x, y] of [
      [534, T + 14],
      [558, T + 10],
      [582, T + 15],
      [546, T + 22],
      [572, T + 22],
    ] as const) {
      plate.ellipse(x, y, 15, 11).fill(0xfaf3e2);
      for (let i = -2; i <= 2; i++)
        plate
          .moveTo(x + i * 2.4, y - 7)
          .lineTo(x + i * 1.6, y - 1)
          .stroke({ width: 0.9, color: 0xd9ceb3 });
    }
    t.addChild(c.tint(plate, 'room'));
    this.plateSpot = { x: 556, y: T + 14 };

    // Räucherwerk (香炉 xiānglú) rechts
    const inc = this.incense;
    inc.position.set(1078, T + 20);
    const ig = new Graphics();
    ig.ellipse(0, 0, 22, 12).fill(0x8a6a2a);
    ig.poly([-22, 0, 22, 0, 18, 16, -18, 16]).fill(0x6e5220);
    for (const x of [-14, 0, 14]) ig.rect(x - 2, 14, 4, 10).fill(0x5a431a);
    ig.ellipse(0, -2, 17, 7).fill(0x3a2a14);
    ig.rect(-1, -26, 2, 24).fill(0xb3392a);
    ig.circle(0, -27, 2).fill(0xffb060);
    inc.addChild(c.tint(ig, 'room'));
    inc.eventMode = 'static';
    inc.cursor = 'pointer';
    t.addChild(inc);
  }

  cupJackie!: Graphics;
  cupYao!: Graphics;
  plateSpot = { x: 0, y: 0 };

  // ─────────────────────────────────────────── Vordergrund: hängende Laternen
  private buildFront(): void {
    const c = this.ctx;
    const mk = (x: number, drop: number, s: number, seedChar: string): Container => {
      const l = new Container();
      l.position.set(x, 100);
      const g = new Graphics();
      g.moveTo(0, 0).lineTo(0, drop).stroke({ width: 2.4, color: 0x2a1a10 });
      const cy = drop + 38 * s;
      g.ellipse(0, cy, 34 * s, 42 * s).fill(0xc9301f);
      g.ellipse(-9 * s, cy - 8 * s, 14 * s, 26 * s).fill({ color: 0xff7a4a, alpha: 0.4 });
      for (let i = -2; i <= 2; i++)
        g.moveTo(i * 12 * s, drop)
          .quadraticCurveTo(i * 34 * s, cy, i * 12 * s, cy + 40 * s)
          .stroke({ width: 1.4, color: 0x7a1a10, alpha: 0.55 });
      g.rect(-16 * s, drop - 3, 32 * s, 8 * s).fill(GOLD);
      g.rect(-14 * s, cy + 38 * s, 28 * s, 8 * s).fill(GOLD);
      for (const i of [-1, 0, 1])
        g.moveTo(i * 6 * s, cy + 46 * s)
          .lineTo(i * 8 * s, cy + 80 * s)
          .stroke({ width: 2, color: GOLD });
      l.addChild(g);
      const t = new Text({
        text: seedChar,
        style: { fontFamily: FONT_BRUSH, fontSize: 36 * s, fill: 0xf3d58a },
      });
      t.anchor.set(0.5);
      t.position.set(0, cy);
      l.addChild(t);
      const glow = new Sprite(c.glow);
      glow.anchor.set(0.5);
      glow.position.set(0, cy);
      glow.scale.set(3.2 * s);
      glow.tint = 0xffa23a;
      glow.blendMode = 'add';
      c.lit(glow, 0.12, 0.85);
      l.addChild(glow);
      l.eventMode = 'static';
      l.cursor = 'pointer';
      this.lanternSwing.push({ c: l, boost: 0, phase: x });
      return l;
    };
    const big = mk(1096, 36, 1, '福');
    this.lanternBig.addChild(big);
    this.lanternBig.eventMode = 'passive';
    const l2 = mk(470, 62, 0.8, '春');
    const l3 = mk(826, 8, 0.56, '喜');
    this.front.addChild(big, l2, l3);
    this.lanternSmall.push(l2, l3);
    this.bigLantern = big;
  }

  bigLantern!: Container;

  // ─────────────────────────────────────────── Update
  applyPalette(p: Palette): void {
    this.ctx.apply(p);
    for (const s of this.shafts) {
      s.s.tint = p.shaft;
    }
    this.shaftAlpha = p.shaftAlpha;
    this.dust.level = clamp(0.35 + p.shaftAlpha * 1.4);
    this.dust.setTint(p.shaft);
    this.steam.node.alpha = 1;
  }

  private shaftAlpha = 0.3;

  update(dt: number, time: number, mx: number, my: number, uiShake = 0): void {
    this.time = time;
    this.steam.update(dt, time);
    this.dust.update(dt, time);
    for (const l of this.layers) l.node.position.set(mx * l.par * 12 + uiShake, my * l.par * 5);
    for (const s of this.shafts) {
      s.s.alpha = this.shaftAlpha * s.base * (0.7 + 0.3 * Math.sin(time * 0.35 + s.phase)) * 0.55;
    }
    for (const l of this.lanternSwing) {
      l.boost *= Math.exp(-dt * 1.4);
      l.c.rotation = Math.sin(time * 1.1 + l.phase) * 0.02 + Math.sin(time * 4.2) * l.boost * 0.12;
    }
    // Katze atmet
    this.cat.scale.y = 1 + Math.sin(time * 1.4) * 0.015;
  }

  /** Laterne anstoßen (Klick / Kopf-Stoß). */
  nudgeLantern(l: Container, amount = 1): void {
    const e = this.lanternSwing.find((x) => x.c === l);
    if (e) e.boost = Math.max(e.boost, amount);
  }

  get catPos(): { x: number; y: number } {
    return { x: this.cat.x - 30, y: this.cat.y - 60 };
  }

  get now(): number {
    return this.time;
  }
}
