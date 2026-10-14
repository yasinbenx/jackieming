// Karte des Tals (Taste M): Gelände, Wege, Wasser, Häuser, Orte. Besuchte Orte tragen ihren Namen und lassen
// sich per Schnellreise erreichen; dazu die Spielfigur und Aufgaben-Markierungen. Das Kartenbild wird einmal aus
// dem Höhenraster gemalt, Figur und Markierungen jedes Mal neu.
import { h } from './dom';
import { PLACES, RIVER } from '../world/map';
import type { Place } from '../world/map';
import { field, surface, WATER_KINDS } from '../world/terrain';
import { HOUSES, footprint, toWorld } from '../world/village';
import { store } from '../state/store';

export interface MapMarker {
  x: number;
  z: number;
  label: string;
}

export interface MapHost {
  /** Position und Blickrichtung der Spielfigur */
  player: () => { x: number; z: number; yaw: number };
  /** Aufgaben-Markierungen (Teemeister, Dorfaufträge) */
  markers: () => MapMarker[];
  /** Schnellreise zu einem besuchten Ort */
  travel: (p: Place) => void;
  /** Reisen gerade erlaubt? (nicht im Gespräch oder Mini-Spiel) */
  canTravel: () => boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

/** Kartenausschnitt (Weltkoordinaten) */
const VIEW = { x0: -118, x1: 118, z0: -108, z1: 142 };
const SCALE = 2.4;

export class WorldMap {
  private el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private base: HTMLCanvasElement | null = null;
  private list: HTMLElement;
  private timer = 0;

  constructor(private host: MapHost) {
    this.canvas = h('canvas', {
      class: 'map-canvas',
      width: Math.round((VIEW.x1 - VIEW.x0) * SCALE),
      height: Math.round((VIEW.z1 - VIEW.z0) * SCALE),
      'aria-label': 'Karte des Tals',
      role: 'img',
    });
    this.list = h('ul', { class: 'map-places' });
    this.el = h(
      'div',
      {
        id: 'worldmap',
        class: 'map-overlay',
        hidden: true,
        onclick: (e: Event) => e.target === this.el && this.close(),
      },
      h(
        'div',
        { class: 'map-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'map-title' },
        h(
          'header',
          { class: 'map-head' },
          h('h2', { id: 'map-title' }, h('span', { lang: 'zh' }, '地图'), ' Karte'),
          h(
            'button',
            { class: 'modal-close', type: 'button', 'aria-label': 'Schließen', onclick: () => this.close() },
            '×',
          ),
        ),
        h(
          'div',
          { class: 'map-body' },
          h('div', { class: 'map-wrap' }, this.canvas),
          h(
            'aside',
            { class: 'map-side' },
            h('h3', {}, 'Orte'),
            this.list,
            h(
              'p',
              { class: 'map-hint' },
              'Besuchte Orte: anklicken für die Schnellreise. ',
              h('b', {}, 'M'),
              ' oder Esc schließt.',
            ),
          ),
        ),
      ),
    );
    document.body.appendChild(this.el);
    this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));
    window.addEventListener(
      'keydown',
      (e) => {
        if (this.open && e.key === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.close();
        }
      },
      true,
    );
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  show(): void {
    this.base ??= this.paintBase();
    this.renderList();
    this.draw();
    this.el.hidden = false;
    this.host.onOpen?.();
    this.timer = window.setInterval(() => this.draw(), 250);
  }

  close(): void {
    if (!this.open) return;
    this.el.hidden = true;
    window.clearInterval(this.timer);
    this.host.onClose?.();
  }

  private px(x: number, z: number): [number, number] {
    return [(x - VIEW.x0) * SCALE, (z - VIEW.z0) * SCALE];
  }

