// Geländehöhe der ganzen Welt, ohne three.js. Aufbau in Schichten:
//  1. Nahbereich ums Teehaus (bisherige Form mit Teichmulde) geht weich in das große Tal über
//  2. Tal: hinten (−z) Berghang, vorn fällt es zum Fluss, dahinter steigt es wieder; Hügel, Schreinberg, Grat
//  3. Ränder: jenseits der Grenze steile Berge (weiche Spielgrenze, keine unsichtbaren Wände)
//  4. Orte werden geebnet, Wege quer zur Laufrichtung flach gezogen
//  5. Reisterrassen, Bachbetten und Flussbett werden eingeschnitten
// Die gerenderte und begehbare Oberfläche ist das Raster `field()` (1 m), dessen Dreiecke genau dem Mesh
// entsprechen; so stehen Figuren und Objekte exakt auf dem sichtbaren Boden.
import { fbm, lerp, noise2, smoothstep } from '../three/noise';
import {
  boundaryK,
  PATHS,
  PLACES,
  polyAt,
  polyDist,
  polyLength,
  RIVER,
  RIVER_HALF,
  RIVER_LEVEL,
  STREAM_HALF,
  STREAM_IN,
  STREAM_OUT,
  TERRACES,
} from './map';
import type { P2 } from './map';
import { HOUSES, onHouse, padOf } from './village';

/** Teich (gleiche Werte wie three/shared POND; hier dupliziert, damit das Modul ohne three.js auskommt) */
const POND = { x: -1.2, z: 11, rx: 6.6, rz: 3.3 };

export function pondEdge(x: number, z: number): number {
  // < 1 im Teich; leicht unregelmäßiger Rand
  const dx = (x - POND.x) / POND.rx;
  const dz = (z - POND.z) / POND.rz;
  const a = Math.atan2(dz, dx);
  const wobble = 1 + Math.sin(a * 3 + 1.2) * 0.07 + Math.sin(a * 5 + 0.4) * 0.04;
  return Math.sqrt(dx * dx + dz * dz) / wobble;
}

/** Bisherige Form ums Teehaus: flaches Plateau, dahinter Hang, Teichmulde */
function near(x: number, z: number): number {
  const r = Math.hypot(x, z * 0.85);
  const rise = smoothstep(11, 70, r);
  const back = smoothstep(4, -30, z) * 0.6 + 0.4;
  let h = rise * (fbm(x * 0.025 + 3, z * 0.025, 4) * 26 + 3) * back;
  h += (fbm(x * 0.18, z * 0.18, 3) - 0.5) * 0.5 * smoothstep(7, 12, r);
  return h;
}

const bump = (x: number, z: number, cx: number, cz: number, r: number, h: number): number => {
  const d2 = ((x - cx) ** 2 + (z - cz) ** 2) / (r * r);
  return h * Math.exp(-d2);
};

interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
const bbox = (pts: readonly P2[], pad: number): Box => ({
  x0: Math.min(...pts.map((p) => p[0])) - pad,
  x1: Math.max(...pts.map((p) => p[0])) + pad,
  z0: Math.min(...pts.map((p) => p[1])) - pad,
  z1: Math.max(...pts.map((p) => p[1])) + pad,
});
const inBox = (b: Box, x: number, z: number): boolean => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;

const RIVER_BOX = bbox(RIVER, 16);
const PATH_BOXES = PATHS.map((p) => bbox(p.pts, p.half + 4));

/** Großform des Tals */
function valley(x: number, z: number): number {
  const north = smoothstep(-6, -78, z) * 18;
  const south = -smoothstep(18, 74, z) * 5.4;
  const far = smoothstep(90, 134, z) * 15;
  const side = smoothstep(58, 108, Math.abs(x)) * 9;
  let hills = (fbm(x * 0.017 + 3.1, z * 0.017 - 1.7, 4) - 0.42) * 26;
  // in Flussnähe und im Dorf ruhiger
  if (inBox(RIVER_BOX, x, z)) hills *= 1 - 0.75 * smoothstep(26, 6, polyDist(RIVER, x, z).d);
  hills *= 1 - 0.6 * smoothstep(34, 12, Math.hypot(x - 36, z - 58));
  let h = north + south + far + side + hills;
  h += bump(x, z, 64, -64, 20, 7); // Schreinberg
  h += bump(x, z, -66, -46, 17, 14); // Grat mit Aussichtspunkt
  h += bump(x, z, -80, -20, 22, 8);
  h += bump(x, z, 56, -8, 24, 2.5); // Teefeld, sanfter Hang
  h += bump(x, z, -30, 26, 16, -1.2); // Mulde im Bambushain
  h += (fbm(x * 0.16, z * 0.16, 3) - 0.5) * 0.7;
  return h;
}

