// Sprechblasen über den Köpfen (für Begrüßung, Zwischenrufe und Easter-Egg-Kommentare).
import type { Stage } from '../scene/stage';
import type { Figure } from '../figures/figure';
import { bus } from '../core/bus';
import { store } from '../state/store';
import { h, prefersReducedMotion } from './dom';
import { Typer } from './typewriter';

interface Active {
  el: HTMLElement;
  fig: Figure;
  typer: Typer;
  timer: number;
  resolve: () => void;
}

export class Bubbles {
  private root: HTMLElement;
  private active = new Map<string, Active>();
  private raf = 0;

  constructor(private stage: Stage) {
    this.root = h('div', { id: 'bubbles', 'aria-live': 'polite' });
    document.body.appendChild(this.root);
  }

  /** Zeigt eine Sprechblase und löst auf, wenn sie wieder verschwunden ist. */
  say(fig: Figure, text: string, hold = 1800): Promise<void> {
    this.dismiss(fig.style.id);
    return new Promise((resolve) => {
      const name = fig.style.id === 'jackie' ? '成龙' : '姚明';
      const textEl = h('span', { class: 'bubble-text' });
      const el = h(
        'div',
        { class: `bubble bubble-${fig.style.id}` },
        h('span', { class: 'bubble-name', lang: 'zh' }, name),
        textEl,
      );
      this.root.appendChild(el);
      const instant = prefersReducedMotion() || store.settings.calm;
      fig.speaking = true;
      bus.emit('voice:start', { who: fig.style.id });
      const typer = new Typer(textEl, text, {
        speed: 24,
        instant,
        onBlip: (ch) => {
          fig.pulse(0.8);
          bus.emit('voice:blip', { who: fig.style.id, ch });
        },
        onDone: () => {
          fig.speaking = false;
          bus.emit('voice:end', { who: fig.style.id });
          const a = this.active.get(fig.style.id);
          if (a) a.timer = window.setTimeout(() => this.dismiss(fig.style.id), hold + text.length * 28);
        },
      });
      this.active.set(fig.style.id, { el, fig, typer, timer: 0, resolve });
      requestAnimationFrame(() => el.classList.add('show'));
      typer.start();
      this.loop();
    });
  }

  dismiss(id: string): void {
    const a = this.active.get(id);
    if (!a) return;
    window.clearTimeout(a.timer);
    a.typer.cancel();
    a.fig.speaking = false;
    this.active.delete(id);
    a.el.classList.remove('show');
    window.setTimeout(() => a.el.remove(), 350);
    a.resolve();
  }

  dismissAll(): void {
    for (const id of [...this.active.keys()]) this.dismiss(id);
  }

  /** Blasen folgen den Köpfen (die Kamera bewegt sich). */
  private loop = (): void => {
    cancelAnimationFrame(this.raf);
    if (!this.active.size) return;
    for (const a of this.active.values()) {
      const p = a.fig.headTop;
      const s = this.stage.designToScreen(p.x, p.y);
      const w = a.el.offsetWidth || 240;
      const x = Math.min(window.innerWidth - w / 2 - 12, Math.max(w / 2 + 12, s.x));
      a.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(s.y, a.el.offsetHeight + 70))}px) translate(-50%, -100%)`;
    }
    this.raf = requestAnimationFrame(this.loop);
  };
}
