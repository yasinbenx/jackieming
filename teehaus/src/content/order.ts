// Bestellen auf Chinesisch: Aus Satzbausteinen einen Satz legen. Zwei Muster sind richtig:
//   请给我一杯X  qǐng gěi wǒ yì bēi X  – Bitte gib mir eine Tasse X.
//   我要一杯X    wǒ yào yì bēi X       – Ich möchte eine Tasse X.
// Dazu kommen ein paar Ablenker, damit es nicht nur Abzählen ist.
import { TEAS } from './teas';
import type { Tea } from './teas';

export interface Tile {
  /** eindeutiger Schlüssel (gleiche Zeichen können doppelt vorkommen) */
  key: string;
  zh: string;
  py: string;
  de: string;
}

const BASE: Omit<Tile, 'key'>[] = [
  { zh: '请', py: 'qing3', de: 'bitte' },
  { zh: '给', py: 'gei3', de: 'geben' },
  { zh: '我', py: 'wo3', de: 'ich/mir' },
  { zh: '一杯', py: 'yi4bei1', de: 'eine Tasse' },
  { zh: '要', py: 'yao4', de: 'möchten' },
];
const DISTRACT: Omit<Tile, 'key'>[] = [
  { zh: '你', py: 'ni3', de: 'du/dir' },
  { zh: '两杯', py: 'liang3bei1', de: 'zwei Tassen' },
  { zh: '不', py: 'bu4', de: 'nicht' },
  { zh: '谢谢', py: 'xie4xie5', de: 'danke' },
];

/** Teesorten, die der Meister ausschenkt (alle aus dem Tee-Mini-Spiel) */
export const ORDER_TEAS: Tea[] = TEAS;

/** Bausteine für eine Bestellung: alle richtigen plus zwei Ablenker, gemischt */
export function orderTiles(tea: Tea, rnd: () => number = Math.random): Tile[] {
  const d = [...DISTRACT].sort(() => rnd() - 0.5).slice(0, 2);
  const all = [...BASE, { zh: tea.zh, py: tea.py, de: tea.de }, ...d].map((t, i) => ({ ...t, key: `t${i}` }));
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all;
}

export type OrderCheck = { ok: true; polite: boolean } | { ok: false; hint: string };

/** Ist der gelegte Satz eine richtige Bestellung für diesen Tee? */
export function checkOrder(zh: string[], tea: Tea): OrderCheck {
  const s = zh.join('');
  if (s === `请给我一杯${tea.zh}`) return { ok: true, polite: true };
  if (s === `我要一杯${tea.zh}`) return { ok: true, polite: false };
  if (!s.endsWith(tea.zh)) {
    const other = TEAS.find((t) => s.endsWith(t.zh));
    if (other) return { ok: false, hint: `Das wäre ${other.de}. Du wolltest ${tea.de}.` };
    return { ok: false, hint: `Der Tee steht am Ende: …一杯${tea.zh}.` };
  }
  if (s.includes('两杯')) return { ok: false, hint: '两杯 sind zwei Tassen. Eine reicht: 一杯.' };
  if (s.includes('你'))
    return { ok: false, hint: '你 heißt „du“. Der Meister soll dir den Tee geben: 给我.' };
  if (s.includes('不')) return { ok: false, hint: '不 heißt „nicht“. Du willst doch Tee!' };
  if (s.includes('谢谢')) return { ok: false, hint: '谢谢 sagst du hinterher, wenn der Tee kommt.' };
  if (!s.includes('一杯')) return { ok: false, hint: 'Wie viel? Eine Tasse: 一杯.' };
  if (s.startsWith('给')) return { ok: false, hint: 'Höflicher mit 请 am Anfang: 请给我…' };
  return {
    ok: false,
    hint: 'Fast. Reihenfolge: 请 · 给 · 我 · 一杯 · Tee. Oder kurz: 我 · 要 · 一杯 · Tee.',
  };
}
