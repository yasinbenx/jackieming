// Laufraster für Kollision und Wegfindung (A*). Das Teehaus samt Treppe und Teichbrücke hat ein feines Raster
// (0,2-m-Zellen), die Welt draußen ein eigenes (0,25 m), das aus Gelände, Wasser, Wegen und Bewuchs entsteht.
// Hindernisse sind um den Figurenradius aufgeblasen, sodass für die Bewegung ein einfacher Punkttest genügt.
import { BRIDGE, bridgeY, COUNTER, DOOR, FLOOR, HALL, PILLARS, STAIRS, TABLES, TERRACE } from './layout';
import { boundaryK } from './map';
import { deckAt, scatter } from './scatter';
import { field, surfaceAt } from './terrain';

export const AGENT_R = 0.28;
const CELL = 0.2;
const X0 = -11;
const Z0 = -7;
const W = Math.round(22 / CELL);
const H = Math.round(31 / CELL);

type Rect = { x0: number; x1: number; z0: number; z1: number };
const inRect = (x: number, z: number, r: Rect, pad = 0): boolean =>
  x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;

/** Bereich des feinen Rasters: Haus mit Terrasse (samt Wandstreifen) sowie Treppe und Teichbrücke */
const FINE_HOUSE: Rect = { x0: HALL.x0 - 0.6, x1: HALL.x1 + 0.6, z0: HALL.z0 - 0.6, z1: TERRACE.z1 + 0.05 };
const FINE_BRIDGE: Rect = { x0: BRIDGE.x - 1.6, x1: BRIDGE.x + 1.6, z0: TERRACE.z1, z1: BRIDGE.z1 };
export const inFine = (x: number, z: number): boolean =>
  inRect(x, z, FINE_HOUSE) || inRect(x, z, FINE_BRIDGE);

// ───────────────────────────────────────── Raster draußen

/** Höchste begehbare Steigung abseits der Wege und auf Wegen/Treppen */
export const MAX_SLOPE = 0.62;
export const MAX_SLOPE_PATH = 1.05;
const OC = 0.25;
const OX0 = -125;
const OZ0 = -115;
const OW = Math.round(250 / OC);
const OH = Math.round(265 / OC);
let outdoor: Uint8Array | null = null;

/** Begehbarkeit des Geländes ohne Hindernisse (Steigung, Wasser, Rand) */
export function terrainWalkable(x: number, z: number): boolean {
  if (boundaryK(x, z) > 0.62) return false;
  const f = field();
  const s = surfaceAt(x, z);
  if (s.waterD < 0.25) return false;
  const onPath = s.pathD < 0.3;
  if (f.slope(x, z, 0.35) > (onPath ? MAX_SLOPE_PATH : MAX_SLOPE)) return false;
  return true;
}

/** Laufraster draußen (einmal gebaut, ~0,5 s) */
function outdoorGrid(): Uint8Array {
  if (outdoor) return outdoor;
  const g = new Uint8Array(OW * OH);
  // Gelände in 0,5-m-Blöcken prüfen (je 2×2 Zellen)
  for (let j = 0; j < OH; j += 2) {
    for (let i = 0; i < OW; i += 2) {
      const x = OX0 + (i + 1) * OC;
      const z = OZ0 + (j + 1) * OC;
      if (!terrainWalkable(x, z)) continue;
      g[j * OW + i] = 1;
      if (i + 1 < OW) g[j * OW + i + 1] = 1;
      if (j + 1 < OH) {
        g[(j + 1) * OW + i] = 1;
        if (i + 1 < OW) g[(j + 1) * OW + i + 1] = 1;
      }
    }
  }
  const sc = scatter();
  // Brücken über Fluss und Bach (zwischen den Geländern)
  for (const c of sc.crossings) {
    const reach = c.len / 2 + 1;
    const s = Math.sin(c.yaw);
    const co = Math.cos(c.yaw);
    for (let j = Math.floor((c.z - reach - OZ0) / OC); j <= Math.ceil((c.z + reach - OZ0) / OC); j++) {
      for (let i = Math.floor((c.x - reach - OX0) / OC); i <= Math.ceil((c.x + reach - OX0) / OC); i++) {
        if (i < 0 || j < 0 || i >= OW || j >= OH) continue;
        const x = OX0 + (i + 0.5) * OC - c.x;
        const z = OZ0 + (j + 0.5) * OC - c.z;
        const along = x * s + z * co;
        const lat = x * co - z * s;
        if (Math.abs(along) > c.len / 2) continue;
        g[j * OW + i] = Math.abs(lat) < c.half - AGENT_R ? 1 : 0;
      }
    }
  }
  // Hindernisse (Stämme, Felsen, Laternen, Teesträucher …)
  for (const b of sc.blockers) {
    const rr = b.r + AGENT_R;
    for (let j = Math.floor((b.z - rr - OZ0) / OC); j <= Math.ceil((b.z + rr - OZ0) / OC); j++) {
      for (let i = Math.floor((b.x - rr - OX0) / OC); i <= Math.ceil((b.x + rr - OX0) / OC); i++) {
        if (i < 0 || j < 0 || i >= OW || j >= OH) continue;
        const dx = OX0 + (i + 0.5) * OC - b.x;
        const dz = OZ0 + (j + 0.5) * OC - b.z;
        if (dx * dx + dz * dz < rr * rr) g[j * OW + i] = 0;
      }
    }
  }
  outdoor = g;
  return g;
}

