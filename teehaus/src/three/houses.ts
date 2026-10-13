// Baukasten für die Dorfhäuser (nur von außen): Sockel, Wand mit Papierfenstern, Tür, Säulen, Dächer (Walm-,
// Sattel-, Krüppelwalmdach, Vordach), Dachreiter, Geländer, Schilder, Vorhänge, Laternen und Kleinkram vor dem
// Haus. Farben und Materialien sind dieselben wie am Teehaus, damit alles wie aus einem Guss wirkt.
// Jedes Haus hat zwei Stufen: nah (volle Fassade, pro Material zusammengefasst) und fern (ein einfaches Mesh).
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
} from 'three';
import type { Material } from 'three';
import { Batcher, M } from '../world/cafe';
import { vinyl } from '../world/materials';
import { Baker } from './geo';
import { rng } from './noise';
import { FONT_BRUSH } from './shared';
import { paperTexture } from './textures';

// ───────────────────────────────────────── Materialien (geteilt mit dem Teehaus)

/** Papier der Fenster: leuchtet abends warm (Helligkeit setzt die Welt je nach Tageszeit) */
export const HOUSE_PAPER = new MeshStandardMaterial({
  color: '#f4ead6',
  emissive: new Color('#ffcf8a'),
  emissiveIntensity: 0.3,
  roughness: 0.9,
  side: DoubleSide,
});

const mats = (): Record<string, Material> => {
  if (!HOUSE_PAPER.map) HOUSE_PAPER.map = paperTexture();
  return {
    lac: M.lacquer(),
    dw: M.darkWood(),
    mw: M.midWood(),
    pl: M.plaster(),
    stone: M.stone(),
    gold: M.gold(),
    tile: TILE,
    fascia: FASCIA,
    paper: HOUSE_PAPER,
    green: vinyl('#3f6b5a', { rough: 0.5 }),
    indigo: vinyl('#2f4a74', { rough: 0.9, rim: 0.3 }),
    cloth: vinyl('#d9cdb4', { rough: 1, rim: 0.2 }),
    straw: vinyl('#b89a5c', { rough: 1, rim: 0.2 }),
    iron: vinyl('#3a3a3a', { rough: 0.5, metal: 0.4 }),
    ceramic: vinyl('#3a5f7a', { rough: 0.3 }),
    redCloth: vinyl('#b3261a', { rough: 0.9 }),
  };
};
const TILE = new MeshStandardMaterial({
  color: '#3d4148',
  roughness: 0.6,
  flatShading: true,
  side: DoubleSide,
});
const FASCIA = new MeshStandardMaterial({ color: '#7a2016', roughness: 0.5, side: DoubleSide });

// ───────────────────────────────────────── Schilder (Pinselschrift auf Holz)

