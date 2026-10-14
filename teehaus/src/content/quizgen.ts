// Quiz-Runden zusammenstellen: Wortfragen aus den gesammelten Wörtern (Chinesisch → Deutsch und umgekehrt)
// und Wissensfragen über Jackie und Yao, sobald die passende Frage im Gespräch gestellt wurde.
import { QUIZ } from './quiz';
import { WORDS } from './words';
import type { Word } from './types';

export interface QuizOption {
  label: string;
  /** Beschriftung ist Chinesisch (größer setzen) */
  zh?: boolean;
}

export interface QuizQuestion {
  id: string;
  kind: 'zh-de' | 'de-zh' | 'wissen';
  prompt: string;
  /** Zeichen und Pinyin bei Wortfragen */
  zh?: string;
  py?: string;
  options: QuizOption[];
  correct: number;
  explain: string;
}

export const QUIZ_LEN = 8;
/** so viele Wörter braucht es mindestens für ein Quiz */
export const QUIZ_MIN_WORDS = 4;

function shuffle<T>(a: T[], rnd: () => number): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
}

/** Drei Antworten: die richtige und zwei andere, gemischt */
function choices(right: Word, rnd: () => number): { words: Word[]; correct: number } {
  const others = shuffle(
    WORDS.filter((w) => w.id !== right.id && w.de !== right.de && w.zh !== right.zh),
    rnd,
  ).slice(0, 2);
  const words = shuffle([right, ...others], rnd);
  return { words, correct: words.indexOf(right) };
}

export function wordQuestion(w: Word, kind: 'zh-de' | 'de-zh', rnd: () => number): QuizQuestion {
  const { words, correct } = choices(w, rnd);
  const ex = `${w.zh} heißt „${w.de}“.${w.note ? ` ${w.note}` : ''}`;
  return kind === 'zh-de'
    ? {
        id: `w-${w.id}`,
        kind,
        prompt: 'Was bedeutet das?',
        zh: w.zh,
        py: w.py,
        options: words.map((x) => ({ label: x.de })),
        correct,
        explain: ex,
      }
    : {
        id: `w-${w.id}`,
        kind,
        prompt: `Wie heißt „${w.de}“ auf Chinesisch?`,
        options: words.map((x) => ({ label: x.zh, zh: true })),
        correct,
        explain: ex,
      };
}

/**
 * Eine Quiz-Runde. Leer, wenn noch zu wenig gesammelt ist.
 * @param words gesammelte Wort-IDs
 * @param asked im Gespräch gestellte Fragen
 */
export function buildQuiz(
  words: ReadonlySet<string>,
  asked: ReadonlySet<string>,
  rnd: () => number = Math.random,
  len = QUIZ_LEN,
): QuizQuestion[] {
  const learned = WORDS.filter((w) => words.has(w.id));
  if (learned.length < QUIZ_MIN_WORDS) return [];
  const facts = shuffle(
    QUIZ.filter((q) => !q.related?.length || q.related.some((r) => asked.has(r))),
    rnd,
  ).slice(0, Math.min(3, Math.floor(len / 3)));
  const nWords = Math.min(learned.length, len - facts.length);
  const ws = shuffle(learned, rnd).slice(0, nWords);
  const qs: QuizQuestion[] = [
    ...ws.map((w, i) => wordQuestion(w, i % 2 ? 'de-zh' : 'zh-de', rnd)),
    ...facts.map((q): QuizQuestion => {
      const order = shuffle(
        q.options.map((_, i) => i),
        rnd,
      );
      return {
        id: q.id,
        kind: 'wissen',
        prompt: q.q,
        options: order.map((i) => ({ label: q.options[i]! })),
        correct: order.indexOf(q.correct),
        explain: q.explain,
      };
    }),
  ];
  return shuffle(qs, rnd);
}
