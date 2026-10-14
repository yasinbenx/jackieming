// Dorfbewohner: Rolle, Aussehen, Tagesablauf, kurze Sprüche und ein „Wort des Moments“. Alle Figuren sind frei
// erfunden, mit generischen Gesichtern. Texte und Abläufe lassen sich hier ändern, ohne Code anzufassen.
// Orte im Ablauf: siehe SPOT-Namen in src/world/village.ts (villageSpots).

/** Was ein Bewohner an einem Ort tut */
export type Activity =
  /** stehen und schauen */
  | 'stand'
  /** sitzen (Ort muss ein Sitzplatz sein: bank-…, brett-…) */
  | 'sit'
  /** Bewegung aus dem Figuren-Satz, wiederholt (z. B. polish = wischen/fegen, pet = bücken/pflücken) */
  | 'polish'
  | 'pour'
  | 'point'
  | 'think'
  | 'write'
  | 'pet'
  | 'play'
  | 'hop'
  | 'bow'
  | 'fan'
  | 'laugh';

export interface Step {
  spot: string;
  act: Activity;
  /** Dauer in Sekunden (wird leicht zufällig gestreckt) */
  dur: number;
}

export interface VillagerLook {
  height: number;
  build: number;
  skin: string;
  hair: string;
  hairStyle: 'crop' | 'elder' | 'bun' | 'kidBuns' | 'cap' | 'straw' | 'ponytail' | 'side' | 'none';
  beard?: boolean;
  child?: boolean;
  top: {
    cut: 'tang' | 'hanfu' | 'changshan';
    color: string;
    trim: string;
    skirt: number;
    vest?: string;
    wideSleeves?: boolean;
    motif?: 'cloud' | 'hem' | 'plain';
  };
  pants: string;
  shoes: string;
  apron?: string;
  face?: { laughLines?: number; foreheadLines?: number; smileEyes?: number };
}

export interface Villager {
  id: string;
  name: string;
  zh: string;
  role: string;
  look: VillagerLook;
  /** Haus, in das die Figur abends geht (Spot-Name) */
  home: string;
  schedule: Step[];
  lines: string[];
  /** Lernwort (wird beim Ansprechen vergeben) */
  word: string;
  /** verkauft etwas (Laden) */
  shop?: boolean;
  /** gibt einen Auftrag (siehe ERRANDS) */
  errand?: string;
  /** langsam oder flink */
  speed?: number;
}

const SKIN = ['#e8b894', '#d9a27a', '#c98f68', '#f0c8a8', '#b97f5a'];

