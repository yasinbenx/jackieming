// Spielstand und Einstellungen. Alles liegt nur im Browser (localStorage), nichts wird gesendet.
// Jeder Zugriff ist in try/catch gekapselt: im privaten Modus o. Ä. läuft das Spiel trotzdem.

const KEY = 'teehaus.v1';

export interface Settings {
  muted: boolean;
  music: number;
  sfx: number;
  /** Bewegungsarm (zusätzlich zur Systemeinstellung) */
  calm: boolean;
}

interface Persisted {
  asked: string[];
  words: string[];
  eggs: string[];
  quizBest: number;
  toasted: boolean;
  settings: Settings;
}

const DEFAULTS: Persisted = {
  asked: [],
  words: [],
  eggs: [],
  quizBest: 0,
  toasted: false,
  settings: { muted: false, music: 0.6, sfx: 0.8, calm: false },
};

type Listener = () => void;

class Store {
  private data: Persisted = structuredClone(DEFAULTS);
  private listeners = new Set<Listener>();

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Persisted>;
        this.data = {
          ...DEFAULTS,
          ...parsed,
          settings: { ...DEFAULTS.settings, ...(parsed.settings ?? {}) },
        };
      }
    } catch {
      /* ohne Speicher weiterspielen */
    }
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* ignorieren */
    }
    this.listeners.forEach((l) => l());
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get asked(): ReadonlySet<string> {
    return new Set(this.data.asked);
  }
  get words(): ReadonlySet<string> {
    return new Set(this.data.words);
  }
  get eggs(): ReadonlySet<string> {
    return new Set(this.data.eggs);
  }
  get settings(): Settings {
    return this.data.settings;
  }
  get quizBest(): number {
    return this.data.quizBest;
  }
  get toasted(): boolean {
    return this.data.toasted;
  }

  hasAsked(id: string): boolean {
    return this.data.asked.includes(id);
  }
  markAsked(id: string): boolean {
    if (this.data.asked.includes(id)) return false;
    this.data.asked.push(id);
    this.save();
    return true;
  }
  /** Gibt true zurück, wenn das Wort neu ist. */
  addWord(id: string): boolean {
    if (this.data.words.includes(id)) return false;
    this.data.words.push(id);
    this.save();
    return true;
  }
  addEgg(id: string): boolean {
    if (this.data.eggs.includes(id)) return false;
    this.data.eggs.push(id);
    this.save();
    return true;
  }
  setQuizBest(n: number): void {
    if (n > this.data.quizBest) {
      this.data.quizBest = n;
      this.save();
    }
  }
  setToasted(): void {
    this.data.toasted = true;
    this.save();
  }
  setSettings(patch: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
  }
  reset(): void {
    this.data = structuredClone(DEFAULTS);
    this.save();
  }
}

export const store = new Store();
