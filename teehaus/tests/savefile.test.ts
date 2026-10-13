// Spielstand: Standardwerte, Umzug von Version 1, kaputte Daten, Tastenbelegung
import { describe, expect, it } from 'vitest';
import {
  BACKUP_KEY,
  cleanProgress,
  cleanSettings,
  DEFAULT_KEYS,
  LEGACY_KEY,
  loadAll,
  rebind,
  SAVE_KEY,
  SAVE_VERSION,
  SETTINGS_KEY,
} from '../src/state/savefile';

const mem = (data: Record<string, string>) => (k: string) => data[k] ?? null;

describe('loadAll', () => {
  it('leerer Speicher: neues Spiel mit Standardwerten', () => {
    const r = loadAll(mem({}));
    expect(r.progress.v).toBe(SAVE_VERSION);
    expect(r.progress.started).toBe(false);
    expect(r.settings.keys.sound).toBe('KeyT');
    expect(r.settings.keys.map).toBe('KeyM');
    expect(r.recovered).toBeNull();
  });

  it('übernimmt Version 1 (Fragen, Wörter, Outfit, Ton)', () => {
    const v1 = {
      asked: ['j-kindheit', 'j-kindheit'],
      words: ['chaguan', 'qingjin', 'xianggang'],
      eggs: ['cat'],
      quizBest: 4,
      toasted: true,
      settings: {
        muted: true,
        music: 0.2,
        sfx: 0.5,
        calm: true,
        quality: 1,
        outfit: 2,
        voices: 0.6,
        disclaimerSeen: true,
      },
    };
    const r = loadAll(mem({ [LEGACY_KEY]: JSON.stringify(v1) }));
    expect(r.migrated).toBe(true);
    expect(r.progress.asked).toEqual(['j-kindheit']);
    expect(r.progress.words).toHaveLength(3);
    expect(r.progress.outfit).toBe(2);
    expect(r.progress.quiz.best).toBe(4);
    expect(r.progress.started).toBe(true);
    expect(r.settings.muted).toBe(true);
    expect(r.settings.quality).toBe(1);
    expect(r.settings.disclaimerSeen).toBe(true);
  });

  it('kaputter Spielstand: neu beginnen und Rohdaten zur Sicherung melden', () => {
    const r = loadAll(mem({ [SAVE_KEY]: '{kaputt' }));
    expect(r.recovered).toBe('{kaputt');
    expect(r.progress.started).toBe(false);
    expect(BACKUP_KEY).toBe('teehaus.save.backup');
  });

  it('kaputte Einstellungen: Standardwerte, Fortschritt bleibt', () => {
    const save = JSON.stringify({ v: 2, started: true, asked: ['a'] });
    const r = loadAll(mem({ [SAVE_KEY]: save, [SETTINGS_KEY]: 'nicht json' }));
    expect(r.progress.asked).toEqual(['a']);
    expect(r.settings.music).toBe(0.45);
  });
});

describe('cleanProgress / cleanSettings', () => {
  it('verwirft falsche Typen und begrenzt Werte', () => {
    const p = cleanProgress({ asked: [1, 'x', null], coins: -5, time: 'mittag', pos: { x: 'a', z: 1 } });
    expect(p.asked).toEqual(['x']);
    expect(p.coins).toBe(0);
    expect(p.time).toBe('auto');
    expect(p.pos).toBeNull();
    const s = cleanSettings({
      music: 7,
      camSpeed: -1,
      uiScale: 3,
      quality: 'ultra',
      keys: { use: 'KeyF', foo: 'KeyX' },
    });
    expect(s.music).toBe(1);
    expect(s.camSpeed).toBe(0.3);
    expect(s.uiScale).toBe(1.4);
    expect(s.quality).toBe('auto');
    expect(s.keys.use).toBe('KeyF');
    expect(s.keys.forward).toBe('KeyW');
  });

  it('wirft bei Nicht-Objekt', () => {
    expect(() => cleanProgress('hallo')).toThrow();
  });
});

describe('rebind', () => {
  it('belegt neu und tauscht bei Konflikt', () => {
    const k = rebind(DEFAULT_KEYS, 'sound', 'KeyE');
    expect(k.sound).toBe('KeyE');
    expect(k.use).toBe('KeyT');
  });

  it('Esc und Pfeiltasten sind reserviert', () => {
    expect(rebind(DEFAULT_KEYS, 'use', 'Escape')).toEqual(DEFAULT_KEYS);
    expect(rebind(DEFAULT_KEYS, 'forward', 'ArrowUp')).toEqual(DEFAULT_KEYS);
  });
});