export const VILLAGERS: Villager[] = [
  {
    id: 'wang',
    name: 'Frau Wang',
    zh: '王阿姨',
    role: 'Teehändlerin',
    look: {
      height: 1.6,
      build: 0.98,
      skin: SKIN[0]!,
      hair: '#2a2220',
      hairStyle: 'bun',
      top: { cut: 'hanfu', color: '#2e6b5e', trim: '#e8c37a', skirt: 0.7, wideSleeves: true, motif: 'cloud' },
      pants: '#2a2a2e',
      shoes: '#2e2a26',
      apron: '#efe2c4',
      face: { laughLines: 0.6 },
    },
    home: 'tuer-teeladen',
    schedule: [
      { spot: 'theke-teeladen', act: 'pour', dur: 18 },
      { spot: 'stand-tee', act: 'point', dur: 14 },
      { spot: 'theke-teeladen', act: 'polish', dur: 12 },
      { spot: 'brunnen', act: 'stand', dur: 6 },
    ],
    lines: [
      '欢迎！Frischer Tee aus unserem Teefeld. Schau dir ruhig alles an.',
      'Grüner Tee wird nicht mit kochendem Wasser aufgegossen, sonst wird er bitter.',
      'Ich habe auch Hüte und etwas zu naschen. Für ein paar Münzen.',
    ],
    word: 'chaye',
    shop: true,
  },
  {
    id: 'zhao',
    name: 'Herr Zhao',
    zh: '老赵',
    role: 'Gemüsehändler',
    look: {
      height: 1.68,
      build: 1.05,
      skin: SKIN[1]!,
      hair: '#3a3430',
      hairStyle: 'cap',
      top: { cut: 'tang', color: '#6a5a3a', trim: '#d9c38a', skirt: 0, vest: '#3a3228', motif: 'plain' },
      pants: '#3a3530',
      shoes: '#2a2018',
    },
    home: 'tuer-wohnhaus6',
    schedule: [
      { spot: 'stand-gemuese', act: 'point', dur: 20 },
      { spot: 'stand-gemuese', act: 'polish', dur: 10 },
      { spot: 'tuer-lagerhaus', act: 'pet', dur: 8 },
      { spot: 'stand-gemuese', act: 'stand', dur: 12 },
    ],
    lines: [
      'Kohl, Rettich, Lauch! Alles heute früh geerntet.',
      'Zu teuer? Für dich mache ich einen guten Preis!',
    ],
    word: 'cai',
  },
  {
    id: 'sun',
    name: 'Frau Sun',
    zh: '孙大姐',
    role: 'Obsthändlerin',
    look: {
      height: 1.58,
      build: 0.95,
      skin: SKIN[3]!,
      hair: '#1e1a18',
      hairStyle: 'ponytail',
      top: { cut: 'tang', color: '#b8432a', trim: '#f2d27a', skirt: 0, motif: 'hem' },
      pants: '#2e2a36',
      shoes: '#2a2026',
    },
    home: 'tuer-wohnhaus7',
    schedule: [
      { spot: 'stand-obst', act: 'point', dur: 18 },
      { spot: 'stand-obst', act: 'laugh', dur: 6 },
      { spot: 'brunnen', act: 'polish', dur: 10 },
      { spot: 'stand-obst', act: 'stand', dur: 14 },
    ],
    lines: ['Pfirsiche, so süß wie Honig!', 'Die Mandarinen bringen Glück, sagt man.'],
    word: 'shuiguo',
  },
  {
    id: 'liu',
    name: 'Wirt Liu',
    zh: '刘老板',
    role: 'Gastwirt',
    look: {
      height: 1.74,
      build: 1.15,
      skin: SKIN[2]!,
      hair: '#2a2420',
      hairStyle: 'crop',
      top: { cut: 'tang', color: '#7a1f2a', trim: '#e3b450', skirt: 0, motif: 'plain' },
      pants: '#2a2622',
      shoes: '#1e1a16',
      apron: '#e8dcc4',
      face: { laughLines: 0.8, smileEyes: 0.4 },
    },
    home: 'tuer-gasthaus',
    schedule: [
      { spot: 'vor-gasthaus', act: 'polish', dur: 16 },
      { spot: 'brunnen', act: 'pour', dur: 8 },
      { spot: 'vor-gasthaus', act: 'stand', dur: 12 },
      { spot: 'stand-gemuese', act: 'point', dur: 8 },
    ],
    lines: [
      'Im Gasthaus gibt es heute Nudelsuppe. Komm vorbei!',
      'Reisende erzählen mir die besten Geschichten.',
    ],
    word: 'miantiao',
  },
  {
    id: 'chen',
    name: 'Meister Chen',
    zh: '陈师傅',
    role: 'Schreiner',
    look: {
      height: 1.7,
      build: 1.1,
      skin: SKIN[4]!,
      hair: '#4a4038',
      hairStyle: 'side',
      top: { cut: 'tang', color: '#4f6a7a', trim: '#c9b88a', skirt: 0, vest: '#5a4030', motif: 'plain' },
      pants: '#3a342c',
      shoes: '#2a2018',
      apron: '#8a6a44',
    },
    home: 'tuer-werkstatt',
    schedule: [
      { spot: 'hobelbank', act: 'polish', dur: 22 },
      { spot: 'vor-werkstatt', act: 'think', dur: 6 },
      { spot: 'hobelbank', act: 'pour', dur: 10 },
      { spot: 'tuer-lagerhaus', act: 'pet', dur: 8 },
    ],
    lines: [
      'Holz muss trocknen, sonst verzieht es sich. Geduld!',
      'Den Tisch im Teehaus? Den habe ich gebaut.',
    ],
    word: 'mutou',
  },
  {
    id: 'zhou',
    name: 'Bauer Zhou',
    zh: '周大爷',
    role: 'Reisbauer',
    look: {
      height: 1.66,
      build: 1.0,
      skin: SKIN[4]!,
      hair: '#6a6460',
      hairStyle: 'straw',
      top: { cut: 'tang', color: '#3a5a7a', trim: '#d9cdb5', skirt: 0, motif: 'plain' },
      pants: '#2e3a4a',
      shoes: '#3a2a1e',
      face: { foreheadLines: 0.6, laughLines: 0.5 },
    },
    home: 'tuer-wohnhaus9',
    schedule: [
      { spot: 'terrassen', act: 'pet', dur: 24 },
      { spot: 'terrassen-2', act: 'pet', dur: 18 },
      { spot: 'flussbruecke', act: 'stand', dur: 6 },
      { spot: 'brunnen', act: 'pour', dur: 8 },
    ],
    lines: [
      'Reis braucht viel Wasser und noch mehr Geduld.',
      'Siehst du die Terrassen? Mein Großvater hat sie angelegt.',
    ],
    word: 'mifan',
    speed: 0.9,
  },
  {
    id: 'wu',
    name: 'Bäuerin Wu',
    zh: '吴大妈',
    role: 'Reisbäuerin',
    look: {
      height: 1.56,
      build: 0.98,
      skin: SKIN[1]!,
      hair: '#3a3330',
      hairStyle: 'straw',
      top: { cut: 'hanfu', color: '#7a6a3a', trim: '#d9cdb5', skirt: 0.5, motif: 'plain' },
      pants: '#3a3a30',
      shoes: '#3a2a1e',
    },
    home: 'tuer-wohnhaus9',
    schedule: [
      { spot: 'terrassen-2', act: 'pet', dur: 22 },
      { spot: 'terrassen', act: 'stand', dur: 8 },
      { spot: 'huehner', act: 'pet', dur: 10 },
    ],
    lines: ['Die Enten fressen die Schnecken aus den Reisfeldern. Kluge Tiere!', 'Bist du neu hier? 欢迎！'],
    word: 'ya',
  },
  {
    id: 'mei',
    name: 'Mei',
    zh: '小梅',
    role: 'Teepflückerin',
    look: {
      height: 1.6,
      build: 0.92,
      skin: SKIN[3]!,
      hair: '#1a1614',
      hairStyle: 'straw',
      top: { cut: 'hanfu', color: '#5a8a4a', trim: '#f1d9a0', skirt: 0.55, motif: 'cloud' },
      pants: '#3a4a3a',
      shoes: '#2a3026',
    },
    home: 'tuer-hofhaus',
    schedule: [
      { spot: 'teefeld-a', act: 'pet', dur: 26 },
      { spot: 'teefeld-b', act: 'pet', dur: 22 },
      { spot: 'teefeld-weg', act: 'stand', dur: 8 },
    ],
    lines: [
      'Man pflückt nur die Spitze: eine Knospe und zwei Blätter.',
      'Am frühen Morgen duften die Teesträucher am schönsten.',
    ],
    word: 'caicha',
    errand: 'teekorb',
  },
  {
    id: 'huang',
    name: 'Fischer Huang',
    zh: '黄老头',
    role: 'Fischer',
    look: {
      height: 1.65,
      build: 0.95,
      skin: SKIN[2]!,
      hair: '#a8a49c',
      hairStyle: 'elder',
      beard: true,
      top: { cut: 'tang', color: '#3a4a5a', trim: '#c9b88a', skirt: 0, motif: 'plain' },
      pants: '#2a3038',
      shoes: '#2a2420',
      face: { laughLines: 0.8, foreheadLines: 0.8 },
    },
    home: 'tuer-lagerhaus',
    schedule: [
      { spot: 'angelplatz', act: 'think', dur: 40 },
      { spot: 'angelplatz-2', act: 'think', dur: 30 },
      { spot: 'stand-obst', act: 'stand', dur: 6 },
    ],
    lines: [
      'Pst! Die Fische hören jedes Wort.',
      'Heute beißt keiner. Macht nichts, die Ruhe ist das Beste daran.',
    ],
    word: 'yu',
    speed: 0.8,
  },
  {
    id: 'jingxin',
    name: 'Mönch Jingxin',
    zh: '静心法师',
    role: 'Mönch am Schrein',
    look: {
      height: 1.72,
      build: 0.95,
      skin: SKIN[0]!,
      hair: '#2a2420',
      hairStyle: 'none',
      top: { cut: 'changshan', color: '#c98a3a', trim: '#8a3a1e', skirt: 0.85, motif: 'plain' },
      pants: '#6a4a2a',
      shoes: '#3a2a1e',
      face: { smileEyes: 0.5 },
    },
    home: 'schrein',
    schedule: [
      { spot: 'schrein', act: 'bow', dur: 12 },
      { spot: 'schrein-hof', act: 'polish', dur: 20 },
      { spot: 'schreinchen', act: 'bow', dur: 8 },
      { spot: 'schrein-hof', act: 'stand', dur: 10 },
    ],
    lines: [
      'Ein ruhiger Geist ist wie stilles Wasser.',
      'Die Treppe hat 99 Stufen. Ich habe sie oft gezählt.',
    ],
    word: 'miao',
    speed: 0.85,
  },
  {
    id: 'laoli',
    name: 'Großvater Li',
    zh: '李爷爷',
    role: 'Brettspieler',
    look: {
      height: 1.64,
      build: 0.96,
      skin: SKIN[1]!,
      hair: '#d8d4cc',
      hairStyle: 'elder',
      beard: true,
      top: { cut: 'changshan', color: '#4a3a5a', trim: '#d6b56a', skirt: 0.8, motif: 'hem' },
      pants: '#2a2630',
      shoes: '#1e1a16',
      face: { laughLines: 0.9, foreheadLines: 0.7 },
    },
    home: 'tuer-hofhaus',
    schedule: [
      { spot: 'brett-a', act: 'sit', dur: 70 },
      { spot: 'bank-1', act: 'sit', dur: 20 },
    ],
    lines: ['将军！Ha, das hast du nicht kommen sehen.', 'Wir spielen hier jeden Tag, seit vierzig Jahren.'],
    word: 'xiaqi',
    speed: 0.75,
  },
  {
    id: 'laozhang',
    name: 'Großvater Zhang',
    zh: '张爷爷',
    role: 'Brettspieler',
    look: {
      height: 1.7,
      build: 0.9,
      skin: SKIN[4]!,
      hair: '#bcb8b0',
      hairStyle: 'cap',
      top: { cut: 'changshan', color: '#2d5a52', trim: '#d6b56a', skirt: 0.8, motif: 'hem' },
      pants: '#2a2a2a',
      shoes: '#1e1a16',
      face: { foreheadLines: 0.8 },
    },
    home: 'tuer-wohnhaus10',
    schedule: [
      { spot: 'brett-b', act: 'sit', dur: 70 },
      { spot: 'brunnen', act: 'stand', dur: 10 },
    ],
    lines: ['Hmm … lass mich nachdenken.', 'Der alte Li gewinnt nur, weil er so laut ist!'],
    word: 'qipan',
    speed: 0.75,
  },
  {
    id: 'xiaoming',
    name: 'Xiaoming',
    zh: '小明',
    role: 'Kind',
    look: {
      height: 1.2,
      build: 0.95,
      skin: SKIN[0]!,
      hair: '#1a1614',
      hairStyle: 'crop',
      child: true,
      top: { cut: 'tang', color: '#2f5aa8', trim: '#f2d27a', skirt: 0, motif: 'hem' },
      pants: '#f0e2c4',
      shoes: '#d8452e',
    },
    home: 'tuer-wohnhaus6',
    schedule: [
      { spot: 'platz-a', act: 'hop', dur: 8 },
      { spot: 'huehner', act: 'pet', dur: 8 },
      { spot: 'platz-b', act: 'hop', dur: 6 },
      { spot: 'brett-zuschauer', act: 'stand', dur: 10 },
    ],
    lines: ['Fang mich doch!', 'Die Hühner gehören Oma Wu. Das braune heißt Dumpling.'],
    word: 'ji',
    speed: 1.5,
  },
  {
    id: 'lili',
    name: 'Lili',
    zh: '丽丽',
    role: 'Kind',
    look: {
      height: 1.15,
      build: 0.92,
      skin: SKIN[3]!,
      hair: '#1a1614',
      hairStyle: 'kidBuns',
      child: true,
      top: { cut: 'tang', color: '#d84a7a', trim: '#f2d27a', skirt: 0.2, motif: 'cloud' },
      pants: '#f0e2c4',
      shoes: '#2e6b5e',
    },
    home: 'tuer-wohnhaus7',
    schedule: [
      { spot: 'platz-b', act: 'hop', dur: 8 },
      { spot: 'brunnen', act: 'pet', dur: 6 },
      { spot: 'platz-a', act: 'laugh', dur: 6 },
      { spot: 'stand-obst', act: 'stand', dur: 6 },
    ],
    lines: [
      'Ich kann schon bis hundert zählen! 一、二、三 …',
      'Hast du den Drachen auf dem Teehausdach gesehen?',
    ],
    word: 'pengyou',
    speed: 1.5,
  },
  {
    id: 'yun',
    name: 'Frau Yun',
    zh: '云嫂',
    role: 'Wäscherin',
    look: {
      height: 1.62,
      build: 1.0,
      skin: SKIN[2]!,
      hair: '#2a2220',
      hairStyle: 'bun',
      top: { cut: 'hanfu', color: '#6f6aa0', trim: '#e6d3a0', skirt: 0.6, motif: 'plain' },
      pants: '#2a2836',
      shoes: '#2a2838',
    },
    home: 'tuer-wohnhaus10',
    schedule: [
      { spot: 'brunnen', act: 'polish', dur: 20 },
      { spot: 'hof', act: 'polish', dur: 14 },
      { spot: 'tuer-wohnhaus10', act: 'stand', dur: 8 },
    ],
    lines: [
      'Brunnenwasser ist eiskalt, sogar im Sommer.',
      'Wenn die Wäsche flattert, kommt Regen. Sagt meine Mutter.',
    ],
    word: 'jing',
  },
  {
    id: 'shu',
    name: 'Lehrer Shu',
    zh: '舒老师',
    role: 'Lehrer und Kalligraf',
    look: {
      height: 1.76,
      build: 0.9,
      skin: SKIN[0]!,
      hair: '#2a2420',
      hairStyle: 'side',
      top: {
        cut: 'changshan',
        color: '#4f6a7a',
        trim: '#d9c38a',
        skirt: 0.85,
        vest: '#2c2a30',
        motif: 'hem',
      },
      pants: '#2a2a30',
      shoes: '#1e1a16',
    },
    home: 'tuer-hofhaus',
    schedule: [
      { spot: 'aussicht', act: 'write', dur: 26 },
      { spot: 'bambus', act: 'think', dur: 10 },
      { spot: 'hof', act: 'write', dur: 16 },
      { spot: 'teehaus-weg', act: 'stand', dur: 6 },
    ],
    lines: [
      'Schreib jedes Zeichen so, als wäre es das einzige.',
      'Vom Aussichtspunkt sieht man das ganze Tal. Ein Gedicht wert!',
    ],
    word: 'shufa',
  },
  {
    id: 'pilger',
    name: 'Pilgerin An',
    zh: '安女士',
    role: 'Wanderin',
    look: {
      height: 1.66,
      build: 0.94,
      skin: SKIN[1]!,
      hair: '#2a2220',
      hairStyle: 'straw',
      top: { cut: 'hanfu', color: '#8a5a3a', trim: '#e8c37a', skirt: 0.7, motif: 'cloud' },
      pants: '#3a2a22',
      shoes: '#3a2a1e',
    },
    home: 'tuer-gasthaus',
    schedule: [
      { spot: 'schrein', act: 'bow', dur: 10 },
      { spot: 'teefeld-weg', act: 'stand', dur: 6 },
      { spot: 'teehaus-weg', act: 'think', dur: 8 },
      { spot: 'bank-0', act: 'sit', dur: 16 },
    ],
    lines: [
      'Ich wandere von Dorf zu Dorf und sammle Teesorten.',
      'Im Gasthaus schläft man gut. Der Wirt schnarcht nur leise.',
    ],
    word: 'lvxing',
  },
  {
    id: 'bo',
    name: 'Bote Bo',
    zh: '小波',
    role: 'Bote',
    look: {
      height: 1.72,
      build: 0.95,
      skin: SKIN[3]!,
      hair: '#1a1614',
      hairStyle: 'cap',
      top: { cut: 'tang', color: '#a8322a', trim: '#e9c46a', skirt: 0, motif: 'plain' },
      pants: '#24201e',
      shoes: '#1a1614',
    },
    home: 'tuer-gasthaus',
    schedule: [
      { spot: 'teehaus-weg', act: 'stand', dur: 4 },
      { spot: 'tuer-teeladen', act: 'bow', dur: 4 },
      { spot: 'flussbruecke', act: 'stand', dur: 4 },
      { spot: 'tuer-werkstatt', act: 'bow', dur: 4 },
      { spot: 'teefeld-weg', act: 'stand', dur: 4 },
    ],
    lines: ['Keine Zeit, keine Zeit! Briefe für das ganze Tal.', 'Ich bin schneller als jedes Pferd. Fast.'],
    word: 'xin',
    speed: 1.3,
  },
];

