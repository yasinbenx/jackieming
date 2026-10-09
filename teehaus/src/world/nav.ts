// Laufraster für Kollision und Wegfindung (A*). Der Boden wird in 0,2-m-Zellen eingeteilt; Hindernisse sind um
// den Figurenradius aufgeblasen, sodass für die Bewegung ein einfacher Punkttest genügt.
import { heightAt } from '../three/landscape';
import { BRIDGE, bridgeY, COUNTER, DOOR, FLOOR, HALL, PILLARS, STAIRS, TABLES, TERRACE } from './layout';

export const AGENT_R = 0.28;
const CELL = 0.2;
const X0 = -11;
const Z0 = -7;
const W = Math.round(22 / CELL);
const H = Math.round(31 / CELL);

type Rect = { x0: number; x1: number; z0: number; z1: number };
const inRect = (x: number, z: number, r: Rect, pad = 0): boolean =>
  x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;

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
  return heightAt(x, z);
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

  /** Grundflächen: Halle, Tür, Terrasse, Treppe, Brücke und das Wegstück hinter der Brücke */
  private baseWalkable(x: number, z: number): boolean {
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
    if (x > -3.6 && x < 4.6 && z > BRIDGE.z1 && z < BRIDGE.z1 + 7.5) {
      // Wiese hinter der Brücke, aber nicht ins Wasser
      const dx = (x - -1.2) / 6.9;
      const dz = (z - 11) / 3.6;
      return dx * dx + dz * dz > 1;
    }
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
    const s = this.idx(ax, az);
    const g = this.idx(goal[0], goal[1]);
    if (s < 0 || g < 0) return null;
    if (this.clear(ax, az, goal[0], goal[1])) return [goal];
    const gScore = new Float32Array(W * H).fill(Infinity);
    const came = new Int32Array(W * H).fill(-1);
    const closed = new Uint8Array(W * H);
    const gi = g % W;
    const gj = Math.floor(g / W);
    const h = (k: number): number => {
      const dx = Math.abs((k % W) - gi);
      const dz = Math.abs(Math.floor(k / W) - gj);
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
    while (heap.length && iter++ < 40000) {
      const k = pop();
      if (k === g) {
        found = true;
        break;
      }
      if (closed[k]) continue;
      closed[k] = 1;
      const ci = k % W;
      const cj = Math.floor(k / W);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di;
          const nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
          const nk = nj * W + ni;
          if (!this.open[nk] && nk !== g) continue;
          // keine Ecken schneiden
          if (di && dj && (!this.open[cj * W + ni] || !this.open[nj * W + ci])) continue;
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
    for (let k = g; k !== s && k >= 0; k = came[k]!) {
      cells.push([X0 + ((k % W) + 0.5) * CELL, Z0 + (Math.floor(k / W) + 0.5) * CELL]);
    }
    cells.reverse();
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
