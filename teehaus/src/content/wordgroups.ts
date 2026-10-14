// Themen für das Wörterbuch (Filter). Wörter, die in keiner Liste stehen, gehören zu „Teehaus und Dorf“;
// alles vor dem ersten Teehaus-Wort stammt aus den Gesprächen mit Jackie und Yao.
import { WORDS } from './words';

export interface WordGroup {
  id: string;
  de: string;
  zh: string;
}

export const WORD_GROUPS: WordGroup[] = [
  { id: 'gaeste', de: 'Jackie und Yao', zh: '对话' },
  { id: 'tee', de: 'Tee', zh: '茶' },
  { id: 'alltag', de: 'Begrüßen und Bestellen', zh: '日常' },
  { id: 'spiele', de: 'Brettspiel', zh: '象棋' },
  { id: 'welt', de: 'Teehaus und Dorf', zh: '村子' },
];

const LISTS: Record<string, string[]> = {
  tee: [
    'cha',
    'chaguan',
    'chahu',
    'qinghecha',
    'lvcha',
    'hongcha',
    'molihuacha',
    'wulongcha',
    'baicha',
    'shui',
    'haocha',
    'kaishui',
    'chaye',
    'caicha',
    'ganbei',
  ],
  alltag: [
    'nihao',
    'huanying',
    'xiexie',
    'qingjin',
    'zaijian',
    'pengyou',
    'duoshaoqian',
    'qing',
    'gei',
    'wo',
    'yibei',
    'yao4',
  ],
  spiele: ['xiangqi', 'jiangjun', 'ju', 'ma', 'pao', 'bing', 'xiaqi', 'qipan'],
};

const FIRST_WORLD = WORDS.findIndex((w) => w.id === 'cha');

/** Thema eines Worts */
export function wordGroup(id: string): string {
  for (const [g, ids] of Object.entries(LISTS)) if (ids.includes(id)) return g;
  const i = WORDS.findIndex((w) => w.id === id);
  return i >= 0 && i < FIRST_WORLD ? 'gaeste' : 'welt';
}

/** Für Tests: alle in den Listen genannten Wörter */
export const LISTED_WORDS = Object.values(LISTS).flat();

/** Suchtext ohne Töne und Akzente: „cha“ findet 茶 chá, „jasmin“ findet Jasmintee */
export function plain(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0-9\s]/g, '')
    .replace(/ü|v/g, 'u');
}
