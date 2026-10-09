// Kurze, vorgefertigte Sätze der Gäste und des Teemeisters (keine realen Personen). Jeder Satz kann ein Lernwort
// vergeben, das beim ersten Mal ins Wörterbuch wandert.

export interface NpcLine {
  text: string;
  /** Lernwort (id aus words.ts) */
  word?: string;
}

export interface NpcProfile {
  id: string;
  /** Anzeigename (Deutsch) und Rolle */
  name: string;
  zh: string;
  py: string;
  /** Sprüche beim Ansprechen, der Reihe nach */
  lines: NpcLine[];
  /** Kurze Reaktion, wenn der Spieler winkt */
  wave?: string;
}

export const NPCS: Record<string, NpcProfile> = {
  master: {
    id: 'master',
    name: 'Teemeister',
    zh: '茶师',
    py: 'cha2shi1',
    lines: [
      { text: '欢迎光临! Herzlich willkommen in meinem Teehaus.', word: 'huanying' },
      { text: 'Guter Tee braucht Geduld. Und heißes, aber nicht kochendes Wasser.' },
      { text: 'Möchtest du Tee? Komm an die Theke, dann schenke ich dir ein.', word: 'qinghecha' },
      { text: 'Man nennt mich hier einfach 师傅 shīfu. Das ist eine höfliche Anrede.', word: 'shifu' },
    ],
    wave: 'Eine kleine Verbeugung zurück.',
  },
  boardA: {
    id: 'boardA',
    name: 'Schachspieler',
    zh: '棋手',
    py: 'qi2shou3',
    lines: [
      { text: 'Pssst, ich denke nach. Das ist 象棋 xiàngqí, chinesisches Schach.', word: 'xiangqi' },
      { text: 'Der Fluss in der Mitte heißt 楚河汉界. Bis dahin darf mein Elefant.' },
      { text: 'Noch drei Züge, dann habe ich ihn. Vielleicht. Hoffentlich.' },
    ],
  },
  boardB: {
    id: 'boardB',
    name: 'Schachspielerin',
    zh: '棋手',
    py: 'qi2shou3',
    lines: [
      { text: '你好! Er überlegt schon seit zehn Minuten.', word: 'nihao' },
      { text: 'Beim Schach und beim Tee gilt dasselbe: nicht hetzen.' },
    ],
  },
  poet: {
    id: 'poet',
    name: 'Dichterin',
    zh: '诗人',
    py: 'shi1ren2',
    lines: [
      { text: 'Ich schreibe ein 诗 shī, ein Gedicht, über die Berge im Nebel.', word: 'shi' },
      { text: 'Mit dem 毛笔 máobǐ schreibt man langsam. Das ist das Schöne daran.', word: 'maobi' },
      { text: '山 shān, Berg. Drei Striche nach oben, wie drei Gipfel.', word: 'shan' },
    ],
  },
  merchant: {
    id: 'merchant',
    name: 'Händler',
    zh: '商人',
    py: 'shang1ren2',
    lines: [
      { text: 'Puh, warm heute! Zum Glück habe ich meinen 扇子 shànzi, meinen Fächer.', word: 'shanzi' },
      { text: 'Ich handle mit Tee aus den Bergen. Aber hier trinke ich ihn nur.' },
      { text: 'Ein guter Handel ist wie guter Tee: Beide Seiten gehen zufrieden.' },
    ],
  },
  child: {
    id: 'child',
    name: 'Kind',
    zh: '小朋友',
    py: 'xiao3peng2you3',
    lines: [
      { text: '你好! Hast du die Katze schon gesehen? Sie heißt Mantou.', word: 'nihao' },
      { text: 'Ich darf heute Tee probieren. Aber nur einen ganz kleinen Schluck!' },
      { text: 'Fang mich doch! Haha!' },
    ],
  },
  terrace: {
    id: 'terrace',
    name: 'Gast auf der Terrasse',
    zh: '客人',
    py: 'ke4ren2',
    lines: [
      { text: 'Von hier sieht man die Berge am schönsten. Besonders am Abend.', word: 'shan' },
      { text: 'Bevor du gehst, sag 再见 zàijiàn, auf Wiedersehen.', word: 'zaijian' },
    ],
  },
};

/** Was der Teemeister beim Einschenken sagt */
export const TEA_LINES: NpcLine[] = [
  { text: '请喝茶 qǐng hē chá, bitte trink. Grüner Tee aus den Bergen.', word: 'qinghecha' },
  { text: 'Noch eine Tasse? Gern. Langsam trinken, dann schmeckt man mehr.' },
  { text: 'Dieser Oolong ist etwas kräftiger. Zum Wohl!' },
];
