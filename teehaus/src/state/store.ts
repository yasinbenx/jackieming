// Spielstand und Einstellungen. Alles liegt nur im Browser (localStorage), nichts wird gesendet.
// Format, Versionen und Umzug älterer Stände: savefile.ts. Gespeichert wird automatisch (kurz verzögert,
// gebündelt) und beim Verlassen der Seite. Jeder Zugriff ist in try/catch gekapselt: im privaten Modus o. Ä.
// läuft das Spiel trotzdem, nur ohne Speichern.
import {
  BACKUP_KEY,
  cleanSettings,
  DEFAULT_SETTINGS,
  defaultProgress,
  loadAll,
  SAVE_KEY,
  SETTINGS_KEY,
} from './savefile';
import type { Progress, Settings } from './savefile';

export type { Settings, Progress, Action } from './savefile';

type Listener = () => void;

const storage = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): boolean {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  },
};

class Store {
  private p: Progress;
  private s: Settings;
  private listeners = new Set<Listener>();
  private timer = 0;
  /** Ein unlesbarer Spielstand wurde gesichert (BACKUP_KEY) und neu begonnen */
  readonly recovered: boolean;
  /** Speichern schlug zuletzt fehl (voller Speicher, privater Modus) */
  saveFailed = false;

  constructor() {
    const all = loadAll((k) => storage.get(k));
    this.p = all.progress;
    this.s = all.settings;
    this.recovered = all.recovered !== null;
    if (all.recovered !== null) storage.set(BACKUP_KEY, all.recovered);
    if (all.migrated || all.recovered !== null) this.flush();
    try {
      window.addEventListener('pagehide', () => this.flush());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.flush();
      });
    } catch {
      /* ohne Fenster (Tests) */
    }
  }

  /** Sofort schreiben */
  flush(): void {
    window.clearTimeout(this.timer);
    this.timer = 0;
    this.p.savedAt = Date.now();
    const ok =
      storage.set(SAVE_KEY, JSON.stringify(this.p)) && storage.set(SETTINGS_KEY, JSON.stringify(this.s));
    this.saveFailed = !ok;
  }

  /** Gebündelt speichern und Zuhörer benachrichtigen */
  private save(notify = true): void {
    if (!this.timer) this.timer = window.setTimeout(() => this.flush(), 400);
    if (notify) this.listeners.forEach((l) => l());
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ── Fortschritt
  get progress(): Readonly<Progress> {
    return this.p;
  }
  /** Gibt es einen Spielstand zum Weiterspielen? */
  get hasProgress(): boolean {
    return this.p.started;
  }
  get asked(): ReadonlySet<string> {
    return new Set(this.p.asked);
  }
  get words(): ReadonlySet<string> {
    return new Set(this.p.words);
  }
  get eggs(): ReadonlySet<string> {
    return new Set(this.p.eggs);
  }
  get quizBest(): number {
    return this.p.quiz.best;
  }
  get toasted(): boolean {
    return this.p.toasted;
  }
  get outfit(): number {
    return this.p.outfit;
  }
  get coins(): number {
    return this.p.coins;
  }

  hasAsked(id: string): boolean {
    return this.p.asked.includes(id);
  }
  markAsked(id: string): boolean {
    if (this.p.asked.includes(id)) return false;
    this.p.asked.push(id);
    this.save();
    return true;
  }
  /** Gibt true zurück, wenn das Wort neu ist. */
  addWord(id: string): boolean {
    if (this.p.words.includes(id)) return false;
    this.p.words.push(id);
    this.save();
    return true;
  }
  addEgg(id: string): boolean {
    if (this.p.eggs.includes(id)) return false;
    this.p.eggs.push(id);
    this.save();
    return true;
  }
  setQuizBest(n: number): void {
    if (n > this.p.quiz.best) {
      this.p.quiz.best = n;
      this.save();
    }
  }
  addBadge(id: string): boolean {
    if (this.p.quiz.badges.includes(id)) return false;
    this.p.quiz.badges.push(id);
    this.save();
    return true;
  }
  setToasted(): void {
    this.p.toasted = true;
    this.save();
  }
  setOutfit(i: number): void {
    this.p.outfit = i;
    this.save();
  }
  setTime(t: Progress['time']): void {
    this.p.time = t;
    this.save(false);
  }
  /** Position der Spielfigur (ohne Benachrichtigung, wird oft aufgerufen) */
  setPos(x: number, z: number, yaw: number): void {
    this.p.pos = { x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(2) };
    this.save(false);
  }
  markPlace(id: string): boolean {
    if (this.p.places.includes(id)) return false;
    this.p.places.push(id);
    this.save();
    return true;
  }
  setQuest(id: string, state: string): void {
    this.p.quests[id] = state;
    this.save();
  }
  addCoins(n: number): void {
    this.p.coins = Math.max(0, this.p.coins + n);
    this.save();
  }
  setGame(id: string, value: number): void {
    this.p.games[id] = value;
    this.save();
  }
  /** laufende Partie speichern (null = löschen) */
  setSave(id: string, data: string | null): void {
    if (data === null) delete this.p.saves[id];
    else this.p.saves[id] = data;
    this.save(false);
  }
  /** Belohnung freischalten; true, wenn neu */
  grant(item: string): boolean {
    if (this.p.wardrobe.owned.includes(item)) return false;
    this.p.wardrobe.owned.push(item);
    this.save();
    return true;
  }
  owns(item: string): boolean {
    return this.p.wardrobe.owned.includes(item);
  }
  setHead(head: string): void {
    this.p.wardrobe.head = head;
    this.save();
  }
  tutorialStep(id: string): void {
    if (this.p.tutorial.steps.includes(id)) return;
    this.p.tutorial.steps.push(id);
    this.save(false);
  }
  setTutorialDone(done = true): void {
    this.p.tutorial.done = done;
    if (!done) this.p.tutorial.steps = [];
    this.save();
  }
  /** Spiel beginnt (nach der Kleiderwahl) */
  markStarted(): void {
    if (this.p.started) return;
    this.p.started = true;
    this.save();
  }

  /** Neues Spiel: Fortschritt auf Anfang, Einstellungen bleiben */
  resetProgress(): void {
    this.p = defaultProgress();
    this.flush();
    this.listeners.forEach((l) => l());
  }

  // ── Einstellungen
  get settings(): Settings {
    return this.s;
  }
  setSettings(patch: Partial<Settings>): void {
    this.s = cleanSettings({ ...this.s, ...patch });
    this.save();
  }
  /** Einstellungen auf Standard (Fortschritt bleibt). Der Hinweis „Fiktives Gespräch“ gilt weiter als gesehen. */
  resetSettings(): void {
    this.s = {
      ...DEFAULT_SETTINGS,
      keys: { ...DEFAULT_SETTINGS.keys },
      disclaimerSeen: this.s.disclaimerSeen,
    };
    this.flush();
    this.listeners.forEach((l) => l());
  }

  /** Alt: alles zurücksetzen (Info-Seite). Entspricht „Neues Spiel“. */
  reset(): void {
    this.resetProgress();
  }
}

export const store = new Store();
