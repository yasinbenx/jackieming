// Typewriter-Effekt: Text wird sofort in Buchstaben-Spans gesetzt (kein Layout-Springen) und nach und nach
// eingeblendet. Chinesische Zeichen bekommen lang="zh". Für jeden zweiten Buchstaben gibt es ein Blip.
import { h, isCjk } from './dom';

export interface TyperOptions {
  /** Millisekunden pro Zeichen */
  speed?: number;
  instant?: boolean;
  onBlip?: (ch: string) => void;
  onDone?: () => void;
}

export class Typer {
  private chars: HTMLElement[] = [];
  private timer = 0;
  private i = 0;
  private done = false;
  private blipCount = 0;

  constructor(
    host: HTMLElement,
    text: string,
    private opts: TyperOptions = {},
  ) {
    host.textContent = '';
    // Wörter zusammenhalten, damit Zeilen nicht mitten im Wort umbrechen
    const words = text.split(/(\s+)/);
    for (const w of words) {
      if (/^\s+$/.test(w)) {
        host.append(document.createTextNode(' '));
        continue;
      }
      const wrap = h('span', { class: 'w' });
      for (const ch of Array.from(w)) {
        const s = h('span', { class: 'ch' }, ch);
        if (isCjk(ch)) s.setAttribute('lang', 'zh');
        wrap.append(s);
        this.chars.push(s);
      }
      host.append(wrap);
    }
  }

  start(): void {
    if (this.opts.instant) return this.skip();
    this.tick();
  }

  private delayFor(ch: string): number {
    const base = this.opts.speed ?? 30;
    if (isCjk(ch)) return base * 2.6;
    if ('.!?'.includes(ch)) return base + 230;
    if (',:;'.includes(ch)) return base + 110;
    return base;
  }

  private tick = (): void => {
    if (this.done) return;
    const ch = this.chars[this.i];
    if (!ch) return this.finish();
    ch.classList.add('on');
    const text = ch.textContent ?? '';
    if (/\S/.test(text)) {
      this.blipCount++;
      if (this.blipCount % 2 === 0) this.opts.onBlip?.(text);
    }
    this.i++;
    if (this.i >= this.chars.length) return this.finish();
    this.timer = window.setTimeout(this.tick, this.delayFor(text));
  };

  /** Alles sofort zeigen (Klick/Taste) */
  skip(): void {
    if (this.done) return;
    window.clearTimeout(this.timer);
    for (const c of this.chars) c.classList.add('on');
    this.finish();
  }

  cancel(): void {
    window.clearTimeout(this.timer);
    this.done = true;
  }

  get finished(): boolean {
    return this.done;
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    window.clearTimeout(this.timer);
    this.opts.onDone?.();
  }
}
