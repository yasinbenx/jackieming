// Wörterbuch (词典 cídiǎn) und Info-Seite (关于 guānyú).
import { WORDS } from '../content/words';
import { JACKIE } from '../content/jackie';
import { YAO } from '../content/yao';
import { pinyinHtml, pinyinText } from '../content/pinyin';
import { EGGS } from '../content/extras';
import { store } from '../state/store';
import { h } from './dom';
import { Modal } from './modal';
import { speakChinese, speechAvailable } from './speech';

const SPEAKER = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" fill="currentColor"/></svg>`;

const wordSource = (id: string): string => {
  const j = JACKIE.questions.find((q) => q.word === id);
  if (j) return `Frag Jackie: ${j.q}`;
  const y = YAO.questions.find((q) => q.word === id);
  if (y) return `Frag Yao: ${y.q}`;
  const e = EGGS.find((x) => x.word === id);
  if (e) return 'Versteckt im Teehaus. Klick dich durch!';
  return 'Kommt später im Spiel vor';
};

export class Dictionary {
  readonly modal = new Modal('dict', 'Wörterbuch', '词典');

  render(): void {
    const got = WORDS.filter((w) => store.words.has(w.id)).length;
    const grid = h('ul', { class: 'dict-grid', role: 'list' });
    for (const w of WORDS) {
      const has = store.words.has(w.id);
      grid.append(
        h(
          'li',
          { class: `dict-item${has ? '' : ' locked'}` },
          has
            ? h(
                'div',
                {},
                h('div', { class: 'dict-zh', lang: 'zh' }, w.zh),
                h('div', { class: 'dict-py', html: pinyinHtml(w.py), 'aria-label': pinyinText(w.py) }),
                h('div', { class: 'dict-de' }, w.de),
                w.note ? h('div', { class: 'dict-note' }, w.note) : null,
                h(
                  'button',
                  {
                    class: 'dict-speak',
                    type: 'button',
                    'aria-label': `${w.zh} anhören`,
                    disabled: !speechAvailable(),
                    onclick: () => speakChinese(w.zh),
                  },
                  h('span', { html: SPEAKER }),
                ),
              )
            : h(
                'div',
                {},
                h('div', { class: 'dict-zh', 'aria-hidden': 'true' }, '？'),
                h('div', { class: 'dict-hint' }, wordSource(w.id)),
              ),
        ),
      );
    }
    this.modal.setContent(
      h('p', { class: 'dict-count' }, `${got} von ${WORDS.length} Wörtern gesammelt`),
      h(
        'div',
        { class: 'dict-bar' },
        h('div', { style: `width:${Math.round((got / WORDS.length) * 100)}%` }),
      ),
      grid,
    );
  }

  open(): void {
    this.render();
    this.modal.open();
  }
}

export class InfoPage {
  readonly modal = new Modal('info', 'Über das Teehaus', '关于');

  constructor(private onReset: () => void) {}

  open(): void {
    let confirming = false;
    const resetBtn = h(
      'button',
      {
        class: 'btn ghost danger',
        type: 'button',
        onclick: () => {
          if (!confirming) {
            confirming = true;
            resetBtn.textContent = 'Wirklich alles zurücksetzen?';
            return;
          }
          store.reset();
          this.onReset();
          this.modal.close();
        },
      },
      'Fortschritt zurücksetzen',
    );
    this.modal.setContent(
      h(
        'div',
        { class: 'notice-box', role: 'note' },
        h('b', {}, 'Fiktives Gespräch, basiert auf öffentlich bekannten Fakten.'),
        ' Keine echten Zitate. Nicht mit den dargestellten Personen verbunden.',
      ),
      h('h3', {}, 'So funktioniert es'),
      h(
        'ul',
        { class: 'info-list' },
        h('li', {}, 'Tippe oder klicke auf Jackie Chan (成龙) oder Yao Ming (姚明), oder drücke J und Y.'),
        h(
          'li',
          {},
          'Wähle ein Thema und stelle Fragen. Neue Fragen schalten sich frei, wenn du die vorherigen gestellt hast.',
        ),
        h(
          'li',
          {},
          'Nach vielen Antworten erscheint ein „Wort des Moments“. Gesammelte Wörter findest du im Wörterbuch (词典).',
        ),
        h(
          'li',
          {},
          'Im Teehaus ist einiges versteckt: Probier die Teekanne, die Laternen, die Elster oder den Teich.',
        ),
        h('li', {}, 'Esc schließt Fenster. Mit Leertaste oder „Überspringen“ siehst du Antworten sofort.'),
      ),
      h('h3', {}, 'Woher kommen die Inhalte?'),
      h(
        'p',
        {},
        'Alle Antworten sind frei formulierte Ich-Texte auf Grundlage öffentlich bekannter Fakten. Die Fakten und ihre Quellen stehen zum Gegenprüfen in der Datei ',
        h('code', {}, 'FAKTEN.md'),
        ' im Projekt. Persönlichkeitsaussagen und Scherze sind Charakterisierungen, keine belegten Aussagen der echten Personen.',
      ),
      h('h3', {}, 'Technik und Datenschutz'),
      h(
        'p',
        {},
        'Gebaut mit TypeScript und PixiJS (MIT-Lizenz). Alle Bilder und Klänge entstehen live im Code, es werden keine fremden Bilder oder Audiodateien geladen. Dein Spielstand liegt nur in deinem Browser (localStorage), es gibt keine Cookies und kein Tracking.',
      ),
      resetBtn,
    );
    this.modal.open();
  }
}

/** Messlatte 身高 shēngāo: Größenvergleich der beiden Gäste (ungefähre Angaben). */
export class HeightPanel {
  readonly modal = new Modal('heights', 'Messlatte', '身高');

  open(): void {
    const J = 173;
    const Y = 229;
    const scale = (cm: number): string => `${Math.round((cm / 240) * 100)}%`;
    const col = (zh: string, name: string, cm: number, label: string, cls: string): HTMLElement =>
      h(
        'div',
        { class: `ht-col ${cls}` },
        h(
          'div',
          { class: 'ht-bar-wrap' },
          h('div', { class: 'ht-bar', style: `height:${scale(cm)}` }, h('span', { class: 'ht-cm' }, label)),
        ),
        h('div', { class: 'ht-name' }, h('span', { lang: 'zh' }, zh), ' ', name),
      );
    this.modal.setContent(
      h(
        'div',
        { class: 'ht-chart' },
        col('成龙', 'Jackie', J, 'ca. 1,73 m', 'ht-j'),
        col('姚明', 'Yao', Y, '2,29 m', 'ht-y'),
      ),
      h('p', { class: 'ht-diff' }, `Unterschied: ca. ${Y - J} Zentimeter`),
      h(
        'p',
        { class: 'dict-note' },
        '身高 shēngāo heißt Körpergröße. Die Angaben sind gerundet; Jackies Größe wird in Quellen unterschiedlich angegeben (meist um 1,73 m).',
      ),
    );
    this.modal.open();
  }
}
