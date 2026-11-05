// Easter Eggs, Gespräche am Tisch und Texte für besondere Momente.
import type { FigureId } from './types';

export interface EggLine {
  by: FigureId;
  text: string;
}

export interface Egg {
  id: 'teapot' | 'magpie' | 'lantern' | 'koi' | 'cat' | 'ruler' | 'incense' | 'scroll';
  /** Lernwort (id aus words.ts), das beim ersten Fund gesammelt wird */
  word: string;
  /** Eine Zeile pro Klick; Reihenfolge wird durchlaufen */
  lines: EggLine[];
  /** Verweise in FAKTEN.md */
  facts?: string[];
}

export const EGGS: Egg[] = [
  {
    id: 'teapot',
    word: 'chahu',
    lines: [
      {
        by: 'jackie',
        text: 'Finger weg, die Kanne ist heiß! Ha, ich meine: Gut gemacht, du hast sie gefunden.',
      },
      { by: 'yao', text: 'Tee ist wie ein guter Pass: Man muss ihm Zeit lassen.' },
      { by: 'jackie', text: 'Noch eine Tasse? Das ist die Teekanne, 茶壶 cháhú.' },
    ],
  },
  {
    id: 'magpie',
    word: 'xique',
    lines: [
      {
        by: 'jackie',
        text: 'Eine Elster, 喜鹊 xǐquè! In China bringt sie Glück. Du hast sie gerade erschreckt, aber das Glück bleibt.',
      },
      { by: 'yao', text: 'Sie kommt bestimmt wieder. Vögel haben ein gutes Gedächtnis.' },
    ],
  },
  {
    id: 'lantern',
    word: 'denglong',
    lines: [
      { by: 'yao', text: 'Aua. Die Laterne hängt genau auf meiner Höhe.' },
      { by: 'jackie', text: 'Haha! Das ist eine Laterne, 灯笼 dēnglong. Und bei Yao ein Stoßdämpfer.' },
      { by: 'yao', text: 'Ich sag ja: Man plant immer ein paar Zentimeter mehr ein.' },
    ],
  },
  {
    id: 'koi',
    word: 'jinli',
    lines: [
      {
        by: 'jackie',
        text: 'Die Koi, 锦鲤 jǐnlǐ! Sie gelten in China als Glücksbringer. Pssst, nicht erschrecken.',
      },
      { by: 'yao', text: 'Sie schwimmen so ruhig. Davon kann man lernen.' },
    ],
  },
  {
    id: 'cat',
    word: 'mao',
    lines: [
      { by: 'jackie', text: 'Pst! Die Katze, 猫 māo, schläft. Sie ist der gelassenste Gast im ganzen Haus.' },
      { by: 'yao', text: 'Sie hat den besten Platz am Fenster. Ich beneide sie ein wenig.' },
    ],
  },
  {
    id: 'ruler',
    word: 'shengao',
    facts: ['J-groesse', 'Y-groesse'],
    lines: [
      {
        by: 'jackie',
        text: 'Die Messlatte! 身高 shēngāo heißt Körpergröße. Yao hat 2,29 Meter, ich ungefähr 1,73. Aber ich habe die besseren Stunts.',
      },
      { by: 'yao', text: 'Dafür habe ich die bessere Aussicht.' },
    ],
  },
  {
    id: 'incense',
    word: 'xianglu',
    lines: [
      {
        by: 'yao',
        text: 'Das ist ein Räucherstäbchen-Brenner, 香炉 xiānglú. Ein ruhiger Duft für einen ruhigen Tag.',
      },
    ],
  },
  {
    id: 'scroll',
    word: 'cha',
    lines: [
      {
        by: 'jackie',
        text: 'Das Schriftzeichen 茶 chá bedeutet Tee. Und die vier Zeichen darunter? Frag lieber deine Lehrerin, ha!',
      },
      { by: 'yao', text: 'Schön geschrieben. Ein Zeichen für ein Haus voller Ruhe.' },
    ],
  },
];

/** Szenenübergreifende Sätze */
export const LINES = {
  toast: [
    { by: 'jackie' as FigureId, text: '干杯 gānbēi! Auf dich, auf den Tee und auf eine gute Zeit!' },
    { by: 'yao' as FigureId, text: 'Prost. Danke für deine Fragen und deine Geduld.' },
  ],
};