/** Schicht 1–3 */
function h0(x: number, z: number): number {
  const r = Math.hypot(x, z * 0.85);
  const k = smoothstep(13, 30, r);
  let h = k <= 0 ? near(x, z) : k >= 1 ? valley(x, z) : lerp(near(x, z), valley(x, z), k);
  const b = boundaryK(x, z);
  if (b > 0) h += b * b * (30 + fbm(x * 0.03, z * 0.03, 3) * 44) + smoothstep(0.6, 1, b) * 20;
  return h;
}

/** Breite der Böschung um ebene Orte (m) */
const RAMP = 16;

/** Ebene Hausplätze im Dorf: Höhe in der Hausmitte, weiche Böschung rundum */
const PAD_MARGIN = 2.8;
const padH = new Map<number, number>();
function pads(x: number, z: number, h: number): number {
  // liegt der Punkt auf einem Hausplatz, gilt dessen Höhe; sonst gewichtetes Mittel der nahen Böschungen
  let wsum = 0;
  let acc = 0;
  let wmax = 0;
  for (let i = 0; i < HOUSES.length; i++) {
    const hs = HOUSES[i]!;
    const dx = x - hs.x;
    const dz = z - hs.z;
    if (dx * dx + dz * dz > 120) continue;
    const c = Math.cos(hs.rot);
    const sn = Math.sin(hs.rot);
    const lx = dx * c - dz * sn;
    const lz = dx * sn + dz * c;
    const p = padOf(hs.kind);
    const ex = Math.max(0, Math.abs(lx) - p.hw);
    const ez = Math.max(0, -p.hd - lz, lz - p.hd - p.front);
    const d = Math.hypot(ex, ez);
    if (d > PAD_MARGIN) continue;
    let t = padH.get(i);
    if (t === undefined) {
      t = h1base(hs.x, hs.z);
      padH.set(i, t);
    }
    if (d === 0) return t;
    const k = smoothstep(PAD_MARGIN, 0, d);
    acc += k * t;
    wsum += k;
    wmax = Math.max(wmax, k);
  }
  return wsum > 0 ? lerp(h, acc / wsum, wmax) : h;
}

/** Schicht 4a: Orte und Hausplätze ebnen */
function h1(x: number, z: number): number {
  return pads(x, z, h1base(x, z));
}

function h1base(x: number, z: number): number {
  let h = h0(x, z);
  for (const p of PLACES) {
    if (!p.flat) continue;
    const d = Math.hypot(x - p.x, z - p.z);
    if (d > p.flat + RAMP) continue;
    h = lerp(h, placeHeight(p.id), smoothstep(p.flat + RAMP, p.flat, d));
  }
  return h;
}

const placeH = new Map<string, number>();
function placeHeight(id: string): number {
  let v = placeH.get(id);
  if (v === undefined) {
    const p = PLACES.find((q) => q.id === id)!;
    v = p.h ?? h0(p.x, p.z);
    placeH.set(id, v);
  }
  return v;
}

