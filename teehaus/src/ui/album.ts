// Album (相册 xiàngcè, P3d): eigene Fotos, gefangene Fische, Erfolge (Abzeichen) und Sammelstand.
import { Modal } from './modal';
import { h } from './dom';
import { photos } from './photo';
import { store } from '../state/store';
import { BADGES } from '../content/badges';
import { FISH } from '../content/fish';

type Tab = 'fotos' | 'fische' | 'erfolge';

export class Album {
  private modal = new Modal('album', 'Album', '相册');
  private tab: Tab = 'fotos';

  get open(): boolean {
    return this.modal.isOpen;
  }

  show(tab?: Tab): void {
    if (tab) this.tab = tab;
    this.render();
    this.modal.open();
  }

  toggle(): void {
    if (this.open) this.modal.close();
    else this.show();
  }

  private render(): void {
    const tabs = h(
      'div',
      { class: 'album-tabs', role: 'tablist' },
      ...(
        [
          ['fotos', 'Fotos'],
          ['fische', 'Fische'],
          ['erfolge', 'Erfolge'],
        ] as [Tab, string][]
      ).map(([id, name]) =>
        h(
          'button',
          {
            class: `btn ${this.tab === id ? 'primary' : 'ghost'}`,
            type: 'button',
            role: 'tab',
            'aria-selected': String(this.tab === id),
            onclick: () => {
              this.tab = id;
              this.render();
            },
          },
          name,
        ),
      ),
    );
    this.modal.setContent(tabs, this.body());
  }

  private body(): HTMLElement {
    if (this.tab === 'fotos') {
      const list = photos.list().reverse();
      if (!list.length)
        return h(
          'p',
          { class: 'album-empty' },
          'Noch keine Fotos. Drücke ',
          h('kbd', {}, 'C'),
          ' für den Fotomodus und dann die Leertaste.',
        );
      return h(
        'ul',
        { class: 'album-grid' },
        ...list.map((p) =>
          h(
            'li',
            { class: 'album-photo' },
            h('img', { src: p.img, alt: `Foto: ${p.where}`, loading: 'lazy' }),
            h(
              'div',
              { class: 'album-cap' },
              h('span', {}, `${p.where} · ${p.filter}`),
              h('a', { href: p.img, download: `teehaus-${p.t}.jpg`, class: 'btn ghost small' }, 'Speichern'),
              h(
                'button',
                {
                  class: 'btn ghost small',
                  type: 'button',
                  onclick: () => {
                    photos.remove(p.t);
                    this.render();
                  },
                },
                'Löschen',
              ),
            ),
          ),
        ),
      );
    }
    if (this.tab === 'fische') {
      const g = store.progress.games;
      const total = FISH.reduce((a, f) => a + (g[`fisch-${f.id}`] ?? 0), 0);
      return h(
        'div',
        {},
        h(
          'p',
          {},
          `Gefangen: ${total} · Arten: ${FISH.filter((f) => (g[`fisch-${f.id}`] ?? 0) > 0).length} / ${FISH.length}`,
        ),
        h(
          'ul',
          { class: 'album-list' },
          ...FISH.map((f) => {
            const n = g[`fisch-${f.id}`] ?? 0;
            return h(
              'li',
              { class: n ? 'got' : 'missing' },
              h('span', { class: 'album-zh', lang: 'zh' }, n ? f.zh : '？'),
              h('span', {}, n ? `${f.de} · ${f.py}` : 'noch nicht gefangen'),
              h('small', {}, n ? `${n}× · größter ${(g[`fisch-max-${f.id}`] ?? 0) / 10} cm` : f.hint),
            );
          }),
        ),
      );
    }
    const have = new Set(store.progress.quiz.badges);
    return h(
      'div',
      {},
      h('p', {}, `Erfolge: ${have.size} / ${BADGES.length}`),
      h(
        'ul',
        { class: 'album-list' },
        ...BADGES.map((b) =>
          h(
            'li',
            { class: have.has(b.id) ? 'got' : 'missing' },
            h('span', { class: 'album-zh', lang: 'zh' }, b.zh),
            h('span', {}, b.de),
            h('small', {}, b.how),
          ),
        ),
      ),
    );
  }
}