const signCache = new Map<string, MeshStandardMaterial>();
/** Schild: dunkles Holz mit Goldrand und Goldschrift; senkrecht für Türstreifen (Reimpaare) */
export function signMat(text: string, kind: 'board' | 'couplet' | 'cloth' = 'board'): MeshStandardMaterial {
  const key = `${kind}:${text}`;
  let m = signCache.get(key);
  if (m) return m;
  const vertical = kind === 'couplet' || kind === 'cloth';
  const n = Array.from(text).length;
  const c = document.createElement('canvas');
  c.width = vertical ? 96 : Math.max(192, n * 128);
  c.height = vertical ? Math.max(192, n * 120) : 160;
  const g = c.getContext('2d')!;
  g.fillStyle = kind === 'couplet' ? '#b3261a' : kind === 'cloth' ? '#2f4a74' : '#2a1a10';
  g.fillRect(0, 0, c.width, c.height);
  if (kind === 'board') {
    g.strokeStyle = '#d4a54a';
    g.lineWidth = 8;
    g.strokeRect(8, 8, c.width - 16, c.height - 16);
  }
  g.fillStyle = kind === 'cloth' ? '#f1ead8' : '#e8c06a';
  g.font = `${vertical ? 74 : 112}px ${FONT_BRUSH}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  Array.from(text).forEach((ch, i) => {
    if (vertical) g.fillText(ch, 48, 60 + i * 120 + (c.height - n * 120) / 2);
    else g.fillText(ch, (c.width / n) * (i + 0.5), 86);
  });
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  m = new MeshStandardMaterial({
    map: t,
    roughness: 0.6,
    emissive: new Color(kind === 'board' ? '#3a2408' : '#000000'),
    emissiveIntensity: 0.4,
  });
  signCache.set(key, m);
  return m;
}

// ───────────────────────────────────────── Dächer

import type { RoofKind } from '../world/village';
export type { RoofKind };

/**
 * Geschwungenes Ziegeldach als Höhenfeld (wie am Teehaus): Halbbreite W (x), Halbtiefe D (z), Höhe H.
 * hip: Walmdach mit hochgezogenen Ecken; gable: Satteldach (Giebel an den Seiten); xieshan: Walm unten,
 * Giebel oben (歇山).
 */
function roofHeight(kind: RoofKind, W: number, D: number, H: number): (x: number, z: number) => number {
  return (x, z) => {
    const ax = Math.abs(x);
    const az = Math.abs(z);
    let s: number;
    if (kind === 'gable') s = Math.max(0, (D - az) / D);
    else if (kind === 'hip') s = Math.max(0, Math.min((D - az) / D, (W - ax) / D));
    else s = Math.max(0, Math.min((D - az) / D, (W - ax) / (D * 0.55)));
    let y = H * Math.pow(s, 1.45);
    if (kind === 'xieshan') y = Math.min(y, H * Math.pow(Math.max(0, (D - az) / D), 1.45));
    const ex = ax / W;
    const ez = az / D;
    // hochgezogene Traufe an den Ecken
    const m = kind === 'gable' ? ex : Math.min(ex, ez);
    y +=
      (H / 3.2) *
      Math.pow(m > 0.62 ? Math.min(1, (m - 0.62) / 0.38) : 0, 2.2) *
      (kind === 'gable' ? ez * 0.8 : 1);
    y += 0.1 * (kind === 'gable' ? Math.pow(ez, 8) * 0.5 : Math.pow(ex, 8) + Math.pow(ez, 8));
    // Ziegelreihen
    y += 0.03 * Math.sin((x / 0.26) * Math.PI) * Math.min(1, s * 6);
    return y;
  };
}

/** Dachfläche, Unterseite, roter Traufbalken, First mit Dachreitern */
function roof(
  B: Batcher,
  mt: Record<string, Material>,
  kind: RoofKind,
  W: number,
  D: number,
  H: number,
  y0: number,
  cz = 0,
): void {
  const height = roofHeight(kind, W, D, H);
  const seg = Math.max(16, Math.round(W * 7));
  const top = new PlaneGeometry(W * 2, D * 2, seg, Math.max(10, Math.round(D * 7))).rotateX(-Math.PI / 2);
  const p = top.attributes.position as BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
  top.computeVertexNormals();
  B.add(top, mt.tile!, [0, y0, cz]);
  const under = top.clone();
  const up = under.attributes.position as BufferAttribute;
  for (let i = 0; i < up.count; i++) up.setY(i, up.getY(i) - 0.16);
  under.computeVertexNormals();
  B.add(under, mt.dw!, [0, y0, cz]);
  // Traufbalken rundum
  const ring: [number, number][] = [];
  const N = 40;
  for (let i = 0; i < N; i++) ring.push([-W + (2 * W * i) / N, D]);
  for (let i = 0; i < N; i++) ring.push([W, D - (2 * D * i) / N]);
  for (let i = 0; i < N; i++) ring.push([W - (2 * W * i) / N, -D]);
  for (let i = 0; i < N; i++) ring.push([-W, -D + (2 * D * i) / N]);
  const v: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]!;
    const [bx, bz] = ring[(i + 1) % ring.length]!;
    const ay = height(ax, az);
    const by = height(bx, bz);
    v.push(ax, ay, az, ax, ay - 0.16, az, bx, by, bz, bx, by, bz, ax, ay - 0.16, az, bx, by - 0.16, bz);
  }
  const fg = new BufferGeometry();
  fg.setAttribute('position', new BufferAttribute(new Float32Array(v), 3));
  fg.computeVertexNormals();
  B.add(fg, mt.fascia!, [0, y0, cz]);
  // First und Dachreiter
  const ridgeLen =
    kind === 'hip'
      ? Math.max(0.6, (W - D) * 2 + 0.4)
      : kind === 'xieshan'
        ? Math.max(0.6, (W - D * 0.55) * 2 - 0.5)
        : W * 2 - 0.6;
  B.box(ridgeLen, 0.2, 0.24, mt.tile!, 0, y0 + H, cz);
  for (const s of [-1, 1]) {
    B.add(
      new TorusGeometry(0.15, 0.045, 5, 8, Math.PI * 1.2),
      mt.tile!,
      [(s * ridgeLen) / 2, y0 + H + 0.24, cz],
      [0, 0, s > 0 ? -0.4 : Math.PI + 0.4],
    );
  }
  // Giebeldreiecke (Satteldach und 歇山)
  if (kind !== 'hip') {
    const gx = kind === 'gable' ? W - 0.35 : W - D * 0.55 + 0.05;
    const gh = kind === 'gable' ? H : height(gx, 0) - height(gx, D * 0.7);
    const gd = kind === 'gable' ? D - 0.5 : D * 0.7;
    const baseY = kind === 'gable' ? 0 : height(gx, D * 0.7);
    for (const s of [-1, 1]) {
      const tri = new BufferGeometry();
      tri.setAttribute(
        'position',
        new BufferAttribute(new Float32Array([0, 0, -gd, 0, 0, gd, 0, gh * 0.92, 0]), 3),
      );
      tri.computeVertexNormals();
      B.add(tri, mt.pl!, [s * gx, y0 + baseY - 0.05, cz]);
      B.add(new BoxGeometry(0.06, 0.08, gd * 2), mt.dw!, [s * (gx + 0.01), y0 + baseY - 0.02, cz]);
    }
  }
}

/** Vordach über Tür oder Ladenfront (einfaches Pultdach mit Ziegeln) */
function awning(
  B: Batcher,
  mt: Record<string, Material>,
  w: number,
  x: number,
  y: number,
  z: number,
  depth = 0.9,
): void {
  const g = new PlaneGeometry(w, depth, Math.round(w * 6), 2).rotateX(-Math.PI / 2 + 0.38);
  const p = g.attributes.position as BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.025 * Math.sin((p.getX(i) / 0.26) * Math.PI));
  g.computeVertexNormals();
  B.add(g, mt.tile!, [x, y, z + depth * 0.42]);
  B.box(w, 0.1, 0.06, mt.fascia!, x, y - Math.sin(0.38) * depth * 0.5 - 0.04, z + depth * 0.88);
  for (const s of [-1, 1])
    B.box(0.06, 0.06, depth, mt.dw!, x + s * (w / 2 - 0.1), y - 0.18, z + depth * 0.45);
}

// ───────────────────────────────────────── Wand, Fenster, Tür

/** Was in einem Wandfeld sitzt */
export type Bay = 'win' | 'door' | 'plain' | 'open' | 'shutter';

interface WallOpts {
  /** Geschosshöhe */
  h: number;
  /** Feldfolge (von links nach rechts von außen gesehen) */
  bays: Bay[];
}

/** Fassade entlang x bei z = fz (nach +z), von x0 bis x1, ab Höhe y0 */
function facade(
  B: Batcher,
  mt: Record<string, Material>,
  x0: number,
  x1: number,
  fz: number,
  y0: number,
  o: WallOpts,
  dir = 1,
): void {
  const len = x1 - x0;
  const n = o.bays.length;
  const bw = len / n;
  const H = o.h;
  const T = 0.2;
  const z = fz - (dir * T) / 2;
  // Schwelle, Rähm
  B.box(len + 0.1, 0.1, T + 0.06, mt.dw!, (x0 + x1) / 2, y0 + 0.05, z);
  B.box(len + 0.1, 0.14, T + 0.08, mt.dw!, (x0 + x1) / 2, y0 + H - 0.07, z);
  for (let i = 0; i <= n; i++) B.box(0.16, H, T + 0.08, mt.dw!, x0 + i * bw, y0 + H / 2, z);
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i + 0.5) * bw;
    const w = bw - 0.16;
    const bay = o.bays[i]!;
    const face = fz + dir * 0.005;
    if (bay === 'open') continue;
    if (bay === 'plain' || bay === 'win' || bay === 'shutter') {
      // unten Holzpaneel, oben Putz
      B.box(w, 0.8, T, mt.mw!, cx, y0 + 0.4, z);
      B.box(w, 0.05, T + 0.04, mt.dw!, cx, y0 + 0.82, z);
      const topH = H - 0.85;
      if (bay === 'plain') {
        B.box(w, topH, T, mt.pl!, cx, y0 + 0.85 + topH / 2, z);
        continue;
      }
      const wh = Math.min(1.3, topH - 0.45);
      const wy = y0 + 0.85 + 0.15 + wh / 2;
      // Putz um das Fenster
      B.box(w, topH - wh - 0.15, T, mt.pl!, cx, y0 + 0.85 + 0.15 + wh + (topH - wh - 0.15) / 2, z);
      B.box(w, 0.15, T, mt.pl!, cx, y0 + 0.925, z);
      if (bay === 'shutter') {
        // geschlossene Holzläden
        B.box(w - 0.04, wh, 0.06, mt.mw!, cx, wy, face);
        for (let k = 1; k < 6; k++)
          B.box(w - 0.04, 0.025, 0.08, mt.dw!, cx, wy - wh / 2 + (wh * k) / 6, face);
        B.box(0.03, wh, 0.08, mt.dw!, cx, wy, face);
        continue;
      }
      B.add(new PlaneGeometry(w, wh), mt.paper!, [cx, wy, fz - (dir * T) / 2], [0, dir > 0 ? 0 : Math.PI, 0]);
      const cols = Math.max(2, Math.round(w / 0.28));
      for (let k = 1; k < cols; k++) B.box(0.03, wh, 0.05, mt.dw!, cx - w / 2 + (w * k) / cols, wy, face);
      for (let k = 1; k < 5; k++) B.box(w, 0.03, 0.05, mt.dw!, cx, wy - wh / 2 + (wh * k) / 5, face);
      B.box(w + 0.06, 0.06, 0.08, mt.dw!, cx, wy - wh / 2 - 0.02, face + dir * 0.02);
      continue;
    }
    // Tür: zwei Flügel, Lack, Goldnägel; darüber Putz
    const dh = Math.min(2.2, H - 0.3);
    B.box(w, H - dh, T, mt.pl!, cx, y0 + dh + (H - dh) / 2, z);
    B.box(w + 0.04, 0.1, T + 0.08, mt.dw!, cx, y0 + dh, z);
    for (const s of [-1, 1]) {
      B.box(w / 2 - 0.02, dh - 0.05, 0.08, mt.lac!, cx + (s * w) / 4, y0 + dh / 2, z);
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 2; c++)
          B.add(new SphereGeometry(0.025, 5, 4), mt.gold!, [
            cx + (s * w) / 4 + (c - 0.5) * 0.18,
            y0 + dh * (0.35 + r * 0.18),
            fz + dir * 0.04,
          ]);
      B.add(new TorusGeometry(0.05, 0.012, 4, 8), mt.gold!, [cx + s * 0.08, y0 + dh * 0.5, fz + dir * 0.05]);
    }
  }
}

// ───────────────────────────────────────── Säulen, Geländer, Laternen

function pillar(
  B: Batcher,
  mt: Record<string, Material>,
  x: number,
  z: number,
  y0: number,
  h: number,
  r = 0.12,
): void {
  B.add(new CylinderGeometry(r, r * 1.08, h, 10), mt.lac!, [x, y0 + h / 2, z]);
  B.add(new CylinderGeometry(r * 1.6, r * 1.75, 0.12, 10), mt.stone!, [x, y0 + 0.06, z]);
  B.add(new CylinderGeometry(r * 1.3, r * 1.2, 0.1, 10), mt.gold!, [x, y0 + h - 0.2, z]);
}

function railing(
  B: Batcher,
  mt: Record<string, Material>,
  x0: number,
  x1: number,
  z: number,
  y0: number,
): void {
  for (let x = x0; x <= x1 + 0.01; x += 0.5)
    B.add(new CylinderGeometry(0.035, 0.04, 0.7, 6), mt.lac!, [x, y0 + 0.35, z]);
  B.box(x1 - x0, 0.06, 0.07, mt.lac!, (x0 + x1) / 2, y0 + 0.7, z);
  B.box(x1 - x0, 0.04, 0.05, mt.lac!, (x0 + x1) / 2, y0 + 0.35, z);
  // Zierfüllung zwischen den Stäben
  for (let x = x0 + 0.25; x < x1; x += 0.5) B.box(0.26, 0.2, 0.03, mt.dw!, x, y0 + 0.52, z);
}

const LANTERN_GEO = new LatheGeometry(
  Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    return new Vector2(0.06 + Math.sin(t * Math.PI) * 0.17, t * 0.44 - 0.22);
  }),
  10,
);
/** Rote Laterne ohne Lichtquelle (leuchtet über das Material) */
export const LANTERN_MAT = new MeshStandardMaterial({
  color: '#c0281c',
  emissive: new Color('#ff5a2a'),
  emissiveIntensity: 0.6,
  roughness: 0.6,
});
function lantern(B: Batcher, mt: Record<string, Material>, x: number, y: number, z: number, s = 1): void {
  B.add(LANTERN_GEO, LANTERN_MAT, [x, y, z], [0, 0, 0], [s, s, s]);
  B.add(new CylinderGeometry(0.075, 0.085, 0.045, 8), mt.gold!, [x, y + 0.23 * s, z], [0, 0, 0], [s, s, s]);
  B.add(new CylinderGeometry(0.075, 0.085, 0.045, 8), mt.gold!, [x, y - 0.23 * s, z], [0, 0, 0], [s, s, s]);
  B.add(new ConeGeometry(0.03, 0.18, 6), mt.lac!, [x, y - 0.36 * s, z], [Math.PI, 0, 0], [s, s, s]);
  B.add(new CylinderGeometry(0.006, 0.006, 0.3, 4), mt.dw!, [x, y + 0.38 * s, z]);
}

// ───────────────────────────────────────── Kleinkram vor dem Haus

function sign(
  B: Batcher,
  text: string,
  kind: 'board' | 'couplet' | 'cloth',
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  ry = 0,
): void {
  B.add(new PlaneGeometry(w, h), signMat(text, kind), [x, y, z], [0, ry, 0]);
}

function barrel(B: Batcher, mt: Record<string, Material>, x: number, z: number, y0 = 0, s = 1): void {
  B.add(new CylinderGeometry(0.28 * s, 0.24 * s, 0.7 * s, 10), mt.mw!, [x, y0 + 0.35 * s, z]);
  for (const k of [0.15, 0.55])
    B.add(new TorusGeometry(0.27 * s, 0.015, 4, 12), mt.iron!, [x, y0 + k * s, z], [Math.PI / 2, 0, 0]);
}
function basket(B: Batcher, mt: Record<string, Material>, x: number, z: number, y0 = 0, s = 1): void {
  B.add(new CylinderGeometry(0.24 * s, 0.17 * s, 0.32 * s, 10, 1, true), mt.straw!, [x, y0 + 0.16 * s, z]);
  B.add(new CylinderGeometry(0.2 * s, 0.2 * s, 0.03, 10), mt.green!, [x, y0 + 0.28 * s, z]);
}
function woodpile(B: Batcher, mt: Record<string, Material>, x: number, z: number, ry = 0): void {
  const r = rng(Math.round(x * 13 + z * 7));
  for (let row = 0; row < 4; row++)
    for (let k = 0; k < 6 - row; k++) {
      const lx = (k - (5 - row) / 2) * 0.17;
      const ly = 0.08 + row * 0.15;
      const c = Math.cos(ry);
      const sn = Math.sin(ry);
      B.add(
        new CylinderGeometry(0.075, 0.075, 0.9 + r() * 0.1, 6),
        r() < 0.5 ? mt.mw! : mt.dw!,
        [x + lx * c, ly, z - lx * sn],
        [Math.PI / 2, ry, 0],
      );
    }
}
function bench(B: Batcher, mt: Record<string, Material>, x: number, z: number, ry = 0, w = 1.4): void {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  B.add(new BoxGeometry(w, 0.07, 0.36), mt.mw!, [x, 0.45, z], [0, ry, 0]);
  for (const d of [-w / 2 + 0.12, w / 2 - 0.12])
    B.add(new BoxGeometry(0.08, 0.45, 0.32), mt.dw!, [x + d * c, 0.22, z - d * s], [0, ry, 0]);
}
function cart(B: Batcher, mt: Record<string, Material>, x: number, z: number, ry = 0): void {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const at = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
  const [bx, bz] = at(0, 0);
  B.add(new BoxGeometry(1.1, 0.35, 0.8), mt.mw!, [bx, 0.62, bz], [0, ry, 0]);
  for (const sd of [-1, 1]) {
    const [wx, wz] = at(0, sd * 0.47);
    B.add(new TorusGeometry(0.36, 0.04, 5, 14), mt.dw!, [wx, 0.38, wz], [0, ry, 0]);
    B.add(new CylinderGeometry(0.02, 0.02, 0.7, 4), mt.dw!, [wx, 0.38, wz], [0, ry, Math.PI / 2]);
    const [hx, hz] = at(1.05, sd * 0.3);
    B.add(new BoxGeometry(1.2, 0.05, 0.05), mt.dw!, [hx, 0.56, hz], [0, ry, 0.15]);
  }
  basket(B, mt, ...at(-0.2, 0), 0.8, 0.8);
}
function bicycle(B: Batcher, mt: Record<string, Material>, x: number, z: number, ry = 0): void {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  for (const d of [-0.5, 0.5])
    B.add(new TorusGeometry(0.32, 0.025, 4, 16), mt.iron!, [x + d * c, 0.33, z - d * s], [0, ry, 0]);
  B.add(new CylinderGeometry(0.018, 0.018, 1.0, 4), mt.green!, [x, 0.55, z], [0, ry, Math.PI / 2 - 0.15]);
  B.add(
    new CylinderGeometry(0.018, 0.018, 0.55, 4),
    mt.green!,
    [x - 0.15 * c, 0.6, z + 0.15 * s],
    [0, ry, 0.35],
  );
  B.add(new BoxGeometry(0.2, 0.04, 0.1), mt.dw!, [x - 0.25 * c, 0.86, z + 0.25 * s], [0, ry, 0]);
  B.add(new BoxGeometry(0.04, 0.04, 0.45), mt.iron!, [x + 0.42 * c, 0.92, z - 0.42 * s], [0, ry, 0]);
}
function laundry(B: Batcher, mt: Record<string, Material>, x0: number, x1: number, z: number): void {
  for (const x of [x0, x1]) B.add(new CylinderGeometry(0.04, 0.05, 2.0, 6), mt.dw!, [x, 1.0, z]);
  B.box(x1 - x0, 0.015, 0.015, mt.dw!, (x0 + x1) / 2, 1.9, z);
  const cols = [mt.indigo!, mt.cloth!, mt.redCloth!, mt.cloth!];
  const n = Math.floor((x1 - x0 - 0.4) / 0.6);
  for (let i = 0; i < n; i++)
    for (const ry of [0, Math.PI])
      B.add(
        new PlaneGeometry(0.45, 0.6 + (i % 2) * 0.15),
        cols[i % cols.length]!,
        [x0 + 0.4 + i * 0.6, 1.55 - (i % 2) * 0.07, z],
        [0, ry, 0],
      );
}
function pot(B: Batcher, mt: Record<string, Material>, x: number, z: number, s = 1): void {
  B.add(new CylinderGeometry(0.22 * s, 0.16 * s, 0.35 * s, 10), mt.ceramic!, [x, 0.17 * s, z]);
  B.add(new SphereGeometry(0.3 * s, 7, 5), mt.green!, [x, 0.48 * s, z], [0, 0, 0], [1, 0.8, 1]);
}
function curtain(B: Batcher, text: string, x: number, y: number, z: number, w: number): void {
  // Türvorhang (门帘) in zwei Bahnen mit Schrift
  for (const s of [-1, 1])
    B.add(
      new PlaneGeometry(w / 2 - 0.02, 0.9),
      signMat(text.length > 1 ? text[(s + 1) / 2]! : text, 'cloth'),
      [x + (s * w) / 4, y, z],
    );
}

// ───────────────────────────────────────── Varianten

export { HOUSE_SPECS } from '../world/village';
export type { HouseSpec } from '../world/village';
import type { HouseSpec } from '../world/village';

export interface HouseModel {
  spec: HouseSpec;
  /** volle Fassade */
  hi: Group;
  /** einfache Form für die Ferne (ein Mesh) */
  lo: Mesh;
}

/** Baut ein Haus (Ursprung: Mitte der Grundfläche auf Bodenhöhe, Front nach +z) */
export function buildHouse(spec: HouseSpec, seed = 0): HouseModel {
  const rs = rng(seed * 31 + 7);
  const mt = mats();
  const B = new Batcher();
  B.shadowless(HOUSE_PAPER);
  B.shadowless(LANTERN_MAT);
  const { w, d } = spec;
  const hw = w / 2;
  const hd = d / 2;
  const plinth = 0.35;
  const H = 2.9;
  // Sockel mit Stufe vorn
  const sock = (sw: number, sd: number, cz = 0): void => {
    B.box(sw + 0.4, plinth, sd + 0.4, mt.stone!, 0, plinth / 2, cz);
    B.box(1.8, plinth / 2, 0.4, mt.stone!, 0, plinth / 4, cz + sd / 2 + 0.4);
  };
  const lo = new Baker();
  const loBox = (bw: number, bh: number, bd: number, y: number, z: number, col: string): void => {
    lo.add(new BoxGeometry(bw, bh, bd).translate(0, y, z), col, 0.02);
  };
  const loRoof = (rw: number, rd: number, rh: number, y: number, z: number): void => {
    lo.add(
      new ConeGeometry(1, 1, 4, 1)
        .rotateY(Math.PI / 4)
        .scale(rw * 1.42, rh, rd * 1.42)
        .translate(0, y + rh / 2, z),
      '#3d4148',
      0.02,
    );
  };

  switch (spec.id) {
    case 'wohnhaus': {
      sock(w, d);
      const y0 = plinth;
      facade(B, mt, -hw, hw, hd, y0, { h: H, bays: ['win', 'door', 'win'] });
      facade(B, mt, -hw, hw, -hd, y0, { h: H, bays: ['plain', 'win', 'plain'] }, -1);
      sideWalls(B, mt, hw, hd, y0, H, ['plain', 'shutter']);
      roof(B, mt, 'gable', hw + 0.8, hd + 0.9, 1.7, y0 + H);
      // Reimpaare und Querschild über der Tür (春联)
      const pair = COUPLETS[seed % COUPLETS.length]!;
      sign(B, pair[0], 'couplet', -1.1, y0 + 1.35, hd + 0.02, 0.22, 1.1);
      sign(B, pair[1], 'couplet', 1.1, y0 + 1.35, hd + 0.02, 0.22, 1.1);
      sign(B, '福', 'couplet', 0, y0 + 2.5, hd + 0.02, 0.4, 0.4);
      lantern(B, mt, -1.25, y0 + 2.6, hd + 0.5, 0.8);
      lantern(B, mt, 1.25, y0 + 2.6, hd + 0.5, 0.8);
      // Kleinkram je nach Haus verschieden
      if (rs() < 0.6) laundry(B, mt, hw + 0.8, hw + 3.2, 0.5);
      else cart(B, mt, hw + 1.4, 0.8, Math.PI / 2 + 0.3);
      woodpile(B, mt, -hw - 0.7, -0.6, Math.PI / 2);
      basket(B, mt, 1.9, hd + 0.8);
      if (rs() < 0.5) basket(B, mt, 2.35, hd + 0.65, 0, 0.8);
      else barrel(B, mt, 2.4, hd + 0.7, 0, 0.75);
      pot(B, mt, -2.1, hd + 0.75);
      if (rs() < 0.5) bench(B, mt, -hw + 0.9, hd + 1.1, 0, 1.2);
      else bicycle(B, mt, -hw + 0.6, hd + 1.0, 0.2);
      loBox(w, H + plinth, d, (H + plinth) / 2, 0, '#d8c8a8');
      loRoof(hw + 0.8, hd + 0.9, 1.9, plinth + H, 0);
      break;
    }
    case 'teeladen': {
      sock(w, d);
      const y0 = plinth;
      facade(B, mt, -hw, hw, hd, y0, { h: H, bays: ['win', 'open', 'open', 'win'] });
      facade(B, mt, -hw, hw, -hd, y0, { h: H, bays: ['plain', 'win', 'win', 'plain'] }, -1);
      sideWalls(B, mt, hw, hd, y0, H, ['win', 'plain']);
      // Laden: Rückwand innen mit Regal, Theke vorn
      B.box(3.4, H, 0.1, mt.mw!, 0, y0 + H / 2, -0.4);
      for (const y of [0.9, 1.4, 1.9]) B.box(3.2, 0.05, 0.35, mt.dw!, 0, y0 + y, -0.25);
      for (const y of [0.9, 1.4, 1.9])
        for (let k = 0; k < 8; k++)
          B.add(
            new CylinderGeometry(0.09, 0.09, 0.22, 8),
            k % 3 === 0 ? mt.gold! : k % 3 === 1 ? mt.ceramic! : mt.lac!,
            [-1.4 + k * 0.4, y0 + y + 0.14, -0.25],
          );
      B.box(3.2, 0.95, 0.5, mt.lac!, 0, y0 + 0.475, hd - 0.5);
      B.box(3.3, 0.06, 0.6, mt.mw!, 0, y0 + 0.98, hd - 0.5);
      for (let k = 0; k < 4; k++) basket(B, mt, -1.2 + k * 0.8, hd - 0.5, y0 + 1.01, 0.7);
      B.box(w, 0.06, d, mt.mw!, 0, y0 + 0.03, 0);
      roof(B, mt, 'xieshan', hw + 0.9, hd + 1.0, 1.9, y0 + H);
      awning(B, mt, 3.6, 0, y0 + H - 0.25, hd);
      sign(B, '茶庄', 'board', 0, y0 + H + 0.35, hd + 0.75, 1.5, 0.55);
      sign(B, '名茶', 'couplet', -1.85, y0 + 1.5, hd + 0.13, 0.24, 1.0);
      sign(B, '雅座', 'couplet', 1.85, y0 + 1.5, hd + 0.13, 0.24, 1.0);
      for (const x of [-1.5, -0.5, 0.5, 1.5]) lantern(B, mt, x, y0 + H - 0.75, hd + 0.75, 0.75);
      // Fähnchen „茶“ an einer Stange
      B.add(new CylinderGeometry(0.03, 0.03, 3.2, 5), mt.dw!, [hw + 0.5, 1.6, hd + 0.6]);
      sign(B, '茶', 'cloth', hw + 0.5 - 0.3, 2.6, hd + 0.6, 0.5, 0.9);
      for (let k = 0; k < 3; k++) barrel(B, mt, -hw - 0.5, hd - 0.4 - k * 0.65, 0, 0.8);
      pot(B, mt, hw - 0.2, hd + 1.0);
      loBox(w, H + plinth, d, (H + plinth) / 2, 0, '#d8c8a8');
      loRoof(hw + 0.9, hd + 1, 2, plinth + H, 0);
      break;
    }
    case 'werkstatt': {
      sock(w, d);
      const y0 = plinth;
      facade(B, mt, -hw, hw, hd, y0, { h: H, bays: ['open', 'open', 'shutter'] });
      facade(B, mt, -hw, hw, -hd, y0, { h: H, bays: ['plain', 'plain', 'win'] }, -1);
      sideWalls(B, mt, hw, hd, y0, H, ['plain', 'plain']);
      B.box(w, 0.06, d, mt.mw!, 0, y0 + 0.03, 0);
      // Hobelbank, Bretter, Werkzeug
      B.box(2.2, 0.08, 0.6, mt.mw!, -0.6, y0 + 0.85, 0.6);
      for (const x of [-1.5, 0.3]) B.box(0.1, 0.85, 0.5, mt.dw!, x, y0 + 0.42, 0.6);
      for (let k = 0; k < 6; k++)
        B.box(0.25, 2.2, 0.04, k % 2 ? mt.mw! : mt.dw!, -2.6 + k * 0.08, y0 + 1.1, -hd + 0.4, 0.15);
      B.box(1.4, 0.05, 0.2, mt.iron!, -0.6, y0 + 2.0, -hd + 0.25);
      roof(B, mt, 'gable', hw + 0.8, hd + 0.9, 1.6, y0 + H);
      sign(B, '木工', 'board', -1.0, y0 + H + 0.3, hd + 0.85, 1.2, 0.48);
      for (let k = 0; k < 2; k++) barrel(B, mt, hw - 0.6 - k * 0.65, hd + 0.9);
      woodpile(B, mt, hw + 0.8, -0.4, Math.PI / 2);
      cart(B, mt, -hw - 1.4, hd + 0.6, 0.4);
      lantern(B, mt, 0.9, y0 + 2.5, hd + 0.6, 0.75);
      loBox(w, H + plinth, d, (H + plinth) / 2, 0, '#d8c8a8');
      loRoof(hw + 0.8, hd + 0.9, 1.8, plinth + H, 0);
      break;
    }
    case 'gasthaus': {
      sock(w, d);
      const y0 = plinth;
      facade(B, mt, -hw, hw, hd, y0, { h: H, bays: ['win', 'win', 'door', 'win', 'win'] });
      facade(B, mt, -hw, hw, -hd, y0, { h: H, bays: ['plain', 'win', 'plain', 'win', 'plain'] }, -1);
      sideWalls(B, mt, hw, hd, y0, H, ['win', 'plain', 'win']);
      // Zwischendach (腰檐) und Balkon
      const y1 = y0 + H + 0.25;
      skirt(B, mt, hw, hd, y0 + H + 0.05);
      B.box(w + 0.6, 0.12, 1.0, mt.mw!, 0, y1, hd + 0.4);
      railing(B, mt, -hw - 0.2, hw + 0.2, hd + 0.85, y1 + 0.06);
      facade(B, mt, -hw + 0.3, hw - 0.3, hd - 0.1, y1, { h: 2.4, bays: ['win', 'win', 'win', 'win'] });
      facade(
        B,
        mt,
        -hw + 0.3,
        hw - 0.3,
        -hd + 0.1,
        y1,
        { h: 2.4, bays: ['win', 'plain', 'plain', 'win'] },
        -1,
      );
      sideWalls(B, mt, hw - 0.3, hd - 0.1, y1, 2.4, ['win', 'win']);
      for (const x of [-hw - 0.1, hw + 0.1]) pillar(B, mt, x, hd + 0.85, y1, 0.8, 0.07);
      roof(B, mt, 'xieshan', hw + 0.7, hd + 0.8, 2.0, y1 + 2.4);
      sign(B, '客栈', 'board', 0, y1 + 0.42, hd + 0.9, 1.6, 0.55);
      curtain(B, '客栈', 0, y0 + 1.6, hd + 0.03, 1.3);
      for (const x of [-2.6, -1.0, 1.0, 2.6]) lantern(B, mt, x, y1 + 2.0, hd + 0.75, 0.8);
      for (const x of [-hw + 0.8, hw - 0.8]) lantern(B, mt, x, y0 + 2.2, hd + 0.4, 0.75);
      bench(B, mt, -2.6, hd + 1.2, 0, 1.6);
      bench(B, mt, 2.6, hd + 1.2, 0, 1.6);
      for (let k = 0; k < 3; k++) barrel(B, mt, hw + 0.6, -hd + 0.6 + k * 0.7);
      pot(B, mt, -hw - 0.3, hd + 0.9);
      // Fahne
      B.add(new CylinderGeometry(0.04, 0.04, 6.5, 5), mt.dw!, [-hw - 1.0, 3.25, hd + 0.4]);
      sign(B, '酒', 'cloth', -hw - 1.0 + 0.35, 5.3, hd + 0.4, 0.6, 1.1);
      loBox(w, H + plinth, d, (H + plinth) / 2, 0, '#d8c8a8');
      loBox(w - 0.6, 2.4, d - 0.2, y1 + 1.2, 0, '#d8c8a8');
      loRoof(hw + 0.7, hd + 0.8, 2.1, y1 + 2.4, 0);
      break;
    }
    case 'schreinchen': {
      B.box(w + 0.6, 0.5, d + 0.6, mt.stone!, 0, 0.25, 0);
      B.box(1.4, 0.25, 0.5, mt.stone!, 0, 0.125, hd + 0.55);
      const y0 = 0.5;
      const h = 2.0;
      for (const x of [-hw + 0.2, hw - 0.2])
        for (const z of [-hd + 0.2, hd - 0.2]) pillar(B, mt, x, z, y0, h, 0.1);
      B.box(w - 0.4, h, 0.12, mt.pl!, 0, y0 + h / 2, -hd + 0.25);
      for (const s of [-1, 1]) B.box(0.12, h, d - 0.5, mt.pl!, s * (hw - 0.25), y0 + h / 2, 0);
      // Altar mit Figur (abstrakt) und Opfergaben
      B.box(1.2, 0.7, 0.6, mt.lac!, 0, y0 + 0.35, -hd + 0.65);
      B.add(new CylinderGeometry(0.16, 0.22, 0.6, 8), mt.gold!, [0, y0 + 1.0, -hd + 0.6]);
      B.add(new SphereGeometry(0.14, 8, 6), mt.gold!, [0, y0 + 1.42, -hd + 0.6]);
      for (const x of [-0.4, 0.4])
        B.add(new SphereGeometry(0.08, 6, 5), vinyl('#e08a3c'), [x, y0 + 0.78, -hd + 0.75]);
      B.box(w - 0.2, 0.18, 0.2, mt.lac!, 0, y0 + h - 0.1, hd - 0.2);
      roof(B, mt, 'hip', hw + 0.55, hd + 0.55, 1.1, y0 + h);
      sign(B, '土地', 'board', 0, y0 + h - 0.42, hd - 0.08, 0.8, 0.34);
      sign(B, '有求', 'couplet', -hw + 0.2, y0 + 1.0, hd - 0.08, 0.16, 0.7);
      sign(B, '必应', 'couplet', hw - 0.2, y0 + 1.0, hd - 0.08, 0.16, 0.7);
      // Weihrauchbecken davor
      B.add(new CylinderGeometry(0.3, 0.24, 0.35, 8), vinyl('#5d5240'), [0, 0.45, hd + 1.4]);
      for (let k = 0; k < 3; k++)
        B.add(new CylinderGeometry(0.04, 0.04, 0.28, 4), vinyl('#4a4033'), [
          Math.cos(k * 2.1) * 0.2,
          0.14,
          hd + 1.4 + Math.sin(k * 2.1) * 0.2,
        ]);
      for (const x of [-0.08, 0, 0.08])
        B.add(new CylinderGeometry(0.008, 0.008, 0.3, 3), mt.redCloth!, [x, 0.75, hd + 1.4]);
      lantern(B, mt, -hw - 0.2, y0 + h - 0.2, hd + 0.3, 0.6);
      lantern(B, mt, hw + 0.2, y0 + h - 0.2, hd + 0.3, 0.6);
      loBox(w, h + 0.5, d, (h + 0.5) / 2, 0, '#c84a30');
      loRoof(hw + 0.55, hd + 0.55, 1.2, y0 + h, 0);
      break;
    }
    case 'lagerhaus': {
      sock(w, d);
      const y0 = plinth;
      facade(B, mt, -hw, hw, hd, y0, { h: H, bays: ['shutter', 'door', 'door', 'shutter'] });
      facade(B, mt, -hw, hw, -hd, y0, { h: H, bays: ['plain', 'shutter', 'shutter', 'plain'] }, -1);
      sideWalls(B, mt, hw, hd, y0, H, ['plain', 'plain']);
      roof(B, mt, 'gable', hw + 0.7, hd + 0.8, 1.5, y0 + H);
      // Säcke, Fässer, Körbe vor dem Tor, Rampe aus Brettern
      for (let k = 0; k < 5; k++)
        B.add(
          new SphereGeometry(0.3, 7, 5),
          mt.cloth!,
          [-hw + 0.6 + (k % 3) * 0.55, 0.28 + Math.floor(k / 3) * 0.42, hd + 0.9 + (k % 2) * 0.2],
          [0, k, 0],
          [1, 0.75, 0.8],
        );
      for (let k = 0; k < 3; k++) barrel(B, mt, hw - 0.5 - k * 0.65, hd + 0.8);
      basket(B, mt, hw - 0.8, hd + 1.6, 0, 0.9);
      B.box(1.6, 0.06, 1.0, mt.mw!, 0, 0.22, hd + 0.55, 0);
      sign(B, '仓', 'board', 0, y0 + H + 0.1, hd + 0.75, 0.7, 0.5);
      lantern(B, mt, hw - 0.4, y0 + 2.4, hd + 0.5, 0.7);
      woodpile(B, mt, -hw - 0.8, 0.2, Math.PI / 2);
      loBox(w, H + plinth, d, (H + plinth) / 2, 0, '#c8b898');
      loRoof(hw + 0.7, hd + 0.8, 1.7, plinth + H, 0);
      break;
    }
    case 'hofhaus': {
      // Haupthaus hinten, Hof mit Mauer, Tor vorn
      const mh = 7.2;
      const md = 4.4;
      const mz = -hd + md / 2;
      B.box(mh + 0.4, plinth, md + 0.4, mt.stone!, 0, plinth / 2, mz);
      B.box(2.2, plinth / 2, 0.4, mt.stone!, 0, plinth / 4, mz + md / 2 + 0.4);
      const y0 = plinth;
      facade(B, mt, -mh / 2, mh / 2, mz + md / 2, y0, {
        h: H + 0.2,
        bays: ['win', 'win', 'door', 'win', 'win'],
      });
      facade(
        B,
        mt,
        -mh / 2,
        mh / 2,
        mz - md / 2,
        y0,
        { h: H + 0.2, bays: ['plain', 'plain', 'plain', 'plain', 'plain'] },
        -1,
      );
      sideWallsAt(B, mt, mh / 2, md / 2, mz, y0, H + 0.2, ['plain', 'win']);
      for (const x of [-mh / 2 + 0.2, -1.2, 1.2, mh / 2 - 0.2])
        pillar(B, mt, x, mz + md / 2 + 0.75, y0, H + 0.2, 0.11);
      B.box(mh + 0.2, 0.1, 1.0, mt.stone!, 0, y0 - 0.02, mz + md / 2 + 0.5);
      roof(B, mt, 'hip', mh / 2 + 1.1, md / 2 + 1.5, 2.1, y0 + H + 0.2, mz + 0.4);
      sign(B, '和气', 'board', 0, y0 + H - 0.3, mz + md / 2 + 0.06, 1.3, 0.5);
      // Hofmauer mit Ziegelkappe
      const wallH = 2.1;
      const wall = (x0: number, z0: number, x1: number, z1: number): void => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
        B.add(new BoxGeometry(len, wallH, 0.3), mt.pl!, [cx, wallH / 2, cz], [0, ry, 0]);
        B.add(new BoxGeometry(len, 0.4, 0.3), mt.stone!, [cx, 0.2, cz], [0, ry, 0]);
        B.add(new BoxGeometry(len + 0.1, 0.12, 0.6), mt.tile!, [cx, wallH + 0.06, cz], [0, ry, 0]);
        B.add(new BoxGeometry(len + 0.1, 0.1, 0.2), mt.tile!, [cx, wallH + 0.16, cz], [0, ry, 0]);
      };
      wall(-hw, -hd, -hw, hd);
      wall(hw, -hd, hw, hd);
      wall(-hw, hd, -1.2, hd);
      wall(1.2, hd, hw, hd);
      // Tor mit eigenem Dach
      for (const x of [-1.05, 1.05]) pillar(B, mt, x, hd, 0, 2.7, 0.13);
      // Torflügel stehen offen (nach innen geschwenkt): der Hof ist begehbar
      for (const s of [-1, 1]) {
        B.add(
          new BoxGeometry(0.95, 2.3, 0.08),
          mt.lac!,
          [s * 0.98, 1.15, hd - 0.55],
          [0, Math.PI / 2 - s * 0.12, 0],
        );
        B.add(
          new TorusGeometry(0.06, 0.015, 4, 8),
          mt.gold!,
          [s * 0.92, 1.2, hd - 0.85],
          [0, Math.PI / 2, 0],
        );
      }
      B.box(2.4, 0.3, 0.4, mt.dw!, 0, 2.75, hd);
      roof(B, mt, 'gable', 1.7, 0.9, 0.7, 2.85, hd);
      sign(B, '福', 'couplet', 0, 2.42, hd + 0.21, 0.36, 0.36);
      lantern(B, mt, -1.3, 2.4, hd + 0.35, 0.8);
      lantern(B, mt, 1.3, 2.4, hd + 0.35, 0.8);
      // Hof: Pflaster, Pflanzen, Fahrrad, Brunnenbecken
      B.box(w - 0.4, 0.04, hd * 2 - md - 0.2, mt.stone!, 0, 0.02, (mz + md / 2 + hd) / 2 + 0.3);
      for (const [x, z] of [
        [-3.5, 1.2],
        [3.5, 1.2],
        [-3.5, 3.6],
      ] as const)
        pot(B, mt, x, z, 1.2);
      bicycle(B, mt, 3.4, 3.4, 0.6);
      B.add(new CylinderGeometry(0.6, 0.55, 0.5, 10), mt.ceramic!, [0, 0.25, 2.2]);
      B.add(new CylinderGeometry(0.55, 0.55, 0.02, 10), vinyl('#2e5a5a', { rough: 0.15 }), [0, 0.46, 2.2]);
      laundry(B, mt, -3.8, -1.6, 3.3);
      loBox(mh, H + plinth, md, (H + plinth) / 2, mz, '#d8c8a8');
      loRoof(mh / 2 + 1.1, md / 2 + 1.5, 2.2, plinth + H, mz + 0.4);
      for (const [x0, z0, x1, z1] of [
        [-hw, -hd, -hw, hd],
        [hw, -hd, hw, hd],
        [-hw, hd, hw, hd],
      ] as const)
        lo.add(
          new BoxGeometry(
            Math.max(0.3, Math.abs(x1 - x0)),
            wallH,
            Math.max(0.3, Math.abs(z1 - z0)),
          ).translate((x0 + x1) / 2, wallH / 2, (z0 + z1) / 2),
          '#d8c8a8',
          0.02,
        );
      break;
    }
  }
  const hi = B.build(spec.id);
  const loMesh = lo.mesh();
  loMesh.name = `${spec.id}-lo`;
  return { spec, hi, lo: loMesh };
}

/** Seitenwände (x = ±hw), Felder von vorn nach hinten */
function sideWalls(
  B: Batcher,
  mt: Record<string, Material>,
  hw: number,
  hd: number,
  y0: number,
  h: number,
  bays: Bay[],
): void {
  sideWallsAt(B, mt, hw, hd, 0, y0, h, bays);
}
function sideWallsAt(
  B: Batcher,
  mt: Record<string, Material>,
  hw: number,
  hd: number,
  cz: number,
  y0: number,
  h: number,
  bays: Bay[],
): void {
  for (const s of [-1, 1]) {
    const g = new Batcher();
    facade(g, mt, -hd, hd, 0, y0, { h, bays });
    // Fassade liegt entlang x bei z = 0 → auf die Seite x = s·hw drehen
    B.addAll(g, [s * hw, 0, cz], [0, (s * Math.PI) / 2, 0]);
  }
}

/** Umlaufendes Zwischendach (腰檐) zwischen den Geschossen */
function skirt(B: Batcher, mt: Record<string, Material>, hw: number, hd: number, y: number): void {
  const depth = 0.9;
  for (const [len, ry, ox, oz] of [
    [hw * 2 + 1.8, 0, 0, hd],
    [hw * 2 + 1.8, Math.PI, 0, -hd],
    [hd * 2 + 1.8, Math.PI / 2, hw, 0],
    [hd * 2 + 1.8, -Math.PI / 2, -hw, 0],
  ] as const) {
    const g = new PlaneGeometry(len, depth, Math.round(len * 5), 2).rotateX(-Math.PI / 2 + 0.42);
    const p = g.attributes.position as BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.025 * Math.sin((p.getX(i) / 0.26) * Math.PI));
    g.computeVertexNormals();
    g.translate(0, 0, depth * 0.42);
    B.add(g, mt.tile!, [ox, y, oz], [0, ry, 0]);
    const f = new BoxGeometry(len, 0.1, 0.06).translate(
      0,
      -Math.sin(0.42) * depth * 0.5 - 0.03,
      depth * 0.88,
    );
    B.add(f, mt.fascia!, [ox, y, oz], [0, ry, 0]);
  }
}

/** Reimpaare (春联) für Wohnhäuser */
const COUPLETS: [string, string][] = [
  ['春和', '景明'],
  ['家和', '业兴'],
  ['平安', '如意'],
  ['花好', '月圆'],
];

export type Goods = 'gemuese' | 'obst' | 'tee';

/** Marktstand: Tisch mit Stoffdach, Kisten mit Ware (Ursprung Mitte, Front nach +z) */
export function buildStall(goods: Goods, seed = 0): Group {
  const mt = mats();
  const B = new Batcher();
  const r = rng(seed + 11);
  B.box(2.2, 0.06, 1.0, mt.mw!, 0, 0.82, 0);
  for (const x of [-1, 1]) for (const z of [-0.42, 0.42]) B.box(0.07, 0.82, 0.07, mt.dw!, x, 0.41, z);
  for (const x of [-1.05, 1.05]) {
    B.add(new CylinderGeometry(0.035, 0.035, 2.3, 5), mt.dw!, [x, 1.15, -0.45]);
    B.add(new CylinderGeometry(0.035, 0.035, 2.0, 5), mt.dw!, [x, 1.0, 0.55]);
  }
  const roofCol = goods === 'tee' ? mt.indigo! : goods === 'obst' ? mt.redCloth! : mt.cloth!;
  // Stoffdach, nach vorn geneigt
  B.add(new BoxGeometry(2.4, 0.03, 1.3), roofCol, [0, 2.12, 0.05], [0.28, 0, 0]);
  const fruit: Record<Goods, string[]> = {
    gemuese: ['#6f9a3c', '#e0e0c8', '#b54a2a', '#7aa04a'],
    obst: ['#e08a3c', '#d43a2a', '#f0c84a', '#9a3a5a'],
    tee: ['#5a7a3a', '#3e4e2a', '#8a6a3a', '#6a7a4a'],
  };
  for (let k = 0; k < 4; k++) {
    const x = -0.78 + k * 0.52;
    B.box(0.46, 0.14, 0.42, mt.straw!, x, 0.92, 0.05);
    const col = vinyl(fruit[goods][k]!, { rough: 0.6 });
    for (let i = 0; i < 6; i++)
      B.add(
        new SphereGeometry(goods === 'tee' ? 0.05 : 0.07, 6, 4),
        col,
        [x + (r() - 0.5) * 0.3, 1.02 + r() * 0.04, 0.05 + (r() - 0.5) * 0.26],
        [0, 0, 0],
        goods === 'tee' ? [1.6, 0.7, 1.6] : [1, 1, 1],
      );
  }
  basket(B, mt, -1.4, 0.4, 0, 0.8);
  basket(B, mt, 1.45, 0.3, 0, 0.9);
  if (goods === 'tee') sign(B, '新茶', 'cloth', 0, 1.7, 0.56, 0.5, 0.36);
  return B.build(`stand-${goods}`);
}

/** Niedrige Steinmauer mit Ziegelkappe, folgt dem Gelände in Stücken (Weltkoordinaten) */
export function addLowWall(
  B: Batcher,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  ground: (x: number, z: number) => number,
): void {
  const mt = mats();
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 1.2));
  const ry = Math.atan2(x1 - x0, z1 - z0);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    const y = ground(x, z);
    const l = len / n + 0.02;
    B.add(new BoxGeometry(0.45, 0.9, l), mt.stone!, [x, y + 0.35, z], [0, ry, 0]);
    B.add(new BoxGeometry(0.6, 0.1, l + 0.04), mt.tile!, [x, y + 0.85, z], [0, ry, 0]);
  }
}

/** Holzzaun: Pfosten und zwei Latten (Weltkoordinaten) */
export function addFence(
  B: Batcher,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  ground: (x: number, z: number) => number,
): void {
  const mt = mats();
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 1.0));
  const ry = Math.atan2(x1 - x0, z1 - z0);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    B.add(new CylinderGeometry(0.04, 0.05, 1.0, 5), mt.dw!, [x, ground(x, z) + 0.45, z]);
    if (k === n) continue;
    const xm = x0 + (x1 - x0) * (t + 0.5 / n);
    const zm = z0 + (z1 - z0) * (t + 0.5 / n);
    const y = ground(xm, zm);
    for (const h of [0.4, 0.75])
      B.add(new BoxGeometry(0.04, 0.06, len / n + 0.05), mt.mw!, [xm, y + h, zm], [0, ry, 0]);
  }
}
