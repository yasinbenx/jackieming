// Fremdinhalte und ihre Lizenzen. Alles andere (Figuren, Teehaus, Landschaft, Texturen, Klänge) ist im Code erzeugt.

export interface Credit {
  name: string;
  what: string;
  author: string;
  license: string;
  url: string;
}

export const CREDITS: Credit[] = [
  {
    name: 'three.js',
    what: '3D-Darstellung im Browser',
    author: 'three.js authors',
    license: 'MIT',
    url: 'https://github.com/mrdoob/three.js',
  },
  {
    name: 'postprocessing',
    what: 'Bloom, Tiefenunschärfe, Tone Mapping',
    author: 'Raoul van Rüschen (pmndrs)',
    license: 'Zlib',
    url: 'https://github.com/pmndrs/postprocessing',
  },
  {
    name: 'Universal Base Characters',
    what: 'Haar- und Augenbrauen-Modelle (haare.glb, komprimiert)',
    author: 'Quaternius',
    license: 'CC0 1.0',
    url: 'https://quaternius.itch.io/universal-base-characters',
  },
  {
    name: 'Noto Serif SC',
    what: 'Schrift für chinesische Zeichen (Subset)',
    author: 'Google, Adobe',
    license: 'SIL Open Font License 1.1',
    url: 'https://fonts.google.com/noto/specimen/Noto+Serif+SC',
  },
  {
    name: 'Ma Shan Zheng',
    what: 'Pinselschrift für Titel und Schilder (Subset)',
    author: 'Ma Shan Zheng',
    license: 'SIL Open Font License 1.1',
    url: 'https://fonts.google.com/specimen/Ma+Shan+Zheng',
  },
];

export const CREDITS_EXTRA =
  'Alle Figuren, das Teehaus, die Landschaft, Stickereimuster, Texturen, Musik und Geräusche sind im Code erzeugt (prozedural). Einzige Ausnahme sind die oben genannten CC0-Haarmodelle. Es werden keine Fotos oder Tonaufnahmen von außen geladen.';
