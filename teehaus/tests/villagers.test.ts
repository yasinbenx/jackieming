import { describe, expect, it } from 'vitest';
import { ERRANDS, SHOP, VILLAGERS } from '../src/content/villagers';
import { wordById } from '../src/content/words';
import { NavGrid } from '../src/world/nav';
import { scatter } from '../src/world/scatter';
import { villageSpots } from '../src/world/village';
import { buildWayGraph, route } from '../src/world/waygraph';

const nav = new NavGrid();
nav.setDoor(true);
const spots = villageSpots(scatter().benches);
const graph = buildWayGraph(
  spots,
  (x, z) => nav.walkable(x, z),
  (ax, az, bx, bz) => nav.path(ax, az, bx, bz),
);

describe('Dorfbewohner', () => {
  it('15–25 Bewohner mit eindeutigen Namen, Sprüchen und gültigem Lernwort', () => {
    expect(VILLAGERS.length).toBeGreaterThanOrEqual(15);
    expect(VILLAGERS.length).toBeLessThanOrEqual(25);
    expect(new Set(VILLAGERS.map((v) => v.id)).size).toBe(VILLAGERS.length);
    for (const v of VILLAGERS) {
      expect(v.lines.length, v.id).toBeGreaterThan(0);
      expect(wordById(v.word), `${v.id}: ${v.word}`).toBeDefined();
    }
  });

  it('alle Orte der Tagesabläufe gibt es und sie hängen am Wegenetz', () => {
    for (const v of VILLAGERS)
      for (const name of [v.home, ...v.schedule.map((s) => s.spot)]) {
        expect(spots[name], `${v.id}: ${name}`).toBeDefined();
        expect(graph.spotNode[name], `${v.id}: ${name} nicht angebunden`).toBeDefined();
      }
  });

  it('zwischen allen Programmpunkten und nach Hause gibt es einen Weg', () => {
    for (const v of VILLAGERS) {
      const names = [...v.schedule.map((s) => s.spot), v.home];
      for (let i = 0; i < names.length; i++) {
        const a = graph.spotNode[names[i]!]!;
        const b = graph.spotNode[names[(i + 1) % names.length]!]!;
        if (a === b) continue;
        expect(route(graph, a, b), `${v.id}: ${names[i]} → ${names[(i + 1) % names.length]}`).not.toBeNull();
      }
    }
  });

  it('Stehplätze liegen auf begehbarem Boden; Sitzplätze nur an Bänken und am Spieltisch', () => {
    for (const [name, s] of Object.entries(spots)) {
      if (s.inside || s.seat !== undefined) continue;
      expect(nav.walkable(s.x, s.z), name).toBe(true);
    }
    for (const v of VILLAGERS)
      for (const st of v.schedule)
        if (st.act === 'sit') expect(spots[st.spot]!.seat, `${v.id}: ${st.spot}`).toBeDefined();
  });

  it('Aufträge und Laden verweisen auf gültige Bewohner, Wörter und Garderobe', () => {
    for (const e of ERRANDS) {
      expect(VILLAGERS.some((v) => v.id === e.from && v.errand === e.id)).toBe(true);
      expect(VILLAGERS.some((v) => v.id === e.to)).toBe(true);
      expect(wordById(e.word)).toBeDefined();
    }
    expect(VILLAGERS.some((v) => v.shop)).toBe(true);
    for (const it of SHOP) {
      expect(it.price).toBeGreaterThan(0);
      if (it.gives.startsWith('word:')) expect(wordById(it.gives.slice(5)), it.id).toBeDefined();
      else expect(it.gives).toMatch(/^(head|outfit):/);
    }
  });
});