export function outdoorWalkable(x: number, z: number): boolean {
  const i = Math.floor((x - OX0) / OC);
  const j = Math.floor((z - OZ0) / OC);
  if (i < 0 || j < 0 || i >= OW || j >= OH) return false;
  if (inFine(x, z)) return false;
  // Streifen ums Haus (Terrassenkante, Wände): von außen nicht begehbar, sonst führen Wege an der Terrasse vorbei
  if (inRect(x, z, FINE_HOUSE, 0.5)) return false;
  return outdoorGrid()[j * OW + i] === 1;
}

/** Bodenhöhe an (x, z): Fußboden, Treppe, Brücke oder Gelände */
export function groundY(x: number, z: number): number {
  if (x >= HALL.x0 - 0.3 && x <= HALL.x1 + 0.3 && z >= HALL.z0 - 0.3 && z <= TERRACE.z1) return FLOOR;
  if (inRect(x, z, STAIRS)) {
    const u = (z - STAIRS.z0) / (STAIRS.z1 - STAIRS.z0);
    // drei Stufen: treppenförmig, aber leicht geglättet, damit die Figur nicht ruckelt
    const steps = Math.min(3, Math.floor(u * 3.2) + 0.5 * Math.min(1, ((u * 3.2) % 1) * 4));
    return FLOOR + (bridgeY(0) + 0.05 - FLOOR) * (steps / 3);
  }
  if (Math.abs(x - BRIDGE.x) <= BRIDGE.half + 0.25 && z >= BRIDGE.z0 && z <= BRIDGE.z1) {
    return bridgeY((z - BRIDGE.z0) / (BRIDGE.z1 - BRIDGE.z0)) + 0.06;
  }
  return deckAt(x, z) ?? field().at(x, z);
}

export interface Circle {
  x: number;
  z: number;
  r: number;
}

export class NavGrid {
  /** 1 = begehbar */
  private open = new Uint8Array(W * H);
  private doorOpen = false;
  readonly obstacles: Circle[] = [];
  readonly boxes: Rect[] = [];

  constructor() {
    this.build();
  }

  setDoor(open: boolean): void {
    this.doorOpen = open;
    this.build();
  }

  /** Grundflächen: Halle, Tür, Terrasse, Treppe, Brücke; außerhalb des Hauses das Raster draußen */
  private baseWalkable(x: number, z: number): boolean {
    if (!inFine(x, z)) return outdoorWalkable(x, z);
    const R = AGENT_R;
    if (x > HALL.x0 + R && x < HALL.x1 - R && z > HALL.z0 + R && z < HALL.z1 - R) return true;
    if (
      this.doorOpen &&
      x > DOOR.x0 + R &&
      x < DOOR.x1 - R &&
      z >= HALL.z1 - R - 0.05 &&
      z <= HALL.z1 + R + 0.05
    )
      return true;
    if (x > TERRACE.x0 + R && x < TERRACE.x1 - R && z > TERRACE.z0 + R && z < TERRACE.z1 - R + 0.02)
      return true;
    if (x > STAIRS.x0 + R && x < STAIRS.x1 - R && z >= TERRACE.z1 - R - 0.05 && z <= STAIRS.z1 + 0.05)
      return true;
    if (Math.abs(x - BRIDGE.x) <= BRIDGE.half - 0.2 && z >= BRIDGE.z0 - 0.1 && z <= BRIDGE.z1 + 0.1)
      return true;
    return false;
  }

