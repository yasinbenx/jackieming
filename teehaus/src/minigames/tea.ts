// Tee-Mini-Spiel: Regeln ohne Oberfläche (Wassertemperatur, Ziehzeit, Bewertung). Wird von der Oberfläche und
// den Tests genutzt.
import type { Tea } from '../content/teas';

/** Spielsekunden je Ziehminute */
export const SECONDS_PER_MINUTE = 3;
/** längste Ziehzeit, danach gießt der Meister selbst ab (Minuten) */
export const MAX_STEEP = 7;
export const ROOM_TEMP = 20;

/** Wasser erhitzen (heating) oder abkühlen lassen; dt in Sekunden */
export function stepWater(temp: number, heating: boolean, dt: number): number {
  if (heating) return Math.min(100, temp + (102 - temp) * 0.34 * dt);
  return Math.max(ROOM_TEMP, temp - (temp - ROOM_TEMP) * 0.02 * dt);
}

/** Abstand zu einem Bereich (0 = drin) */
export function offBy(v: number, [lo, hi]: [number, number]): number {
  return v < lo ? lo - v : v > hi ? v - hi : 0;
}

/** Stärke des Aufgusses 0..1 (für die Farbe in der Tasse) */
export function strength(minutes: number, tea: Tea): number {
  return Math.min(1, minutes / (tea.time[1] * 1.15));
}

export interface TeaRound {
  tea: Tea;
  /** Fehlversuche bei der Teewahl */
  wrongPicks: number;
  temp: number;
  minutes: number;
  phraseOk: boolean;
}

export interface TeaRating {
  leaves: 1 | 2 | 3;
  score: number;
  coins: number;
  /** Rückmeldungen je Schritt (gut/schlecht und warum) */
  notes: { ok: boolean; text: string }[];
}

/** Bewertung des Teemeisters: je Schritt bis zu 1 Punkt, daraus 1–3 Teeblätter */
export function rateTea(r: TeaRound): TeaRating {
  const notes: TeaRating['notes'] = [];
  const t = r.tea;
  let score = 0;
  // Teesorte
  if (r.wrongPicks === 0) {
    score += 1;
    notes.push({ ok: true, text: `Richtige Sorte: ${t.zh} ${t.de}.` });
  } else {
    score += r.wrongPicks === 1 ? 0.5 : 0;
    notes.push({ ok: false, text: `Die Sorte erst im ${r.wrongPicks + 1}. Versuch gefunden.` });
  }
  // Wasser
  const dT = offBy(r.temp, t.temp);
  const tempText = `${Math.round(r.temp)} °C (gut: ${t.temp[0]}–${t.temp[1]} °C)`;
  if (dT === 0) {
    score += 1;
    notes.push({ ok: true, text: `Wasser genau richtig: ${tempText}.` });
  } else if (dT <= 6) {
    score += 0.5;
    notes.push({ ok: false, text: `Wasser fast richtig: ${tempText}.` });
  } else {
    const hot = r.temp > t.temp[1];
    notes.push({
      ok: false,
      text: `Wasser zu ${hot ? 'heiß' : 'kalt'}: ${tempText}.${hot && t.tooHot ? ` ${t.tooHot}` : ''}`,
    });
  }
  // Ziehzeit
  const dM = offBy(r.minutes, t.time);
  const timeText = `${fmtMin(r.minutes)} (gut: ${fmtMin(t.time[0])}–${fmtMin(t.time[1])})`;
  if (dM === 0) {
    score += 1;
    notes.push({ ok: true, text: `Ziehzeit genau richtig: ${timeText}.` });
  } else if (dM <= 0.6) {
    score += 0.5;
    notes.push({ ok: false, text: `Ziehzeit knapp daneben: ${timeText}.` });
  } else {
    notes.push({
      ok: false,
      text: `Zu ${r.minutes > t.time[1] ? 'lange' : 'kurz'} gezogen: ${timeText}.`,
    });
  }
  // Servieren
  if (r.phraseOk) {
    score += 1;
    notes.push({ ok: true, text: 'Höflich serviert: 请喝茶 qǐng hē chá.' });
  } else
    notes.push({ ok: false, text: 'Beim Servieren sagt man 请喝茶 qǐng hē chá, „Bitte trinken Sie Tee“.' });
  const leaves: 1 | 2 | 3 = score >= 3.5 ? 3 : score >= 2.5 ? 2 : 1;
  return { leaves, score, coins: leaves * 5, notes };
}

/** 2.5 → „2:30 Min.“ */
export function fmtMin(m: number): string {
  const s = Math.round(m * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} Min.`;
}

/** Nächste Bestellung: beim ersten Mal Grüntee, danach zufällig, aber nicht zweimal dieselbe hintereinander */
export function nextOrder(teas: readonly Tea[], rounds: number, last: string | null, rnd = Math.random): Tea {
  if (rounds === 0) return teas[0]!;
  const pool = teas.filter((t) => t.id !== last);
  return pool[Math.floor(rnd() * pool.length)] ?? teas[0]!;
}
