// Zwei-Knochen-IK für Arme: Schulter → Ellbogen → Handgelenk.
import { clamp } from '../core/util';

export interface Pt {
  x: number;
  y: number;
}

/**
 * Berechnet die Ellbogenposition so, dass das Handgelenk das Ziel erreicht.
 * bend = +1 knickt den Ellbogen im Uhrzeigersinn (nach außen links), −1 gegen den Uhrzeigersinn.
 */
export function solveArm(s: Pt, t: Pt, l1: number, l2: number, bend: 1 | -1): { elbow: Pt; wrist: Pt } {
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const d = clamp(Math.hypot(dx, dy), 8, l1 + l2 - 0.5);
  const a = Math.atan2(dy, dx);
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const A = Math.acos(cosA);
  const ang = a + bend * A;
  const elbow = { x: s.x + Math.cos(ang) * l1, y: s.y + Math.sin(ang) * l1 };
  // Handgelenk liegt auf der Strecke Ellbogen → Ziel in Länge l2
  const ex = t.x - elbow.x;
  const ey = t.y - elbow.y;
  const el = Math.hypot(ex, ey) || 1;
  const wrist = { x: elbow.x + (ex / el) * l2, y: elbow.y + (ey / el) * l2 };
  return { elbow, wrist };
}
