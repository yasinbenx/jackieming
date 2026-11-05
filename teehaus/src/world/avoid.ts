// Ausweichen unter Fußgängern: Wer jemanden vor sich hat, weicht nach rechts (aus eigener Sicht) aus und wird
// langsamer, wenn es eng wird. Kommen zwei sich entgegen, gehen beide nach rechts und damit aneinander vorbei.

export interface Avoid {
  /** seitliches Ausweichen (m/s, positiv = rechts der Gehrichtung) */
  side: number;
  /** Abbremsen 0 (frei) … 1 (stehen bleiben) */
  slow: number;
}

/**
 * @param x,z eigene Position
 * @param fx,fz Gehrichtung (Einheitsvektor)
 * @param others andere Figuren (moving: geht selbst)
 */
export function avoidance(
  x: number,
  z: number,
  fx: number,
  fz: number,
  others: readonly { x: number; z: number; moving: boolean }[],
  reach = 1.4,
): Avoid {
  let side = 0;
  let slow = 0;
  for (const o of others) {
    const ox = o.x - x;
    const oz = o.z - z;
    const ahead = ox * fx + oz * fz;
    if (ahead <= 0 || ahead > reach) continue;
    // Abstand quer zur Gehrichtung (positiv = rechts)
    const lat = ox * fz - oz * fx;
    if (Math.abs(lat) > 0.75) continue;
    const near = 1 - ahead / reach;
    // steht der andere genau vor einem, nach rechts; sonst weg von ihm
    const dir = lat > 0.05 ? -1 : 1;
    side += dir * near * 0.9;
    // nur bremsen, wenn es wirklich eng wird (und der andere steht oder sehr nah ist)
    if (ahead < 0.7 && Math.abs(lat) < 0.45) slow = Math.max(slow, o.moving ? 0.5 : 0.85);
  }
  return { side: Math.max(-1, Math.min(1, side)), slow };
}
