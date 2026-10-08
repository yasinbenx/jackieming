// Die Außenwelt: mehrschichtige Parallax-Landschaft (Himmel, Berge im Nebel, Teehaus, Teich mit
// Spiegelung, Brücke, Bambus, Blüten). Alles prozedural gezeichnet.
import { Application, Container, DisplacementFilter, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { clamp, mulberry32, rand, TAU } from '../core/util';
import { SceneCtx, FONT_BRUSH } from './ctx';
import type { Palette } from './timeOfDay';
import { buildMountain } from './art-mountains';
import { buildStairs, buildTeahouse } from './art-teahouse';
import type { TeahouseResult } from './art-teahouse';
import { WATERLINE, buildBridge } from './art-bridge';
import { buildGrove, swayStalks } from './art-bamboo';
import type { Stalk } from './art-bamboo';
import {
  Flock,
  buildBank,
  buildBlossomBranch,
  buildCloud,
  buildKoi,
  buildLotus,
  buildMagpie,
  buildWillow,
  updateKoi,
} from './art-nature';
import type { Koi } from './art-nature';
import { gradientCanvas, rippleTexture } from './gfx';

export const DESIGN_W = 1600;
export const DESIGN_H = 900;
export const TEAHOUSE_POS = { x: 1020, y: 520 };

export interface CamState {
  /** Fahrt-Fortschritt 0..1 (verschiebt den Fokuspunkt in die Bildmitte) */
  p: number;
  /** Zoom des Teehaus-Fokus; näher liegende Ebenen zoomen stärker */
  zoom: number;
  /** Gleichmäßiger Maßstab für alle Ebenen (Innenraum-Ausblick); überschreibt den Tiefenzoom */
  uniform: number | null;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
}

interface Layer {
  node: Container;
  /** Tiefenfaktor für Zoom */
  k: number;
  /** Maus-Parallaxe in Designpixeln */
  par: number;
  /** Anteil der Fokus-Verschiebung */
  shift: number;
}

interface Mist {
  s: Sprite;
  base: number;
  speed: number;
  phase: number;
  amp: number;
}

const gradientTex = (stops: [number, string][], h = 64): Texture => Texture.from(gradientCanvas(2, h, stops));

export class World {
  readonly root = new Container();
  readonly ctx = new SceneCtx();
  readonly layers: Layer[] = [];
  teahouse!: TeahouseResult;
  /** Alles, was nur von außen sichtbar ist (verschwindet, wenn wir im Haus sind) */
  readonly outdoorOnly = new Container();
  readonly magpie: Container;
  readonly magpieSpot = { x: 1180, y: 228 };
  magpiePerched = true;
  readonly flock = new Flock(7);
  /** Weltpositionen von Blüten, an denen Blütenblätter fallen */
  blossomSpots: [number, number][] = [];

  midLayer!: Container;
  fgLayer!: Container;
  private skyCanvas = document.createElement('canvas');
  private skyTex: Texture;
  private sunGlow1 = new Sprite();
  private sunGlow2 = new Sprite();
  private sunDisc = new Graphics();
  private moon = new Container();
  private moonGlow = new Sprite();
  private stars = new Container();
  private twinkles: { s: Sprite; phase: number }[] = [];
  private clouds: { c: Container; speed: number; base: number }[] = [];
  private mists: Mist[] = [];
  private stalks: Stalk[] = [];
  private frondSets: { c: Container; phase: number }[] = [];
  private koi: Koi[] = [];
  private glints: { g: Graphics; phase: number; base: number }[] = [];
  private waterTex: Texture;
  private waterCanvas = document.createElement('canvas');
  private sunStreak = new Sprite();
  private dispSprite!: Sprite;
  private reflection = new Container();
  private lanternNodes: Container[] = [];
  private fgBranch = new Container();
  private fgLantern = new Container();
  private flagNode!: Container;
  private wind = 0;
  private nextFlock = 6;
  private flockRng = mulberry32(99);
  private magpieFly = 0;
  private time = 0;
  /** Bildschirm-Qualität (0 = niedrig, 1 = hoch) – niedrig lässt den Wasserfilter weg */
  private reflectionFilter: DisplacementFilter | null = null;

  constructor(_app: Application) {
    this.skyCanvas.width = 2;
    this.skyCanvas.height = 256;
    this.skyTex = Texture.from(this.skyCanvas);
    this.waterCanvas.width = 2;
    this.waterCanvas.height = 128;
    this.waterTex = Texture.from(this.waterCanvas);
    this.magpie = buildMagpie();
  }

  private addLayer(k: number, par: number, shift: number): Container {
    const node = new Container();
    this.layers.push({ node, k, par, shift });
    this.root.addChild(node);
    return node;
  }

  build(): void {
    const ctx = this.ctx;
    this.buildSky(this.addLayer(0, 3, 0.1));
    this.buildMountainRange(this.addLayer(0.12, 8, 0.3), 'far');
    this.buildMountainRange(this.addLayer(0.22, 14, 0.4), 'mid');
    this.buildMountainRange(this.addLayer(0.34, 22, 0.55), 'near');
    this.buildHill(this.addLayer(0.5, 30, 1));
    this.buildWater(this.addLayer(0.56, 36, 1));
    this.midLayer = this.addLayer(0.85, 56, 1);
    this.buildMidBamboo(this.midLayer);
    this.fgLayer = this.addLayer(1.25, 100, 1);
    this.buildForeground(this.fgLayer);
    this.root.addChild(this.outdoorOnly);
    void ctx;
  }

  // ───────────────────────────── Himmel
  private buildSky(layer: Container): void {
    const sky = new Sprite(this.skyTex);
    sky.position.set(-700, -500);
    sky.width = 3000;
    sky.height = 1200;
    layer.addChild(sky);

    // Sterne
    const rng = mulberry32(11);
    const sg = new Graphics();
    for (let i = 0; i < 130; i++) {
      sg.circle(rand(rng, -300, 1900), rand(rng, -300, 430), rand(rng, 0.6, 1.6)).fill({
        color: 0xfff6e0,
        alpha: rand(rng, 0.35, 0.95),
      });
    }
    this.stars.addChild(sg);
    for (let i = 0; i < 16; i++) {
      const s = new Sprite(this.ctx.glow);
      s.anchor.set(0.5);
      s.position.set(rand(rng, -200, 1800), rand(rng, -200, 380));
      s.scale.set(rand(rng, 0.1, 0.22));
      s.blendMode = 'add';
      this.stars.addChild(s);
      this.twinkles.push({ s, phase: rng() * TAU });
    }
    layer.addChild(this.stars);

    // Sonne
    for (const [s, sc] of [
      [this.sunGlow1, 11],
      [this.sunGlow2, 3.6],
    ] as const) {
      s.texture = this.ctx.glow;
      s.anchor.set(0.5);
      s.scale.set(sc);
      s.blendMode = 'add';
      layer.addChild(s);
    }
    this.sunDisc.circle(0, 0, 44).fill(0xffffff);
    layer.addChild(this.sunDisc);

    // Mond
    this.moonGlow.texture = this.ctx.glow;
    this.moonGlow.anchor.set(0.5);
    this.moonGlow.scale.set(6);
    this.moonGlow.blendMode = 'add';
    this.moonGlow.tint = 0x9fb4ff;
    this.moon.addChild(this.moonGlow);
    const m = new Graphics();
    m.circle(0, 0, 38).fill(0xf6f2dc);
    m.circle(-12, -8, 9).fill({ color: 0xd9d3b8, alpha: 0.55 });
    m.circle(10, 10, 12).fill({ color: 0xd9d3b8, alpha: 0.45 });
    m.circle(8, -14, 5).fill({ color: 0xd9d3b8, alpha: 0.5 });
    this.moon.addChild(m);
    layer.addChild(this.moon);

    // Wolken
    const cl = new Container();
    this.ctx.tint(cl, 'far');
    const cr = mulberry32(5);
    for (let i = 0; i < 7; i++) {
      const w = rand(cr, 260, 520);
      const c = buildCloud(100 + i, w);
      const base = rand(cr, -300, 1900);
      c.position.set(base, rand(cr, 70, 360));
      cl.addChild(c);
      this.clouds.push({ c, speed: rand(cr, 3, 9), base });
    }
    layer.addChild(cl);
  }

  // ───────────────────────────── Berge
  private buildMountainRange(layer: Container, kind: 'far' | 'mid' | 'near'): void {
    const ctx = this.ctx;
    const build = (n: Container): void => {
      if (kind === 'far') {
        n.addChild(
          buildMountain({
            seed: 21,
            base: 480,
            color: 0xb4c5d6,
            strokes: 40,
            peaks: [
              { c: 150, h: 170, w: 90 },
              { c: 420, h: 250, w: 62 },
              { c: 700, h: 150, w: 120 },
              { c: 1010, h: 270, w: 78 },
              { c: 1310, h: 190, w: 100 },
              { c: 1560, h: 235, w: 66 },
            ],
          }),
        );
      } else if (kind === 'mid') {
        n.addChild(
          buildMountain({
            seed: 22,
            base: 552,
            color: 0x8da4b8,
            strokes: 70,
            pines: 10,
            peaks: [
              { c: 60, h: 190, w: 100 },
              { c: 330, h: 140, w: 90 },
              { c: 570, h: 310, w: 58 },
              { c: 870, h: 165, w: 110 },
              { c: 1190, h: 230, w: 72 },
              { c: 1470, h: 160, w: 100 },
            ],
          }),
        );
      } else {
        n.addChild(
          buildMountain({
            seed: 23,
            base: 622,
            color: 0x6a8a82,
            strokes: 90,
            pines: 26,
            peaks: [
              { c: 200, h: 140, w: 150 },
              { c: 640, h: 96, w: 170 },
              { c: 1420, h: 150, w: 160 },
            ],
          }),
        );
      }
    };
    const orig = new Container();
    build(orig);
    layer.addChild(ctx.tint(orig, kind));
    this.mirrorSources.push({ build, kind });

    // Nebelbänder
    const bandY = kind === 'far' ? 455 : kind === 'mid' ? 560 : 640;
    for (let i = 0; i < (kind === 'near' ? 1 : 2); i++) {
      const s = new Sprite(ctx.mist);
      s.anchor.set(0.5);
      s.width = 3000;
      s.height = kind === 'far' ? 150 : 190;
      s.position.set(800, bandY + i * 28);
      layer.addChild(s);
      this.mists.push({
        s,
        base: 800,
        speed: rand(mulberry32(i + 3), 0.05, 0.12),
        phase: i * 2.1 + (kind === 'mid' ? 1 : 0),
        amp: 40,
      });
    }
  }

  private mirrorSources: { build: (n: Container) => void; kind: 'far' | 'mid' | 'near' }[] = [];

  // ───────────────────────────── Hügel + Teehaus
  private hillShape(g: Graphics): void {
    g.moveTo(560, 700)
      .quadraticCurveTo(720, 650, 800, 560)
      .quadraticCurveTo(840, 524, 884, 521)
      .lineTo(1160, 521)
      .quadraticCurveTo(1206, 524, 1250, 562)
      .quadraticCurveTo(1340, 650, 1500, 700)
      .closePath()
      .fill(0x5b7a56);
  }

  private buildHill(layer: Container): void {
    const ctx = this.ctx;
    const buildAll = (n: Container, withExtras: boolean): void => {
      const g = new Graphics();
      this.hillShape(g);
      // Licht/Schatten und Felsen
      g.poly([560, 700, 720, 650, 800, 560, 760, 560, 700, 640]).fill({ color: 0x0a1420, alpha: 0.12 });
      for (let i = 0; i < 40; i++) {
        const r = mulberry32(i + 70);
        const x = rand(r, 640, 1400);
        g.moveTo(x, 600 + rand(r, 0, 80))
          .quadraticCurveTo(x + 4, 620, x - 3, 636 + rand(r, 0, 40))
          .stroke({ width: 1.6, color: 0x0a1420, alpha: 0.12 });
      }
      n.addChild(g);
      // Ahorn (枫 fēng) und Kiefern am Hang
      const trees = new Graphics();
      const spots: [number, number, number][] = [
        [760, 604, 1],
        [830, 548, 0.8],
        [1210, 546, 0.9],
        [1300, 620, 1.1],
        [690, 640, 0.9],
      ];
      for (const [x, y, s] of spots) {
        trees
          .moveTo(x, y)
          .lineTo(x + 2, y - 26 * s)
          .stroke({ width: 4 * s, color: 0x3b2a1d });
        const cols = [0xc4492a, 0xd9722f, 0xb23a22, 0xe39a3a];
        for (let i = 0; i < 6; i++) {
          trees.circle(x + (i - 2.5) * 7 * s, y - 36 * s + Math.sin(i * 1.7) * 7, 13 * s).fill(cols[i % 4]!);
        }
      }
      for (const [x, y, s] of [
        [740, 628, 0.9],
        [1330, 650, 1],
        [1380, 668, 0.8],
        [660, 668, 0.8],
      ] as const) {
        // einfache Kiefern
        trees
          .moveTo(x, y)
          .lineTo(x, y - 10 * s)
          .stroke({ width: 2.4 * s, color: 0x3b2a1d });
        for (let i = 0; i < 3; i++) {
          const yy = y - (10 + i * 13) * s;
          const w = (17 - i * 4) * s;
          trees.poly([x - w, yy, x, yy - 20 * s, x + w, yy]).fill(0x2f4a38);
        }
      }
      n.addChild(trees);
      if (withExtras) {
        const stairs = buildStairs();
        stairs.position.set(TEAHOUSE_POS.x, TEAHOUSE_POS.y);
        n.addChild(stairs);
      }
    };
    const orig = new Container();
    buildAll(orig, true);
    layer.addChild(ctx.tint(orig, 'mid'));

    this.teahouse = buildTeahouse(ctx);
    this.teahouse.node.position.set(TEAHOUSE_POS.x, TEAHOUSE_POS.y);
    layer.addChild(this.teahouse.node);
    this.flagNode = this.teahouse.flag;
    this.lanternNodes.push(...this.teahouse.lanterns);

    this.mirrorHill = (n: Container): void => {
      buildAll(n, true);
      const t = buildTeahouse(ctx);
      t.node.position.set(TEAHOUSE_POS.x, TEAHOUSE_POS.y);
      n.addChild(t.node);
    };
  }

  private mirrorHill: ((n: Container) => void) | null = null;

  // ───────────────────────────── Teich, Brücke, Ufer
  private buildWater(layer: Container): void {
    const ctx = this.ctx;
    const W = WATERLINE;
    // Wasserfläche
    const water = new Sprite(this.waterTex);
    water.position.set(-700, W);
    water.width = 3000;
    water.height = 330;
    layer.addChild(water);

    // Spiegelung: gespiegelte Kopien von Bergen, Hügel, Teehaus, Brücke
    const refl = this.reflection;
    const mirror = new Container();
    mirror.scale.y = -1;
    mirror.position.y = 2 * W;
    for (const src of this.mirrorSources) {
      const n = new Container();
      src.build(n);
      mirror.addChild(ctx.tint(n, src.kind));
    }
    if (this.mirrorHill) {
      const n = new Container();
      this.mirrorHill(n);
      mirror.addChild(ctx.tint(n, 'mid'));
    }
    const rb = buildBridge(ctx);
    mirror.addChild(rb.node);
    refl.addChild(mirror);
    refl.alpha = 0.62;
    const mask = new Graphics().rect(-700, W, 3000, 330).fill(0xffffff);
    refl.addChild(mask);
    refl.mask = mask;
    layer.addChild(refl);

    // Verschiebungsfilter für lebendige Spiegelung
    this.dispSprite = new Sprite(rippleTexture(256));
    this.dispSprite.width = 3400;
    this.dispSprite.height = 700;
    this.dispSprite.position.set(-900, W - 200);
    layer.addChild(this.dispSprite);
    this.dispSprite.renderable = false;
    this.reflectionFilter = new DisplacementFilter({ sprite: this.dispSprite, scale: { x: 16, y: 7 } });
    refl.filters = [this.reflectionFilter];

    // Tiefenverlauf über der Spiegelung (Spiegelung blendet nach unten aus)
    const fade = new Sprite(
      gradientTex(
        [
          [0, 'rgba(255,255,255,0)'],
          [1, 'rgba(255,255,255,0.9)'],
        ],
        32,
      ),
    );
    fade.position.set(-700, W);
    fade.width = 3000;
    fade.height = 330;
    this.fadeSprite = fade;
    layer.addChild(fade);

    // Sonnenglitzern
    this.sunStreak.texture = this.ctx.glow;
    this.sunStreak.anchor.set(0.5, 0);
    this.sunStreak.blendMode = 'add';
    this.sunStreak.position.set(1000, W);
    this.sunStreak.scale.set(1.0, 2.6);
    layer.addChild(this.sunStreak);

    // Koi unter der Brücke
    const koiCols = [0xe8642a, 0xf2a03a, 0xdd4a2a];
    for (let i = 0; i < 3; i++) {
      const k = buildKoi(
        760 + (i - 1) * 90,
        800 + (i % 2) * 18,
        230 - i * 40,
        34,
        0.35 + i * 0.08,
        i * 2.1,
        koiCols[i]!,
      );
      k.node.alpha = 0.85;
      layer.addChild(k.node);
      this.koi.push(k);
    }

    // Glitzerlinien
    const gr = mulberry32(31);
    for (let i = 0; i < 46; i++) {
      const g = new Graphics();
      const w = rand(gr, 12, 60);
      g.moveTo(-w / 2, 0)
        .lineTo(w / 2, 0)
        .stroke({ width: 1.6, color: 0xffffff, alpha: 1, cap: 'round' });
      g.position.set(rand(gr, -100, 1700), rand(gr, W + 8, 900));
      layer.addChild(g);
      this.glints.push({ g, phase: gr() * TAU, base: rand(gr, 0.15, 0.4) });
    }

    // Ufer, Weide, Lotos
    const bl = buildBank(41, -1);
    const br = buildBank(42, 1);
    layer.addChild(ctx.tint(bl, 'near'), ctx.tint(br, 'near'));
    const willow = buildWillow(51);
    willow.node.position.set(250, 735);
    layer.addChild(ctx.tint(willow.node, 'near'));
    this.frondSets = willow.fronds;
    for (const [x, y, s] of [
      [480, 830, 1],
      [1040, 850, 1.2],
      [1260, 770, 0.8],
      [150, 900, 1.3],
    ] as const) {
      const l = buildLotus(Math.floor(x));
      l.position.set(x, y);
      l.scale.set(s);
      layer.addChild(ctx.tint(l, 'near'));
    }

    // Brücke (Original)
    const b = buildBridge(ctx);
    layer.addChild(b.node);
    this.lanternNodes.push(...b.lanterns);
  }

  private fadeSprite!: Sprite;

  // ───────────────────────────── Bambus mittlere Ebene
  private buildMidBamboo(layer: Container): void {
    const ctx = this.ctx;
    const common = {
      stalk: 0x4b7a3a,
      stalkLight: 0x7aa456,
      node: 0x2f5128,
      leafColors: [0x4f8a3c, 0x6aa24a, 0x3d7032],
      leafSize: 62,
    };
    const l = buildGrove({
      ...common,
      seed: 61,
      count: 7,
      x0: -60,
      x1: 400,
      baseY: 760,
      height: [520, 760],
      width: [16, 22],
    });
    const r = buildGrove({
      ...common,
      seed: 62,
      count: 6,
      x0: 1330,
      x1: 1700,
      baseY: 770,
      height: [500, 740],
      width: [16, 22],
    });
    layer.addChild(ctx.tint(l.node, 'near'), ctx.tint(r.node, 'near'));
    this.stalks.push(...l.stalks, ...r.stalks);
  }

  // ───────────────────────────── Vordergrund
  private buildForeground(layer: Container): void {
    const ctx = this.ctx;
    const common = {
      stalk: 0x2c5230,
      stalkLight: 0x4d7d45,
      node: 0x15301a,
      leafColors: [0x2e6b34, 0x3f8140, 0x24552b],
      leafSize: 120,
    };
    const l = buildGrove({
      ...common,
      seed: 71,
      count: 4,
      x0: -140,
      x1: 190,
      baseY: 960,
      height: [900, 1200],
      width: [34, 46],
    });
    const r = buildGrove({
      ...common,
      seed: 72,
      count: 3,
      x0: 1560,
      x1: 1760,
      baseY: 960,
      height: [900, 1150],
      width: [32, 44],
    });
    layer.addChild(ctx.tint(l.node, 'near'), ctx.tint(r.node, 'near'));
    this.stalks.push(...l.stalks, ...r.stalks);

    // Pflaumenzweig oben rechts mit Laterne und Elster
    const { node, spots } = buildBlossomBranch(81);
    this.fgBranch.addChild(node);
    this.blossomSpots = spots;
    layer.addChild(ctx.tint(this.fgBranch, 'near'));

    const lant = this.fgLantern;
    lant.position.set(1400, 268);
    const lg = new Graphics();
    lg.moveTo(0, -30).lineTo(0, 0).stroke({ width: 2, color: 0x3a2418 });
    lg.ellipse(0, 26, 22, 28).fill(0xc9301f);
    for (let i = -1; i <= 1; i++)
      lg.moveTo(i * 8, 0)
        .quadraticCurveTo(i * 20, 26, i * 8, 54)
        .stroke({ width: 1.3, color: 0x7a1a10, alpha: 0.6 });
    lg.rect(-11, -2, 22, 5).fill(0xd9a94a);
    lg.rect(-9, 52, 18, 5).fill(0xd9a94a);
    lg.moveTo(0, 57).lineTo(0, 80).stroke({ width: 2, color: 0xd9a94a });
    lg.moveTo(-4, 80).lineTo(4, 80).stroke({ width: 4, color: 0xd9a94a });
    lant.addChild(lg);
    const lt = new Text({ text: '福', style: { fontFamily: FONT_BRUSH, fontSize: 26, fill: 0xf3d58a } });
    lt.anchor.set(0.5);
    lt.position.set(0, 27);
    lant.addChild(lt);
    const glow = new Sprite(ctx.glow);
    glow.anchor.set(0.5);
    glow.position.set(0, 27);
    glow.scale.set(2.4);
    glow.tint = 0xffa23a;
    glow.blendMode = 'add';
    ctx.lit(glow, 0.0, 0.9);
    lant.addChild(glow);
    layer.addChild(lant);
    this.lanternNodes.push(lant);

    this.magpie.position.set(this.magpieSpot.x, this.magpieSpot.y);
    this.magpie.scale.x = 1;
    layer.addChild(ctx.tint(this.magpie, 'near'));
    // Vogelschwarm läuft in der Himmelsebene weit hinten
    this.layers[0]!.node.addChild(this.flock.node);
  }

  // ───────────────────────────── Paletten & Kamera
  applyPalette(p: Palette): void {
    this.ctx.apply(p);
    // Himmel
    const c = this.skyCanvas.getContext('2d')!;
    const g = c.createLinearGradient(0, 0, 0, 256);
    const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');
    g.addColorStop(0, hex(p.skyTop));
    g.addColorStop(0.55, hex(p.skyMid));
    g.addColorStop(0.88, hex(p.skyBottom));
    g.addColorStop(1, hex(p.skyBottom));
    c.fillStyle = g;
    c.fillRect(0, 0, 2, 256);
    this.skyTex.source.update();
    // Wasser
    const wc = this.waterCanvas.getContext('2d')!;
    const wg = wc.createLinearGradient(0, 0, 0, 128);
    wg.addColorStop(0, hex(p.skyBottom));
    wg.addColorStop(0.18, hex(p.water));
    wg.addColorStop(1, hex(p.water));
    wc.fillStyle = wg;
    wc.fillRect(0, 0, 2, 128);
    this.waterTex.source.update();
    this.fadeSprite.tint = p.water;

    // Sonne
    const sunA = clamp(p.sunGlow);
    this.sunGlow1.position.set(p.sunX, p.sunY);
    this.sunGlow2.position.set(p.sunX, p.sunY);
    this.sunGlow1.tint = p.sunColor;
    this.sunGlow2.tint = p.sunColor;
    this.sunGlow1.alpha = 0.5 * sunA;
    this.sunGlow2.alpha = 0.9 * sunA;
    this.sunDisc.position.set(p.sunX, p.sunY);
    this.sunDisc.tint = p.sunColor;
    this.sunDisc.alpha = clamp(sunA * 2);
    // Mond und Sterne
    this.moon.position.set(p.moonX, p.moonY);
    this.moon.alpha = p.moonAlpha;
    this.stars.alpha = p.starAlpha;
    // Nebel
    for (const m of this.mists) {
      m.s.tint = p.haze;
      m.s.alpha = p.hazeAlpha * 0.85;
    }
    // Sonnenglitzern auf dem Wasser
    this.sunStreak.position.x = p.sunX;
    this.sunStreak.tint = p.sunColor;
    this.sunStreak.alpha = sunA * 0.45 * (p.sunY < 640 ? 1 : 0.2);
    this.sunStreak.scale.set(1.1 + sunA * 0.5, 2.6);
  }

  applyCamera(cam: CamState, mx: number, my: number): void {
    for (const l of this.layers) {
      const s = cam.uniform ?? 1 + (cam.zoom - 1) * l.k;
      const sh = cam.p * (cam.uniform !== null ? 1 : Math.min(1, l.shift));
      l.node.scale.set(s);
      l.node.pivot.set(cam.fx, cam.fy);
      l.node.position.set(
        cam.fx + (cam.cx - cam.fx) * sh + mx * l.par,
        cam.fy + (cam.cy - cam.fy) * sh + my * l.par * 0.5,
      );
    }
  }

  setOutdoor(visible: boolean): void {
    this.teahouse.node.visible = visible;
  }

  update(dt: number, time: number, p: Palette): void {
    this.time = time;
    // Wind: sanfte Böen
    this.wind = 0.3 + Math.max(0, Math.sin(time * 0.13)) * 0.9 + Math.max(0, Math.sin(time * 0.31 + 2)) * 0.4;
    swayStalks(this.stalks, time, this.wind);
    for (const f of this.frondSets)
      f.c.rotation = Math.sin(time * 0.6 + f.phase) * 0.05 * (0.6 + this.wind * 0.5);
    this.fgBranch.rotation = Math.sin(time * 0.5) * 0.004 * this.wind;
    this.fgBranch.position.set(0, 0);
    this.fgLantern.rotation = Math.sin(time * 0.8 + 1) * 0.05 * (0.5 + this.wind);
    // Fahne
    this.flagNode.skew.y = Math.sin(time * 2.4) * 0.07 * (0.5 + this.wind * 0.4);
    this.flagNode.scale.x = 0.96 + Math.sin(time * 2.4 + 1) * 0.04;
    // Laternen schaukeln
    for (let i = 0; i < this.lanternNodes.length; i++) {
      const l = this.lanternNodes[i]!;
      if (l === this.fgLantern) continue;
      l.rotation = Math.sin(time * 1.2 + i) * 0.03 * (0.4 + this.wind * 0.6);
    }
    // Wolken & Nebel
    for (const c of this.clouds) {
      c.base += c.speed * dt;
      if (c.base > 2100) c.base = -500;
      c.c.x = c.base;
    }
    for (const m of this.mists) m.s.x = m.base + Math.sin(time * m.speed + m.phase) * m.amp;
    // Sterne funkeln
    for (const t of this.twinkles) t.s.alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 1.7 + t.phase));
    // Wasser
    this.dispSprite.x = -900 + Math.sin(time * 0.35) * 90;
    this.dispSprite.y = WATERLINE - 200 + Math.cos(time * 0.27) * 50;
    for (const k of this.koi) updateKoi(k, time);
    for (const g of this.glints)
      g.g.alpha = clamp(
        g.base * (0.4 + 0.6 * Math.sin(time * 1.3 + g.phase)) * (0.4 + p.sunGlow * 1.0 + p.moonAlpha * 0.6),
      );
    this.sunStreak.alpha *= 0.92 + Math.sin(time * 3.1) * 0.08;
    // Vögel: gelegentlich ein Schwarm
    if (!this.flock.active) {
      this.nextFlock -= dt;
      if (this.nextFlock <= 0 && p.moonAlpha < 0.6) {
        this.flock.launch(rand(this.flockRng, 110, 300), rand(this.flockRng, 45, 75));
        this.nextFlock = rand(this.flockRng, 35, 70);
      }
    }
    this.flock.update(dt);
    // Elster
    if (this.magpiePerched) {
      this.magpie.y = this.magpieSpot.y + Math.sin(time * 1.8) * 0.8;
      this.magpie.rotation = Math.sin(time * 0.9) * 0.02;
    } else {
      this.magpieFly += dt;
      const f = this.magpieFly;
      this.magpie.x = this.magpieSpot.x - f * 220;
      this.magpie.y = this.magpieSpot.y - f * 120 + Math.sin(f * 14) * 6 - f * f * 20;
      this.magpie.rotation = -0.3 + Math.sin(f * 14) * 0.1;
      this.magpie.alpha = clamp(1 - (f - 2.2) / 1.2);
      if (f > 3.6) this.magpie.visible = false;
    }
  }

  /** Elster fliegt weg (Easter Egg). Gibt false zurück, wenn sie schon weg ist. */
  scareMagpie(): boolean {
    if (!this.magpiePerched) return false;
    this.magpiePerched = false;
    this.magpieFly = 0;
    return true;
  }

  /** Für den Blick aus dem Fenster: Elster auf eine sichtbare Blüte setzen. */
  placeMagpieForRoom(): void {
    const toScreen = (x: number, y: number): { sx: number; sy: number } => ({
      sx: 800 + 0.85 * (x - 800),
      sy: 500 + 0.85 * (y - 720),
    });
    let best: [number, number] | null = null;
    let bestScore = Infinity;
    for (const [x, y] of this.blossomSpots) {
      const { sx, sy } = toScreen(x, y);
      if (sx < 1120 || sx > 1330 || sy < 150) continue;
      const score = Math.abs(sy - 215) + Math.abs(sx - 1230) * 0.2;
      if (score < bestScore) {
        bestScore = score;
        best = [x, y];
      }
    }
    const [bx, by] = best ?? [1460, 330];
    this.magpieSpot.x = bx + 6;
    this.magpieSpot.y = by - 8;
    this.resetMagpie();
  }

  /** Elster kehrt später zurück. */
  resetMagpie(): void {
    this.magpiePerched = true;
    this.magpie.visible = true;
    this.magpie.alpha = 1;
    this.magpie.position.set(this.magpieSpot.x, this.magpieSpot.y);
  }

  setReflectionQuality(on: boolean): void {
    this.reflection.filters = on && this.reflectionFilter ? [this.reflectionFilter] : [];
  }

  get timeNow(): number {
    return this.time;
  }
}