/** Längsprofil eines Wegs: Geländehöhe entlang der Achse, geglättet (keine Sprünge an Hügelkuppen) */
const profiles = new Map<number, Float32Array>();
function profile(i: number): Float32Array {
  let pr = profiles.get(i);
  if (pr) return pr;
  const p = PATHS[i]!;
  const n = Math.max(2, Math.ceil(polyLength(p.pts)));
  pr = new Float32Array(n + 1);
  // Stützstellen auf ebenen Orten bleiben fest, damit Weg und Platz nahtlos ineinander übergehen
  const fixed = new Uint8Array(n + 1);
  for (let k = 0; k <= n; k++) {
    const q = polyAt(p.pts, k / n);
    pr[k] = h1(q.x, q.z);
    for (const pl of PLACES)
      if (pl.flat && Math.hypot(q.x - pl.x, q.z - pl.z) < pl.flat) {
        fixed[k] = 1;
        pr[k] = placeHeight(pl.id);
      }
  }
  // Wege, die an einem früheren Weg beginnen oder enden, übernehmen dort dessen Höhe (keine Stufe an Kreuzungen)
  for (const k of [0, n]) {
    const q = polyAt(p.pts, k / n);
    for (let j = 0; j < i; j++) {
      const o = polyDist(PATHS[j]!.pts, q.x, q.z);
      if (o.d < 0.6) {
        pr[k] = profileAt(j, o.t);
        fixed[k] = 1;
        break;
      }
    }
  }
  // Enden und Platzstücke festhalten, dazwischen mehrfach glätten; das Fenster wird zu festen Stellen hin kleiner
  const R = 6;
  const room = new Int32Array(n + 1);
  for (let k = 0; k <= n; k++) {
    let r = Math.min(R, k, n - k);
    for (let m = 1; m <= r; m++) if (fixed[k - m] || fixed[k + m]) r = m - 1;
    room[k] = r;
  }
  for (let pass = 0; pass < 4; pass++) {
    const src = pr.slice();
    for (let k = 1; k < n; k++) {
      if (fixed[k]) continue;
      let sum = 0;
      let cnt = 0;
      const r = room[k]!;
      for (let m = k - r; m <= k + r; m++) {
        sum += src[m]!;
        cnt++;
      }
      pr[k] = sum / cnt;
    }
  }
  profiles.set(i, pr);
  return pr;
}
function profileAt(i: number, t: number): number {
  const pr = profile(i);
  const n = pr.length - 1;
  const f = Math.max(0, Math.min(1, t)) * n;
  const k = Math.min(n - 1, Math.floor(f));
  return lerp(pr[k]!, pr[k + 1]!, f - k);
}

/** Schicht 4b: Wege quer flach (Höhe aus dem geglätteten Längsprofil), weiche Böschung */
function h2(x: number, z: number): number {
  let h = h1(x, z);
  // an Kreuzungen die Wegprofile gewichtet mitteln (statt nacheinander), damit keine Kanten entstehen
  let wsum = 0;
  let wmax = 0;
  let acc = 0;
  for (let i = 0; i < PATHS.length; i++) {
    if (!inBox(PATH_BOXES[i]!, x, z)) continue;
    const p = PATHS[i]!;
    const q = polyDist(p.pts, x, z);
    const w = p.half + 3.2;
    if (q.d > w) continue;
    const k = smoothstep(w, p.half * 0.8, q.d);
    if (k <= 0) continue;
    acc += k * profileAt(i, q.t);
    wsum += k;
    wmax = Math.max(wmax, k);
  }
  if (wsum > 0) h = lerp(h, acc / wsum, wmax);
  // ebene Orte haben Vorrang vor Wegböschungen
  for (const p of PLACES) {
    if (!p.flat) continue;
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.flat + 2) h = lerp(h, placeHeight(p.id), smoothstep(p.flat + 2, p.flat - 1, d));
  }
  return h;
}

/** Terrassen: Höhe in Stufen, kurze steile Kanten */
export function terraceK(x: number, z: number): number {
  const T = TERRACES;
  const d = Math.hypot((x - T.x) / T.rx, (z - T.z) / T.rz);
  return smoothstep(1, 0.7, d);
}
function terrace(h: number, k: number): number {
  if (k <= 0) return h;
  const s = TERRACES.step;
  const f = h / s;
  const fl = Math.floor(f);
  const q = (fl + smoothstep(0.84, 1, f - fl)) * s;
  return lerp(h, q, k);
}

// ───────────────────────────────────────── Wasserläufe

/** Wasserspiegel entlang eines Bachs: fällt stetig, folgt dem Gelände (in Stützstellen pro Meter) */
interface Channel {
  pts: readonly P2[];
  box: Box;
  /** Spiegelhöhe an Stelle t (0..1), linear zwischen Stützstellen */
  levels: Float32Array;
}

