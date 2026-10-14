// Laden im Dorf: kleine Leckereien (bringen ein Lernwort) und Hüte für die Garderobe, bezahlt mit den Münzen
// aus dem Tee-Mini-Spiel und den Aufgaben.
import { Modal } from './modal';
import { h } from './dom';
import { SHOP } from '../content/villagers';
import { store } from '../state/store';

export interface ShopHost {
  award: (wordId: string) => void;
  toast: (html: string) => void;
  /** Händlerin bedankt sich */
  thanks: () => void;
}

export class Shop {
  private modal = new Modal('shop', 'Laden', '小卖部');

  constructor(private host: ShopHost) {}

  get open(): boolean {
    return this.modal.isOpen;
  }

  show(): void {
    this.render();
    this.modal.open();
  }

  private render(): void {
    const coins = store.coins;
    const rows = SHOP.map((it) => {
      const isItem = !it.gives.startsWith('word:');
      const owned = isItem && store.owns(it.gives);
      const btn = h(
        'button',
        {
          class: 'btn primary',
          type: 'button',
          disabled: owned || coins < it.price,
          onclick: () => this.buy(it.id),
        },
        owned ? 'schon da' : `${it.price} 铜钱`,
      );
      return h(
        'li',
        { class: 'shop-row' },
        h('span', { class: 'shop-zh', lang: 'zh' }, it.zh),
        h('span', { class: 'shop-de' }, it.de, isItem ? h('small', {}, ' · Garderobe') : ''),
        btn,
      );
    });
    this.modal.setContent(
      h('p', {}, 'Was darf es sein? ', h('span', { lang: 'zh' }, '多少钱？'), ' – Wie viel kostet das?'),
      h('ul', { class: 'shop-list' }, ...rows),
      h('p', { class: 'shop-coins' }, `Deine Münzen: ${coins}`),
    );
  }

  private buy(id: string): void {
    const it = SHOP.find((x) => x.id === id);
    if (!it || store.coins < it.price) return;
    if (it.gives.startsWith('word:')) {
      store.addCoins(-it.price);
      this.host.award(it.gives.slice(5));
      this.host.toast(`Gekauft: <span lang="zh">${it.zh}</span> ${it.de}. Lecker!`);
    } else {
      if (store.owns(it.gives)) return;
      store.addCoins(-it.price);
      store.grant(it.gives);
      this.host.toast(
        `Gekauft: <span lang="zh">${it.zh}</span> ${it.de} · jetzt in der Garderobe (Pausemenü)`,
      );
    }
    this.host.award('duoshaoqian');
    this.host.thanks();
    this.render();
  }
}
