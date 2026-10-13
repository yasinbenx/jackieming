// Das Dorf als reine Daten: Hausarten, Lage und Drehung jedes Hauses, Grundflächen für Gelände und Kollision,
// Mäuerchen, Zäune und Marktstände. Ohne three.js (Gelände, Laufraster und Tests lesen es mit).
import { place } from './map';

export type RoofKind = 'hip' | 'gable' | 'xieshan';

export interface HouseSpec {
  id: string;
  name: string;
  zh: string;
  /** Grundfläche (m), Front nach +z */
  w: number;
  d: number;
  floors: 1 | 2;
  roof: RoofKind;
  sign?: string;
  note: string;
}

export const HOUSE_SPECS: HouseSpec[] = [
  {
    id: 'wohnhaus',
    name: 'Wohnhaus',
    zh: '民居',
    w: 6,
    d: 4.6,
    floors: 1,
    roof: 'gable',
    note: 'Satteldach, Papierfenster, Reimpaare an der Tür, Wäscheleine und Holzstapel',
  },
  {
    id: 'teeladen',
    name: 'Teeladen',
    zh: '茶庄',
    w: 7,
    d: 5,
    floors: 1,
    roof: 'xieshan',
    sign: '茶庄',
    note: 'offene Ladenfront mit Theke, Teedosen, Körben und Laternen, Vordach',
  },
  {
    id: 'werkstatt',
    name: 'Werkstatt',
    zh: '木工坊',
    w: 6.4,
    d: 5,
    floors: 1,
    roof: 'gable',
    sign: '木工',
    note: 'Schreinerei: offene Halle, Hobelbank, Bretter, Fässer, Karren',
  },
  {
    id: 'gasthaus',
    name: 'Gasthaus',
    zh: '客栈',
    w: 8,
    d: 6,
    floors: 2,
    roof: 'xieshan',
    sign: '客栈',
    note: 'zweistöckig, Balkon mit Geländer, Laternen, Türvorhang, Bänke',
  },
  {
    id: 'schreinchen',
    name: 'Kleiner Schrein',
    zh: '土地庙',
    w: 2.6,
    d: 2.2,
    floors: 1,
    roof: 'hip',
    sign: '土地',
    note: 'Erdgott-Schrein: rote Säulen, Weihrauchbecken, Opfergaben',
  },
  {
    id: 'hofhaus',
    name: 'Hofhaus',
    zh: '四合院',
    w: 11,
    d: 10,
    floors: 1,
    roof: 'hip',
    sign: '福',
    note: 'größeres Haus mit Hofmauer, offenem Tor und begehbarem Hof mit Topfpflanzen und Fahrrad',
  },
  {
    id: 'lagerhaus',
    name: 'Lagerhaus',
    zh: '仓库',
    w: 7,
    d: 5,
    floors: 1,
    roof: 'gable',
    note: 'schlichter Speicher: Holzläden, breites Tor, Säcke, Fässer und Körbe',
  },
];
export const spec = (id: string): HouseSpec => HOUSE_SPECS.find((s) => s.id === id)!;

export interface HousePlacement {
  /** Hausart (HOUSE_SPECS) */
  kind: string;
  x: number;
  z: number;
  /** Blickrichtung der Front (rad, 0 = +z) */
  rot: number;
  /** Abwandlung (Schriftzeichen, Kleinkram) */
  seed: number;
}

const D = place('dorf');
/** Front zeigt auf (tx, tz) */
const facing = (x: number, z: number, tx: number, tz: number): number => Math.atan2(tx - x, tz - z);

/** Häuser in lockeren Gruppen: am Platz, an der Dorfrunde, am Hang im Osten, am Dorfweg */
export const HOUSES: HousePlacement[] = [
  { kind: 'gasthaus', x: 40, z: 41.8, rot: 0, seed: 1 },
  { kind: 'teeladen', x: 55.5, z: 47.5, rot: facing(55.5, 47.5, D.x, D.z), seed: 2 },
  { kind: 'schreinchen', x: 50, z: 38.5, rot: facing(50, 38.5, D.x - 2, D.z), seed: 3 },
  { kind: 'hofhaus', x: 64, z: 60, rot: -Math.PI / 2, seed: 4 },
  { kind: 'werkstatt', x: 56.5, z: 73, rot: facing(56.5, 73, D.x, D.z), seed: 5 },
  { kind: 'wohnhaus', x: 15.3, z: 58.8, rot: Math.PI / 2 - 0.15, seed: 6 },
  { kind: 'wohnhaus', x: 16.6, z: 70, rot: Math.PI / 2 + 0.35, seed: 7 },
  { kind: 'lagerhaus', x: 9, z: 49.5, rot: Math.PI / 2, seed: 8 },
  { kind: 'wohnhaus', x: 66.5, z: 45.5, rot: facing(66.5, 45.5, D.x, D.z), seed: 9 },
  { kind: 'wohnhaus', x: 27.8, z: 38.5, rot: 0.45, seed: 10 },
];

