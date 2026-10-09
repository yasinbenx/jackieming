// Wörterbuch (词典 cídiǎn) und Info-Seite (关于 guānyú).
import { WORDS } from '../content/words';
import { JACKIE, YAO } from '../content/dialogs';
import { pinyinHtml, pinyinText } from '../content/pinyin';
import { EGGS } from '../content/extras';
import { CREDITS, CREDITS_EXTRA } from '../content/credits';
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

  constructor(
    private onReset: () => void,
    private onCredits: () => void,
  ) {}

  open(): void {
    let confirming = false;
    const quality = h('select', { id: 'quality-select', class: 'select' }) as HTMLSelectElement;
    for (const [v, label] of [
      ['auto', 'Automatisch'],
      ['2', 'Hoch'],
      ['1', 'Mittel'],
      ['0', 'Niedrig'],
    ] as const) {
      const o = h('option', { value: v }, label) as HTMLOptionElement;
      o.selected = String(store.settings.quality) === v;
      quality.append(o);
    }
    quality.addEventListener('change', () => {
      const v = quality.value;
      store.setSettings({ quality: v === 'auto' ? 'auto' : (Number(v) as 0 | 1 | 2) });
    });
    const calm = h('input', { type: 'checkbox', id: 'calm-toggle' });
    calm.checked = store.settings.calm;
    calm.addEventListener('change', () => store.setSettings({ calm: calm.checked }));
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
        h(
          'li',
          {},
          'Laufen: WASD oder Pfeiltasten (Umschalt = schneller), auf dem Handy der Joystick links unten. Oder einfach auf den Boden klicken bzw. tippen.',
        ),
        h('li', {}, 'Ansprechen und Benutzen: E-Taste oder den Hinweis antippen. Winken: G.'),
        h(
          'li',
          {},
          'Kamera: mit der Maus ziehen oder auf dem Handy wischen, Mausrad oder zwei Finger zum Zoomen.',
        ),
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
      h('h3', {}, 'Bewegung und Barrierefreiheit'),
      h(
        'label',
        { class: 'calm-row', for: 'calm-toggle' },
        calm,
        h(
          'span',
          {},
          h('b', {}, 'Ruhe-Modus: '),
          'weniger Bewegung (keine Kamerafahrt, sanftere Animationen, weniger Blütenblätter, keine Tiefenunschärfe, Antworten sofort sichtbar). Wird automatisch aktiv, wenn dein System „Bewegung reduzieren“ meldet.',
        ),
      ),
      h(
        'label',
        { class: 'calm-row', for: 'quality-select' },
        h(
          'span',
          {},
          h('b', {}, 'Grafik: '),
          'Bei „Automatisch“ wird die Qualität gesenkt, wenn es ruckelt.',
        ),
        quality,
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
        'Gebaut mit TypeScript und three.js. Figuren, Teehaus, Landschaft und Klänge entstehen live im Code. Es gibt keinen Server und keine KI: Alle Fragen und Antworten stehen fest im Spiel. Dein Spielstand liegt nur in deinem Browser (localStorage), es gibt keine Cookies und kein Tracking.',
      ),
      h(
        'p',
        {},
        h(
          'button',
          { class: 'btn ghost', type: 'button', onclick: () => this.onCredits() },
          'Credits und Lizenzen',
        ),
      ),
      resetBtn,
    );
    this.modal.open();
  }
}

/** Credits: alle verwendeten Fremdinhalte mit Lizenz und Link */
export class CreditsPage {
  readonly modal = new Modal('credits', 'Credits und Lizenzen', '鸣谢');

  open(): void {
    const items = CREDITS.map((c) =>
      h(
        'article',
        { class: 'credit' },
        h('h3', {}, c.name),
        h('p', {}, c.what),
        h(
          'p',
          { class: 'dict-note' },
          `${c.author} · Lizenz: ${c.license} · `,
          h('a', { href: c.url, target: '_blank', rel: 'noopener' }, 'Quelle'),
        ),
      ),
    );
    this.modal.setContent(
      h(
        'div',
        { class: 'notice-box', role: 'note' },
        h('b', {}, 'Fiktives Gespräch, basiert auf öffentlich bekannten Fakten.'),
        ' Keine echten Zitate. Nicht mit den dargestellten Personen verbunden. Die Figuren von Jackie Chan und Yao Ming sind frei gestaltet und nicht nach ihren Gesichtern modelliert.',
      ),
      ...items,
      h('p', { class: 'dict-note' }, CREDITS_EXTRA),
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
