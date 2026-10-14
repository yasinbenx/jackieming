// Wo was wächst und steht: Bäume, Bambus, Felsen, Teesträucher, Laternen, Tore. Reine Daten, deterministisch;
// dieselben Listen nutzen Darstellung (three/nature, three/structures) und Laufraster (Kollision).
import { fbm, rng } from '../three/noise';
import { boundaryK, crossings, PATHS, place, PLACES, polyAt, polyLength } from './map';
import type { Crossing } from './map';
import {
  BOARD_TABLE,
  FENCES,
  footprint,
  HOUSES,
  LOW_WALLS,
  onHouse,
  STALLS,
  toWorld,
  VILLAGE_BAMBOO,
  VILLAGE_TREES,
} from './village';
import { field, pathAt, pondEdge, terraceK, waterAt } from './terrain';

export type TreeKind = 'pine' | 'pine2' | 'broad' | 'cherry' | 'ginkgo' | 'maple';
export interface Item {
  x: number;
  z: number;
  y: number;
  /** Größe (1 = normal) */
  s: number;
  /** Drehung um y */
  rot: number;
}
export interface Tree extends Item {
  kind: TreeKind;
}

/** Schrein: Gebäude (Rechteck) auf dem Schreinplatz, Front nach +z */
export const SHRINE = { x: 62, z: -63.2, w: 6.4, d: 4.6 };
/** Pavillon am Aussichtspunkt */
export const PAVILION = { x: -64, z: -42, r: 2.4 };
/** Brunnen auf dem Dorfplatz */
export const WELL = { x: 40, z: 60, r: 0.85 };

export type Bench = Item;

export interface Rect {
  x: number;
  z: number;
  hw: number;
  hd: number;
  rot: number;
}

export interface Scatter {
  benches: Bench[];
  /** Mauer um den Aussichtspunkt: Winkelbereich der Öffnung zum Weg */
  lookoutGap: { a: number; w: number };
  trees: Tree[];
  bamboo: Item[];
  rocks: Item[];
  tea: Item[];
  lanterns: Item[];
  gates: Item[];
  crossings: Crossing[];
  /** Kollisionskreise (Stamm, Fels, Laterne, Torpfosten …) */
  blockers: { x: number; z: number; r: number }[];
  /** Kollisionsrechtecke (Häuser, Mauern, Zäune, Stände): Mitte, Halbmaße, Drehung */
  rects: Rect[];
}

/** Nahbereich des Teehauses: hier bleibt alles wie gehabt (eigener Bewuchs in landscape.ts) */
const nearHouse = (x: number, z: number): boolean => Math.hypot(x, z * 0.85) < 17;

/** Platz für Gebäude im Dorf (W2) freihalten */
const VILLAGE = place('dorf');
const inVillage = (x: number, z: number, pad = 0): boolean =>
  Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 27 + pad;

const TEA_FIELD = { x: 54, z: -6, rx: 19, rz: 13 };
export const inTeaField = (x: number, z: number): boolean =>
  ((x - TEA_FIELD.x) / TEA_FIELD.rx) ** 2 + ((z - TEA_FIELD.z) / TEA_FIELD.rz) ** 2 < 1;

const GROVE = { x: -30, z: 24, rx: 15, rz: 11 };
export const inGrove = (x: number, z: number, pad = 0): boolean =>
  ((x - GROVE.x) / (GROVE.rx + pad)) ** 2 + ((z - GROVE.z) / (GROVE.rz + pad)) ** 2 < 1;

const nearPlace = (x: number, z: number, pad: number): boolean =>
  PLACES.some((p) => p.flat > 0 && Math.hypot(x - p.x, z - p.z) < p.flat + pad);

/** Freie Fläche für Bewuchs? (kein Weg, kein Wasser, kein Platz, kein Teehaus) */
function free(x: number, z: number, pathPad: number, waterPad: number): boolean {
  if (nearHouse(x, z)) return false;
  if (pathAt(x, z).d < pathPad) return false;
  if (waterAt(x, z, waterPad)) return false;
  if (nearPlace(x, z, 2)) return false;
  return true;
}

