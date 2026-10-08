// „Wort des Moments“: Lernkarte mit Zeichen, Pinyin (Tonfarben), Bedeutung und Aussprache-Button.
import type { Word } from '../content/types';
import { pinyinHtml, pinyinText } from '../content/pinyin';
import { bus } from '../core/bus';
import { h } from './dom';
import { onSpeechChange, speakChinese, speechAvailable } from './speech';

const SPEAKER = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" fill="currentColor"/></svg>`;

export class WordCard {
  readonly el: HTMLElement;
  private speakBtn: HTMLButtonElement;
  private current: Word | null = null;
  private timer = 0;

  constructor(counter: () => string) {
    this.speakBtn = h('button', { class: 'wc-speak', type: 'button', onclick: () => this.speak() });
    this.el = h('aside', { class: 'wordcard', 'aria-live': 'polite', hidden: true });
    document.body.appendChild(this.el);
    this.counter = counter;
    onSpeechChange(() => this.updateSpeak());
  }

  private counter: () => string;

  show(word: Word, isNew: boolean): void {
    this.current = word;
    window.clearTimeout(this.timer);
    this.speakBtn.innerHTML = `${SPEAKER}<span>Aussprache</span>`;
    const parts: (Node | null)[] = [
      h(
        'div',
        { class: 'wc-head' },
        h('span', { class: 'wc-kicker' }, 'Wort des Moments'),
        isNew ? h('span', { class: 'wc-new' }, 'neu') : h('span', { class: 'wc-old' }, 'bekannt'),
        h(
          'button',
          { class: 'wc-close', type: 'button', 'aria-label': 'Karte schließen', onclick: () => this.hide() },
          '×',
        ),
      ),
      h('div', { class: 'wc-zh', lang: 'zh' }, word.zh),
      h('div', { class: 'wc-py', html: pinyinHtml(word.py), 'aria-label': pinyinText(word.py) }),
      h('div', { class: 'wc-de' }, word.de),
      word.note ? h('div', { class: 'wc-note' }, word.note) : null,
      h('div', { class: 'wc-foot' }, this.speakBtn, h('span', { class: 'wc-count' }, this.counter())),
    ];
    this.el.replaceChildren(...parts.filter((n): n is Node => n !== null));
    this.updateSpeak();
    this.el.hidden = false;
    this.el.classList.remove('out');
    void this.el.offsetWidth;
    this.el.classList.add('in');
    if (isNew) bus.emit('ui:word', { id: word.id });
    this.timer = window.setTimeout(() => this.hide(), 14000);
  }

  hide(): void {
    window.clearTimeout(this.timer);
    this.el.classList.remove('in');
    this.el.classList.add('out');
    window.setTimeout(() => {
      if (this.el.classList.contains('out')) this.el.hidden = true;
    }, 400);
  }

  private updateSpeak(): void {
    const ok = speechAvailable();
    this.speakBtn.disabled = !ok;
    this.speakBtn.title = ok
      ? 'Aussprache anhören'
      : 'Auf diesem Gerät ist keine chinesische Stimme installiert';
  }

  private speak(): void {
    if (this.current) speakChinese(this.current.zh);
  }
}
