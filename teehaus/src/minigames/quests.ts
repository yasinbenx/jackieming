// Aufgaben: Zustand ohne Oberfläche. Gespeichert wird je Aufgabe ein kurzer Text im Spielstand
// (progress.quests[id]): 'aktiv:<Schritt>:<gesehene Gäste, mit | getrennt>' oder 'erledigt'.
import type { Quest, QuestStep } from '../content/quests';

export interface QuestState {
  status: 'neu' | 'aktiv' | 'erledigt';
  step: number;
  /** schon angesprochene Gäste (Aufgabe „Gäste kennenlernen“) */
  seen: string[];
}

export function parseQuest(raw: string | undefined): QuestState {
  if (!raw) return { status: 'neu', step: 0, seen: [] };
  if (raw === 'erledigt') return { status: 'erledigt', step: 0, seen: [] };
  const [s, step, seen] = raw.split(':');
  if (s !== 'aktiv') return { status: 'neu', step: 0, seen: [] };
  return {
    status: 'aktiv',
    step: Math.max(0, Number(step) || 0),
    seen: seen ? seen.split('|').filter(Boolean) : [],
  };
}

export function serializeQuest(q: QuestState): string {
  if (q.status === 'erledigt') return 'erledigt';
  if (q.status === 'neu') return '';
  return `aktiv:${q.step}:${q.seen.join('|')}`;
}

/** Die Aufgabe, die gerade läuft oder als Nächstes angeboten wird (null = alle erledigt) */
export function currentQuest(
  quests: readonly Quest[],
  states: Record<string, string>,
): { quest: Quest; state: QuestState } | null {
  for (const q of quests) {
    const st = parseQuest(states[q.id]);
    if (st.status !== 'erledigt') return { quest: q, state: st };
  }
  return null;
}

export type QuestEvent =
  | { type: 'take'; item: 'tea' }
  | { type: 'deliver'; to: string }
  | { type: 'cat' }
  | { type: 'talk'; npc: string }
  | { type: 'brew'; leaves: number }
  | { type: 'report' };

/** Ereignis anwenden; gibt den neuen Zustand zurück und ob sich etwas geändert hat */
export function applyEvent(
  quest: Quest,
  st: QuestState,
  ev: QuestEvent,
): { state: QuestState; changed: boolean } {
  if (st.status !== 'aktiv') return { state: st, changed: false };
  const step: QuestStep | undefined = quest.steps[st.step];
  if (!step) return { state: st, changed: false };
  const next = (): { state: QuestState; changed: boolean } => {
    const n = st.step + 1;
    return {
      state: { status: n >= quest.steps.length ? 'erledigt' : 'aktiv', step: n, seen: st.seen },
      changed: true,
    };
  };
  switch (step.kind) {
    case 'take':
      return ev.type === 'take' && ev.item === step.item ? next() : { state: st, changed: false };
    case 'deliver':
      return ev.type === 'deliver' && ev.to === step.to ? next() : { state: st, changed: false };
    case 'find-cat':
      return ev.type === 'cat' ? next() : { state: st, changed: false };
    case 'brew':
      return ev.type === 'brew' && ev.leaves >= step.leaves ? next() : { state: st, changed: false };
    case 'report':
      return ev.type === 'report' ? next() : { state: st, changed: false };
    case 'talk': {
      if (ev.type !== 'talk' || st.seen.includes(ev.npc)) return { state: st, changed: false };
      const seen = [...st.seen, ev.npc];
      if (seen.length >= step.count)
        return { state: { status: 'aktiv', step: st.step + 1, seen }, changed: true };
      return { state: { ...st, seen }, changed: true };
    }
  }
}

/** Fortschrittstext für die Anzeige („2/3 Gäste“) */
export function stepText(quest: Quest, st: QuestState): string {
  const step = quest.steps[st.step];
  if (!step) return '';
  if (step.kind === 'talk') return `${step.text} (${st.seen.length}/${step.count})`;
  return step.text;
}