let cached: Scatter | null = null;

export function scatter(): Scatter {
  if (cached) return cached;
  const f = field();
  const r = rng(808);
  const trees: Tree[] = [];
  const bamboo: Item[] = [];
  const rocks: Item[] = [];
  const tea: Item[] = [];
  const lanterns: Item[] = [];
  const gates: Item[] = [];
  const blockers: Scatter['blockers'] = [];
  const item = (x: number, z: number, s: number): Item => ({
    x,
    z,
    y: f.at(x, z),
    s,
    rot: r() * Math.PI * 2,
  });

  // ── Bäume: Raster mit Zufallsversatz, Dichte aus Rauschen, Hang und Rand
  const C = 4.6;
  for (let gz = -125; gz < 155; gz += C) {
    for (let gx = -135; gx < 135; gx += C) {
      const x = gx + r() * C;
      const z = gz + r() * C;
      const bk = boundaryK(x, z);
      if (bk > 0.92) continue;
      const patch = fbm(x * 0.028 + 7, z * 0.028 - 3, 3);
      const slope = f.slope(x, z);
      // Wald in Flecken, dichter am Rand (Bergwald), lichter im Tal
      let p = (patch - 0.38) * 2.4 + bk * 1.6 + Math.min(0.4, slope * 0.5);
      if (z > 30 && z < 100 && bk < 0.2) p -= 0.35; // offenes Tal zum Fluss
      if (r() > p) continue;
      if (!free(x, z, 2.8, 2.2)) continue;
      if (
        inVillage(x, z, 6) ||
        onHouse(x, z, 3) ||
        inTeaField(x, z) ||
        inGrove(x, z, 2) ||
        terraceK(x, z) > 0.05
      )
        continue;
      if (slope > 1.6) continue;
      const u = r();
      const kind: TreeKind =
        bk > 0.25 || slope > 0.45
          ? u < 0.6
            ? 'pine'
            : 'pine2'
          : u < 0.45
            ? 'pine'
            : u < 0.62
              ? 'pine2'
              : 'broad';
      const t = { ...item(x, z, 0.8 + r() * 0.6), kind };
      trees.push(t);
    }
  }

  // ── Zierbäume an Orten und Wegen
  const deco = (kind: TreeKind, x: number, z: number, s: number): void => {
    if (!free(x, z, 1.8, 1.5) && !nearPlace(x, z, -1)) {
      // auf Plätzen dürfen Zierbäume am Rand stehen
      if (pathAt(x, z).d < 1.8 || waterAt(x, z, 1.5) || nearHouse(x, z)) return;
    }
    trees.push({ ...item(x, z, s), kind });
  };
  const shrine = place('schrein');
  // zwei alte Ginkgos vor dem Schrein, Kirschen im Halbkreis
  deco('ginkgo', shrine.x - 6.5, shrine.z + 5.5, 1.5);
  deco('ginkgo', shrine.x + 6.5, shrine.z + 5.5, 1.4);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.15 + (i / 6) * 0.7) + Math.PI;
    deco('cherry', shrine.x + Math.cos(a) * 12, shrine.z + Math.sin(a) * 11, 0.9 + r() * 0.3);
  }
  // Kirschen entlang des Dorfwegs, Ahorn am Bach und am Aussichtspunkt
  const along = (id: string, kind: TreeKind, every: number, side: number, from = 0.05, to = 0.95): void => {
    const p = PATHS.find((q) => q.id === id)!;
    const n = Math.floor(polyLength(p.pts) / every);
    for (let k = 0; k <= n; k++) {
      const t = from + ((to - from) * k) / Math.max(1, n);
      const q = polyAt(p.pts, t);
      const sd = (k % 2 ? 1 : -1) * side;
      deco(kind, q.x - q.dz * sd * (p.half + 2.6), q.z + q.dx * sd * (p.half + 2.6), 0.85 + r() * 0.3);
    }
  };
  along('dorfweg', 'cherry', 9, 1, 0.2, 0.85);
  along('ostweg', 'maple', 14, 1, 0.15, 0.85);
  along('brueckenweg', 'broad', 16, 1, 0.3, 0.95);
  const look = place('aussicht');
  deco('maple', look.x + 9, look.z - 3, 1.1);
  deco('pine', look.x - 8, look.z + 4, 1.4);
  deco('maple', look.x - 2, look.z - 9.5, 1);
  // Dorfrand: Ginkgo und Kirschen (die Mitte bleibt für den Platz frei)

  // ── Bambus ums Teehaus (links, rechts, dahinter, am Teich) wie bisher
  const rb = rng(55);
  const houseGroves = [
    { x: -10.6, z: -2.5, rx: 1.8, rz: 3.4 },
    { x: 10.6, z: -2.5, rx: 1.8, rz: 3.2 },
    { x: 0, z: -9.4, rx: 8, rz: 1.6 },
    { x: -10.2, z: 6.6, rx: 1.4, rz: 1.4 },
  ];
  for (let i = 0; i < 200; i++) {
    const gr = houseGroves[i % houseGroves.length]!;
    const a = rb() * Math.PI * 2;
    const d = Math.sqrt(rb());
    const x = gr.x + Math.cos(a) * gr.rx * d;
    const z = gr.z + Math.sin(a) * gr.rz * d;
    bamboo.push({ x, z, y: f.at(x, z), s: 0.8 + rb() * 0.5, rot: rb() * Math.PI * 2 });
  }

  // ── Bambushain (dicht)
  for (let i = 0; i < 1400 && bamboo.length < 720; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    const x = GROVE.x + Math.cos(a) * GROVE.rx * d;
    const z = GROVE.z + Math.sin(a) * GROVE.rz * d;
    if (pathAt(x, z).d < 1.0 || waterAt(x, z, 0.6)) continue;
    bamboo.push(item(x, z, 0.8 + r() * 0.5));
  }

  // ── Dorf: Bäume und Bambusbüsche zwischen den Häusern
  for (const [kind, x, z, sc] of VILLAGE_TREES) trees.push({ ...item(x, z, sc), kind: kind as TreeKind });
  for (const [cx, cz, rr] of VILLAGE_BAMBOO) {
    const n = Math.round(rr * rr * 9);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * rr;
      bamboo.push(item(cx + Math.cos(a) * d, cz + Math.sin(a) * d, 0.7 + r() * 0.4));
    }
  }

  // ── Teefeld: Reihen quer zum Hang
  for (let row = -TEA_FIELD.rz; row <= TEA_FIELD.rz; row += 1.9) {
    for (let col = -TEA_FIELD.rx; col <= TEA_FIELD.rx; col += 1.05) {
      const x = TEA_FIELD.x + col + Math.sin(row * 0.7) * 0.3;
      const z = TEA_FIELD.z + row + Math.sin(col * 0.25) * 0.6;
      if (!inTeaField(x, z)) continue;
      if (pathAt(x, z).d < 1.4) continue;
      tea.push(item(x, z, 0.85 + r() * 0.3));
    }
  }

  // ── Felsen: an Hängen, Ufern und am Rand
  for (let i = 0; i < 5000 && rocks.length < 460; i++) {
    const x = -125 + r() * 250;
    const z = -115 + r() * 265;
    const bk = boundaryK(x, z);
    if (bk > 0.9) continue;
    const slope = f.slope(x, z);
    const bank = waterAt(x, z, 2.4) && !waterAt(x, z, 0.2);
    const p = slope * 0.9 + (bank ? 0.6 : 0) + bk * 0.5 - 0.15;
    if (r() > p) continue;
    if (nearHouse(x, z) || pathAt(x, z).d < 1.2 || waterAt(x, z, 0.2)) continue;
    if (
      inVillage(x, z) ||
      onHouse(x, z, 2) ||
      inTeaField(x, z) ||
      nearPlace(x, z, 1) ||
      terraceK(x, z) > 0.05
    )
      continue;
    rocks.push(item(x, z, 0.35 + r() ** 2 * 1.8));
  }

  // ── Steinlaternen entlang der Hauptwege und am Schrein
  for (const p of PATHS) {
    if (p.kind === 'side' && p.id !== 'ostweg') continue;
    const len = polyLength(p.pts);
    const every = p.kind === 'stairs' ? 9 : 17;
    const n = Math.floor(len / every);
    for (let k = 1; k <= n; k++) {
      const t = (k - 0.5) / n;
      const q = polyAt(p.pts, t);
      const sd = k % 2 ? 1 : -1;
      const x = q.x - q.dz * sd * (p.half + 0.9);
      const z = q.z + q.dx * sd * (p.half + 0.9);
      if (nearHouse(x, z) || waterAt(x, z, 1)) continue;
      lanterns.push({ ...item(x, z, 1), rot: Math.atan2(q.dx, q.dz) });
    }
  }
  for (const sd of [-1, 1]) lanterns.push({ ...item(shrine.x + sd * 3.2, shrine.z + 3.5, 1.1), rot: 0 });

  // ── Tore: Dorfeingang, Fuß der Schreintreppe, oben am Schrein
  const gateOn = (id: string, t: number, s = 1): void => {
    const p = PATHS.find((q) => q.id === id)!;
    const q = polyAt(p.pts, t);
    gates.push({ x: q.x, z: q.z, y: f.at(q.x, q.z), s, rot: Math.atan2(q.dx, q.dz) });
  };
  gateOn('dorfweg', 0.66);
  gateOn('schreinweg', 0.06);
  gateOn('schreinweg', 0.8, 0.9);

  // ── Kollision
  for (const t of trees)
    blockers.push({ x: t.x, z: t.z, r: (t.kind.startsWith('pine') ? 0.22 : 0.26) * t.s });
  for (const b of bamboo) blockers.push({ x: b.x, z: b.z, r: 0.07 });
  for (const k of rocks) if (k.s > 0.6) blockers.push({ x: k.x, z: k.z, r: k.s * 0.55 });
  for (const t of tea) blockers.push({ x: t.x, z: t.z, r: 0.42 * t.s });
  for (const l of lanterns) blockers.push({ x: l.x, z: l.z, r: 0.3 });
  for (const g of gates)
    for (const sd of [-1, 1]) {
      const cx = Math.cos(g.rot);
      const sz = -Math.sin(g.rot);
      blockers.push({ x: g.x + cx * sd * 1.9 * g.s, z: g.z + sz * sd * 1.9 * g.s, r: 0.22 });
    }

  // ── Bauwerke: Schrein, Pavillon, Brunnen, Bänke, Mauer am Aussichtspunkt
  const benches: Bench[] = [];
  const bench = (x: number, z: number, rot: number): void => {
    benches.push({ x, z, y: f.at(x, z), s: 1, rot });
  };
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    bench(WELL.x + Math.cos(a) * 6.5, WELL.z + Math.sin(a) * 6.5, -a - Math.PI / 2);
  }
  const lk = place('aussicht');
  // Blick zum Teehaus und ins Tal
  const view = Math.atan2(0 - lk.x, 20 - lk.z);
  bench(lk.x + Math.sin(view) * 4.6, lk.z + Math.cos(view) * 4.6, view);
  bench(shrine.x - 4.5, shrine.z + 6.5, Math.PI);
  bench(56, 12, 0.6);
  bench(38, 78, Math.PI * 0.95);
  for (const b of benches) {
    const cx = Math.cos(b.rot);
    const sz = -Math.sin(b.rot);
    for (const s of [-0.55, 0, 0.55]) blockers.push({ x: b.x + cx * s, z: b.z + sz * s, r: 0.22 });
  }
  blockers.push({ x: WELL.x, z: WELL.z, r: WELL.r });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    blockers.push({
      x: PAVILION.x + Math.cos(a) * PAVILION.r,
      z: PAVILION.z + Math.sin(a) * PAVILION.r,
      r: 0.16,
    });
  }
  // Schreingebäude als Kreisreihe (Rechteck)
  for (let x = SHRINE.x - SHRINE.w / 2; x <= SHRINE.x + SHRINE.w / 2; x += 0.5)
    for (let z = SHRINE.z - SHRINE.d / 2; z <= SHRINE.z + SHRINE.d / 2; z += 0.5)
      blockers.push({ x, z, r: 0.3 });
  // Mauer um den Aussichtspunkt mit Öffnung zum Weg
  const westweg = PATHS.find((p) => p.id === 'westweg')!.pts;
  const into = westweg[westweg.length - 2]!;
  const gapA = Math.atan2(into[1] - lk.z, into[0] - lk.x);
  const lookoutGap = { a: gapA, w: 0.42 };
  for (let a = 0; a < Math.PI * 2; a += 0.06) {
    let d = a - gapA;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) < lookoutGap.w) continue;
    blockers.push({ x: lk.x + Math.cos(a) * 7.3, z: lk.z + Math.sin(a) * 7.3, r: 0.25 });
  }

  // ── Dorf: Häuser, Mauern, Zäune und Marktstände
  const rects: Rect[] = [];
  for (const h of HOUSES)
    for (const fp of footprint(h.kind)) {
      const [x, z] = toWorld(h, fp.x, fp.z);
      rects.push({ x, z, hw: fp.hw, hd: fp.hd, rot: h.rot });
    }
  const seg = (x0: number, z0: number, x1: number, z1: number, half: number): Rect => ({
    x: (x0 + x1) / 2,
    z: (z0 + z1) / 2,
    hw: half,
    hd: Math.hypot(x1 - x0, z1 - z0) / 2,
    rot: Math.atan2(x1 - x0, z1 - z0),
  });
  for (const [x0, z0, x1, z1] of LOW_WALLS) rects.push(seg(x0, z0, x1, z1, 0.25));
  for (const [x0, z0, x1, z1] of FENCES) rects.push(seg(x0, z0, x1, z1, 0.08));
  for (const st of STALLS) rects.push({ x: st.x, z: st.z, hw: 1.2, hd: 0.6, rot: st.rot });
  rects.push({ x: BOARD_TABLE.x, z: BOARD_TABLE.z, hw: 0.45, hd: 0.45, rot: BOARD_TABLE.rot });

  // Blütenbaum und Weide am Teehaus (in landscape.ts gebaut)
  blockers.push({ x: 9.4, z: 5.6, r: 0.35 }, { x: -12.5, z: 6.5, r: 0.35 });

  cached = {
    benches,
    lookoutGap,
    trees,
    bamboo,
    rocks,
    tea,
    lanterns,
    gates,
    crossings: crossings(),
    blockers,
    rects,
  };
  return cached;
}

