// Debug-Anzeige (F3): Bildrate, Rechenzeit pro Bild, Draw-Calls, Dreiecke, Figuren und geladene Zonen.
import { h } from './dom';

export class DebugOverlay {
  private el: HTMLElement;
  private frames = 0;
  private acc = 0;
  private cpu = 0;
  private worst = 0;
  private calls = 0;
  private tris = 0;
  /** weitere Zeilen (Figuren, Zonen, Wetter …) */
  readonly lines: (() => string)[] = [];

  constructor(private quality: () => number) {
    this.el = h('pre', { id: 'debug', 'aria-hidden': 'true', hidden: true });
    document.body.appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'F3') return;
      e.preventDefault();
      this.el.hidden = !this.el.hidden;
    });
    if (new URLSearchParams(location.search).has('debug')) this.el.hidden = false;
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  update(rawDt: number, cpuMs: number, calls: number, tris: number): void {
    this.frames++;
    this.acc += rawDt;
    this.cpu += cpuMs;
    this.worst = Math.max(this.worst, rawDt);
    this.calls = calls;
    this.tris = tris;
    if (this.acc < 0.5) return;
    if (!this.el.hidden) {
      const fps = this.frames / this.acc;
      const q = ['Niedrig', 'Mittel', 'Hoch'][this.quality()] ?? '?';
      this.el.textContent = [
        `FPS        ${fps.toFixed(0)}  (langsamstes Bild ${(this.worst * 1000).toFixed(0)} ms)`,
        `CPU/Bild   ${(this.cpu / this.frames).toFixed(1)} ms`,
        `Draw-Calls ${this.calls}`,
        `Dreiecke   ${(this.tris / 1000).toFixed(0)} k`,
        `Qualität   ${q}`,
        ...this.lines.map((f) => f()),
      ].join('\n');
    }
    this.frames = 0;
    this.acc = 0;
    this.cpu = 0;
    this.worst = 0;
  }
}
