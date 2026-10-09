// Grundriss des Teehaus-Cafés (Meter, y nach oben). Eine Quelle für Bauwerk, Kollision, Wegfindung und NPCs.
import { POND } from '../three/shared';

/** Fußbodenhöhe innen und auf der Terrasse */
export const FLOOR = 0.5;
/** Haupthalle: Innenmaße */
export const HALL = { x0: -7, x1: 7, z0: -6, z1: 4 };
/** Raumhöhe bis zur Decke */
export const CEIL = FLOOR + 3.5;
export const WALL_T = 0.22;
/** Tür in der Vorderwand (z = HALL.z1). Der Türbalken ist niedriger als Yao Ming (2,29 m). */
export const DOOR = { x0: -0.85, x1: 0.85, h: 2.12 };
/** Terrasse vor dem Haus, zum Teich hin */
export const TERRACE = { x0: -7, x1: 7, z0: HALL.z1, z1: 6.4 };
/** Stufen von der Terrasse hinunter zur Brücke */
export const STAIRS = { x0: -1.0, x1: 1.0, z0: TERRACE.z1, z1: 7.1 };
/** Brücke über den Teich (x fest, z von z0 bis z1) */
export const BRIDGE = { x: 0, half: 0.55, z0: POND.z - POND.rz - 0.6, z1: POND.z + POND.rz + 0.6 };
/** Höhe der Brücke an Stelle s (0..1) */
export const bridgeY = (s: number): number => 0.15 + Math.sin(s * Math.PI) * 1.05;

/** Theke mit dem Teemeister (links hinten) */
export const COUNTER = { x0: -6.2, x1: -2.6, z0: -4.7, z1: -4.1 };

export interface Seat {
  id: string;
  /** Sitzposition (Mitte der Sitzfläche) */
  x: number;
  z: number;
  /** Blickrichtung beim Sitzen (rad, 0 = +z) */
  yaw: number;
  table: string;
  /** Höhe der Sitzfläche über dem Fußboden */
  h: number;
  /** Darf der Spieler sich hier hinsetzen? (sonst von einem NPC belegt) */
  free?: boolean;
}

export interface Table {
  id: string;
  x: number;
  z: number;
  r: number;
  /** Tischhöhe über dem Boden */
  h: number;
  terrace?: boolean;
}

export const TABLES: Table[] = [
  { id: 'board', x: -4.4, z: -1.4, r: 0.5, h: 0.62 },
  { id: 'poet', x: -4.6, z: 2.2, r: 0.5, h: 0.62 },
  { id: 'merchant', x: -0.4, z: -3.4, r: 0.5, h: 0.62 },
  { id: 'free', x: 0.6, z: 1.0, r: 0.5, h: 0.62 },
  { id: 'main', x: 4.7, z: -3.1, r: 0.62, h: 0.66 },
  { id: 'terrace', x: 4.6, z: 5.25, r: 0.48, h: 0.62, terrace: true },
  { id: 'terrace2', x: -4.6, z: 5.25, r: 0.48, h: 0.62, terrace: true },
];

/** Hockerhöhe */
export const STOOL_H = 0.46;

const around = (t: Table, angles: number[], free: boolean[], dist = t.r + 0.38): Seat[] =>
  angles.map((a, i) => ({
    id: `${t.id}-${i}`,
    x: t.x + Math.sin(a) * dist,
    z: t.z + Math.cos(a) * dist,
    yaw: a + Math.PI,
    table: t.id,
    h: STOOL_H,
    free: free[i],
  }));

const T = (id: string): Table => TABLES.find((t) => t.id === id)!;

/** Alle Sitzplätze. Winkel 0 = Platz auf der +z-Seite des Tisches. */
export const SEATS: Seat[] = [
  ...around(T('board'), [Math.PI / 2, -Math.PI / 2], [false, false]),
  ...around(T('poet'), [-Math.PI / 2, Math.PI / 2], [false, true]),
  ...around(T('merchant'), [Math.PI, 0], [false, true]),
  ...around(T('free'), [0, (2 * Math.PI) / 3, (-2 * Math.PI) / 3], [true, true, false]),
  // Haupttisch: Jackie links, Yao rechts (beide mit Blick in den Raum), vorne ein freier Platz für den Gast
  ...around(T('main'), [-2.3, 2.3, 0], [false, false, true], 0.98),
  ...around(T('terrace'), [Math.PI, Math.PI / 2], [false, true]),
  ...around(T('terrace2'), [Math.PI, 0], [true, true]),
];

export const seat = (id: string): Seat => SEATS.find((s) => s.id === id)!;

/** Säulen in der Halle */
export const PILLARS: [number, number][] = [
  [-2.4, -2.4],
  [2.4, -2.4],
  [-2.4, 1.6],
  [2.4, 1.6],
];

/** Wo die Katze schläft und wohin sie gern geht */
export const CAT_SPOTS: [number, number][] = [
  [6.2, 3.2],
  [-6.3, 0.4],
  [1.8, 3.4],
  [3.2, 5.6],
];

/** Startpunkt des Spielers (hinter der Brücke) und Eintrittspunkt innen */
export const START = { x: 0, z: BRIDGE.z1 + 4.2 };
export const INSIDE = { x: 0, z: HALL.z1 - 1.2 };
