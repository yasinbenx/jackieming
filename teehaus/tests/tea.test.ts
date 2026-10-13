// Tee-Mini-Spiel: Wasser, Bewertung, Bestellungen
import { describe, expect, it } from 'vitest';
import { TEAS } from '../src/content/teas';
import { WORDS } from '../src/content/words';
import { fmtMin, nextOrder, rateTea, stepWater } from '../src/minigames/tea';

const green = TEAS[0]!;

describe('Wasser', () => {
  it('erhitzt in einigen Sekunden auf 80 °C und kocht höchstens bei 100 °C', () => {
    let t = 20;
    let s = 0;
    while (t < 80 && s < 20) {
      t = stepWater(t, true, 0.05);
      s += 0.05;
    }
    expect(s).toBeGreaterThan(3);
    expect(s).toBeLessThan(6);
    for (let i = 0; i < 1000; i++) t = stepWater(t, true, 0.05);
    expect(t).toBeLessThanOrEqual(100);
  });

  it('kühlt langsam ab, nie unter Raumtemperatur', () => {
    const t = stepWater(90, false, 1);
    expect(t).toBeLessThan(90);
    expect(t).toBeGreaterThan(88);
    let c = 30;
    for (let i = 0; i < 10000; i++) c = stepWater(c, false, 1);
    expect(c).toBeGreaterThanOrEqual(20);
  });
});

describe('Bewertung', () => {
  it('alles richtig: 3 Blätter, 15 Münzen', () => {
    const r = rateTea({ tea: green, wrongPicks: 0, temp: 80, minutes: 2, phraseOk: true });
    expect(r.leaves).toBe(3);
    expect(r.coins).toBe(15);
    expect(r.notes.every((n) => n.ok)).toBe(true);
  });

  it('zu heißes Wasser beim Grüntee nennt den Grund', () => {
    const r = rateTea({ tea: green, wrongPicks: 0, temp: 99, minutes: 2, phraseOk: true });
    expect(r.leaves).toBe(2);
    expect(r.notes.find((n) => !n.ok)!.text).toContain('bitter');
  });

  it('nie weniger als 1 Blatt', () => {
    const r = rateTea({ tea: green, wrongPicks: 3, temp: 30, minutes: 7, phraseOk: false });
    expect(r.leaves).toBe(1);
  });
});

describe('Bestellungen und Daten', () => {
  it('erst Grüntee, dann nie zweimal dieselbe Sorte', () => {
    expect(nextOrder(TEAS, 0, null).id).toBe('lvcha');
    for (let i = 0; i < 50; i++) expect(nextOrder(TEAS, 3, 'hongcha').id).not.toBe('hongcha');
  });

  it('jede Sorte hat ein Lernwort und sinnvolle Bereiche', () => {
    for (const t of TEAS) {
      expect(WORDS.find((w) => w.id === t.id)?.zh).toBe(t.zh);
      expect(t.temp[0]).toBeLessThan(t.temp[1]);
      expect(t.temp[1]).toBeLessThanOrEqual(100);
      expect(t.time[0]).toBeLessThan(t.time[1]);
    }
  });

  it('Zeitformat', () => {
    expect(fmtMin(2.5)).toBe('2:30 Min.');
  });
});
