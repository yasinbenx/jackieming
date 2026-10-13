// Aufgaben: Ablauf, Speichern, Daten
import { describe, expect, it } from 'vitest';
import { HEADS, QUESTS } from '../src/content/quests';
import { WORDS } from '../src/content/words';
import { ALL_OUTFITS } from '../src/world/looks';
import { applyEvent, currentQuest, parseQuest, serializeQuest, stepText } from '../src/minigames/quests';

const [tea, cat, guests, brew] = QUESTS;

describe('Ablauf', () => {
  it('erste Aufgabe ist „Tee bringen“, danach die nächste', () => {
    expect(currentQuest(QUESTS, {})!.quest.id).toBe('songcha');
    expect(currentQuest(QUESTS, { songcha: 'erledigt' })!.quest.id).toBe('zhaomao');
    expect(currentQuest(QUESTS, Object.fromEntries(QUESTS.map((q) => [q.id, 'erledigt'])))).toBeNull();
  });

  it('Tee bringen: holen, abliefern, melden', () => {
    let st = parseQuest('aktiv:0:');
    st = applyEvent(tea!, st, { type: 'deliver', to: 'poet' }).state;
    expect(st.step).toBe(0);
    st = applyEvent(tea!, st, { type: 'take', item: 'tea' }).state;
    st = applyEvent(tea!, st, { type: 'deliver', to: 'merchant' }).state;
    expect(st.step).toBe(1);
    st = applyEvent(tea!, st, { type: 'deliver', to: 'poet' }).state;
    expect(st.step).toBe(2);
    st = applyEvent(tea!, st, { type: 'report' }).state;
    expect(st.status).toBe('erledigt');
  });

  it('Katze finden', () => {
    const st = applyEvent(cat!, parseQuest('aktiv:0:'), { type: 'cat' }).state;
    expect(st.step).toBe(1);
  });

  it('drei verschiedene Gäste zählen, doppelte nicht', () => {
    let st = parseQuest('aktiv:0:');
    for (const n of ['poet', 'poet', 'child']) st = applyEvent(guests!, st, { type: 'talk', npc: n }).state;
    expect(st.seen).toEqual(['poet', 'child']);
    expect(stepText(guests!, st)).toContain('2/3');
    st = applyEvent(guests!, st, { type: 'talk', npc: 'merchant' }).state;
    expect(st.step).toBe(1);
  });

  it('Tee mit 3 Blättern nötig', () => {
    const st = parseQuest('aktiv:0:');
    expect(applyEvent(brew!, st, { type: 'brew', leaves: 2 }).changed).toBe(false);
    expect(applyEvent(brew!, st, { type: 'brew', leaves: 3 }).state.step).toBe(1);
  });

  it('nicht aktive Aufgaben ignorieren Ereignisse', () => {
    expect(applyEvent(tea!, parseQuest(undefined), { type: 'take', item: 'tea' }).changed).toBe(false);
  });
});

describe('Speichern und Daten', () => {
  it('Zustand übersteht Speichern und Laden', () => {
    const st = { status: 'aktiv' as const, step: 1, seen: ['poet', 'child'] };
    expect(parseQuest(serializeQuest(st))).toEqual(st);
    expect(parseQuest('quatsch').status).toBe('neu');
  });

  it('Belohnungen verweisen auf vorhandene Outfits, Köpfe und Wörter', () => {
    for (const q of QUESTS) {
      for (const it of q.reward.items) {
        const [kind, id] = it.split(':');
        if (kind === 'outfit') expect(ALL_OUTFITS.some((o) => o.id === id)).toBe(true);
        else expect(HEADS.some((h) => h.id === id)).toBe(true);
      }
      if (q.reward.word) expect(WORDS.some((w) => w.id === q.reward.word)).toBe(true);
    }
  });
});
