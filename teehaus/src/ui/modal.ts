// Einfaches Modal: Esc / Klick auf den Hintergrund schließt, Fokus wird gesetzt und zurückgegeben.
import { h } from './dom';

export class Modal {
  readonly el: HTMLElement;
  private card: HTMLElement;
  private content: HTMLElement;
  private opener: Element | null = null;
  private titleEl: HTMLElement;
  private onClose?: () => void;

  constructor(id: string, title: string, titleZh: string) {
    this.titleEl = h('h2', { id: `${id}-title` }, h('span', { lang: 'zh' }, titleZh), ' ', title);
    this.content = h('div', { class: 'modal-content' });
    this.card = h(
      'div',
      {
        class: 'modal-card',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': `${id}-title`,
        tabindex: '-1',
      },
      h(
        'header',
        { class: 'modal-head' },
        this.titleEl,
        h(
          'button',
          { class: 'modal-close', type: 'button', 'aria-label': 'Schließen', onclick: () => this.close() },
          '×',
        ),
      ),
      this.content,
    );
    this.el = h(
      'div',
      { id, class: 'modal', hidden: true, onclick: (e: Event) => e.target === this.el && this.close() },
      this.card,
    );
    document.body.appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.el.hidden) {
        e.stopPropagation();
        this.close();
      }
    });
  }

  setContent(...nodes: (Node | string)[]): void {
    this.content.replaceChildren(...nodes);
  }

  open(onClose?: () => void): void {
    this.opener = document.activeElement;
    this.onClose = onClose;
    this.el.hidden = false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => {
      this.el.classList.add('show');
      this.card.focus({ preventScroll: true });
    });
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.classList.remove('show');
    window.setTimeout(() => {
      this.el.hidden = true;
      document.body.classList.remove('modal-open');
    }, 250);
    (this.opener as HTMLElement | null)?.focus?.({ preventScroll: true });
    this.onClose?.();
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }
}
