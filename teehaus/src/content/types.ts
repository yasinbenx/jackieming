// Datentypen für alle Inhalte. Die Inhalte selbst liegen in eigenen Dateien (jackie.ts, yao.ts, …),
// damit du Fragen, Antworten und Wörter leicht ändern kannst, ohne Code anzufassen.

export type FigureId = 'jackie' | 'yao';

export type CategoryId =
  'kindheit' | 'persoenlichkeit' | 'rueckschlaege' | 'karriere' | 'werte' | 'engagement' | 'china' | 'fun';

export interface Category {
  id: CategoryId;
  de: string;
  zh: string;
  /** Pinyin mit Tonziffern, z. B. "tong2nian2" */
  py: string;
}

/** Ein Lernwort. py: Silbengruppen mit Tonziffern, z. B. "pu2tao5 jiu3" → "pútao jiǔ". */
export interface Word {
  id: string;
  zh: string;
  py: string;
  de: string;
  /** Kleine Eselsbrücke oder wörtliche Bedeutung */
  note?: string;
}

export interface Banter {
  by: FigureId;
  text: string;
}

export interface Question {
  id: string;
  cat: CategoryId;
  /** Die Frage, so wie sie im Menü steht (du-Form) */
  q: string;
  /** Antwort in Ich-Form, 2–4 Sätze */
  a: string;
  /** Lernwort, das nach der Antwort erscheint */
  word?: string;
  /** Wird erst freigeschaltet, wenn diese Frage gestellt wurde */
  needs?: string;
  /** Kleiner Zwischenruf der anderen Figur */
  banter?: Banter;
  /** Ausdruck der Figur beim Antworten */
  mood?: 'laugh' | 'think' | 'nod';
  /** Verweise in FAKTEN.md (ids aus facts.ts) */
  facts?: string[];
}

export interface Fact {
  id: string;
  who: FigureId | 'beide';
  text: string;
  /** Quellen-URLs zum Gegenchecken */
  src: string[];
  /** hoch = in mehreren Quellen bestätigt; mittel = bitte nachprüfen; Hinweis = kurze Anmerkung */
  confidence: 'hoch' | 'mittel';
  note?: string;
}

export interface QuizItem {
  id: string;
  q: string;
  options: string[];
  /** Index der richtigen Antwort */
  correct: number;
  explain: string;
  /** Frage-IDs, bei denen dieses Wissen vorkommt (für die Auswahl) */
  related?: string[];
}

export interface FigureProfile {
  id: FigureId;
  zh: string;
  /** Pinyin mit Tonziffern */
  py: string;
  nameDe: string;
  /** Bedeutung der Zeichen, z. B. [["成","werden, vollenden"],["龙","Drache"]] */
  parts: [string, string][];
  greetings: string[];
  idle: string[];
  questions: Question[];
}
