// Bildnachweise für die Papierfiguren. Lizenzbedingungen: Urheber nennen, Lizenz verlinken, Änderungen angeben;
// bei CC BY-SA steht die bearbeitete Fassung unter derselben Lizenz.

export interface Credit {
  who: string;
  file: string;
  url: string;
  author: string;
  authorUrl?: string;
  license: string;
  licenseUrl: string;
  /** Was am Bild verändert wurde */
  changes: string;
  /** Hinweis zur Nachprüfung, falls etwas nicht eindeutig belegt ist */
  note?: string;
}

const CHANGES =
  'Hintergrund entfernt (freigestellt), zugeschnitten, verkleinert, heller Papierrand und gerissene Kante ergänzt. Das Gesicht wurde nicht verändert.';

export const CREDITS: Credit[] = [
  {
    who: 'Jackie Chan (成龙)',
    file: 'Jackie Chan (7588072360) (cropped).jpg',
    url: 'https://commons.wikimedia.org/wiki/File:Jackie_Chan_(7588072360)_(cropped).jpg',
    author: 'Gage Skidmore',
    authorUrl: 'https://www.flickr.com/people/gageskidmore/',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/deed.de',
    changes: `${CHANGES} Die bearbeitete Fassung steht ebenfalls unter CC BY-SA 2.0.`,
    note: 'Aufnahme: San Diego Comic-Con 2012.',
  },
  {
    who: 'Yao Ming (姚明)',
    file: 'Yao Ming, Former NBA player, Founder, The Yao Foundation (13982586406).jpg',
    url: 'https://commons.wikimedia.org/wiki/File:Yao_Ming,_Former_NBA_player,_Founder,_The_Yao_Foundation_(13982586406).jpg',
    author: 'World Travel & Tourism Council',
    authorUrl: 'https://www.flickr.com/photos/wttc/13982586406',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/deed.de',
    changes: CHANGES,
    note: 'Aufnahme: Global Summit des WTTC, Hainan, April 2014.',
  },
];

export const CREDITS_EXTRA =
  'Alle übrigen Bilder, Figuren-Bühnen, Landschaft und Klänge sind im Code erzeugt. Schriften: Noto Serif SC und Ma Shan Zheng (SIL Open Font License). 3D: three.js (MIT), postprocessing (Zlib).';
