// Debug-Anzeige (F3; ?debug zeigt sie gleich beim Start): Bildrate, Bildzeit, Rechenzeit, Draw-Calls,
// Dreiecke, Speicher und Texturen, Spielzustand, Ladezustand jedes Schritts, Zeitstempel des letzten Bildes,
// letzte Fehler und Watchdog-Meldungen.
import { h } from './dom';

/** Debug-Anzeige verfügbar? (Entwicklungsserver oder ?debug in der Adresse) */
export const DEBUG_AVAILABLE = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');

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
    if (!DEBUG_AVAILABLE) return;
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

  /** Budget der aktuellen Stufe (Draw-Calls, Dreiecke, voll animierte Figuren) und Auflösungsfaktor */
  budget?: () => { calls: number; tris: number; figures?: { now: number; max: number }; scale?: number };

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
      const calls = Math.round(this.calls / this.frames);
      const tris = this.tris / this.frames;
      const b = this.budget?.();
      const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      // Wert gegen Budget: grün im Rahmen, rot darüber
      const vs = (v: number, max: number | undefined, unit = ''): string =>
        max === undefined
          ? `${v}${unit}`
          : `<span class="${v > max ? 'over' : 'ok'}">${v}${unit}</span> / ${max}${unit}`;
      const fpsTxt = `<span class="${fps < 55 ? 'over' : 'ok'}">${fps.toFixed(0)}</span>`;
      this.el.innerHTML = [
        `FPS        ${fpsTxt} / 60  · Bildzeit ${((this.acc / this.frames) * 1000).toFixed(1)} ms (langsamstes ${(this.worst * 1000).toFixed(0)} ms)`,
        `letztes Bild ${(performance.now() / 1000).toFixed(1)} s nach Seitenstart`,
        `CPU/Bild   ${(this.cpu / this.frames).toFixed(1)} ms`,
        `Draw-Calls ${vs(calls, b?.calls)}  (Mittel; Schatten und Spiegelung jedes 2. Bild)`,
        `Dreiecke   ${vs(Math.round(tris / 1000), b ? Math.round(b.tris / 1000) : undefined, ' k')}`,
        b?.figures ? `Figuren    ${vs(b.figures.now, b.figures.max)} voll animiert` : '',
        `Qualität   ${q}${b?.scale !== undefined ? ` · Auflösung ${Math.round(b.scale * 100)} %` : ''}`,
        esc(this.memory()),
        ...this.lines.map((f) => esc(f())),
      ]
        .filter(Boolean)
        .join('\n');
    }
    this.frames = 0;
    this.acc = 0;
    this.cpu = 0;
    this.worst = 0;
    this.calls = 0;
    this.tris = 0;
  }
}