/** Ist (x, z) Teich, für Tests und Bewuchs am Haus */
export const inPond = (x: number, z: number): boolean => pondEdge(x, z) < 1;

/** Deckhöhe einer Brücke über Fluss oder Bach an (x, z), sonst null */
export function deckAt(x: number, z: number): number | null {
  for (const c of scatter().crossings) {
    const dx = x - c.x;
    const dz = z - c.z;
    if (Math.abs(dx) > c.len && Math.abs(dz) > c.len) continue;
    const s = Math.sin(c.yaw);
    const co = Math.cos(c.yaw);
    const along = dx * s + dz * co;
    const lat = dx * co - dz * s;
    if (Math.abs(along) > c.len / 2 || Math.abs(lat) > c.half + 0.2) continue;
    return deckY(c, along / c.len + 0.5);
  }
  return null;
}

/** Deckhöhe an Stelle u (0..1) entlang der Brücke: zwischen den Ufern, Steinbrücke mit Bogen */
export function deckY(c: Crossing, u: number): number {
  const f = field();
  const s = Math.sin(c.yaw);
  const co = Math.cos(c.yaw);
  const y0 = f.at(c.x - s * c.len * 0.5, c.z - co * c.len * 0.5);
  const y1 = f.at(c.x + s * c.len * 0.5, c.z + co * c.len * 0.5);
  const arch = c.kind === 'stone' ? 1.3 : 0.18;
  return y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * arch + 0.04;
}
