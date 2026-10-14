// Kurze Sätze, die im Spiel gesprochen oder gemeldet werden (Teemeister beim Bestellen, Händlerin, Wetter, Quiz).
// Hier ändern, nicht im Code.
import type { Tea } from './teas';

/** Antwort des Teemeisters auf eine Bestellung auf Chinesisch */
export const orderReply = (tea: Tea, polite: boolean): string =>
  polite
    ? `好的！一杯${tea.zh}，马上来。 Hǎo de! So höflich bestellt. Ein ${tea.de} kommt sofort.`
    : `好的，一杯${tea.zh}。 Hǎo de! Ein ${tea.de}, bitte schön.`;

/** Händlerin nach dem Kauf */
export const SHOP_THANKS = '谢谢！Beehr uns bald wieder.';

/** Gast bedankt sich für gebrachten Tee (Aufgabe) */
export const DELIVER_THANKS = '谢谢！Wie aufmerksam, der Tee ist noch warm.';

/** Meldungen beim Wetterwechsel (HTML) */
export const WEATHER_TOASTS: Partial<Record<'regen' | 'nebel', string>> = {
  regen: '<span lang="zh">下雨了</span> xià yǔ le · Es fängt an zu regnen.',
  nebel: '<span lang="zh">起雾了</span> qǐ wù le · Nebel zieht auf.',
};

/** Lob am Ende des Quiz, nach Anteil richtiger Antworten (absteigend) */
export const QUIZ_PRAISE: [number, string][] = [
  [1, '太棒了！ Alles richtig!'],
  [0.75, '很好！ Sehr gut.'],
  [0.5, '不错。 Nicht schlecht.'],
  [0, '加油！ Weiter üben!'],
];
