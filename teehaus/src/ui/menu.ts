// Hauptmenü (vor dem Spiel, das Teehaus im Hintergrund) und Pausemenü (Esc / Pause-Knopf). Beide sind einfache
// Overlays mit Knopfliste; gefährliche Schritte (Neues Spiel) fragen vorher nach.
import { h } from './dom';
import { bus } from '../core/bus';

export interface MenuItem {
  id: string;
  label: string;
  zh?: string;
  primary?: boolean;
  hidden?: boolean;
  onClick: () => void;
}

/** Sicherheitsabfrage im selben Feld (kein Browser-Dialog) */
export function confirmView(
  host: HTMLElement,
  opts: { title: string; text: string; yes: string; no?: string; danger?: boolean },
): Promise<boolean> {
  return new Promise((resolve) => {
    const prev = [...host.childNodes];
    const done = (v: boolean): void => {
      host.replaceChildren(...prev);
      (host.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
      resolve(v);
    };
    const yes = h(
      'button',
      { class: `btn ${opts.danger ? 'danger' : 'primary'}`, type: 'button', onclick: () => done(true) },
      opts.yes,
    );
    const no = h(
      'button',
      { class: 'btn ghost', type: 'button', onclick: () => done(false) },
      opts.no ?? 'Abbrechen',
    );
    host.replaceChildren(
      h(
        'div',
        {
          class: 'confirm',
          role: 'alertdialog',
          'aria-labelledby': 'confirm-t',
          'aria-describedby': 'confirm-d',
        },
        h('h3', { id: 'confirm-t' }, opts.title),
        h('p', { id: 'confirm-d' }, opts.text),
        h('div', { class: 'confirm-actions' }, no, yes),
      ),
    );
    no.focus({ preventScroll: true });
  });
}

function buttons(items: MenuItem[]): HTMLElement {
  return h(
    'nav',
    { class: 'menu-list' },
    ...items
      .filter((i) => !i.hidden)
      .map((i) =>
        h(
          'button',
          {
            class: `menu-btn${i.primary ? ' primary' : ''}`,
            type: 'button',
            'data-id': i.id,
            onclick: () => {
              bus.emit('ui:click');
              i.onClick();
            },
          },
          i.zh ? h('span', { class: 'menu-zh', lang: 'zh' }, i.zh) : null,
          h('span', {}, i.label),
        ),
      ),
  );
}

/** Hauptmenü: Schriftzug links, Knöpfe darunter, Hinweis klein unten. Die 3D-Szene bleibt dahinter sichtbar. */
export class MainMenu {
  readonly el: HTMLElement;
  readonly body: HTMLElement;
  private note: HTMLElement;

  constructor() {
    this.body = h('div', { class: 'menu-body' });
    this.note = h('p', { class: 'menu-note', role: 'status' });
    this.el = h(
      'section',
      { id: 'mainmenu', class: 'menu', hidden: true, 'aria-label': 'Hauptmenü' },
      h(
        'div',
        { class: 'menu-panel' },
        h(
          'h1',
          { class: 'menu-title' },
          h('span', { class: 'zh', lang: 'zh' }, '茶馆'),
          h('span', { class: 'py' }, 'cháguǎn'),
          h('span', { class: 'de' }, 'Das Teehaus'),
        ),
        this.body,
        this.note,
      ),
      h(
        'p',
        { class: 'menu-disclaimer' },
        'Fiktives Gespräch, basiert auf öffentlich bekannten Fakten. Keine echten Zitate. Nicht mit den dargestellten Personen verbunden.',
      ),
    );
    document.body.appendChild(this.el);
  }

  show(items: MenuItem[], note = ''): void {
    this.body.replaceChildren(buttons(items));
    this.note.textContent = note;
    this.el.hidden = false;
    document.body.classList.add('in-menu');
    // Einblenden ohne requestAnimationFrame (läuft in Hintergrund-Tabs nicht): erst Layout erzwingen
    void this.el.offsetWidth;
    this.el.classList.add('show');
    (this.body.querySelector('.menu-btn.primary, .menu-btn') as HTMLElement | null)?.focus({
      preventScroll: true,
    });
  }

  hide(): void {
    this.el.classList.remove('show');
    document.body.classList.remove('in-menu');
    window.setTimeout(() => {
      if (!this.el.classList.contains('show')) this.el.hidden = true;
    }, 500);
  }

  get open(): boolean {
    return !this.el.hidden && this.el.classList.contains('show');
  }
}

/** Pausemenü: dunkler Schleier, Knöpfe in der Mitte */
export class PauseMenu {
  readonly el: HTMLElement;
  readonly body: HTMLElement;

  constructor() {
    this.body = h('div', { class: 'menu-body' });
    this.el = h(
      'section',
      {
        id: 'pausemenu',
        class: 'menu pause',
        hidden: true,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'Pause',
      },
      h(
        'div',
        { class: 'menu-panel' },
        h(
          'h2',
          { class: 'pause-title' },
          h('span', { lang: 'zh' }, '暂停'),
          ' ',
          h('i', {}, 'zàntíng'),
          ' · Pause',
        ),
        this.body,
      ),
    );
    document.body.appendChild(this.el);
  }

  show(items: MenuItem[]): void {
    this.body.replaceChildren(buttons(items));
    this.el.hidden = false;
    document.body.classList.add('paused');
    void this.el.offsetWidth;
    this.el.classList.add('show');
    (this.body.querySelector('.menu-btn') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  hide(): void {
    this.el.classList.remove('show');
    this.el.hidden = true;
    document.body.classList.remove('paused');
  }

  get open(): boolean {
    return !this.el.hidden;
  }
}
