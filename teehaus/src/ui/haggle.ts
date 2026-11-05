// Feilschen (讨价还价 tǎojià huánjià, P3d) beim fahrenden Händler: Er nennt den Preis auf Chinesisch, du bietest
// mit chinesischen Zahlen dagegen. Zu wenig geboten → er ist beleidigt; vernünftig → er kommt dir entgegen.
// Nach drei Runden bleibt sein Preis fest. Lernt die Zahlen 1–99 und die Antworten des Händlers.
import { Modal } from './modal';
import { h } from './dom';
import { store } from '../state/store';

const DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const PY = ['', 'yī', 'èr', 'sān', 'sì', 'wǔ', 'liù', 'qī', 'bā', 'jiǔ'];

/** 1–99 auf Chinesisch: 十五, 二十, 二十五 … */
export function numZh(n: number): string {
  if (n < 10) return DIGITS[n] || '零';
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${t > 1 ? DIGITS[t] : ''}十${DIGITS[o]}`;
}

export function numPy(n: number): string {
  if (n < 10) return PY[n] || 'líng';
  const t = Math.floor(n / 10);
  const o = n % 10;
  return [t > 1 ? PY[t] : '', 'shí', o ? PY[o] : ''].filter(Boolean).join(' ');
}

export interface Ware {
  id: string;
  zh: string;
  de: string;
  /** üblicher Preis; der Händler verlangt mehr, geht bis ~70 % herunter */
  price: number;
  /** was man bekommt */
  gives: 'kite' | 'word' | 'coinsBack';
  word?: string;
}

export const WARES: Ware[] = [
  {
    id: 'fengzheng',
    zh: '风筝',
    de: 'Papierdrachen zum Steigenlassen',
    price: 18,
    gives: 'kite',
    word: 'fengzheng',
  },
  { id: 'shanzi', zh: '扇子', de: 'bemalter Fächer', price: 12, gives: 'word', word: 'shanzi' },
  { id: 'xiangliao', zh: '香料', de: 'Gewürze aus dem Westen', price: 15, gives: 'word' },
  { id: 'chahe', zh: '茶盒', de: 'lackierte Teedose', price: 24, gives: 'word' },
];

export interface HaggleHost {
  award: (wordId: string) => void;
  toast: (html: string) => void;
}

export class Haggle {
  private modal = new Modal('haggle', 'Feilschen', '讨价还价');
  private ware: Ware | null = null;
  private ask = 0;
  private min = 0;
  private rounds = 0;
  private mood = '';

  constructor(private host: HaggleHost) {}

  get open(): boolean {
    return this.modal.isOpen;
  }

  show(): void {
    this.ware = null;
    this.render();
    this.modal.open();
    this.host.award('taojia');
  }

  private py(n: number): string {
    return store.settings.pinyin ? ` (${numPy(n)} kuài)` : '';
  }

  private pick(w: Ware): void {
    this.ware = w;
    // Händler verlangt 30–60 % mehr, gibt bis ~70–80 % des üblichen Preises nach
    this.ask = Math.round(w.price * (1.3 + Math.random() * 0.3));
    this.min = Math.round(w.price * (0.7 + Math.random() * 0.1));
    this.rounds = 0;
    this.mood = `“${numZh(this.ask)}块！”${this.py(this.ask)} – ${this.ask} Münzen, sagt Herr Qiao.`;
    this.host.award('kuai');
    this.render();
  }

  private offer(n: number): void {
    const w = this.ware!;
    this.rounds++;
    if (n >= this.ask) return this.buy(this.ask);
    if (n >= this.min) {
      this.mood = `“好，${numZh(n)}块，成交！” – Gut, ${n}, abgemacht!`;
      this.render();
      window.setTimeout(() => this.buy(n), 900);
      return;
    }
    if (n < this.min * 0.75) {
      this.mood = `“太便宜了！” tài piányi le – Viel zu billig! Er bleibt bei ${numZh(this.ask)}块.`;
    } else if (this.rounds >= 3) {
      this.ask = Math.max(this.min, this.ask);
      this.mood = `“最后的价格：${numZh(this.ask)}块。” – Letzter Preis: ${this.ask}.`;
    } else {
      this.ask = Math.max(this.min, Math.round((this.ask + n) / 2 + 1));
      this.mood = `“${numZh(this.ask)}块，怎么样？”${this.py(this.ask)} – Wie wäre es mit ${this.ask}?`;
    }
    void w;
    this.render();
  }

  private buy(n: number): void {
    const w = this.ware!;
    if (store.coins < n) {
      this.mood = `Du hast nur ${store.coins} Münzen. “没关系，下次吧。” – Macht nichts, nächstes Mal.`;
      this.render();
      return;
    }
    store.addCoins(-n);
    const saved = Math.max(0, Math.round(w.price * 1.45) - n);
    const g = store.progress.games;
    store.setGame('gefeilscht', (g['gefeilscht'] ?? 0) + 1);
    store.setGame('gespart', (g['gespart'] ?? 0) + saved);
    store.setGame(`ware-${w.id}`, 1);
    if (w.gives === 'kite') store.setGame('drachen-gekauft', 1);
    if (w.word) this.host.award(w.word);
    this.host.toast(
      `<b>${w.zh}</b> gekauft für ${n} Münzen${saved ? ` – ${saved} gespart!` : ''}${
        w.gives === 'kite' ? ' Lass ihn auf der Drachenwiese steigen.' : ''
      }`,
    );
    this.ware = null;
    this.mood = '“谢谢，欢迎再来！” – Danke, komm wieder!';
    this.render();
  }

  private render(): void {
    const w = this.ware;
    if (!w) {
      this.modal.setContent(
        h('p', {}, this.mood || 'Herr Qiao breitet seine Waren aus. Worauf zeigst du?'),
        h(
          'ul',
          { class: 'shop-list' },
          ...WARES.map((x) =>
            h(
              'li',
              { class: 'shop-row' },
              h('span', { class: 'shop-zh', lang: 'zh' }, x.zh),
              h(
                'span',
                { class: 'shop-de' },
                x.de,
                store.progress.games[`ware-${x.id}`] ? h('small', {}, ' · schon gekauft') : '',
              ),
              h('button', { class: 'btn primary', type: 'button', onclick: () => this.pick(x) }, '多少钱？'),
            ),
          ),
        ),
        h('p', { class: 'shop-coins' }, `Deine Münzen: ${store.coins}`),
      );
      return;
    }
    // Gegenangebote: vier Zahlen unterhalb des Preises, als Zeichen (Pinyin nach Einstellung)
    const offers = [...new Set([0.55, 0.7, 0.8, 0.9].map((k) => Math.max(1, Math.round(this.ask * k))))];
    this.modal.setContent(
      h('p', { class: 'haggle-ware' }, h('b', { lang: 'zh' }, w.zh), ` – ${w.de}`),
      h('p', { class: 'haggle-mood' }, this.mood),
      h('p', {}, 'Dein Angebot:'),
      h(
        'div',
        { class: 'haggle-offers' },
        ...offers.map((n) =>
          h(
            'button',
            { class: 'btn ghost', type: 'button', onclick: () => this.offer(n) },
            h('span', { lang: 'zh' }, `${numZh(n)}块`),
            store.settings.pinyin ? h('small', {}, ` ${numPy(n)}`) : '',
          ),
        ),
        h(
          'button',
          { class: 'btn primary', type: 'button', onclick: () => this.offer(this.ask) },
          h('span', { lang: 'zh' }, '好，买了！'),
          h('small', {}, ` (${this.ask})`),
        ),
      ),
      h(
        'button',
        {
          class: 'btn ghost small',
          type: 'button',
          onclick: () => {
            this.ware = null;
            this.mood = '“不要？好吧。” – Nicht? Na gut.';
            this.render();
          },
        },
        'Doch nicht',
      ),
      h('p', { class: 'shop-coins' }, `Deine Münzen: ${store.coins}`),
    );
  }
}
