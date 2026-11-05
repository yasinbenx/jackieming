// Mini-Xiangqi: Namen der Figuren, Regeln, Gegner und ihre Sprüche. Leicht änderbar.
import type { Kind, Side } from '../minigames/xiangqi';

export interface PieceInfo {
  /** Zeichen für Rot und Schwarz (wie auf echten Steinen) */
  zh: Record<Side, string>;
  py: Record<Side, string>;
  de: string;
  rule: string;
  /** Lernwort */
  word?: string;
}

export const PIECES: Record<Kind, PieceInfo> = {
  K: {
    zh: { r: '帅', b: '将' },
    py: { r: 'shuài', b: 'jiàng' },
    de: 'General',
    rule: 'Geht einen Schritt gerade (vor, zurück, zur Seite). Wird er geschlagen, ist die Partie verloren.',
    word: 'jiangjun',
  },
  R: {
    zh: { r: '车', b: '车' },
    py: { r: 'jū', b: 'jū' },
    de: 'Wagen',
    rule: 'Fährt beliebig weit gerade, bis ihm etwas im Weg steht. Die stärkste Figur.',
    word: 'ju',
  },
  H: {
    zh: { r: '马', b: '马' },
    py: { r: 'mǎ', b: 'mǎ' },
    de: 'Pferd',
    rule: 'Ein Schritt gerade, dann einer schräg nach außen. Steht direkt neben ihm etwas im Weg, ist es in diese Richtung „gehemmt“.',
    word: 'ma',
  },
  C: {
    zh: { r: '炮', b: '炮' },
    py: { r: 'pào', b: 'pào' },
    de: 'Kanone',
    rule: 'Zieht wie der Wagen. Schlagen kann sie aber nur, indem sie über genau eine Figur (egal welcher Farbe) hinwegspringt.',
    word: 'pao',
  },
  P: {
    zh: { r: '兵', b: '卒' },
    py: { r: 'bīng', b: 'zú' },
    de: 'Soldat',
    rule: 'Geht einen Schritt vorwärts. Jenseits der Brettmitte darf er auch zur Seite, aber nie zurück.',
    word: 'bing',
  },
};

export const RULES_INTRO = [
  'Xiangqi (象棋) ist das chinesische Schach. Gespielt wird auf den Kreuzungspunkten der Linien, nicht in den Feldern.',
  'Diese kleine Fassung hat ein Brett mit 5 × 6 Punkten und acht Steine pro Seite. Du spielst Rot und ziehst zuerst.',
  'Ziel: den gegnerischen General schlagen. Steht dein General im Angriff, ruft der Gegner „将军！“ (jiāngjūn, Schach). Wer keinen Zug mehr hat, verliert. Nach 120 Halbzügen ist es unentschieden.',
  'Gegenüber dem großen Xiangqi fehlen Palast, Elefanten und Berater; die Generäle dürfen sich frei gegenüberstehen.',
];

export interface Opponent {
  level: 1 | 2 | 3;
  /** NPC-ID für Sprechblasen und Kamera */
  npc: string;
  name: string;
  zh: string;
  blurb: string;
  coins: number;
}

export const OPPONENTS: Opponent[] = [
  {
    level: 1,
    npc: 'boardB',
    name: 'Brettspieler Lin',
    zh: '初学',
    blurb: 'Stufe 1 · spielt zum Spaß und übersieht viel',
    coins: 5,
  },
  {
    level: 2,
    npc: 'boardB',
    name: 'Brettspieler Lin',
    zh: '中级',
    blurb: 'Stufe 2 · denkt einen Zug voraus',
    coins: 10,
  },
  {
    level: 3,
    npc: 'boardA',
    name: 'Alter Meister Zhou',
    zh: '高手',
    blurb: 'Stufe 3 · rechnet mehrere Züge voraus',
    coins: 20,
  },
];

/** Sprüche der Gegner */
export const XQ_LINES = {
  start: ['请！Du hast den ersten Zug.', 'Rot beginnt. 请！'],
  check: ['将军！', '将军！Pass auf deinen General auf.'],
  capture: ['Ha, den nehme ich.', 'Danke für den Stein!', 'Hm, das war leichtsinnig.'],
  lostPiece: ['Oh, guter Zug.', 'Den habe ich nicht kommen sehen.', '好棋！Guter Zug.'],
  win: ['Diesmal war ich schneller. Noch eine Partie?', '再来一局？Noch eine?'],
  lose: ['好棋！Du hast gewonnen.', 'Respekt. Das war eine schöne Partie.'],
  draw: ['Unentschieden. Ein ehrenvolles Ende.'],
};
