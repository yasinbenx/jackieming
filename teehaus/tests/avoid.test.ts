// Ausweichen unter Bewohnern
import { describe, expect, it } from 'vitest';
import { avoidance } from '../src/world/avoid';

describe('Ausweichen', () => {
  it('niemand im Weg: nichts tun', () => {
    expect(avoidance(0, 0, 0, 1, [])).toEqual({ side: 0, slow: 0 });
    // hinter einem oder weit seitlich zählt nicht
    expect(avoidance(0, 0, 0, 1, [{ x: 0, z: -1, moving: true }]).side).toBe(0);
    expect(avoidance(0, 0, 0, 1, [{ x: 2, z: 0.5, moving: true }]).side).toBe(0);
  });
  it('Entgegenkommende weichen beide nach rechts aus und kommen aneinander vorbei', () => {
    let a = { x: 0, z: 0 };
    let b = { x: 0.05, z: 6 };
    let minD = Infinity;
    for (let i = 0; i < 200; i++) {
      const da = avoidance(a.x, a.z, 0, 1, [{ ...b, moving: true }]);
      const db = avoidance(b.x, b.z, 0, -1, [{ ...a, moving: true }]);
      const dt = 0.05;
      // rechts von (0,1) ist (1,0) in dieser Konvention: (fz, -fx)
      a = { x: a.x + da.side * dt, z: a.z + 1.1 * (1 - da.slow) * dt };
      b = { x: b.x - db.side * dt, z: b.z - 1.1 * (1 - db.slow) * dt };
      minD = Math.min(minD, Math.hypot(a.x - b.x, a.z - b.z));
    }
    expect(minD).toBeGreaterThan(0.45);
    // beide sind durchgekommen
    expect(a.z).toBeGreaterThan(6);
    expect(b.z).toBeLessThan(0);
  });
  it('vor einem Stehenden bremsen', () => {
    const r = avoidance(0, 0, 0, 1, [{ x: 0, z: 0.5, moving: false }]);
    expect(r.slow).toBeGreaterThan(0.5);
    expect(Math.abs(r.side)).toBeGreaterThan(0);
  });
});
