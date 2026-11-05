// Wörterbuch (词典 cídiǎn) und Info-Seite (关于 guānyú).
import { WORDS } from '../content/words';
import { plain, WORD_GROUPS, wordGroup } from '../content/wordgroups';
import { JACKIE, YAO } from '../content/dialogs';
import { pinyinHtml, pinyinText } from '../content/pinyin';
import { EGGS } from '../content/extras';
import { CREDITS, CREDITS_EXTRA } from '../content/credits';
import { store } from '../state/store';
import { keyLabel } from '../state/savefile';
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
  private query = '';
  private group = 'alle';
  private show: 'alle' | 'gelernt' | 'offen' = 'alle';
  private items: { el: HTMLElement; id: string; text: string; group: string }[] = [];
  private countEl: HTMLElement | null = null;
  private emptyEl: HTMLElement | null = null;
  /** Quiz öffnen (vom Spiel gesetzt) */
  onQuiz?: () => void;

  render(): void {
    const learned = store.words;
    const got = WORDS.filter((w) => learned.has(w.id)).length;
    const grid = h('ul', { class: 'dict-grid', role: 'list' });
    this.items = [];
    for (const w of WORDS) {
      const has = learned.has(w.id);
      const el = h(
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
      );
      grid.append(el);
      // Gesperrte Wörter verraten bei der Suche nichts (nur der Hinweistext zählt)
      const text = has
        ? plain(`${w.zh} ${w.py} ${pinyinText(w.py)} ${w.de} ${w.note ?? ''}`)
        : plain(wordSource(w.id));
      this.items.push({ el, id: w.id, text, group: wordGroup(w.id) });
    }
    const search = h('input', {
      type: 'search',
      class: 'dict-search',
      placeholder: 'Suchen: Deutsch, Pinyin oder Zeichen',
      'aria-label': 'Wörterbuch durchsuchen',
      value: this.query,
      oninput: (e: Event) => {
        this.query = (e.target as HTMLInputElement).value;
        this.apply();
      },
    });
    // Tasten im Suchfeld nicht an das Spiel weitergeben
    search.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') e.stopPropagation();
    });
    const chip = (id: string, label: Node | string, sel: () => boolean, set: () => void): HTMLElement =>
      h(
        'button',
        {
          type: 'button',
          class: `dict-chip${sel() ? ' on' : ''}`,
          'aria-pressed': sel() ? 'true' : 'false',
          'data-chip': id,
          onclick: (e: Event) => {
            set();
            const bar = (e.currentTarget as HTMLElement).parentElement!;
            bar.querySelectorAll('.dict-chip').forEach((c) => {
              const on = c === e.currentTarget;
              c.classList.toggle('on', on);
              c.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            this.apply();
          },
        },
        label,
      );
    const groups = h(
      'div',
      { class: 'dict-chips', role: 'group', 'aria-label': 'Thema' },
      chip(
        'alle',
        'Alle Themen',
        () => this.group === 'alle',
        () => (this.group = 'alle'),
      ),
      ...WORD_GROUPS.map((g) =>
        chip(
          g.id,
          h('span', {}, h('span', { lang: 'zh' }, g.zh), ' ', g.de),
          () => this.group === g.id,
          () => (this.group = g.id),
        ),
      ),
    );
    const shows = h(
      'div',
      { class: 'dict-chips', role: 'group', 'aria-label': 'Anzeigen' },
      ...(
        [
          ['alle', 'Alle'],
          ['gelernt', 'Gesammelt'],
          ['offen', 'Noch offen'],
        ] as const
      ).map(([id, label]) =>
        chip(
          id,
          label,
          () => this.show === id,
          () => (this.show = id),
        ),
      ),
    );
    this.countEl = h('p', { class: 'dict-count', role: 'status' });
    this.emptyEl = h('p', { class: 'dict-empty', hidden: true }, 'Nichts gefunden.');
    this.modal.setContent(
      h(
        'div',
        { class: 'dict-top' },
        h('p', { class: 'dict-count' }, `${got} von ${WORDS.length} Wörtern gesammelt`),
        h(
          'button',
          { class: 'btn primary dict-quiz', type: 'button', onclick: () => this.onQuiz?.() },
          h('span', { lang: 'zh' }, '测验'),
          ' Quiz und Abzeichen',
        ),
      ),
      h(
        'div',
        { class: 'dict-bar' },
        h('div', { style: `width:${Math.round((got / WORDS.length) * 100)}%` }),
      ),
      h('div', { class: 'dict-filters' }, search, groups, shows),
      this.countEl,
      this.emptyEl,
      grid,
    );
    this.apply();
  }

  /** Suche und Filter anwenden (nur ein-/ausblenden, nichts neu bauen) */
  private apply(): void {
    const q = plain(this.query);
    const learned = store.words;
    let n = 0;
    for (const it of this.items) {
      const has = learned.has(it.id);
      const vis =
        (this.group === 'alle' || it.group === this.group) &&
        (this.show === 'alle' || (this.show === 'gelernt') === has) &&
        (!q || it.text.includes(q));
      it.el.hidden = !vis;
      if (vis) n++;
    }
    if (this.countEl) this.countEl.textContent = n === this.items.length ? '' : `${n} Treffer`;
    if (this.emptyEl) this.emptyEl.hidden = n > 0;
  }

  open(): void {
    this.render();
    this.modal.open();
  }
}

