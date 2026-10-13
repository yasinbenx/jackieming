// Spielstand-Format (reine Logik ohne Browser-Zugriff, damit es testbar ist): Versionsnummer, Standardwerte,
// Umzug älterer Stände und Prüfung. Spielstand und Einstellungen liegen getrennt, damit „Neues Spiel“ die
// Einstellungen behält und „Einstellungen zurücksetzen“ den Fortschritt.

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'teehaus.save';
export const SETTINGS_KEY = 'teehaus.settings';
/** Hierhin wird ein unlesbarer Spielstand gesichert, bevor neu begonnen wird */
export const BACKUP_KEY = 'teehaus.save.backup';
/** Speicherort bis Version 1 (Fortschritt und Einstellungen in einem) */
export const LEGACY_KEY = 'teehaus.v1';

/** Tastenbelegung: Aktion → KeyboardEvent.code */
export type Action =
  'forward' | 'back' | 'left' | 'right' | 'run' | 'use' | 'wave' | 'map' | 'sound' | 'pause';

export const ACTIONS: { id: Action; label: string }[] = [
  { id: 'forward', label: 'Vorwärts' },
  { id: 'back', label: 'Rückwärts' },
  { id: 'left', label: 'Links' },
  { id: 'right', label: 'Rechts' },
  { id: 'run', label: 'Laufen (halten)' },
  { id: 'use', label: 'Ansprechen / benutzen' },
  { id: 'wave', label: 'Winken' },
  { id: 'map', label: 'Karte' },
  { id: 'sound', label: 'Ton an/aus' },
  { id: 'pause', label: 'Pause' },
];

export const DEFAULT_KEYS: Record<Action, string> = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  run: 'ShiftLeft',
  use: 'KeyE',
  wave: 'KeyG',
  map: 'KeyM',
  sound: 'KeyT',
  pause: 'KeyP',
};

export interface Settings {
  muted: boolean;
  music: number;
  sfx: number;
  /** Lautstärke der Stimmen (Simlish) */
  voices: number;
  /** Grafikqualität: automatisch oder fest (0 niedrig, 1 mittel, 2 hoch) */
  quality: 'auto' | 0 | 1 | 2;
  /** Weniger Bewegung (zusätzlich zur Systemeinstellung) */
  calm: boolean;
  /** Kamerageschwindigkeit (Maus/Wischen), 1 = normal */
  camSpeed: number;
  keys: Record<Action, string>;
  /** Pinyin unter den Schriftzeichen zeigen */
  pinyin: boolean;
  /** Schriftgröße der Oberfläche, 1 = normal */
  uiScale: number;
  /** Hoher Kontrast */
  contrast: boolean;
  /** Untertitel für das Gemurmel der Gäste */
  captions: boolean;
  /** Hinweis „Fiktives Gespräch“ beim ersten Gespräch bestätigt */
  disclaimerSeen: boolean;
}

export interface Progress {
  v: number;
  /** wurde schon einmal ein Spiel begonnen (für „Weiter“) */
  started: boolean;
  asked: string[];
  words: string[];
  eggs: string[];
  quiz: { best: number; badges: string[] };
  toasted: boolean;
  outfit: number;
  /** Tageszeit-Wahl (Knöpfe oben) */
  time: 'day' | 'golden' | 'night' | 'auto';
  /** entdeckte Orte */
  places: string[];
  /** Aufgaben: id → Zustand (z. B. 'offen', 'erledigt') */
  quests: Record<string, string>;
  coins: number;
  /** letzte Position der Spielfigur */
  pos: { x: number; z: number; yaw: number } | null;
  tutorial: { done: boolean; steps: string[] };
  /** Ergebnisse späterer Spiele (Brettspiel, Tee) */
  games: Record<string, number>;
  /** Gespeicherte laufende Partien (z. B. Xiangqi), Kurzform je Spiel */
  saves: Record<string, string>;
  /** Garderobe: freigeschaltete Belohnungen (outfit:…, head:…) und gewählter Kopf */
  wardrobe: { owned: string[]; head: string };
  savedAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  muted: false,
  music: 0.45,
  sfx: 0.8,
  voices: 0.8,
  quality: 'auto',
  calm: false,
  camSpeed: 1,
  keys: { ...DEFAULT_KEYS },
  pinyin: true,
  uiScale: 1,
  contrast: false,
  captions: false,
  disclaimerSeen: false,
};

