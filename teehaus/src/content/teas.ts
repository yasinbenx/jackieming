// Tee-Mini-Spiel: Teesorten, Wendungen und Sprüche des Teemeisters. Temperaturen und Ziehzeiten sind übliche
// Richtwerte für Blatttee in der Kanne (keine starren Regeln; Herkunft und Geschmack verschieben sie).
// Ziehzeit im Spiel: 1 Minute = 3 Sekunden.

export interface Tea {
  id: string;
  zh: string;
  /** Pinyin mit Tonziffern */
  py: string;
  de: string;
  note: string;
  /** Wassertemperatur (°C): Bereich, in dem es gut wird */
  temp: [number, number];
  /** Ziehzeit (Minuten) */
  time: [number, number];
  /** Farbe des fertigen Aufgusses */
  color: string;
  /** Hinweis bei zu heißem Wasser */
  tooHot: string;
}

export const TEAS: Tea[] = [
  {
    id: 'lvcha',
    zh: '绿茶',
    py: 'lv4cha2',
    de: 'Grüntee',
    note: '绿 = grün. Die Blätter werden nach der Ernte erhitzt, damit sie grün bleiben.',
    temp: [75, 85],
    time: [1.5, 2.5],
    color: '#c9c75a',
    tooHot: 'Zu heißes Wasser macht Grüntee bitter.',
  },
  {
    id: 'hongcha',
    zh: '红茶',
    py: 'hong2cha2',
    de: 'Schwarztee',
    note: 'wörtlich „roter Tee“, nach der Farbe des Aufgusses. Im Deutschen heißt er nach den dunklen Blättern.',
    temp: [90, 100],
    time: [3, 4.5],
    color: '#a5421c',
    tooHot: '',
  },
  {
    id: 'molihuacha',
    zh: '茉莉花茶',
    py: 'mo4li4hua1 cha2',
    de: 'Jasmintee',
    note: '茉莉花 = Jasminblüte. Meist grüner Tee, der mit frischen Blüten beduftet wird.',
    temp: [78, 88],
    time: [2, 3],
    color: '#d6c46a',
    tooHot: 'Zu heiß, und der zarte Blütenduft verfliegt.',
  },
  {
    id: 'wulongcha',
    zh: '乌龙茶',
    py: 'wu1long2 cha2',
    de: 'Oolong',
    note: '乌龙 = „schwarzer Drache“. Halb oxidiert, zwischen Grün- und Schwarztee.',
    temp: [88, 98],
    time: [2, 3.5],
    color: '#c98a2e',
    tooHot: '',
  },
  {
    id: 'baicha',
    zh: '白茶',
    py: 'bai2cha2',
    de: 'Weißtee',
    note: '白 = weiß, nach dem feinen weißen Flaum der jungen Knospen.',
    temp: [75, 88],
    time: [2.5, 4],
    color: '#e3d79a',
    tooHot: 'Weißtee mag es sanft, nicht zu heiß.',
  },
];

/** Wendungen beim Servieren; die erste ist richtig */
export const SERVE_PHRASES = [
  { zh: '请喝茶', py: 'qing3 he1 cha2', de: 'Bitte trinken Sie Tee!', ok: true },
  { zh: '谢谢', py: 'xie4xie5', de: 'Danke', ok: false },
  { zh: '再见', py: 'zai4jian4', de: 'Auf Wiedersehen', ok: false },
  { zh: '干杯', py: 'gan1bei1', de: 'Prost!', ok: false },
];

/** Bestellung des Teemeisters: „Bitte bring mir eine Tasse …“ */
export const ORDER = {
  zh: (tea: string) => `请来一杯${tea}。`,
  py: (py: string) => `qing3 lai2 yi4 bei1 ${py}`,
};

/** Wasserstufen nach Temperatur (für die Anzeige am Kessel) */
export const WATER_STAGES = [
  { from: 0, zh: '凉水', py: 'liang2shui3', de: 'kaltes Wasser' },
  { from: 45, zh: '温水', py: 'wen1shui3', de: 'warmes Wasser' },
  { from: 70, zh: '热水', py: 're4shui3', de: 'heißes Wasser' },
  { from: 97, zh: '开水', py: 'kai1shui3', de: 'kochendes Wasser' },
];

/** Urteil des Teemeisters nach Teeblättern (1–3) */
export const MASTER_VERDICT: Record<1 | 2 | 3, string[]> = {
  3: [
    '好茶！Ein ausgezeichneter Tee.',
    'Hervorragend. Du hast ein Gespür für Tee.',
    '好！So schmeckt ein Tee, wie er sein soll.',
  ],
  2: ['Gut gemacht. Mit etwas Übung wird er noch besser.', 'Nicht schlecht! Fast wie bei mir.'],
  1: ['Hm. Jeder Meister hat einmal angefangen.', 'Trinkbar. Versuch es gleich noch einmal.'],
};

/** neue Lernwörter des Mini-Spiels */
export const TEA_WORDS = [
  'lvcha',
  'hongcha',
  'molihuacha',
  'wulongcha',
  'baicha',
  'shui',
  'kaishui',
  'qinghecha',
];