function makeChannel(pts: readonly P2[], start: number | null, end: number): Channel {
  let len = 0;
  for (let i = 1; i < pts.length; i++)
    len += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  const n = Math.max(2, Math.ceil(len));
  const levels = new Float32Array(n + 1);
  // entlang der Achse abtasten
  let seg = 0;
  let acc = 0;
  const segLen = (i: number): number => Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]);
  let prev = start ?? Infinity;
  for (let k = 0; k <= n; k++) {
    const d = (k / n) * len;
    while (seg < pts.length - 2 && d > acc + segLen(seg)) {
      acc += segLen(seg);
      seg++;
    }
    const u = Math.min(1, (d - acc) / (segLen(seg) || 1));
    const x = pts[seg]![0] + (pts[seg + 1]![0] - pts[seg]![0]) * u;
    const z = pts[seg]![1] + (pts[seg + 1]![1] - pts[seg]![1]) * u;
    const g = h2(x, z) - 0.35;
    prev = Math.min(prev, g);
    levels[k] = prev;
  }
  // zum Ende hin auf den Zielspiegel einschwingen (Teich oder Fluss), nie wieder ansteigen
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const want = Math.max(levels[k]!, end + (1 - t) * 0.6);
    levels[k] = k > 0 ? Math.min(levels[k - 1]!, want) : want;
  }
  levels[n] = end;
  return { pts, box: bbox(pts, STREAM_HALF + 6), levels };
}

let channels: Channel[] | null = null;
function getChannels(): Channel[] {
  if (!channels) {
    channels = [makeChannel(STREAM_IN, null, 0.0), makeChannel(STREAM_OUT, 0.0, RIVER_LEVEL)];
  }
  return channels;
}

export function channelLevel(c: Channel, t: number): number {
  const n = c.levels.length - 1;
  const f = Math.max(0, Math.min(1, t)) * n;
  const i = Math.min(n - 1, Math.floor(f));
  return lerp(c.levels[i]!, c.levels[i + 1]!, f - i);
}

/** Wasserspiegel des Bachs (0 = Zufluss, 1 = Abfluss) an Stelle t */
export function streamLevel(which: 0 | 1, t: number): number {
  return channelLevel(getChannels()[which]!, t);
}

/** Schicht 5: Flussbett, Bachbetten (mit Uferkante über dem Spiegel) */
function carve(x: number, z: number, h: number): number {
  // auf Wegen keine flachen Uferböschungen: dort stehen die Brückenköpfe
  const onPath = pathAt(x, z).d < 1.2;
  for (const c of getChannels()) {
    if (!inBox(c.box, x, z)) continue;
    const q = polyDist(c.pts, x, z);
    const half = STREAM_HALF;
    // am Talrand schmal und steil (Klamm), damit man dort nicht am Ufer entlang aus der Welt läuft
    const w = half + lerp(4.5, 0.6, smoothstep(0.05, 0.45, boundaryK(x, z)));
    if (q.d > w || (onPath && q.d > half + 0.5)) continue;
    // im Teich selbst nichts tun (Teichmulde bleibt)
    if (pondEdge(x, z) < 1.05) continue;
    const lv = channelLevel(c, q.t);
    if (q.d < half) h = lv - 0.42 * (1 - (q.d / half) ** 2);
    else {
      const top = Math.max(lv + 0.22, Math.min(h, lv + 0.22 + (q.d - half) * 0.6));
      h = lerp(top, Math.max(h, lv + 0.22), smoothstep(half, w, q.d));
    }
  }
  if (inBox(RIVER_BOX, x, z)) {
    const q = polyDist(RIVER, x, z);
    const half = RIVER_HALF;
    const bk = boundaryK(x, z);
    const w = half + lerp(9, 0.6, smoothstep(0, 0.4, bk));
    if (q.d < w && !(onPath && q.d > half + 0.7) && !(q.d > half + 1 && onHouse(x, z, 0.5))) {
      const lv = RIVER_LEVEL;
      if (q.d < half) h = lv - 1.5 * (1 - (q.d / half) ** 2) - 0.1;
      else {
        const top = Math.max(lv + 0.3, Math.min(h, lv + 0.3 + (q.d - half) * 0.25));
        h = lerp(top, Math.max(h, lv + 0.3), smoothstep(half, w, q.d));
      }
    }
  }
  return h;
}

