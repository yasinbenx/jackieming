// Pinyin: "cheng2 long2" → "chéng lóng". Töne werden zusätzlich als Farbe ausgegeben (wie in Pleco).

const TONES: Record<string, string[]> = {
  a: ['a', 'ā', 'á', 'ǎ', 'à'],
  e: ['e', 'ē', 'é', 'ě', 'è'],
  i: ['i', 'ī', 'í', 'ǐ', 'ì'],
  o: ['o', 'ō', 'ó', 'ǒ', 'ò'],
  u: ['u', 'ū', 'ú', 'ǔ', 'ù'],
  ü: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

export interface Syllable {
  text: string;
  /** 1–4, 5 = neutral */
  tone: number;
}

/** Setzt das Tonzeichen auf den richtigen Vokal (a/e zuerst, bei "ou" auf das o, sonst auf den letzten Vokal). */
export function applyTone(base: string, tone: number): string {
  const s = base.replace(/v/g, 'ü');
  if (tone < 1 || tone > 4) return s;
  let idx = s.search(/[ae]/);
  if (idx < 0 && s.includes('ou')) idx = s.indexOf('o');
  if (idx < 0) {
    for (let i = s.length - 1; i >= 0; i--) {
      if ('iouü'.includes(s[i]!)) {
        idx = i;
        break;
      }
    }
  }
  if (idx < 0) return s;
  const ch = s[idx]!;
  return s.slice(0, idx) + (TONES[ch]?.[tone] ?? ch) + s.slice(idx + 1);
}

/** Zerlegt "pu2tao5 jiu3" in Silben; Gruppen bleiben durch Leerzeichen getrennt. */
export function parsePinyin(py: string): Syllable[][] {
  return py
    .trim()
    .split(/\s+/)
    .map((group) => {
      const out: Syllable[] = [];
      const re = /([a-züv]+)([1-5])?/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(group))) {
        const tone = m[2] ? Number(m[2]) : 5;
        out.push({ text: applyTone(m[1]!.toLowerCase(), tone), tone });
      }
      return out;
    });
}

export const pinyinText = (py: string): string =>
  parsePinyin(py)
    .map((g) => g.map((s) => s.text).join(''))
    .join(' ');

/** HTML mit Tonfarben (class tone-1 … tone-5). */
export function pinyinHtml(py: string): string {
  return parsePinyin(py)
    .map((g) => g.map((s) => `<span class="tone-${s.tone}">${s.text}</span>`).join(''))
    .join(' ');
}
