// Eingabe, nur Desktop: Tastatur (Belegung aus den Einstellungen, Pfeiltasten immer zusätzlich) und Maus
// (ziehen = Kamera, Klick = hinlaufen, Rad = Zoom). Tasten für Karte, Ton, Pause und Vollbild melden sich über
// onAction.
import { store } from '../state/store';
import type { Action } from '../state/store';

export interface Tap {
  x: number;
  y: number;
}

export class Input {
  private keys = new Set<string>();
  private drag: {
    id: number;
    x: number;
    y: number;
    sx: number;
    sy: number;
    t: number;
    moved: boolean;
  } | null = null;
  /** Kameradrehung seit dem letzten Frame (Pixel) */
  lookDX = 0;
  lookDY = 0;
  zoom = 0;
  taps: Tap[] = [];
  interact = false;
  wave = false;
  /**
   * Eingabe an/aus. Zusammengesetzt aus dem Grundzustand (Menü, Intro: `enabled = …`) und benannten Sperren
   * offener Fenster (`lock`/`unlock`). Vorher setzte jedes Fenster beim Schließen den Schalter nur zurück, wenn
   * gerade freies Spiel war – über das Pausemenü geöffnet blieb die Figur danach dauerhaft gesperrt.
   */
  private base = true;
  private locks = new Set<string>();
  get enabled(): boolean {
    return this.base && this.locks.size === 0;
  }
  set enabled(on: boolean) {
    this.base = on;
  }
  lock(reason: string): void {
    this.locks.add(reason);
  }
  unlock(reason: string): void {
    this.locks.delete(reason);
  }
  /** aktuelle Sperren (Debug-Anzeige, Watchdog) */
  get lockReasons(): string[] {
    return [...this.locks];
  }
  /** Notausgang: alle Fenstersperren lösen */
  clearLocks(): void {
    this.locks.clear();
  }
  /** Taste für Karte, Ton oder Pause gedrückt */
  onAction?: (a: Action) => void;

  constructor(canvas: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (this.isTyping(e)) return;
      this.keys.add(e.code);
      const k = store.settings.keys;
      if (e.code === k.use || (e.code === 'Enter' && this.enabled)) {
        if (e.code === k.use || !(e.target instanceof HTMLButtonElement)) this.interact = true;
      }
      if (e.code === k.wave) this.wave = true;
      if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey)
        for (const a of [
          'map',
          'sound',
          'pause',
          'fullscreen',
          'photo',
          'album',
          'bow',
          'clap',
          'taichi',
        ] as const)
          if (e.code === k[a]) this.onAction?.(a);
      if (
        e.code.startsWith('Arrow') &&
        this.enabled &&
        !(e.target as HTMLElement)?.closest?.('.panel, .modal, .dlg3')
      )
        e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // Kamera ziehen / klicken
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== 2) return;
      this.drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        sx: e.clientX,
        sy: e.clientY,
        t: performance.now(),
        moved: false,
      };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 7) d.moved = true;
      if (d.moved) {
        this.lookDX += dx;
        this.lookDY += dy;
      }
    });
    const end = (e: PointerEvent): void => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      if (!d.moved && performance.now() - d.t < 450 && e.type === 'pointerup')
        this.taps.push({ x: e.clientX, y: e.clientY });
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom += Math.sign(e.deltaY) * 0.6;
      },
      { passive: false },
    );
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private isTyping(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable);
  }

  /** Bewegungswunsch: x = rechts, y = vorwärts (Länge 0..1), run = Laufen */
  axis(): { x: number; y: number; run: boolean } {
    if (!this.enabled) return { x: 0, y: 0, run: false };
    const k = this.keys;
    const b = store.settings.keys;
    let x = (k.has(b.right) || k.has('ArrowRight') ? 1 : 0) - (k.has(b.left) || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has(b.forward) || k.has('ArrowUp') ? 1 : 0) - (k.has(b.back) || k.has('ArrowDown') ? 1 : 0);
    const run = k.has(b.run) || (b.run === 'ShiftLeft' && k.has('ShiftRight'));
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y, run };
  }

  /** Pro Frame aufrufen, nachdem alles gelesen wurde */
  endFrame(): void {
    this.lookDX = this.lookDY = 0;
    this.zoom = 0;
    this.taps.length = 0;
    this.interact = false;
    this.wave = false;
  }
}
