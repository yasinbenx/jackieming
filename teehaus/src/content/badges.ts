// Abzeichen (徽章 huīzhāng). Jedes prüft den Spielstand; vergeben werden sie beim Speichern-Takt und nach dem Quiz.
import type { Progress } from '../state/savefile';
import { PLACES } from '../world/map';
import { VILLAGERS } from '../content/villagers';

export interface Badge {
  id: string;
  zh: string;
  de: string;
  /** wie man es bekommt */
  how: string;
  /** automatisch prüfbar (Quiz-Abzeichen vergibt das Quiz selbst) */
  check?: (p: Readonly<Progress>) => boolean;
}

const games = (p: Readonly<Progress>, prefix: string): number =>
  Object.entries(p.games)
    .filter(([k]) => k.startsWith(prefix))
    .reduce((a, [, v]) => a + (v > 0 ? 1 : 0), 0);

export const BADGES: Badge[] = [
  { id: 'quiz-erstes', zh: '初试', de: 'Erster Versuch', how: 'Ein Quiz abschließen' },
  { id: 'quiz-perfekt', zh: '满分', de: 'Volle Punktzahl', how: 'Ein Quiz ohne Fehler' },
  {
    id: 'woerter-20',
    zh: '学生',
    de: 'Fleißig',
    how: '20 Wörter sammeln',
    check: (p) => p.words.length >= 20,
  },
  {
    id: 'woerter-50',
    zh: '学者',
    de: 'Gelehrt',
    how: '50 Wörter sammeln',
    check: (p) => p.words.length >= 50,
  },
  {
    id: 'bestellt',
    zh: '点茶',
    de: 'Auf Chinesisch bestellt',
    how: 'Beim Teemeister auf Chinesisch bestellen',
    check: (p) => (p.games['order-zh'] ?? 0) > 0,
  },
  {
    id: 'teekenner',
    zh: '茶友',
    de: 'Teekenner',
    how: 'Fünf verschiedene Tees auf Chinesisch bestellen',
    check: (p) => games(p, 'order-tea-') >= 5,
  },
  {
    id: 'entdecker',
    zh: '旅行家',
    de: 'Entdecker',
    how: 'Alle Orte im Tal besuchen',
    check: (p) => PLACES.every((pl) => pl.id === 'teehaus' || p.places.includes(pl.id)),
  },
  {
    id: 'xiangqi',
    zh: '棋手',
    de: 'Brettspieler',
    how: 'Eine Partie Xiangqi gewinnen',
    check: (p) => games(p, 'xq-w') > 0,
  },
  {
    id: 'nachbarn',
    zh: '邻居',
    de: 'Gute Nachbarn',
    how: 'Mit zehn Leuten im Dorf sprechen',
    check: (p) => games(p, 'vt-') >= Math.min(10, VILLAGERS.length),
  },
];

/** Neu verdiente Abzeichen (noch nicht im Spielstand) */
export function earnedBadges(p: Readonly<Progress>): Badge[] {
  return BADGES.filter((b) => b.check && !p.quiz.badges.includes(b.id) && b.check(p));
}