/** Analytische Geländehöhe (Bau des Rasters; zur Laufzeit `field().at` benutzen) */
export function rawHeight(x: number, z: number): number {
  let h = h2(x, z);
  h = terrace(h, terraceK(x, z));
  // Teichmulde
  const e = pondEdge(x, z);
  if (e < 1.25) h = lerp(h, -0.65, smoothstep(1.25, 0.82, e));
  return carve(x, z, h);
}

// ───────────────────────────────────────── Wasser-Abfrage

export type WaterKind = 'pond' | 'stream' | 'river';
/** Steht (x, z) im Wasser? Mit Wasserspiegel. */
export function waterAt(x: number, z: number, pad = 0): { kind: WaterKind; level: number } | null {
  if (pondEdge(x, z) < 1 + pad / POND.rz) return { kind: 'pond', level: 0.02 };
  if (inBox(RIVER_BOX, x, z) && polyDist(RIVER, x, z).d < RIVER_HALF + pad)
    return { kind: 'river', level: RIVER_LEVEL };
  for (const c of getChannels()) {
    if (!inBox(c.box, x, z)) continue;
    const q = polyDist(c.pts, x, z);
    if (q.d < STREAM_HALF + pad) return { kind: 'stream', level: channelLevel(c, q.t) };
  }
  return null;
}

/** Abstand zum nächsten Weg (m) und dessen Art */
export function pathAt(x: number, z: number): { d: number; kind: string; half: number } {
  let best = { d: Infinity, kind: '', half: 0 };
  for (let i = 0; i < PATHS.length; i++) {
    if (!inBox(PATH_BOXES[i]!, x, z)) continue;
    const p = PATHS[i]!;
    const d = polyDist(p.pts, x, z).d - p.half;
    if (d < best.d) best = { d, kind: p.kind, half: p.half };
  }
  return best;
}

// ───────────────────────────────────────── Raster

export const FIELD = { x0: -140, z0: -130, x1: 140, z1: 160, step: 1 };

export class TerrainField {
  readonly nx: number;
  readonly nz: number;
  readonly h: Float32Array;
  constructor(
    readonly x0: number,
    readonly z0: number,
    readonly step: number,
    nx: number,
    nz: number,
    fn: (x: number, z: number) => number,
  ) {
    this.nx = nx;
    this.nz = nz;
    this.h = new Float32Array((nx + 1) * (nz + 1));
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i <= nx; i++) this.h[j * (nx + 1) + i] = fn(x0 + i * step, z0 + j * step);
  }

  /** Höhe am Gitterpunkt */
  node(i: number, j: number): number {
    i = Math.max(0, Math.min(this.nx, i));
    j = Math.max(0, Math.min(this.nz, j));
    return this.h[j * (this.nx + 1) + i]!;
  }

  /** Höhe an (x, z), auf den Dreiecken interpoliert wie im Mesh (Diagonale von (i+1, j) nach (i, j+1)) */
  at(x: number, z: number): number {
    const fx = (x - this.x0) / this.step;
    const fz = (z - this.z0) / this.step;
    const i = Math.max(0, Math.min(this.nx - 1, Math.floor(fx)));
    const j = Math.max(0, Math.min(this.nz - 1, Math.floor(fz)));
    const u = Math.max(0, Math.min(1, fx - i));
    const v = Math.max(0, Math.min(1, fz - j));
    const W = this.nx + 1;
    const a = this.h[j * W + i]!;
    const b = this.h[j * W + i + 1]!;
    const c = this.h[(j + 1) * W + i]!;
    const d = this.h[(j + 1) * W + i + 1]!;
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }

  /** Steigung (Betrag des Gradienten) an (x, z) */
  slope(x: number, z: number, e = 0.5): number {
    const gx = (this.at(x + e, z) - this.at(x - e, z)) / (2 * e);
    const gz = (this.at(x, z + e) - this.at(x, z - e)) / (2 * e);
    return Math.hypot(gx, gz);
  }
}

