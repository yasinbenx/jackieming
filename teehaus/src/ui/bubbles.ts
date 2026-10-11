// Sprechblasen über den Köpfen (Comic-Look auf Papier und Holz). Jede Figur behält einen kleinen Verlauf: die
// letzten 2-3 Blasen rücken nach oben und verblassen. Typewriter-Effekt mit Silben-Gemurmel über den Bus.
import type { Vector3 } from 'three';
import { bus } from '../core/bus';
import { store } from '../state/store';
import { h, prefersReducedMotion } from './dom';
import { Typer } from './typewriter';

export interface Speaker {
  id: string;
  /** Anzeigename in der Blase (Zeichen) */
  name: string;
  /** Weltpunkt über dem Kopf */
  anchor: () => Vector3;
  /** Mundbewegung / Gesten beim Sprechen */
  onBlip?: () => void;
  onStart?: () => void;
  onEnd?: () => void;
}

interface Item {
  el: HTMLElement;
  speaker: Speaker;
  typer: Typer;
  timer: number;
  done: boolean;
  resolve: () => void;
  icon: boolean;
  /** Zeitpunkt des Erscheinens (die neueste Blase hat Vorrang beim Platz) */
  born: number;
}

export type Projector = (v: Vector3) => { x: number; y: number; visible: boolean };

export class Bubbles {
  private root: HTMLElement;
  /** pro Sprecher: neueste zuerst */
  private stacks = new Map<string, Item[]>();
  private raf = 0;
  /** Wie viele alte Blasen pro Sprecher sichtbar bleiben (Gespräch: 3, sonst 1) */
  history = 1;

  constructor(private project: Projector) {
    this.root = h('div', { id: 'bubbles', 'aria-live': 'polite' });
    document.body.appendChild(this.root);
  }

  /**
   * Zeigt eine Sprechblase. hold: Sekunden, die sie nach dem Tippen stehen bleibt (0 = bleibt, bis die nächste kommt).
   * Löst auf, wenn fertig getippt (und ggf. ausgeblendet).
   */
  say(
    sp: Speaker,
    text: string,
    opts: { hold?: number; cls?: string; waitDismiss?: boolean } = {},
  ): Promise<void> {
    const stack = this.stacks.get(sp.id) ?? [];
    this.stacks.set(sp.id, stack);
    // Ältere Blasen dieses Sprechers in den Verlauf schieben
    for (const it of stack) {
      it.typer.skip();
      it.el.classList.add('old');
    }
    while (stack.length >= Math.max(1, this.history)) this.remove(sp.id, stack[stack.length - 1]!);
    return new Promise((resolve) => {
      const textEl = h('span', { class: 'bubble-text' });
      const el = h(
        'div',
        { class: `bubble ${opts.cls ?? ''} bubble-${sp.id}` },
        h('span', { class: 'bubble-name', lang: 'zh' }, sp.name),
        textEl,
      );
      this.root.appendChild(el);
      const instant = prefersReducedMotion() || store.settings.calm;
      sp.onStart?.();
      bus.emit('voice:start', { who: sp.id });
      const item: Item = {
        el,
        speaker: sp,
        typer: new Typer(textEl, text, {
          speed: 26,
          instant,
          onBlip: (ch) => {
            sp.onBlip?.();
            bus.emit('voice:blip', { who: sp.id, ch });
          },
          onDone: () => {
            item.done = true;
            sp.onEnd?.();
            bus.emit('voice:end', { who: sp.id });
            const hold = opts.hold ?? 2.2;
            if (hold > 0)
              item.timer = window.setTimeout(
                () => this.remove(sp.id, item),
                (hold + text.length * 0.03) * 1000,
              );
            if (!opts.waitDismiss) resolve();
          },
        }),
        timer: 0,
        done: false,
        resolve,
        icon: false,
        born: performance.now(),
      };
      stack.unshift(item);
      requestAnimationFrame(() => el.classList.add('show'));
      item.typer.start();
      this.loop();
    });
  }