/** Aufträge von Dorfbewohnern (ein Schritt: etwas zu jemandem bringen) */
export interface Errand {
  id: string;
  from: string;
  to: string;
  zh: string;
  de: string;
  offer: string;
  /** was die Empfängerin sagt */
  thanks: string;
  coins: number;
  word: string;
}

export const ERRANDS: Errand[] = [
  {
    id: 'teekorb',
    from: 'mei',
    to: 'wang',
    zh: '送茶叶',
    de: 'Teeblätter bringen',
    offer:
      'Mein Korb ist voll, aber ich muss noch die nächste Reihe pflücken. Bringst du die Blätter zu Frau Wang in den Teeladen im Dorf?',
    thanks: '哎呀，好茶叶！So frisch. Danke dir, hier sind ein paar Münzen.',
    coins: 12,
    word: 'chaye',
  },
];

/** Was es im Laden zu kaufen gibt */
export interface ShopItem {
  id: string;
  zh: string;
  de: string;
  price: number;
  /** Garderobe (head:…, outfit:…) oder Lernwort (word:…) */
  gives: string;
}

export const SHOP: ShopItem[] = [
  { id: 'taozi', zh: '桃子', de: 'Pfirsich', price: 2, gives: 'word:taozi' },
  { id: 'baozi', zh: '包子', de: 'gefülltes Dampfbrötchen', price: 3, gives: 'word:baozi' },
  { id: 'yuebing', zh: '月饼', de: 'Mondkuchen', price: 5, gives: 'word:yuebing' },
  { id: 'doulin', zh: '斗笠', de: 'Reishut', price: 15, gives: 'head:straw' },
  { id: 'guapimao', zh: '瓜皮帽', de: 'Gelehrtenkappe', price: 25, gives: 'head:cap' },
];
