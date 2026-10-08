// Optionaler freier Chat (KI). Läuft über /api/chat; ohne Schlüssel auf dem Server bleibt alles ausgeblendet.
import type { FigureId } from '../content/types';

export interface ChatWord {
  zh: string;
  py: string;
  de: string;
}
export type ChatResult =
  | { ok: true; answer: string; topicOk: boolean; word: ChatWord | null }
  | { ok: false; reason: 'rate' | 'busy' | 'disabled' | 'error' | 'too_long' };

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

let enabled: Promise<{ enabled: boolean; maxChars: number }> | null = null;

/** Fragt einmal ab, ob der Server den Chat anbietet. Jeder Fehler bedeutet: nicht verfügbar. */
export function chatAvailability(): Promise<{ enabled: boolean; maxChars: number }> {
  enabled ??= (async () => {
    try {
      const res = await fetch('/api/chat', { headers: { accept: 'application/json' } });
      if (!res.ok) return { enabled: false, maxChars: 200 };
      const data = (await res.json()) as { enabled?: boolean; maxChars?: number };
      return { enabled: data.enabled === true, maxChars: data.maxChars ?? 200 };
    } catch {
      return { enabled: false, maxChars: 200 };
    }
  })();
  return enabled;
}

export async function askChat(who: FigureId, message: string, history: ChatTurn[]): Promise<ChatResult> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ who, message, history: history.slice(-6) }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      answer?: string;
      topicOk?: boolean;
      word?: ChatWord | null;
      reason?: string;
    };
    if (data.ok && typeof data.answer === 'string') {
      return { ok: true, answer: data.answer, topicOk: data.topicOk !== false, word: data.word ?? null };
    }
    const r = data.reason;
    if (r === 'rate' || r === 'busy' || r === 'disabled' || r === 'too_long') return { ok: false, reason: r };
    return { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export const CHAT_MESSAGES: Record<string, string> = {
  rate: 'Das war viel Gerede für heute. Probier es später noch einmal, oder wähle eine der vorbereiteten Fragen.',
  busy: 'Das Teehaus ist gerade überfüllt. Die vorbereiteten Fragen gehen immer.',
  disabled: 'Die freie Frage ist gerade nicht verfügbar. Die vorbereiteten Fragen gehen immer.',
  error: 'Hier hakt es gerade. Wähle gern eine der vorbereiteten Fragen.',
  too_long: 'Bitte etwas kürzer fragen.',
};
