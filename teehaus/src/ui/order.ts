// Bestellen auf Chinesisch (点茶 diǎn chá): Tee wählen, dann aus Bausteinen den Satz legen. Der Meister schenkt
// erst ein, wenn der Satz stimmt. Wer lieber nur Tee möchte, bestellt mit einem Klick auf Deutsch.
// Tastatur: Ziffern legen Bausteine, Rücktaste nimmt den letzten zurück, Enter bestellt.
import { Modal } from './modal';
import { h } from './dom';
import { pinyinHtml } from '../content/pinyin';
import { checkOrder, ORDER_TEAS, orderTiles } from '../content/order';
import type { Tile } from '../content/order';
import type { Tea } from '../content/teas';
import { store } from '../state/store';
import { speakChinese, speechAvailable } from './speech';

export interface OrderHost {
  /** Tee bringen lassen; tea = null: auf Deutsch bestellt (Haustee) */
  serve: (tea: Tea | null, polite: boolean) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export class OrderPanel {
  private modal = new Modal('order', 'Tee bestellen', '点茶');
  private tea: Tea | null = null;
  private tiles: Tile[] = [];
  private laid: Tile[] = [];
  private hint = '';
  private served = false;

  constructor(private host: OrderHost) {
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  get open(): boolean {
    return this.modal.isOpen;
  }

  show(): void {
    this.tea = null;
    this.served = false;
    this.render();
    this.host.onOpen?.();
    this.modal.open(() => this.host.onClose?.());
  }

  private pickTea(t: Tea): void {
    this.tea = t;
    this.tiles = orderTiles(t);
    this.laid = [];
    this.hint = '';
    this.render();
  }

  private lay(t: Tile): void {
    if (this.laid.includes(t)) return;
    this.laid.push(t);
    this.hint = '';
    this.render();
  }

  private unlay(t: Tile): void {
    this.laid = this.laid.filter((x) => x !== t);
    this.hint = '';
    this.render();
  }

  private submit(): void {
    const tea = this.tea;
    if (!tea || !this.laid.length || this.served) return;
    const r = checkOrder(
      this.laid.map((t) => t.zh),
      tea,
    );
    if (!r.ok) {
      this.hint = r.hint;
      this.render();
      return;
    }
    this.served = true;
    const n = (store.progress.games['order-zh'] ?? 0) + 1;
    store.setGame('order-zh', n);
    store.setGame(`order-tea-${tea.id}`, 1);
    if (!store.settings.muted) speakChinese(this.laid.map((t) => t.zh).join(''));
    this.modal.close();
    this.host.serve(tea, r.polite);
  }

  private german(): void {
    this.served = true;
    this.modal.close();
    this.host.serve(null, false);
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.open || !this.tea || this.served) return;
    if (/^[1-9]$/.test(e.key)) {
      const t = this.tiles.filter((x) => !this.laid.includes(x))[Number(e.key) - 1];
      if (t) this.lay(t);
    } else if (e.key === 'Backspace') {
      const t = this.laid[this.laid.length - 1];
      if (t) this.unlay(t);
    } else if (e.key === 'Enter') this.submit();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  private render(): void {
    if (!this.tea) {
      this.modal.setContent(
        h('p', {}, 'Welchen Tee möchtest du? Bestell ihn auf Chinesisch, der Meister freut sich.'),
        h(
          'ul',
          { class: 'order-teas' },
          ...ORDER_TEAS.map((t) =>
            h(
              'li',
              {},
              h(
                'button',
                { class: 'order-tea', type: 'button', onclick: () => this.pickTea(t) },
                h('span', { class: 'order-swatch', style: `background:${t.color}` }),
                h('span', { class: 'order-zh', lang: 'zh' }, t.zh),
                h('span', { class: 'order-py', html: pinyinHtml(t.py) }),
                h('span', { class: 'order-de' }, t.de),
              ),
            ),
          ),
        ),
        h(
          'div',
          { class: 'order-actions' },
          h(
            'button',
            { class: 'btn ghost', type: 'button', onclick: () => this.german() },
            'Einfach auf Deutsch bestellen',
          ),
        ),
      );
      return;
    }
    const tea = this.tea;
    const free = this.tiles.filter((t) => !this.laid.includes(t));
    const tileBtn = (t: Tile, i: number | null, onclick: () => void): HTMLElement =>
      h(
        'button',
        {
          class: 'order-tile',
          type: 'button',
          onclick,
          'aria-label': `${t.zh}, ${t.de}`,
        },
        i !== null ? h('span', { class: 'order-key', 'aria-hidden': 'true' }, String(i + 1)) : null,
        h('span', { class: 'order-zh', lang: 'zh' }, t.zh),
        h('span', { class: 'order-py', html: pinyinHtml(t.py) }),
        h('span', { class: 'order-de' }, t.de),
      );
    this.modal.setContent(
      h(
        'p',
        { class: 'order-goal' },
        'Sag: ',
        h('b', {}, `„Bitte gib mir eine Tasse ${tea.de}.“`),
        h('small', {}, ' Oder kürzer: „Ich möchte eine Tasse …“'),
      ),
      h(
        'div',
        { class: 'order-sentence', 'aria-live': 'polite' },
        ...(this.laid.length
          ? this.laid.map((t) => tileBtn(t, null, () => this.unlay(t)))
          : [h('span', { class: 'order-empty' }, 'Bausteine anklicken (oder Ziffern drücken)')]),
      ),
      h('div', { class: 'order-pool' }, ...free.map((t, i) => tileBtn(t, i, () => this.lay(t)))),
      h('p', { class: `order-hint${this.hint ? ' show' : ''}`, role: 'status' }, this.hint),
      h(
        'div',
        { class: 'order-actions' },
        h(
          'button',
          { class: 'btn ghost', type: 'button', onclick: () => ((this.tea = null), this.render()) },
          'Anderer Tee',
        ),
        h(
          'button',
          {
            class: 'btn ghost',
            type: 'button',
            disabled: !speechAvailable(),
            title: 'Den richtigen Satz anhören',
            onclick: () => speakChinese(`请给我一杯${tea.zh}`),
          },
          'Vorsprechen',
        ),
        h(
          'button',
          { class: 'btn primary', type: 'button', disabled: !this.laid.length, onclick: () => this.submit() },
          'Bestellen ',
          h('span', { lang: 'zh' }, '点'),
        ),
      ),
    );
  }
}
