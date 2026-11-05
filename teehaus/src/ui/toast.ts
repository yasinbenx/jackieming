// Kurze Hinweise oben in der Mitte („Neue Frage freigeschaltet“, „Versteck entdeckt“).
import { h } from './dom';

export class Toast {
  private el: HTMLElement;
  private timer = 0;

  constructor() {
    this.el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(this.el);
  }

  show(html: string, ms = 3200): void {
    window.clearTimeout(this.timer);
    this.el.innerHTML = html;
    this.el.classList.remove('show');
    void this.el.offsetWidth;
    this.el.classList.add('show');
    this.timer = window.setTimeout(() => this.el.classList.remove('show'), ms);
  }
}
