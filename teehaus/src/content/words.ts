// Lernwörter („Wort des Moments“). py: Tonziffern; Silbengruppen mit Leerzeichen trennen.
import type { Word } from './types';

export const WORDS: Word[] = [
  // Jackie
  { id: 'xianggang', zh: '香港', py: 'xiang1gang3', de: 'Hongkong', note: 'wörtlich: „duftender Hafen“' },
  {
    id: 'jingju',
    zh: '京剧',
    py: 'jing1ju4',
    de: 'Peking-Oper',
    note: '京 = Hauptstadt (Peking), 剧 = Theater',
  },
  { id: 'qianxu', zh: '谦虚', py: 'qian1xu1', de: 'bescheiden' },
  { id: 'youmo', zh: '幽默', py: 'you1mo4', de: 'Humor', note: 'klingt wie das Lehnwort „humor“' },
  { id: 'shibai', zh: '失败', py: 'shi1bai4', de: 'scheitern, Misserfolg' },
  { id: 'gutou', zh: '骨头', py: 'gu3tou5', de: 'Knochen' },
  {
    id: 'zuiquan',
    zh: '醉拳',
    py: 'zui4quan2',
    de: 'Trunkene Faust (Kampfstil)',
    note: '醉 = betrunken, 拳 = Faust',
  },
  { id: 'haolaiwu', zh: '好莱坞', py: 'hao3lai2wu4', de: 'Hollywood' },
  { id: 'aosika', zh: '奥斯卡', py: 'ao4si1ka3', de: 'Oscar' },
  { id: 'nuli', zh: '努力', py: 'nu3li4', de: 'sich anstrengen, fleißig' },
  { id: 'bangzhu', zh: '帮助', py: 'bang1zhu4', de: 'helfen, Hilfe' },
  { id: 'guangdonghua', zh: '广东话', py: 'guang3dong1hua4', de: 'Kantonesisch', note: '话 = Sprache' },
  { id: 'long', zh: '龙', py: 'long2', de: 'Drache', note: 'Glückssymbol in China' },
  { id: 'xiongmao', zh: '熊猫', py: 'xiong2mao1', de: 'Panda', note: 'wörtlich: „Bär-Katze“' },

  // Yao
  { id: 'shanghai', zh: '上海', py: 'shang4hai3', de: 'Shanghai', note: 'wörtlich: „auf dem Meer“' },
  { id: 'lanqiu', zh: '篮球', py: 'lan2qiu2', de: 'Basketball', note: '篮 = Korb, 球 = Ball' },
  { id: 'anjing', zh: '安静', py: 'an1jing4', de: 'ruhig, still' },
  { id: 'gao', zh: '高', py: 'gao1', de: 'hoch, groß' },
  { id: 'tuiyi', zh: '退役', py: 'tui4yi4', de: 'aus dem aktiven Sport ausscheiden' },
  { id: 'xuexi', zh: '学习', py: 'xue2xi2', de: 'lernen' },
  { id: 'xuanxiu', zh: '选秀', py: 'xuan3xiu4', de: 'Draft (Auswahl neuer Spieler)' },
  { id: 'quanmingxing', zh: '全明星', py: 'quan2ming2xing1', de: 'All-Star', note: '全 = ganz, 明星 = Star' },
  {
    id: 'mingrentang',
    zh: '名人堂',
    py: 'ming2ren2tang2',
    de: 'Hall of Fame',
    note: 'wörtlich: „Halle berühmter Leute“',
  },
  { id: 'tuandui', zh: '团队', py: 'tuan2dui4', de: 'Team, Mannschaft' },
  { id: 'baohu', zh: '保护', py: 'bao3hu4', de: 'schützen' },
  { id: 'guoqi', zh: '国旗', py: 'guo2qi2', de: 'Nationalflagge' },
  { id: 'putaojiu', zh: '葡萄酒', py: 'pu2tao5jiu3', de: 'Wein', note: '葡萄 = Traube, 酒 = Alkohol' },
  { id: 'jilupian', zh: '纪录片', py: 'ji4lu4pian4', de: 'Dokumentarfilm' },

  // Teehaus, Easter Eggs, Finale
  { id: 'cha', zh: '茶', py: 'cha2', de: 'Tee' },
  { id: 'chaguan', zh: '茶馆', py: 'cha2guan3', de: 'Teehaus', note: '馆 = Haus, Lokal' },
  { id: 'chahu', zh: '茶壶', py: 'cha2hu2', de: 'Teekanne' },
  { id: 'xique', zh: '喜鹊', py: 'xi3que4', de: 'Elster', note: 'gilt in China als Glücksbote' },
  { id: 'denglong', zh: '灯笼', py: 'deng1long5', de: 'Laterne' },
  { id: 'jinli', zh: '锦鲤', py: 'jin3li3', de: 'Koi (Zierkarpfen)', note: 'Symbol für Glück und Ausdauer' },
  { id: 'mao', zh: '猫', py: 'mao1', de: 'Katze' },
  { id: 'xianglu', zh: '香炉', py: 'xiang1lu2', de: 'Räucherstäbchen-Brenner' },
  { id: 'shengao', zh: '身高', py: 'shen1gao1', de: 'Körpergröße' },
  { id: 'ganbei', zh: '干杯', py: 'gan1bei1', de: 'Prost!', note: 'wörtlich: „die Tasse leeren“' },
  { id: 'xiexie', zh: '谢谢', py: 'xie4xie5', de: 'danke' },
  { id: 'qingjin', zh: '请进', py: 'qing3jin4', de: 'bitte eintreten' },
];

export const wordById = (id: string): Word | undefined => WORDS.find((w) => w.id === id);
