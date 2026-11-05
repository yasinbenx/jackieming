// Aussprache über die Web Speech API (zh-CN), falls das Gerät eine chinesische Stimme hat.
let voices: SpeechSynthesisVoice[] = [];
const listeners = new Set<() => void>();

function refresh(): void {
  if (!('speechSynthesis' in window)) return;
  voices = window.speechSynthesis.getVoices();
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refresh();
  window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const zh = voices.filter((v) => /^zh([-_]|$)/i.test(v.lang));
  return zh.find((v) => /cn|hans/i.test(v.lang)) ?? zh[0];
}

export const speechAvailable = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && !!pickVoice();

export function onSpeechChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function speakChinese(text: string): boolean {
  if (!('speechSynthesis' in window)) return false;
  const voice = pickVoice();
  if (!voice) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = 'zh-CN';
  u.rate = 0.8;
  window.speechSynthesis.speak(u);
  return true;
}