  private build(): void {
    this.obstacles.length = 0;
    this.boxes.length = 0;
    for (const [x, z] of PILLARS) this.obstacles.push({ x, z, r: 0.2 });
    for (const t of TABLES) this.obstacles.push({ x: t.x, z: t.z, r: t.r + 0.04 });
    // Theke samt Bereich dahinter (nur für den Teemeister)
    this.boxes.push({ x0: COUNTER.x0 - 0.9, x1: COUNTER.x1, z0: HALL.z0, z1: COUNTER.z1 });
    // Regale und Teeofen an den Wänden, Bambusgeländer der Terrasse, Steinlöwen
    this.boxes.push({ x0: 3.4, x1: 6.9, z0: HALL.z0, z1: -5.5 });
    this.boxes.push({ x0: -6.9, x1: -6.2, z0: -3.4, z1: -2.2 });
    this.obstacles.push(
      { x: -1.45, z: TERRACE.z1 - 0.3, r: 0.32 },
      { x: 1.45, z: TERRACE.z1 - 0.3, r: 0.32 },
    );
    // Katzenkissen und Pflanzen
    this.obstacles.push({ x: 6.2, z: 3.2, r: 0.3 });
    this.obstacles.push({ x: -6.5, z: 3.5, r: 0.3 }, { x: 6.5, z: -1, r: 0.3 });
    const R = AGENT_R;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = X0 + (i + 0.5) * CELL;
        const z = Z0 + (j + 0.5) * CELL;
        let ok = this.baseWalkable(x, z);
        if (ok) {
          for (const o of this.obstacles) {
            const dx = x - o.x;
            const dz = z - o.z;
            if (dx * dx + dz * dz < (o.r + R) ** 2) {
              ok = false;
              break;
            }
          }
        }
        if (ok) for (const b of this.boxes) if (inRect(x, z, b, R)) ok = false;
        this.open[j * W + i] = ok ? 1 : 0;
      }
    }
  }

  private idx(x: number, z: number): number {
    const i = Math.floor((x - X0) / CELL);
    const j = Math.floor((z - Z0) / CELL);
    if (i < 0 || j < 0 || i >= W || j >= H) return -1;
    return j * W + i;
  }

  walkable(x: number, z: number): boolean {
    if (!inFine(x, z)) return outdoorWalkable(x, z);
    const k = this.idx(x, z);
    return k >= 0 && this.open[k] === 1;
  }

  /** Bewegung mit Gleiten an Hindernissen. Gibt die neue Position zurück. */
  move(x: number, z: number, dx: number, dz: number): [number, number] {
    if (this.walkable(x + dx, z + dz)) return [x + dx, z + dz];
    if (Math.abs(dx) > 1e-5 && this.walkable(x + dx, z)) return [x + dx, z];
    if (Math.abs(dz) > 1e-5 && this.walkable(x, z + dz)) return [x, z + dz];
    // Falls die Figur doch in einer gesperrten Zelle steht (z. B. nach dem Aufstehen): herausschieben erlauben
    if (!this.walkable(x, z)) return [x + dx, z + dz];
    return [x, z];
  }

  /** Nächste begehbare Zelle zu (x, z) */
  nearest(x: number, z: number, maxR = 3): [number, number] | null {
    if (this.walkable(x, z)) return [x, z];
    for (let r = CELL; r <= maxR; r += CELL) {
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos((a / 16) * Math.PI * 2) * r;
        const pz = z + Math.sin((a / 16) * Math.PI * 2) * r;
        if (this.walkable(px, pz)) return [px, pz];
      }
    }
    return null;
  }

  /** Sichtlinie auf dem Raster (für das Glätten von Pfaden) */
  private clear(ax: number, az: number, bx: number, bz: number): boolean {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(d / (CELL * 0.5));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      if (!this.walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  /** A* von a nach b; Rückgabe: geglättete Wegpunkte (ohne Startpunkt) oder null */
  path(ax: number, az: number, bx: number, bz: number): [number, number][] | null {
    const goal = this.nearest(bx, bz);
    if (!goal) return null;
    if (this.clear(ax, az, goal[0], goal[1])) return [goal];
    const inExt = (x: number, z: number): boolean => this.idx(x, z) >= 0;
    let g: Grid;
    if (inExt(ax, az) && inExt(goal[0], goal[1])) {
      // im Haus und davor: feines Raster
      g = { W, H, x0: X0, z0: Z0, c: CELL, ok: (k) => this.open[k] === 1 };
    } else {
      // draußen: Raster über dem Rechteck um Start und Ziel, mit Rand für Umwege (Brücken liegen oft abseits);
      // für weite Wege gröber (0,5 m), damit die Suche schnell bleibt
      const dist = Math.hypot(goal[0] - ax, goal[1] - az);
      const c = dist > 50 ? OC * 2 : OC;
      const m = Math.min(90, 30 + dist * 0.5);
      const x0 = Math.min(ax, goal[0]) - m;
      const z0 = Math.min(az, goal[1]) - m;
      const gw = Math.ceil((Math.max(ax, goal[0]) + m - x0) / c);
      const gh = Math.ceil((Math.max(az, goal[1]) + m - z0) / c);
      g = {
        W: gw,
        H: gh,
        x0,
        z0,
        c,
        ok: (k) => this.walkable(x0 + ((k % gw) + 0.5) * c, z0 + (Math.floor(k / gw) + 0.5) * c),
      };
    }
    // steht die Figur (z. B. nach dem Aufstehen) in einer gesperrten Zelle, ab der nächsten freien suchen
    const st = this.walkable(ax, az) ? [ax, az] : (this.nearest(ax, az, 1.5) ?? [ax, az]);
    const cells = astar(g, st[0]!, st[1]!, goal[0], goal[1]);
    if (!cells) return null;
    cells[cells.length - 1] = goal;
    // Glätten: so weit wie möglich geradeaus
    const out: [number, number][] = [];
    let cx = ax;
    let cz = az;
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.clear(cx, cz, cells[j]![0], cells[j]![1])) j--;
      out.push(cells[j]!);
      [cx, cz] = cells[j]!;
      i = j + 1;
    }
    return out;
  }
}