export class InfoPage {
  readonly modal = new Modal('info', 'Hilfe und Hinweise', '关于');

  constructor(private actions: { onCredits: () => void; onSettings: () => void; onTutorial: () => void }) {}

  open(): void {
    const k = store.settings.keys;
    const K = (code: string) => h('kbd', {}, keyLabel(code));
    this.modal.setContent(
      h(
        'div',
        { class: 'notice-box', role: 'note' },
        h('b', {}, 'Fiktives Gespräch, basiert auf öffentlich bekannten Fakten.'),
        ' Keine echten Zitate. Nicht mit den dargestellten Personen verbunden.',
      ),
      h('h3', {}, 'Steuerung'),
      h(
        'ul',
        { class: 'info-list' },
        h(
          'li',
          {},
          'Gehen: ',
          K(k.forward),
          ' ',
          K(k.left),
          ' ',
          K(k.back),
          ' ',
          K(k.right),
          ' oder Pfeiltasten, ',
          K(k.run),
          ' halten zum Laufen. Auf dem Telefon der Joystick links unten. Oder auf den Boden klicken bzw. tippen.',
        ),
        h(
          'li',
          {},
          'Ansprechen und Benutzen: ',
          K(k.use),
          ' oder den Hinweis antippen. Winken: ',
          K(k.wave),
          '.',
        ),
        h('li', {}, 'Kamera: mit der Maus ziehen oder wischen, Mausrad oder zwei Finger zum Zoomen.'),
        h('li', {}, 'Hinsetzen: an einen freien Hocker gehen. Aufstehen: einfach loslaufen.'),
        h(
          'li',
          {},
          'Ton an/aus: ',
          K(k.sound),
          '. Karte: ',
          K(k.map),
          '. Pause: ',
          K(k.pause),
          ' oder ',
          h('kbd', {}, 'Esc'),
          '.',
        ),
        h('li', {}, 'Im Gespräch: Leertaste zeigt die Antwort sofort, Esc beendet das Gespräch.'),
        h('li', {}, 'Tasten lassen sich in den Einstellungen umlegen.'),
      ),
      h('h3', {}, 'Was es zu tun gibt'),
      h(
        'ul',
        { class: 'info-list' },
        h('li', {}, 'Sprich Jackie und Yao am großen Tisch hinten rechts an. Deine Figur setzt sich dazu.'),
        h('li', {}, 'Neue Fragen schalten sich frei, wenn du die vorherigen gestellt hast.'),
        h(
          'li',
          {},
          'Nach vielen Antworten erscheint ein „Wort des Moments“. Alle Wörter stehen im Wörterbuch (词典).',
        ),
        h(
          'li',
          {},
          'Im Teehaus ist einiges versteckt: Probier die Teekanne, die Laternen, die Elster oder den Teich.',
        ),
        h(
          'li',
          {},
          'Bestell an der Theke auf Chinesisch: aus Bausteinen wird 请给我一杯… („Bitte gib mir eine Tasse …“).',
        ),
        h('li', {}, 'Im Wörterbuch kannst du suchen und filtern; dort startet auch das Quiz mit Abzeichen.'),
      ),
      h(
        'div',
        { class: 'info-actions' },
        h(
          'button',
          { class: 'btn ghost', type: 'button', onclick: () => this.actions.onTutorial() },
          'Tutorial wiederholen',
        ),
        h(
          'button',
          { class: 'btn ghost', type: 'button', onclick: () => this.actions.onSettings() },
          'Einstellungen',
        ),
        h(
          'button',
          { class: 'btn ghost', type: 'button', onclick: () => this.actions.onCredits() },
          'Credits und Lizenzen',
        ),
      ),
      h('h3', {}, 'Woher kommen die Inhalte?'),
      h(
        'p',
        {},
        'Alle Antworten sind frei formulierte Ich-Texte auf Grundlage öffentlich bekannter Fakten. Die Fakten und ihre Quellen stehen zum Gegenprüfen in der Datei ',
        h('code', {}, 'FAKTEN.md'),
        ' im Projekt. Persönlichkeitsaussagen und Scherze sind Charakterisierungen, keine belegten Aussagen der echten Personen. Die Gesichter sind frei erfunden und stilisiert.',
      ),
      h('h3', {}, 'Technik und Datenschutz'),
      h(
        'p',
        {},
        'Gebaut mit TypeScript und three.js. Figuren, Teehaus, Landschaft und Klänge entstehen live im Code. Es gibt keinen Server und keine KI: Alle Fragen und Antworten stehen fest im Spiel. Dein Spielstand wird automatisch nur in deinem Browser gespeichert (localStorage), es gibt keine Cookies und kein Tracking.',
      ),
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