  /** Kartengrund: Höhenschattierung, Wasser, Wege, Häuser (einmalig) */
  private paintBase(): HTMLCanvasElement {
    const f = field();
    const sf = surface();
    const W = f.nx + 1;
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d')!;
    const img = g.createImageData(c.width, c.height);
    for (let py = 0; py < c.height; py++) {
      for (let px = 0; px < c.width; px++) {
        const x = VIEW.x0 + px / SCALE;
        const z = VIEW.z0 + py / SCALE;
        const i = Math.max(0, Math.min(f.nx, Math.round((x - f.x0) / f.step)));
        const j = Math.max(0, Math.min(f.nz, Math.round((z - f.z0) / f.step)));
        const k = j * W + i;
        const hgt = f.h[k]!;
        const sx = f.node(i + 1, j) - f.node(i - 1, j);
        const sz = f.node(i, j + 1) - f.node(i, j - 1);
        const shade = Math.max(0.55, Math.min(1.25, 1 - sx * 0.12 - sz * 0.06));
        // Papierton, höher = heller, Berge bräunlich
        let r = 214 + hgt * 0.9;
        let gg = 204 + hgt * 0.4;
        let b = 170 - hgt * 0.3;
        if (hgt > 25) {
          r -= 30;
          gg -= 34;
          b -= 30;
        }
        r *= shade;
        gg *= shade;
        b *= shade;
        const wd = sf.waterD[k]!;
        if (wd < 0 && WATER_KINDS[sf.waterKind[k]!]) {
          r = 96;
          gg = 140;
          b = 150;
        } else if (sf.pathD[k]! < 0.2) {
          r = 168;
          gg = 128;
          b = 82;
        }
        const o = (py * c.width + px) * 4;
        img.data[o] = r;
        img.data[o + 1] = gg;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // Fluss nachziehen (sauberer Rand)
    g.strokeStyle = 'rgba(70,115,128,0.9)';
    g.lineWidth = 7;
    g.lineJoin = 'round';
    g.beginPath();
    RIVER.forEach(([x, z], i) => {
      const [px, py] = this.px(x, z);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.stroke();
    // Häuser als dunkle Rechtecke
    g.fillStyle = '#4a3a2c';
    for (const hs of HOUSES)
      for (const fp of footprint(hs.kind)) {
        const corners = [
          [-fp.hw, -fp.hd],
          [fp.hw, -fp.hd],
          [fp.hw, fp.hd],
          [-fp.hw, fp.hd],
        ].map(([lx, lz]) => this.px(...toWorld(hs, fp.x + lx!, fp.z + lz!)));
        g.beginPath();
        corners.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
        g.closePath();
        g.fill();
      }
    // Teehaus
    g.fillStyle = '#8f2a1c';
    const [tx, ty] = this.px(-7, -6);
    g.fillRect(tx, ty, 14 * SCALE, 12.4 * SCALE);
    // Rand: Nebelschleier um den Ausschnitt
    const grad = g.createRadialGradient(
      c.width / 2,
      c.height * 0.48,
      c.width * 0.38,
      c.width / 2,
      c.height * 0.48,
      c.width * 0.62,
    );
    grad.addColorStop(0, 'rgba(240,232,214,0)');
    grad.addColorStop(1, 'rgba(240,232,214,0.85)');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  private visited(p: Place): boolean {
    return p.id === 'teehaus' || store.progress.places.includes(p.id);
  }

  private renderList(): void {
    const can = this.host.canTravel();
    this.list.replaceChildren(
      ...PLACES.map((p) => {
        const seen = this.visited(p);
        return h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: 'map-place',
              disabled: !seen || !can,
              title: seen ? `Schnellreise: ${p.de}` : 'Noch nicht entdeckt',
              onclick: () => this.go(p),
            },
            h('span', { lang: 'zh' }, seen ? p.zh : '？'),
            ' ',
            seen ? p.de : 'unbekannt',
          ),
        );
      }),
    );
  }

  private go(p: Place): void {
    if (!this.visited(p) || !this.host.canTravel()) return;
    this.close();
    this.host.travel(p);
  }

  private onCanvasClick(e: MouseEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * this.canvas.width;
    const sy = ((e.clientY - r.top) / r.height) * this.canvas.height;
    let best: Place | null = null;
    let bd = 26;
    for (const p of PLACES) {
      const [px, py] = this.px(p.x, p.z);
      const d = Math.hypot(px - sx, py - sy);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (best) this.go(best);
  }

  private draw(): void {
    const g = this.canvas.getContext('2d')!;
    g.drawImage(this.base!, 0, 0);
    // Orte
    g.textAlign = 'center';
    for (const p of PLACES) {
      const [px, py] = this.px(p.x, p.z);
      const seen = this.visited(p);
      g.fillStyle = seen ? '#b3261a' : 'rgba(80,70,60,0.55)';
      g.beginPath();
      g.arc(px, py, seen ? 7 : 5, 0, Math.PI * 2);
      g.fill();
      g.font = '600 15px "Noto Serif SC", serif';
      g.fillStyle = seen ? '#2a1a10' : 'rgba(60,50,40,0.6)';
      g.fillText(seen ? `${p.zh} ${p.de}` : '？', px, py - 12);
    }
    // Aufgaben
    for (const m of this.host.markers()) {
      const [px, py] = this.px(m.x, m.z);
      g.fillStyle = '#e3b450';
      g.strokeStyle = '#5a3a10';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(px, py, 9, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#2a1a10';
      g.font = '700 13px system-ui, sans-serif';
      g.fillText('!', px, py + 5);
      g.font = '12px system-ui, sans-serif';
      g.fillText(m.label, px, py + 24);
    }
    // Spielfigur: Pfeil in Blickrichtung
    const pl = this.host.player();
    const [px, py] = this.px(pl.x, pl.z);
    g.save();
    g.translate(px, py);
    g.rotate(-pl.yaw + Math.PI);
    g.fillStyle = '#2e7d6b';
    g.strokeStyle = '#f4ead6';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -12);
    g.lineTo(8, 9);
    g.lineTo(0, 4);
    g.lineTo(-8, 9);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}