export function defaultProgress(): Progress {
  return {
    v: SAVE_VERSION,
    started: false,
    asked: [],
    words: [],
    eggs: [],
    quiz: { best: 0, badges: [] },
    toasted: false,
    outfit: 0,
    time: 'auto',
    places: [],
    quests: {},
    coins: 0,
    pos: null,
    tutorial: { done: false, steps: [] },
    games: {},
    saves: {},
    wardrobe: { owned: [], head: 'eigen' },
    savedAt: 0,
  };
}

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const strings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [];
const num = (x: unknown, d: number, lo = -Infinity, hi = Infinity): number =>
  typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
const bool = (x: unknown, d: boolean): boolean => (typeof x === 'boolean' ? x : d);

/** Einstellungen aus beliebigen Daten: Unbekanntes fällt auf Standardwerte zurück */
export function cleanSettings(raw: unknown): Settings {
  const r = isObj(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  const keys = { ...DEFAULT_KEYS };
  if (isObj(r.keys))
    for (const a of Object.keys(DEFAULT_KEYS) as Action[]) {
      const k = r.keys[a];
      if (typeof k === 'string' && k) keys[a] = k;
    }
  const q = r.quality;
  return {
    muted: bool(r.muted, d.muted),
    music: num(r.music, d.music, 0, 1),
    sfx: num(r.sfx, d.sfx, 0, 1),
    voices: num(r.voices, d.voices, 0, 1),
    quality: q === 'auto' || q === 0 || q === 1 || q === 2 ? q : d.quality,
    calm: bool(r.calm, d.calm),
    camSpeed: num(r.camSpeed, d.camSpeed, 0.3, 2.5),
    keys,
    pinyin: bool(r.pinyin, d.pinyin),
    uiScale: num(r.uiScale, d.uiScale, 0.85, 1.4),
    contrast: bool(r.contrast, d.contrast),
    captions: bool(r.captions, d.captions),
    disclaimerSeen: bool(r.disclaimerSeen, d.disclaimerSeen),
  };
}

/** Spielstand aus beliebigen Daten (beliebige Version). Wirft, wenn es gar kein Spielstand ist. */
export function cleanProgress(raw: unknown): Progress {
  if (!isObj(raw)) throw new Error('kein Spielstand');
  const d = defaultProgress();
  const quiz = isObj(raw.quiz) ? raw.quiz : {};
  const pos = isObj(raw.pos) ? raw.pos : null;
  const tut = isObj(raw.tutorial) ? raw.tutorial : {};
  const t = raw.time;
  const quests: Record<string, string> = {};
  if (isObj(raw.quests))
    for (const [k, v] of Object.entries(raw.quests)) if (typeof v === 'string') quests[k] = v;
  const games: Record<string, number> = {};
  if (isObj(raw.games))
    for (const [k, v] of Object.entries(raw.games))
      if (typeof v === 'number' && Number.isFinite(v)) games[k] = v;
  return {
    v: SAVE_VERSION,
    started: bool(raw.started, d.started),
    asked: [...new Set(strings(raw.asked))],
    words: [...new Set(strings(raw.words))],
    eggs: [...new Set(strings(raw.eggs))],
    quiz: { best: num(quiz.best, 0, 0), badges: [...new Set(strings(quiz.badges))] },
    toasted: bool(raw.toasted, false),
    outfit: Math.round(num(raw.outfit, 0, 0, 9)),
    time: t === 'day' || t === 'golden' || t === 'night' || t === 'auto' ? t : d.time,
    places: [...new Set(strings(raw.places))],
    quests,
    coins: Math.round(num(raw.coins, 0, 0)),
    pos:
      pos && Number.isFinite(pos.x) && Number.isFinite(pos.z)
        ? { x: pos.x as number, z: pos.z as number, yaw: num(pos.yaw, 0) }
        : null,
    tutorial: { done: bool(tut.done, false), steps: [...new Set(strings(tut.steps))] },
    games,
    saves: Object.fromEntries(
      Object.entries(isObj(raw.saves) ? raw.saves : {}).filter(
        (e): e is [string, string] => typeof e[1] === 'string',
      ),
    ),
    wardrobe: {
      owned: [...new Set(strings(isObj(raw.wardrobe) ? raw.wardrobe.owned : []))],
      head: isObj(raw.wardrobe) && typeof raw.wardrobe.head === 'string' ? raw.wardrobe.head : 'eigen',
    },
    savedAt: num(raw.savedAt, 0),
  };
}

/**
 * Alter Speicher (Version 1: Fortschritt und Einstellungen in einem Objekt) → neuer Spielstand und Einstellungen.
 * Gab es schon Fragen oder Wörter, gilt das Spiel als begonnen.
 */
export function migrateLegacy(raw: unknown): { progress: Progress; settings: Settings } {
  if (!isObj(raw)) throw new Error('kein alter Spielstand');
  const s = isObj(raw.settings) ? raw.settings : {};
  const progress = cleanProgress({
    asked: raw.asked,
    words: raw.words,
    eggs: raw.eggs,
    quiz: { best: raw.quizBest },
    toasted: raw.toasted,
    outfit: s.outfit,
  });
  progress.started = progress.asked.length > 0 || progress.words.length > 2 || progress.eggs.length > 0;
  return { progress, settings: cleanSettings(s) };
}

/** Lädt beides aus einem Schlüssel-Wert-Speicher; meldet, ob ein kaputter Stand gesichert werden musste. */
export function loadAll(get: (k: string) => string | null): {
  progress: Progress;
  settings: Settings;
  recovered: string | null;
  migrated: boolean;
} {
  let recovered: string | null = null;
  let settings = DEFAULT_SETTINGS;
  let progress = defaultProgress();
  let migrated = false;
  const rawSettings = get(SETTINGS_KEY);
  if (rawSettings) {
    try {
      settings = cleanSettings(JSON.parse(rawSettings));
    } catch {
      settings = DEFAULT_SETTINGS;
    }
  }
  const raw = get(SAVE_KEY);
  if (raw) {
    try {
      progress = cleanProgress(JSON.parse(raw));
    } catch {
      recovered = raw;
      progress = defaultProgress();
    }
  } else {
    const legacy = get(LEGACY_KEY);
    if (legacy) {
      try {
        const m = migrateLegacy(JSON.parse(legacy));
        progress = m.progress;
        if (!rawSettings) settings = m.settings;
        migrated = true;
      } catch {
        recovered = legacy;
      }
    }
  }
  return { progress, settings: { ...settings, keys: { ...settings.keys } }, recovered, migrated };
}

/** Taste für die Anzeige („W“, „Umschalt“, „Leertaste“ …) */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const names: Record<string, string> = {
    ShiftLeft: 'Umschalt',
    ShiftRight: 'Umschalt rechts',
    ControlLeft: 'Strg',
    AltLeft: 'Alt',
    Space: 'Leertaste',
    Enter: 'Eingabe',
    Tab: 'Tab',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Escape: 'Esc',
  };
  return names[code] ?? code;
}

/** Tasten, die nicht umgelegt werden dürfen (Esc schließt immer, Pfeile bleiben als Zweitbelegung) */
export const RESERVED = new Set(['Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

/** Neue Belegung setzen; eine andere Aktion mit derselben Taste bekommt die alte Taste (Tausch) */
export function rebind(keys: Record<Action, string>, action: Action, code: string): Record<Action, string> {
  if (RESERVED.has(code)) return keys;
  const next = { ...keys };
  const clash = (Object.keys(next) as Action[]).find((a) => a !== action && next[a] === code);
  if (clash) next[clash] = keys[action];
  next[action] = code;
  return next;
}