interface Grid {
  W: number;
  H: number;
  x0: number;
  z0: number;
  c: number;
  ok: (k: number) => boolean;
}

/** A* auf einem Raster (8 Nachbarn, keine Ecken schneiden); Rückgabe: Zellmitten vom Start (exkl.) zum Ziel */
function astar(g: Grid, ax: number, az: number, bx: number, bz: number): [number, number][] | null {
  const { W: gw, H: gh, x0, z0, c } = g;
  const cell = (x: number, z: number): number => {
    const i = Math.floor((x - x0) / c);
    const j = Math.floor((z - z0) / c);
    return i < 0 || j < 0 || i >= gw || j >= gh ? -1 : j * gw + i;
  };
  const s = cell(ax, az);
  const t = cell(bx, bz);
  if (s < 0 || t < 0) return null;
  const n = gw * gh;
  const gScore = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  // Begehbarkeit nur einmal pro Zelle abfragen (0 = unbekannt, 1 = frei, 2 = gesperrt)
  const known = new Uint8Array(n);
  const open = (k: number): boolean => {
    if (!known[k]) known[k] = g.ok(k) ? 1 : 2;
    return known[k] === 1;
  };
  const ti = t % gw;
  const tj = Math.floor(t / gw);
  const h = (k: number): number => {
    const dx = Math.abs((k % gw) - ti);
    const dz = Math.abs(Math.floor(k / gw) - tj);
    return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
  };
  // einfache binäre Halde
  const heap: [number, number][] = [];
  const push = (f: number, k: number): void => {
    heap.push([f, k]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p]![0] <= heap[i]![0]) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      i = p;
    }
  };
  const pop = (): number => {
    const top = heap[0]![1];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };
  gScore[s] = 0;
  push(h(s), s);
  let found = false;
  let iter = 0;
  while (heap.length && iter++ < 300000) {
    const k = pop();
    if (k === t) {
      found = true;
      break;
    }
    if (closed[k]) continue;
    closed[k] = 1;
    const ci = k % gw;
    const cj = Math.floor(k / gw);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= gw || nj >= gh) continue;
        const nk = nj * gw + ni;
        if (nk !== t && !open(nk)) continue;
        // keine Ecken schneiden
        if (di && dj && (!open(cj * gw + ni) || !open(nj * gw + ci))) continue;
        const cost = gScore[k]! + (di && dj ? 1.414 : 1);
        if (cost < gScore[nk]!) {
          gScore[nk] = cost;
          came[nk] = k;
          push(cost + h(nk), nk);
        }
      }
    }
  }
  if (!found) return null;
  const cells: [number, number][] = [];
  for (let k = t; k !== s && k >= 0; k = came[k]!) {
    cells.push([x0 + ((k % gw) + 0.5) * c, z0 + (Math.floor(k / gw) + 0.5) * c]);
  }
  cells.reverse();
  return cells.length ? cells : [[bx, bz]];
}
