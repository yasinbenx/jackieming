// Aufgaben vom Teemeister (任务 rènwu) und Belohnungen für die Garderobe. Reihenfolge = Freischaltung:
// Jede Aufgabe wird angeboten, sobald die vorige erledigt ist. Texte und Belohnungen lassen sich hier ändern.

export type QuestStep =
  | { kind: 'take'; item: 'tea'; text: string }
  | { kind: 'deliver'; item: 'tea'; to: string; toName: string; text: string }
  | { kind: 'find-cat'; text: string }
  | { kind: 'talk'; count: number; text: string }
  | { kind: 'brew'; leaves: 1 | 2 | 3; text: string }
  | { kind: 'report'; text: string };

export interface Reward {
  coins: number;
  /** Garderobe: Outfits (outfit:…), Kopf (head:…) */
  items: string[];
  /** Lernwort */
  word?: string;
}

export interface Quest {
  id: string;
  zh: string;
  py: string;
  de: string;
  /** Was der Meister beim Anbieten sagt */
  offer: string;
  steps: QuestStep[];
  /** Dank beim Abgeben */
  thanks: string;
  reward: Reward;
}

export const QUESTS: Quest[] = [
  {
    id: 'songcha',
    zh: '送茶',
    py: 'song4 cha2',
    de: 'Tee bringen',
    offer:
      'Die Dichterin am Fenster wartet auf ihren Tee, und ich habe gerade alle Hände voll. Holst du die Tasse hier an der Theke und bringst sie ihr?',
    steps: [
      { kind: 'take', item: 'tea', text: 'Hol die Tasse Tee an der Theke.' },
      {
        kind: 'deliver',
        item: 'tea',
        to: 'poet',
        toName: 'Dichterin',
        text: 'Bring den Tee der Dichterin am Fenster.',
      },
      { kind: 'report', text: 'Sag dem Teemeister Bescheid.' },
    ],
    thanks: '谢谢！Ohne verschütteten Tropfen. Hier, ein Reishut für dich, gegen Sonne und Regen.',
    reward: { coins: 10, items: ['head:straw'], word: 'song' },
  },
  {
    id: 'zhaomao',
    zh: '找猫',
    py: 'zhao3 mao1',
    de: 'Katze finden',
    offer:
      'Meine Katze hat sich wieder versteckt. Sie schläft gern an Orten, wo keiner hinschaut. Findest du sie für mich?',
    steps: [
      { kind: 'find-cat', text: 'Such die Katze im Teehaus oder draußen auf der Terrasse.' },
      { kind: 'report', text: 'Sag dem Teemeister, wo die Katze war.' },
    ],
    thanks: 'Da war sie also! Danke. Meine Tochter hat früher Zöpfe so gebunden, probier es doch einmal.',
    reward: { coins: 10, items: ['head:ponytail', 'head:bun'], word: 'zhao' },
  },
  {
    id: 'renshi',
    zh: '认识客人',
    py: 'ren4shi5 ke4ren2',
    de: 'Gäste kennenlernen',
    offer:
      'In einem Teehaus kennt man seine Gäste. Sprich mit drei von ihnen, sie haben alle etwas zu erzählen.',
    steps: [
      { kind: 'talk', count: 3, text: 'Sprich mit drei verschiedenen Gästen.' },
      { kind: 'report', text: 'Erzähl dem Teemeister davon.' },
    ],
    thanks:
      'Jetzt gehörst du schon fast dazu. Diese Seidenjacke stand hier lange herum, sie passt dir bestimmt.',
    reward: { coins: 15, items: ['outfit:seide'], word: 'pengyou' },
  },
  {
    id: 'haocha',
    zh: '好茶',
    py: 'hao3 cha2',
    de: 'Ein meisterlicher Tee',
    offer:
      'Du hast schon Tee gekocht. Jetzt möchte ich einen, der drei Teeblätter verdient. Nimm dir Zeit, achte auf Wasser und Ziehzeit.',
    steps: [
      { kind: 'brew', leaves: 3, text: 'Bereite an der Theke einen Tee mit 3 Teeblättern zu.' },
      { kind: 'report', text: 'Sprich mit dem Teemeister.' },
    ],
    thanks:
      '好茶！Ein Tee wie aus meiner eigenen Kanne. Nimm dieses Gelehrtengewand und die Kappe, du hast sie dir verdient.',
    reward: { coins: 20, items: ['outfit:gelehrter', 'head:cap'], word: 'haocha' },
  },
];

/** Kopfbedeckungen und Frisuren in der Garderobe ('eigen' = wie beim Outfit) */
export const HEADS: { id: string; zh: string; py: string; de: string; free?: boolean }[] = [
  { id: 'eigen', zh: '原样', py: 'yuan2yang4', de: 'Frisur des Outfits', free: true },
  { id: 'side', zh: '短发', py: 'duan3fa4', de: 'Kurzes Haar, Seitenscheitel', free: true },
  { id: 'crop', zh: '寸头', py: 'cun4tou2', de: 'Ganz kurz', free: true },
  { id: 'ponytail', zh: '马尾', py: 'ma3wei3', de: 'Zopf' },
  { id: 'bun', zh: '发髻', py: 'fa4ji4', de: 'Haarknoten' },
  { id: 'straw', zh: '斗笠', py: 'dou3li4', de: 'Reishut' },
  { id: 'cap', zh: '瓜皮帽', py: 'gua1pi2mao4', de: 'Gelehrtenkappe' },
];

/** Verstecke der Katze für „Katze finden“ (werden gegen das Laufraster geprüft) */
export const CAT_HIDES: [number, number][] = [
  [6.3, 5.9],
  [-6.3, 5.9],
  [-6.4, -2.6],
  [6.3, -0.4],
  [-2.1, 6.0],
];