let theField: TerrainField | null = null;
/** Das Höhenraster der Welt (wird beim ersten Zugriff gebaut, ~0,2 s) */
export function field(): TerrainField {
  if (!theField) {
    const F = FIELD;
    theField = new TerrainField(
      F.x0,
      F.z0,
      F.step,
      Math.round((F.x1 - F.x0) / F.step),
      Math.round((F.z1 - F.z0) / F.step),
      rawHeight,
    );
  }
  return theField;
}

// ───────────────────────────────────────── Untergrund je Rasterpunkt (einmal berechnet)

const PATH_KIND: Record<string, number> = { main: 1, side: 2, stairs: 3 };
export const WATER_KINDS: (WaterKind | null)[] = [null, 'pond', 'stream', 'river'];

export interface Surface {
  /** Abstand zum Wegrand (negativ = auf dem Weg), gedeckelt */
  pathD: Float32Array;
  /** 0 kein Weg, 1 Hauptweg, 2 Nebenweg, 3 Treppe (nächster Weg) */
  pathKind: Uint8Array;
  /** Abstand zum Wasserrand (negativ = im Wasser), gedeckelt */
  waterD: Float32Array;
  /** Index in WATER_KINDS (nächstes Gewässer) */
  waterKind: Uint8Array;
}

let theSurface: Surface | null = null;
/** Abstände zu Wegen und Wasser an jedem Punkt des 1-m-Rasters (für Laufraster, Gras und Bodenfarben) */
export function surface(): Surface {
  if (theSurface) return theSurface;
  const f = field();
  const W = f.nx + 1;
  const n = W * (f.nz + 1);
  const sf: Surface = {
    pathD: new Float32Array(n).fill(20),
    pathKind: new Uint8Array(n),
    waterD: new Float32Array(n).fill(20),
    waterKind: new Uint8Array(n),
  };
  const chans = getChannels();
  for (let j = 0; j <= f.nz; j++) {
    for (let i = 0; i <= f.nx; i++) {
      const x = f.x0 + i * f.step;
      const z = f.z0 + j * f.step;
      const k = j * W + i;
      const p = pathAt(x, z);
      if (p.d < 20) {
        sf.pathD[k] = p.d;
        sf.pathKind[k] = PATH_KIND[p.kind] ?? 0;
      }
      let wd = (pondEdge(x, z) - 1) * POND.rz;
      let wk = 1;
      if (inBox(RIVER_BOX, x, z)) {
        const d = polyDist(RIVER, x, z).d - RIVER_HALF;
        if (d < wd) {
          wd = d;
          wk = 3;
        }
      }
      for (const c of chans) {
        if (!inBox(c.box, x, z)) continue;
        const d = polyDist(c.pts, x, z).d - STREAM_HALF;
        if (d < wd) {
          wd = d;
          wk = 2;
        }
      }
      sf.waterD[k] = Math.min(20, wd);
      sf.waterKind[k] = wd < 20 ? wk : 0;
    }
  }
  theSurface = sf;
  return sf;
}

/** Abstände an (x, z), zwischen den Rasterpunkten interpoliert */
export function surfaceAt(
  x: number,
  z: number,
): { pathD: number; pathKind: number; waterD: number; waterKind: number } {
  const f = field();
  const sf = surface();
  const fx = (x - f.x0) / f.step;
  const fz = (z - f.z0) / f.step;
  const i = Math.max(0, Math.min(f.nx - 1, Math.floor(fx)));
  const j = Math.max(0, Math.min(f.nz - 1, Math.floor(fz)));
  const u = Math.max(0, Math.min(1, fx - i));
  const v = Math.max(0, Math.min(1, fz - j));
  const W = f.nx + 1;
  const k = j * W + i;
  const bil = (a: Float32Array): number =>
    (a[k]! * (1 - u) + a[k + 1]! * u) * (1 - v) + (a[k + W]! * (1 - u) + a[k + W + 1]! * u) * v;
  const near = k + (u > 0.5 ? 1 : 0) + (v > 0.5 ? W : 0);
  return {
    pathD: bil(sf.pathD),
    pathKind: sf.pathKind[near]!,
    waterD: bil(sf.waterD),
    waterKind: sf.waterKind[near]!,
  };
}

/** Leichtes Rauschen für Farbvarianten (0..1) */
export const tint = (x: number, z: number): number => noise2(x * 0.35, z * 0.35);
