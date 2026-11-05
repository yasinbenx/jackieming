// Welche Geräusche gerade wie laut sind: Nähe zu Fluss und Bach, Bambushain, Dorf, Hühnern, Schrein; Regen.
import type { World } from './world';
import { place } from './map';
import { surfaceAt } from './terrain';

const near = (d: number, r: number): number => Math.max(0, Math.min(1, 1 - d / r));

/** Hühnergruppen (wie in three/critters) */
const HENS: [number, number][] = [
  [20.5, 64.5],
  [61.5, 60],
  [9.5, 55.5],
];

export function soundZone(w: World): {
  river: number;
  bamboo: number;
  village: number;
  chickens: number;
  shrine: number;
  rain: number;
} {
  const p = w.player.ch.root.position;
  const s = surfaceAt(p.x, p.z);
  const wet = s.waterKind >= 2 ? near(Math.max(0, s.waterD), s.waterKind === 3 ? 22 : 10) : 0;
  const dorf = place('dorf');
  const schrein = place('schrein');
  const night = w.pal.stars > 0.55;
  return {
    river: wet,
    bamboo: near(Math.hypot((p.x + 30) / 1.3, p.z - 24), 18),
    village: night ? 0 : near(Math.hypot(p.x - dorf.x, p.z - dorf.z), 45),
    chickens: night ? 0 : Math.max(...HENS.map(([x, z]) => near(Math.hypot(p.x - x, p.z - z), 16))),
    shrine: near(Math.hypot(p.x - schrein.x, p.z - schrein.z), 50),
    rain: w.weather.rain,
  };
}
