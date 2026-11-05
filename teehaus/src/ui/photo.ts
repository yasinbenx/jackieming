// Fotomodus (P3d): Oberfläche ausblenden, Kamera frei drehen und zoomen, Filter wählen, auslösen. Die Fotos
// landen im Album (nur im Browser gespeichert, verkleinert als JPEG) und lassen sich dort herunterladen.
import { h } from './dom';
import { store } from '../state/store';
import { report } from '../core/guard';
import type { World } from '../world/world';

export interface PhotoFilter {
  id: string;
  name: string;
  look: Partial<World['look']>;
}

export const FILTERS: PhotoFilter[] = [
  { id: 'natur', name: 'Natur', look: {} },
  { id: 'warm', name: 'Warm', look: { sat: 0.12, hue: 0.06, contrast: 0.05 } },
  { id: 'kuehl', name: 'Kühl', look: { sat: -0.05, hue: -0.12, bright: 0.02 } },
  { id: 'kraeftig', name: 'Kräftig', look: { sat: 0.3, contrast: 0.12, vignette: 0.15 } },
  { id: 'sepia', name: 'Sepia', look: { sepia: 0.85, sat: -0.2, vignette: 0.3 } },
  { id: 'sw', name: 'Schwarzweiß', look: { sat: -1, contrast: 0.15, vignette: 0.2 } },
  { id: 'traum', name: 'Traum', look: { bright: 0.06, contrast: -0.12, sat: 0.08, vignette: 0.35 } },
];

export interface AlbumPhoto {
  t: number;
  img: string;
  where: string;
  filter: string;
}

const KEY = 'teehaus.album';
const MAX = 16;

/** Fotos im Browser (eigener Speicher, nicht im Spielstand: Bilder sind groß) */
export const photos = {
  list(): AlbumPhoto[] {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
      return Array.isArray(raw) ? (raw as AlbumPhoto[]).filter((p) => typeof p?.img === 'string') : [];
    } catch {
      return [];
    }
  },
  save(list: AlbumPhoto[]): boolean {
    // Bei vollem Speicher die ältesten weglassen, bis es passt
    for (let l = list.slice(-MAX); l.length; l = l.slice(1))
      try {
        localStorage.setItem(KEY, JSON.stringify(l));
        return true;
      } catch {
        /* weiter mit weniger Fotos */
      }
    return false;
  },
  add(p: AlbumPhoto): boolean {
    return this.save([...this.list(), p]);
  },
  remove(t: number): void {
    this.save(this.list().filter((p) => p.t !== t));
  },
};

export interface PhotoHost {
  world: World;
  /** Ort für die Bildunterschrift */
  where: () => string;
  toast: (html: string) => void;
  onShot?: () => void;
}

export class PhotoMode {
  open = false;
  private bar: HTMLElement;
  private filterBtns: HTMLButtonElement[] = [];
  private filter = FILTERS[0]!;
  private flash: HTMLElement;
  private keyHandler = (e: KeyboardEvent): void => {
    if (!this.open) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.shoot();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.close();
    } else if (e.code.startsWith('Digit')) {
      const i = Number(e.code.slice(5)) - 1;
      const f = FILTERS[i];
      if (f) this.setFilter(f);
    }
  };

  constructor(private host: PhotoHost) {
    this.bar = h(
      'div',
      { class: 'photo-bar', hidden: true, role: 'toolbar', 'aria-label': 'Fotomodus' },
      h('span', { class: 'photo-title' }, h('span', { lang: 'zh' }, '拍照'), ' Fotomodus'),
      h(
        'div',
        { class: 'photo-filters' },
        ...FILTERS.map((f, i) => {
          const b = h(
            'button',
            { class: 'btn ghost', type: 'button', title: `Taste ${i + 1}`, onclick: () => this.setFilter(f) },
            f.name,
          );
          this.filterBtns.push(b);
          return b;
        }),
      ),
      h(
        'button',
        { class: 'btn primary', type: 'button', onclick: () => this.shoot() },
        '📷 Auslösen (Leertaste)',
      ),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => this.close() }, 'Fertig (Esc)'),
      h('small', { class: 'photo-hint' }, 'Maus ziehen: Kamera drehen · Mausrad: Abstand · 1–7: Filter'),
    );
    this.flash = h('div', { class: 'photo-flash', 'aria-hidden': 'true' });
    document.body.append(this.bar, this.flash);
    window.addEventListener('keydown', this.keyHandler, true);
    this.setFilter(FILTERS[0]!);
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  show(): void {
    const w = this.host.world;
    if (this.open || w.mode !== 'free') return;
    this.open = true;
    w.input.lock('foto');
    document.body.classList.add('photo-mode');
    this.bar.hidden = false;
    this.applyLook();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.host.world.input.unlock('foto');
    document.body.classList.remove('photo-mode');
    this.bar.hidden = true;
    // Look zurück auf neutral
    Object.assign(this.host.world.look, { sat: 0, contrast: 0, bright: 0, sepia: 0, vignette: 0, hue: 0 });
  }

  private setFilter(f: PhotoFilter): void {
    this.filter = f;
    this.filterBtns.forEach((b, i) => b.classList.toggle('on', FILTERS[i] === f));
    if (this.open) this.applyLook();
  }

  private applyLook(): void {
    Object.assign(
      this.host.world.look,
      { sat: 0, contrast: 0, bright: 0, sepia: 0, vignette: 0, hue: 0 },
      this.filter.look,
    );
  }

  shoot(): void {
    try {
      const img = this.host.world.snapshot(640);
      const ok = photos.add({ t: Date.now(), img, where: this.host.where(), filter: this.filter.name });
      this.flash.classList.remove('go');
      void this.flash.offsetWidth;
      this.flash.classList.add('go');
      store.setGame('fotos', (store.progress.games['fotos'] ?? 0) + 1);
      this.host.onShot?.();
      this.host.toast(
        ok
          ? `Foto im Album gespeichert · <b>${this.filter.name}</b> (Album: Taste B)`
          : 'Foto konnte nicht gespeichert werden (Browserspeicher voll).',
      );
    } catch (e) {
      report('Fotomodus', e, 'warn');
      this.host.toast('Foto konnte nicht aufgenommen werden.');
    }
  }
}
