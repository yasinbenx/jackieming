// Platzwahl am Tisch (reine Logik, ohne Szene – wird von Spiel und Tests genutzt)
import type { Seat } from './layout';

export interface Occupant {
  x: number;
  z: number;
  /** Platz, auf dem die Figur sitzt oder auf den sie zugeht */
  seat?: Seat | null;
}

/** Abstand, unter dem ein Hocker als belegt gilt (jemand sitzt oder steht darauf) */
export const SEAT_TAKEN_R = 0.35;

export function seatTaken(s: Seat, others: readonly Occupant[]): boolean {
  return others.some((a) => a.seat === s || Math.hypot(a.x - s.x, a.z - s.z) < SEAT_TAKEN_R);
}

/**
 * Freier Spielerplatz an einem Tisch, der Spielfigur am nächsten. null, wenn alle belegt sind.
 * others: alle anderen Figuren (ohne die Spielfigur).
 */
export function freeSeatAt(
  table: string,
  seats: readonly Seat[],
  others: readonly Occupant[],
  from?: { x: number; z: number },
): Seat | null {
  const free = seats.filter((s) => s.table === table && s.free && !seatTaken(s, others));
  if (!free.length) return null;
  if (!from) return free[0]!;
  return free.reduce((a, b) =>
    Math.hypot(a.x - from.x, a.z - from.z) <= Math.hypot(b.x - from.x, b.z - from.z) ? a : b,
  );
}

/**
 * Punkt, von dem aus man sich auf den Hocker setzt: normalerweise 0,55 m hinter dem Platz (vom Tisch weg). Liegt
 * der nicht auf begehbarem Boden (z. B. am Terrassenrand), wird seitlich herangetreten.
 */
export function approachPoint(
  s: Seat,
  walkable: (x: number, z: number) => boolean,
): { x: number; z: number } {
  for (const turn of [0, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
    const a = s.yaw + turn;
    const p = { x: s.x - Math.sin(a) * 0.55, z: s.z - Math.cos(a) * 0.55 };
    if (walkable(p.x, p.z)) return p;
  }
  return { x: s.x - Math.sin(s.yaw) * 0.55, z: s.z - Math.cos(s.yaw) * 0.55 };
}