/** Lokale Koordinaten (Front nach +z) → Welt */
export function toWorld(h: { x: number; z: number; rot: number }, lx: number, lz: number): [number, number] {
  const c = Math.cos(h.rot);
  const s = Math.sin(h.rot);
  return [h.x + lx * c + lz * s, h.z - lx * s + lz * c];
}

/** Rechtecke (lokal: Mitte, Halbmaße), die nicht begehbar sind */
export function footprint(kind: string): { x: number; z: number; hw: number; hd: number }[] {
  const sp = spec(kind);
  if (kind === 'hofhaus') {
    const hw = sp.w / 2;
    const hd = sp.d / 2;
    const md = 4.4;
    return [
      { x: 0, z: -hd + md / 2, hw: 3.8, hd: md / 2 + 0.2 }, // Haupthaus
      { x: -hw, z: 0, hw: 0.2, hd }, // Mauern
      { x: hw, z: 0, hw: 0.2, hd },
      { x: -hw, z: -hd, hw, hd: 0.2 },
      { x: (-hw - 1.2) / 2, z: hd, hw: (hw - 1.2) / 2, hd: 0.2 },
      { x: (hw + 1.2) / 2, z: hd, hw: (hw - 1.2) / 2, hd: 0.2 },
    ];
  }
  // Sockel; vorn bleibt die Stufe frei begehbar
  return [{ x: 0, z: 0, hw: sp.w / 2 + 0.25, hd: sp.d / 2 + 0.25 }];
}

/** Ebene Fläche unter jedem Haus (lokal, mit Vorplatz) */
export function padOf(kind: string): { hw: number; hd: number; front: number } {
  const sp = spec(kind);
  return { hw: sp.w / 2 + 1.2, hd: sp.d / 2 + 1.0, front: kind === 'schreinchen' ? 2.2 : 1.6 };
}

/** Niedrige Steinmauern (Weltkoordinaten) */
export const LOW_WALLS: [number, number, number, number][] = [
  [26, 36.5, 34, 37.5], // hinter dem Wohnhaus am Dorfweg
  [44.5, 37.5, 50.5, 38.5],
  [69.5, 49, 70.5, 56],
  [9, 52, 13.5, 53.5],
];

/** Holzzäune (Weltkoordinaten) */
export const FENCES: [number, number, number, number][] = [
  [12.5, 60, 12.5, 64],
  [13, 72, 20.5, 73],
  [61, 75.5, 66, 74],
  [5.5, 44, 8, 50],
];

/** Marktstände auf dem Platz (Front zum Brunnen) */
export const STALLS: { x: number; z: number; rot: number; goods: 'gemuese' | 'obst' | 'tee' }[] = [
  { x: 32.2, z: 62.5, rot: facing(32.2, 62.5, D.x, D.z), goods: 'gemuese' },
  { x: 47.6, z: 56.2, rot: facing(47.6, 56.2, D.x, D.z), goods: 'obst' },
  { x: 44.5, z: 50.2, rot: facing(44.5, 50.2, D.x, D.z), goods: 'tee' },
];

/** Bambusbüsche zwischen den Häusern (Mitte, Radius) */
export const VILLAGE_BAMBOO: [number, number, number][] = [
  [21.5, 50.5, 1.6],
  [23, 61.5, 1.2],
  [51.5, 39, 1.5],
  [70, 64, 1.8],
  [10, 58, 1.5],
  [36, 37.5, 1.4],
];

/** Bäume im Dorf (Art, x, z, Größe) */
export const VILLAGE_TREES: [string, number, number, number][] = [
  ['ginkgo', 48.5, 51.5, 1.5],
  ['cherry', 27.5, 57, 1],
  ['cherry', 60, 40, 1.1],
  ['maple', 22, 74.5, 1],
  ['broad', 11, 63.5, 1.2],
];

/** Liegt (x, z) auf einer Hausgrundfläche (mit Rand)? */
export function onHouse(x: number, z: number, pad = 0): boolean {
  for (const h of HOUSES) {
    const c = Math.cos(h.rot);
    const s = Math.sin(h.rot);
    const dx = x - h.x;
    const dz = z - h.z;
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const p = padOf(h.kind);
    if (Math.abs(lx) < p.hw + pad && lz > -p.hd - pad && lz < p.hd + p.front + pad) return true;
  }
  return false;
}