  /** Kleine Symbol-Blase (z. B. ♪, …, ❤, 😄) ohne Text */
  icon(sp: Speaker, symbol: string, secs = 2.4): void {
    const el = h('div', { class: `bubble icon bubble-${sp.id}` }, symbol);
    this.root.appendChild(el);
    const stack = this.stacks.get(sp.id) ?? [];
    this.stacks.set(sp.id, stack);
    const item: Item = {
      el,
      speaker: sp,
      typer: new Typer(h('span'), '', {}),
      timer: 0,
      done: true,
      resolve: () => undefined,
      icon: true,
      born: performance.now(),
    };
    // Symbole verdrängen keine Textblasen, sie hängen hinten an
    stack.push(item);
    requestAnimationFrame(() => el.classList.add('show'));
    item.timer = window.setTimeout(() => this.remove(sp.id, item), secs * 1000);
    this.loop();
  }

  /** Spricht der Sprecher gerade (tippt noch)? */
  speaking(id: string): boolean {
    return (this.stacks.get(id) ?? []).some((i) => !i.done);
  }

  skip(id: string): void {
    for (const i of this.stacks.get(id) ?? []) i.typer.skip();
  }

  private remove(id: string, item: Item): void {
    const stack = this.stacks.get(id);
    if (!stack) return;
    const i = stack.indexOf(item);
    if (i < 0) return;
    stack.splice(i, 1);
    window.clearTimeout(item.timer);
    item.typer.cancel();
    if (!item.done) {
      item.speaker.onEnd?.();
      bus.emit('voice:end', { who: id });
    }
    item.el.classList.remove('show');
    item.el.classList.add('gone');
    window.setTimeout(() => item.el.remove(), 350);
    item.resolve();
  }

  dismiss(id: string): void {
    for (const it of [...(this.stacks.get(id) ?? [])]) this.remove(id, it);
  }

  dismissAll(): void {
    for (const id of [...this.stacks.keys()]) this.dismiss(id);
  }

  /** Blasen folgen den Köpfen; Blasen verschiedener Sprecher weichen einander nach oben aus */
  private loop = (): void => {
    cancelAnimationFrame(this.raf);
    let any = false;
    // Bereich rechts, den das Gesprächsfenster belegt (Desktop: Seitenleiste)
    const panel = document.querySelector<HTMLElement>('.dlg3:not([hidden])');
    const pr = panel?.getBoundingClientRect();
    const side = pr && pr.left > window.innerWidth * 0.45 ? pr.left : window.innerWidth;
    const bottomLimit = pr && pr.left <= window.innerWidth * 0.45 ? pr.top - 8 : window.innerHeight;
    const placed: { l: number; r: number; t: number; b: number }[] = [];
    // Wer zuletzt zu sprechen begann, bekommt seinen Platz am Kopf; die anderen weichen aus oder treten zurück
    const order = [...this.stacks.values()]
      .filter((st) => st.length)
      .map((st) => ({ st, s: this.project(st[0]!.speaker.anchor()) }))
      .sort((a, b) => b.st[0]!.born - a.st[0]!.born);
    for (const { st: stack, s } of order) {
      any = true;
      let y = Math.min(s.y - 8, bottomLimit);
      for (const [i, it] of stack.entries()) {
        const w = it.el.offsetWidth || 220;
        const hgt = it.el.offsetHeight || 60;
        const x = Math.min(side - w / 2 - 10, Math.max(w / 2 + 10, s.x));
        let top = Math.max(hgt + 64, y);
        // nicht über andere Blasen legen: nach oben ausweichen
        for (let k = 0; k < 6; k++) {
          const hit = placed.find(
            (r) => x - w / 2 < r.r + 6 && x + w / 2 > r.l - 6 && top - hgt < r.b + 6 && top > r.t - 6,
          );
          if (!hit) break;
          top = hit.t - 8;
        }
        const clipped = top < hgt + 8;
        top = Math.max(hgt + 8, top);
        it.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(top)}px) translate(-50%, -100%)`;
        it.el.style.zIndex = String(20 - i);
        // ältere Blasen nur zeigen, wenn oben genug Platz ist (sonst würden sie sich überdecken)
        const still = placed.some((r) => x - w / 2 < r.r && x + w / 2 > r.l && top - hgt < r.b && top > r.t);
        const hide = !s.visible || still || (i > 0 && (y < hgt + 64 || clipped));
        it.el.classList.toggle('offscreen', hide);
        if (!hide) placed.push({ l: x - w / 2, r: x + w / 2, t: top - hgt, b: top });
        y = top - hgt - 10;
      }
    }
    if (any) this.raf = requestAnimationFrame(this.loop);
  };
}
