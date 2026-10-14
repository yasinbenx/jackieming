// Debug-Anzeige (F3): Bildrate, Rechenzeit pro Bild, Draw-Calls, Dreiecke, Speicher, Spielzustand, Figuren und
// geladene Zonen.
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

  /** Grafik- und JS-Speicher (JS-Speicher nur in Chromium-Browsern) */
  memoryInfo?: () => { geometries: number; textures: number; programs: number };

  private memory(): string {
    const g = this.memoryInfo?.();
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const js = heap ? ` · JS ${(heap.usedJSHeapSize / 1048576).toFixed(0)} MB` : '';
    return g
      ? `Speicher   ${g.geometries} Geometrien · ${g.textures} Texturen · ${g.programs} Shader${js}`
      : `Speicher  ${js}`;
  }

  /** Draw-Calls der letzten Bilder (für Tests) */
  readonly recent: number[] = [];

  update(rawDt: number, cpuMs: number, calls: number, tris: number): void {
    this.recent.push(calls);
    if (this.recent.length > 16) this.recent.shift();
    this.frames++;
    this.acc += rawDt;
    this.cpu += cpuMs;
    this.worst = Math.max(this.worst, rawDt);
    this.calls += calls;
    this.tris += tris;
    if (this.acc < 0.5) return;
    if (!this.el.hidden) {
      const fps = this.frames / this.acc;
      const q = ['Niedrig', 'Mittel', 'Hoch'][this.quality()] ?? '?';
      this.el.textContent = [
        `FPS        ${fps.toFixed(0)}  (langsamstes Bild ${(this.worst * 1000).toFixed(0)} ms)`,
        `CPU/Bild   ${(this.cpu / this.frames).toFixed(1)} ms`,
        `Draw-Calls ${Math.round(this.calls / this.frames)}  (Mittel; Schatten und Spiegelung jedes 2. Bild)`,
        `Dreiecke   ${(this.tris / this.frames / 1000).toFixed(0)} k`,
        `Qualität   ${q}`,
        this.memory(),
        ...this.lines.map((f) => f()),
      ].join('\n');
    }
    this.frames = 0;
    this.acc = 0;
    this.cpu = 0;
    this.worst = 0;
    this.calls = 0;
    this.tris = 0;
  }
}
