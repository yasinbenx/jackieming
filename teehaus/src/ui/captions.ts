// Untertitel-Zeile unten in der Mitte (fürs Gemurmel der Gäste)
import { h } from './dom';

export class Captions {
  private el: HTMLElement;
  private timer = 0;

  constructor() {
    this.el = h('div', { class: 'captions', 'aria-live': 'polite', hidden: true });
    document.body.appendChild(this.el);
  }

  show(who: string, zh: string, text: string, secs = 3.2): void {
    this.el.replaceChildren(h('b', {}, h('span', { lang: 'zh' }, zh), ' ', who), ` ${text}`);
    this.el.hidden = false;
    this.el.classList.add('show');
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.el.classList.remove('show');
      this.timer = window.setTimeout(() => (this.el.hidden = true), 400);
    }, secs * 1000);
  }
}
