import { describe, expect, it } from 'vitest';
import { boundaryK, crossings, PATHS, PLACES, polyAt, polyLength } from '../src/world/map';
import { MAX_SLOPE_PATH, NavGrid, groundY } from '../src/world/nav';
import { deckAt, scatter } from '../src/world/scatter';
import { field, pathAt, rawHeight, streamLevel, waterAt } from '../src/world/terrain';

describe('Gelände', () => {
  it('Teehaus-Plateau bleibt flach, das Raster folgt der Höhenfunktion', () => {
    const f = field();
    for (const [x, z] of [
      [0, 0],
      [3, -3],
      [-4, 5],
    ])
      expect(Math.abs(f.at(x!, z!))).toBeLessThan(0.3);
    // an Gitterpunkten exakt die analytische Höhe
    expect(f.at(20, 40)).toBeCloseTo(rawHeight(20, 40), 4);
  });

  it('alle Orte liegen innerhalb der Spielgrenze und sind eben', () => {
    const f = field();
    for (const p of PLACES) {
      expect(boundaryK(p.x, p.z), p.id).toBeLessThan(0.2);
      if (p.flat) expect(f.slope(p.x, p.z), p.id).toBeLessThan(0.1);
    }
  });

  it('Wege sind begehbar (Steigung) und laufen nicht durchs Wasser außer auf Brücken', () => {
    const f = field();
    for (const p of PATHS) {
      const n = Math.ceil(polyLength(p.pts));
      for (let k = 0; k < n; k++) {
        const a = polyAt(p.pts, k / n);
        if (deckAt(a.x, a.z) !== null) continue;
        expect(waterAt(a.x, a.z), `${p.id} bei ${a.x.toFixed(0)},${a.z.toFixed(0)}`).toBeNull();
        expect(f.slope(a.x, a.z, 0.35), `${p.id} bei ${a.x.toFixed(0)},${a.z.toFixed(0)}`).toBeLessThan(
          MAX_SLOPE_PATH,
        );
      }
    }
  });

  it('Bäche fließen bergab', () => {
    for (const w of [0, 1] as const) {
      let prev = Infinity;
      for (let k = 0; k <= 50; k++) {
        const lv = streamLevel(w, k / 50);
        expect(lv).toBeLessThanOrEqual(prev + 1e-6);
        prev = lv;
      }
    }
  });
});

describe('Brücken und Bewuchs', () => {
  it('Fluss und Bach haben je mindestens eine Brücke', () => {
    const c = crossings();
    expect(c.some((b) => b.kind === 'stone')).toBe(true);
    expect(c.some((b) => b.kind === 'plank')).toBe(true);
    // Brückendeck liegt über dem Wasser
    for (const b of c) {
      const w = waterAt(b.x, b.z);
      expect(w).not.toBeNull();
      expect(deckAt(b.x, b.z)!).toBeGreaterThan(w!.level + 0.3);
      expect(groundY(b.x, b.z)).toBeCloseTo(deckAt(b.x, b.z)!, 5);
    }
  });

  it('kein Baum, Fels oder Strauch auf Wegen oder im Wasser', () => {
    const s = scatter();
    for (const t of [...s.trees, ...s.rocks, ...s.tea]) {
      expect(pathAt(t.x, t.z).d, `${t.x.toFixed(1)},${t.z.toFixed(1)}`).toBeGreaterThan(0.5);
      expect(waterAt(t.x, t.z)).toBeNull();
    }
    expect(s.trees.length).toBeGreaterThan(300);
  });
});

describe('Laufraster draußen', () => {
  const nav = new NavGrid();
  nav.setDoor(true);

  it('Wasser und Steilhänge sind gesperrt, Wege und Plätze frei', () => {
    expect(nav.walkable(0, 20)).toBe(true);
    expect(nav.walkable(40, 67)).toBe(true); // Dorfplatz (Mitte: Brunnen)
    expect(nav.walkable(-1.2, 11)).toBe(false); // Teich
    expect(nav.walkable(10, 82.5)).toBe(false); // Fluss
    expect(nav.walkable(0, -120)).toBe(false); // Berge hinter dem Tal
  });

  it('jeder Ort ist vom Teehaus aus zu Fuß erreichbar', () => {
    for (const p of PLACES) {
      if (p.id === 'teehaus') continue;
      const path = nav.path(0, -1, p.x, p.z);
      expect(path, p.id).not.toBeNull();
      const end = path![path!.length - 1]!;
      expect(Math.hypot(end[0] - p.x, end[1] - p.z), p.id).toBeLessThan(3);
    }
  });

  it('der Weg über die Flussbrücke führt auf die andere Seite', () => {
    const path = nav.path(40, 67, -24, 96);
    expect(path).not.toBeNull();
    // unterwegs über das Brückendeck
    const pts: [number, number][] = [[40, 67], ...path!];
    let onDeck = false;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1]!;
      const [bx, bz] = pts[i]!;
      for (let t = 0; t <= 1; t += 0.02)
        if (deckAt(ax + (bx - ax) * t, az + (bz - az) * t) !== null) onDeck = true;
    }
    expect(onDeck).toBe(true);
  });
});
