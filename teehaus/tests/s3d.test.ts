import { describe, expect, it } from 'vitest';
import { checkOrder, orderTiles } from '../src/content/order';
import { TEAS } from '../src/content/teas';
import { WORDS, wordById } from '../src/content/words';
import { LISTED_WORDS, plain, WORD_GROUPS, wordGroup } from '../src/content/wordgroups';
import { buildQuiz, QUIZ_LEN, QUIZ_MIN_WORDS } from '../src/content/quizgen';
import { BADGES, earnedBadges } from '../src/content/badges';
import { defaultProgress } from '../src/state/savefile';

const seeded = (s: number) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const jasmin = TEAS.find((t) => t.id === 'molihuacha')!;

describe('Bestellen auf Chinesisch', () => {
  it('Bausteine enthalten beide richtigen Sätze', () => {
    for (const t of TEAS) {
      const zh = orderTiles(t, seeded(3)).map((x) => x.zh);
      for (const need of ['请', '给', '我', '一杯', '要', t.zh]) expect(zh).toContain(need);
      expect(new Set(orderTiles(t).map((x) => x.key)).size).toBe(zh.length);
    }
  });
  it('richtige Sätze', () => {
    expect(checkOrder(['请', '给', '我', '一杯', '茉莉花茶'], jasmin)).toEqual({ ok: true, polite: true });
    expect(checkOrder(['我', '要', '一杯', '茉莉花茶'], jasmin)).toEqual({ ok: true, polite: false });
  });
  it('falsche Sätze bekommen einen Hinweis', () => {
    const cases: string[][] = [
      ['请', '给', '我', '一杯', '绿茶'],
      ['请', '给', '你', '一杯', '茉莉花茶'],
      ['请', '给', '我', '两杯', '茉莉花茶'],
      ['给', '我', '一杯', '茉莉花茶'],
      ['一杯', '茉莉花茶', '请', '给', '我'],
      ['我', '不', '要', '一杯', '茉莉花茶'],
    ];
    for (const c of cases) {
      const r = checkOrder(c, jasmin);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.hint.length).toBeGreaterThan(5);
    }
    const other = checkOrder(['请', '给', '我', '一杯', '绿茶'], jasmin);
    expect(!other.ok && other.hint).toContain('Grüntee');
  });
  it('Satzwörter und Tees stehen im Wörterbuch', () => {
    for (const id of ['qing', 'gei', 'wo', 'yibei', 'yao4', ...TEAS.map((t) => t.id)])
      expect(wordById(id)).toBeTruthy();
  });
});

describe('Wörterbuch', () => {
  it('alle Wörter haben ein bekanntes Thema, Listen nennen nur echte Wörter', () => {
    const groups = new Set(WORD_GROUPS.map((g) => g.id));
    for (const w of WORDS) expect(groups.has(wordGroup(w.id))).toBe(true);
    for (const id of LISTED_WORDS) expect(wordById(id), id).toBeTruthy();
    for (const g of WORD_GROUPS)
      expect(
        WORDS.some((w) => wordGroup(w.id) === g.id),
        g.id,
      ).toBe(true);
  });
  it('Suche ohne Töne und Akzente', () => {
    expect(plain('chá')).toBe('cha');
    expect(plain('cha2')).toBe('cha');
    expect(plain('lǜchá')).toBe(plain('lv4cha2'));
    expect(plain('Grüntee')).toContain('gruntee');
  });
  it('Wort-IDs sind eindeutig', () => {
    expect(new Set(WORDS.map((w) => w.id)).size).toBe(WORDS.length);
  });
});

describe('Quiz', () => {
  it('zu wenig Wörter: kein Quiz', () => {
    expect(buildQuiz(new Set(['cha']), new Set())).toEqual([]);
  });
  it('Runde mit gültigen Fragen', () => {
    const words = new Set(WORDS.slice(0, 12).map((w) => w.id));
    const asked = new Set(['y-kindheit-1', 'j-karriere-3']);
    for (let s = 1; s < 30; s++) {
      const qs = buildQuiz(words, asked, seeded(s));
      expect(qs.length).toBe(QUIZ_LEN);
      expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
      for (const q of qs) {
        expect(q.options.length).toBe(3);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(3);
        expect(new Set(q.options.map((o) => o.label)).size).toBe(3);
        if (q.kind !== 'wissen') expect(words.has(q.id.slice(2))).toBe(true);
      }
    }
  });
  it('mit genau der Mindestzahl Wörter geht es auch', () => {
    const words = new Set(WORDS.slice(0, QUIZ_MIN_WORDS).map((w) => w.id));
    expect(buildQuiz(words, new Set(), seeded(5)).length).toBeGreaterThanOrEqual(QUIZ_MIN_WORDS);
  });
});

describe('Abzeichen', () => {
  it('eindeutig und automatisch vergeben', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    const p = defaultProgress();
    expect(earnedBadges(p)).toEqual([]);
    p.words = WORDS.slice(0, 20).map((w) => w.id);
    p.games['order-zh'] = 1;
    p.games['xq-w1'] = 1;
    expect(
      earnedBadges(p)
        .map((b) => b.id)
        .sort(),
    ).toEqual(['bestellt', 'woerter-20', 'xiangqi']);
    p.quiz.badges.push('woerter-20');
    expect(earnedBadges(p).map((b) => b.id)).not.toContain('woerter-20');
  });
});
