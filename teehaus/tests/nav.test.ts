// Wegfindung im Teehaus: alle Plätze erreichbar, Tür, Brücke, keine Abkürzung durch Wände
import { describe, expect, it } from 'vitest';
import { NavGrid } from '../src/world/nav';
import { HALL, INSIDE, SEATS, START } from '../src/world/layout';
import { approachPoint } from '../src/world/seating';

describe('NavGrid', () => {
  const nav = new NavGrid();
  nav.setDoor(true);
  const approach = (s: (typeof SEATS)[number]) => approachPoint(s, (x, z) => nav.walkable(x, z));

  it('Startpunkt drinnen ist begehbar', () => {
    expect(nav.walkable(INSIDE.x, INSIDE.z)).toBe(true);
  });

  it.each(SEATS.filter((s) => s.free).map((s) => [s.id, s] as const))(
    'freier Platz %s ist von drinnen erreichbar',
    (_id, s) => {
      const a = approach(s);
      const p = nav.path(INSIDE.x, INSIDE.z, a.x, a.z);
      expect(p).not.toBeNull();
      const end = p![p!.length - 1]!;
      expect(Math.hypot(end[0] - a.x, end[1] - a.z)).toBeLessThan(0.3);
    },
  );

  it('von der Brücke ins Haus nur durch die Tür', () => {
    const p = nav.path(START.x, START.z, INSIDE.x, INSIDE.z);
    expect(p).not.toBeNull();
    // der Weg kreuzt die Vorderwand nur im Türbereich
    let prev: [number, number] = [START.x, START.z];
    for (const q of p!) {
      if ((prev[1] - HALL.z1) * (q[1] - HALL.z1) < 0) {
        const t = (HALL.z1 - prev[1]) / (q[1] - prev[1]);
        const x = prev[0] + (q[0] - prev[0]) * t;
        expect(Math.abs(x)).toBeLessThan(0.9);
      }
      prev = q;
    }
  });

  it('bei geschlossener Tür kein Weg hinein', () => {
    const closed = new NavGrid();
    closed.setDoor(false);
    expect(closed.path(START.x, START.z, INSIDE.x, INSIDE.z)).toBeNull();
  });

  it('Wegpunkte liegen alle auf begehbarem Boden', () => {
    for (const s of SEATS.filter((x) => x.free)) {
      const a = approach(s);
      for (const q of nav.path(INSIDE.x, INSIDE.z, a.x, a.z) ?? [])
        expect(nav.walkable(q[0], q[1])).toBe(true);
    }
  });
});
