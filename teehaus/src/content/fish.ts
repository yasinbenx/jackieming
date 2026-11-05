// Fische zum Angeln (P3d): Teich am Teehaus und Fluss. Größe in cm, Preis in Münzen, Kampfkraft 0–1.
export interface Fish {
  id: string;
  zh: string;
  py: string;
  de: string;
  /** Lernwort (words.ts) */
  word: string;
  where: ('teich' | 'fluss')[];
  /** Häufigkeit (relativ) */
  weight: number;
  min: number;
  max: number;
  price: number;
  /** wie stark er zieht (0 ruhig … 1 wild) */
  fight: number;
  hint: string;
}

export const FISH: Fish[] = [
  {
    id: 'jinyu',
    zh: '金鱼',
    py: 'jīnyú',
    de: 'Goldfisch',
    word: 'jinyu',
    where: ['teich'],
    weight: 5,
    min: 8,
    max: 18,
    price: 2,
    fight: 0.15,
    hint: 'im Teich vor dem Teehaus',
  },
  {
    id: 'liyu',
    zh: '鲤鱼',
    py: 'lǐyú',
    de: 'Karpfen',
    word: 'liyu',
    where: ['teich', 'fluss'],
    weight: 5,
    min: 25,
    max: 70,
    price: 4,
    fight: 0.45,
    hint: 'Teich und Fluss',
  },
  {
    id: 'caoyu',
    zh: '草鱼',
    py: 'cǎoyú',
    de: 'Graskarpfen',
    word: 'caoyu',
    where: ['fluss'],
    weight: 4,
    min: 30,
    max: 90,
    price: 5,
    fight: 0.55,
    hint: 'im Fluss',
  },
  {
    id: 'xia',
    zh: '虾',
    py: 'xiā',
    de: 'Flusskrebs',
    word: 'xia',
    where: ['fluss'],
    weight: 3,
    min: 6,
    max: 14,
    price: 2,
    fight: 0.2,
    hint: 'am Flussufer',
  },
  {
    id: 'nianyu',
    zh: '鲶鱼',
    py: 'niányú',
    de: 'Wels',
    word: 'nianyu',
    where: ['fluss'],
    weight: 2,
    min: 40,
    max: 120,
    price: 7,
    fight: 0.75,
    hint: 'im Fluss, eher abends',
  },
  {
    id: 'guiyu',
    zh: '鳜鱼',
    py: 'guìyú',
    de: 'Mandarinfisch',
    word: 'guiyu',
    where: ['fluss'],
    weight: 1,
    min: 25,
    max: 50,
    price: 10,
    fight: 0.9,
    hint: 'selten, im Fluss',
  },
];

/** Fisch für einen Ort auswählen (abends beißt der Wels öfter) */
export function pickFish(where: 'teich' | 'fluss', evening: boolean, rnd = Math.random): Fish {
  const pool = FISH.filter((f) => f.where.includes(where));
  const w = pool.map((f) => f.weight * (evening && f.id === 'nianyu' ? 3 : 1));
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) if ((r -= w[i]!) <= 0) return pool[i]!;
  return pool[pool.length - 1]!;
}

/** Größe: meist mittel, selten groß (Quadrat der Zufallszahl) */
export function fishSize(f: Fish, rnd = Math.random): number {
  return Math.round((f.min + (f.max - f.min) * rnd() ** 2) * 10) / 10;
}
