import { describe, expect, it } from 'vitest';
import { NavGrid } from '../src/world/nav';
import { field, surfaceAt } from '../src/world/terrain';
import { HOUSES, HOUSE_SPECS, padOf, STALLS, toWorld, BOARD_TABLE, villageSpots } from '../src/world/village';
import { pathAt, waterAt } from '../src/world/terrain';
import { scatter } from '../src/world/scatter';

const inPad = (h: (typeof HOUSES)[number], x: number, z: number): boolean => {
  const c = Math.cos(h.rot);
  const s = Math.sin(h.rot);
  const dx = x - h.x;
  const dz = z - h.z;
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const p = padOf(h.kind);
  return Math.abs(lx) < p.hw && lz > -p.hd && lz < p.hd + p.front;
};

/** Punkte auf dem Hausplatz (lokal abgetastet, Rand ausgenommen) */
function padPoints(h: (typeof HOUSES)[number], inset = 0.6): [number, number][] {
  const p = padOf(h.kind);
  const pts: [number, number][] = [];
  for (let lx = -p.hw + inset; lx <= p.hw - inset; lx += 0.5)
    for (let lz = -p.hd + inset; lz <= p.hd + p.front - inset; lz += 0.5) pts.push(toWorld(h, lx, lz));
  return pts;
}

describe('Dorf', () => {
  it('8–12 Häuser aus mindestens fünf Arten', () => {
    expect(HOUSES.length).toBeGreaterThanOrEqual(8);
    expect(HOUSES.length).toBeLessThanOrEqual(12);
    expect(new Set(HOUSES.map((h) => h.kind)).size).toBeGreaterThanOrEqual(5);
    for (const h of HOUSES) expect(HOUSE_SPECS.some((s) => s.id === h.kind)).toBe(true);
  });

  it('Hausplätze überlappen nicht und liegen nicht auf Wegen oder im Wasser', () => {
    for (const h of HOUSES) {
      for (const [x, z] of padPoints(h, 0)) {
        const s = surfaceAt(x, z);
        expect(s.pathD, `${h.kind} ${h.seed} Weg`).toBeGreaterThan(0.3);
        expect(s.waterD, `${h.kind} ${h.seed} Wasser`).toBeGreaterThan(0.5);
        for (const o of HOUSES)
          if (o !== h) expect(inPad(o, x, z), `${h.kind} ${h.seed} / ${o.kind} ${o.seed}`).toBe(false);
      }
    }
  });

  it('Gelände unter jedem Haus ist eben', () => {
    const f = field();
    for (const h of HOUSES) {
      const hs = padPoints(h, 1.0).map(([x, z]) => f.at(x, z));
      expect(Math.max(...hs) - Math.min(...hs), `${h.kind} ${h.seed}`).toBeLessThan(0.3);
    }
  });

  it('Häuser sind nicht begehbar, Vorplätze und der Hof des Hofhauses schon; alles vom Teehaus erreichbar', () => {
    const nav = new NavGrid();
    nav.setDoor(true);
    for (const h of HOUSES) {
      // Hausmitte gesperrt (außer beim Hofhaus: dort ist die Mitte der Hof)
      if (h.kind !== 'hofhaus') expect(nav.walkable(h.x, h.z), `${h.kind} ${h.seed}`).toBe(false);
      const [fx, fz] = toWorld(h, 0, padOf(h.kind).hd + padOf(h.kind).front - 0.4);
      const p = nav.path(40, 67, fx, fz);
      expect(p, `Vorplatz ${h.kind} ${h.seed}`).not.toBeNull();
    }
    const hof = HOUSES.find((h) => h.kind === 'hofhaus')!;
    const [cx, cz] = toWorld(hof, 0, 2.5);
    expect(nav.walkable(cx, cz)).toBe(true);
    const p = nav.path(0, -1, cx, cz);
    expect(p).not.toBeNull();
    const end = p![p!.length - 1]!;
    expect(Math.hypot(end[0] - cx, end[1] - cz)).toBeLessThan(0.5);
  });

  it('Marktstände: 8 Sorten, frei von Wegen, Wasser, Häusern, Bänken und einander', () => {
    expect(STALLS.length).toBe(8);
    expect(new Set(STALLS.map((s) => s.goods)).size).toBe(8);
    const benches = scatter().benches;
    for (const st of STALLS) {
      // Ecken und Mitte des Stands (2,4 × 1,2 m)
      const c = Math.cos(st.rot);
      const s = Math.sin(st.rot);
      for (const [lx, lz] of [
        [0, 0],
        [-1.2, -0.6],
        [1.2, -0.6],
        [-1.2, 0.6],
        [1.2, 0.6],
      ] as const) {
        const x = st.x + lx * c + lz * s;
        const z = st.z - lx * s + lz * c;
        expect(pathAt(x, z).d, `${st.goods} auf Weg`).toBeGreaterThan(0.3);
        expect(waterAt(x, z), `${st.goods} im Wasser`).toBeNull();
        for (const h of HOUSES) expect(inPad(h, x, z), `${st.goods} auf Haus ${h.kind}`).toBe(false);
      }
      for (const b of benches)
        expect(Math.hypot(b.x - st.x, b.z - st.z), `${st.goods} an Bank`).toBeGreaterThan(2.2);
      expect(Math.hypot(BOARD_TABLE.x - st.x, BOARD_TABLE.z - st.z)).toBeGreaterThan(2.5);
      for (const o of STALLS) if (o !== st) expect(Math.hypot(o.x - st.x, o.z - st.z)).toBeGreaterThan(3.2);
    }
    // Händler- und Kundenplatz begehbar
    const nav = new NavGrid();
    const sp = villageSpots(benches);
    for (const st of STALLS) {
      const k = sp[`kunde-${st.goods}`]!;
      expect(nav.walkable(k.x, k.z), `Kundenplatz ${st.goods}`).toBe(true);
    }
  });
});
