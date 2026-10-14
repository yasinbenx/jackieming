// Wegenetz der Dorfbewohner: Knoten entlang aller Wege (alle ~3 m, Kreuzungen zusammengelegt) und je ein
// Anschluss an die benannten Orte. Kürzeste Wege per Dijkstra – billig genug, um sie bei jedem Ortswechsel zu
// rechnen. Ohne three.js.
import { PATHS, polyAt, polyLength } from './map';
import type { Spot } from './village';

export interface WayGraph {
  x: Float32Array;
  z: Float32Array;
  /** Nachbarn je Knoten */
  adj: number[][];
  /** Knoten je Ort */
  spotNode: Record<string, number>;
}

const STEP = 3;
const MERGE = 1.2;

/**
 * Baut das Netz. walkable prüft, ob die gerade Strecke vom Weg zum Ort frei ist (Laufraster); Orte mit
 * inside dürfen auf den letzten Metern durch gesperrte Zellen (Ladentheke, Werkstatt).
 */
export function buildWayGraph(
  spots: Record<string, Spot>,
  walkable: (x: number, z: number) => boolean,
  /** Ersatz für Orte abseits der Wege: Wegsuche im Laufraster (A*), Rückgabe ohne Startpunkt */
  pathfind?: (ax: number, az: number, bx: number, bz: number) => [number, number][] | null,
): WayGraph {
  const xs: number[] = [];
  const zs: number[] = [];
  const adj: number[][] = [];
  const node = (x: number, z: number): number => {
    for (let i = 0; i < xs.length; i++) if (Math.hypot(xs[i]! - x, zs[i]! - z) < MERGE) return i;
    xs.push(x);
    zs.push(z);
    adj.push([]);
    return xs.length - 1;
  };
  const link = (a: number, b: number): void => {
    if (a === b) return;
    if (!adj[a]!.includes(b)) adj[a]!.push(b);
    if (!adj[b]!.includes(a)) adj[b]!.push(a);
  };
  for (const p of PATHS) {
    const len = polyLength(p.pts);
    const n = Math.max(1, Math.round(len / STEP));
    let prev = -1;
    for (let k = 0; k <= n; k++) {
      const q = polyAt(p.pts, k / n);
      const id = node(q.x, q.z);
      if (prev >= 0) link(prev, id);
      prev = id;
    }
  }
  const pathNodes = xs.length;
  const clear = (ax: number, az: number, bx: number, bz: number, tail: number): boolean => {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / 0.3);
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      if (d * (1 - t) < tail) break;
      if (!walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  };
  const spotNode: Record<string, number> = {};
  for (const [name, s] of Object.entries(spots)) {
    // im Haus/hinter Ständen und auf Sitzplätzen dürfen die letzten Meter gesperrt sein
    const tail = s.inside ? 2.6 : s.seat !== undefined ? 1.0 : 0.35;
    // nächste Wegknoten der Reihe nach, bis einer frei erreichbar ist
    const order = Array.from({ length: pathNodes }, (_, i) => i).sort(
      (a, b) => Math.hypot(xs[a]! - s.x, zs[a]! - s.z) - Math.hypot(xs[b]! - s.x, zs[b]! - s.z),
    );
    let anchor = -1;
    for (const i of order.slice(0, 12)) {
      if (Math.hypot(xs[i]! - s.x, zs[i]! - s.z) > 45) break;
      if (clear(xs[i]!, zs[i]!, s.x, s.z, tail)) {
        anchor = i;
        break;
      }
    }
    if (anchor < 0) {
      // über einen anderen, schon angeschlossenen Ort (z. B. Sitzplatz neben dem Brunnen)
      for (const [, other] of Object.entries(spotNode)) {
        const ox = xs[other]!;
        const oz = zs[other]!;
        if (Math.hypot(ox - s.x, oz - s.z) < 18 && clear(ox, oz, s.x, s.z, tail)) {
          anchor = other;
          break;
        }
      }
    }
    if (anchor < 0 && pathfind) {
      // quer übers Gelände: A* vom nächsten Wegknoten, die Strecke wird Teil des Netzes
      for (const i of order.slice(0, 3)) {
        const pts = pathfind(xs[i]!, zs[i]!, s.x, s.z);
        if (!pts || !pts.length) continue;
        let prev = i;
        for (const [px, pz] of pts.slice(0, -1)) {
          xs.push(px);
          zs.push(pz);
          adj.push([]);
          link(prev, xs.length - 1);
          prev = xs.length - 1;
        }
        anchor = prev;
        break;
      }
    }
    if (anchor < 0) continue;
    xs.push(s.x);
    zs.push(s.z);
    adj.push([]);
    const id = xs.length - 1;
    link(anchor, id);
    spotNode[name] = id;
  }
  return { x: Float32Array.from(xs), z: Float32Array.from(zs), adj, spotNode };
}

/** Kürzester Weg zwischen zwei Knoten als Punktfolge (ohne Start) */
export function route(g: WayGraph, from: number, to: number): [number, number][] | null {
  const n = g.x.length;
  const dist = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  dist[from] = 0;
  for (;;) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++)
      if (!done[i] && dist[i]! < best) {
        best = dist[i]!;
        u = i;
      }
    if (u < 0) return null;
    if (u === to) break;
    done[u] = 1;
    for (const v of g.adj[u]!) {
      const d = best + Math.hypot(g.x[u]! - g.x[v]!, g.z[u]! - g.z[v]!);
      if (d < dist[v]!) {
        dist[v] = d;
        prev[v] = u;
      }
    }
  }
  const out: [number, number][] = [];
  for (let v = to; v !== from && v >= 0; v = prev[v]!) out.push([g.x[v]!, g.z[v]!]);
  return out.reverse();
}

/** Nächster Knoten zu (x, z) */
export function nearestNode(g: WayGraph, x: number, z: number): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < g.x.length; i++) {
    const d = (g.x[i]! - x) ** 2 + (g.z[i]! - z) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}
