// Tee-Mini-Spiel an der Theke (泡茶 pào chá): Teesorte wählen, Wasser erhitzen, ziehen lassen, servieren.
// Die Leiste rechts führt durch die vier Schritte; der Teemeister bestellt und bewertet in der 3D-Szene.
// Tastatur: Leertaste halten = erhitzen, Leertaste/Eingabe = weiter bzw. abgießen, 1–5 = Auswahl, Esc = abbrechen.
import { h } from './dom';
import { pinyinHtml, pinyinText } from '../content/pinyin';
import { MASTER_VERDICT, ORDER, SERVE_PHRASES, TEAS, WATER_STAGES } from '../content/teas';
import type { Tea } from '../content/teas';
import {
  fmtMin,
  MAX_STEEP,
  nextOrder,
  offBy,
  rateTea,
  SECONDS_PER_MINUTE,
  stepWater,
  strength,
} from '../minigames/tea';
import type { TeaRating, TeaRound } from '../minigames/tea';
import { store } from '../state/store';
import { bus } from '../core/bus';

export interface TeaHost {
  /** Teemeister spricht (Sprechblase) */
  say: (text: string) => void;
  /** Teemeister-Geste */
  act: (what: 'nod' | 'bow' | 'laugh' | 'pour' | 'taste' | 'shake') => void;
  /** Lernwort vergeben */
  award: (wordId: string) => void;
  /** Spiel beendet (Leiste zu) */
  onClose: () => void;
}

type Step = 'pick' | 'heat' | 'steep' | 'serve' | 'result';
const STEP_TITLES: Record<Exclude<Step, 'result'>, [string, string, string]> = {
  pick: ['选茶', 'xuǎn chá', 'Teesorte wählen'],
  heat: ['烧水', 'shāo shuǐ', 'Wasser erhitzen'],
  steep: ['泡茶', 'pào chá', 'Ziehen lassen'],
  serve: ['上茶', 'shàng chá', 'Servieren'],
};
const ORDER_STEPS: Exclude<Step, 'result'>[] = ['pick', 'heat', 'steep', 'serve'];

const TIN = (color: string): string =>
  `<svg viewBox="0 0 40 48" width="40" height="48" aria-hidden="true"><rect x="5" y="9" width="30" height="36" rx="4" fill="${color}"/><rect x="3" y="4" width="34" height="8" rx="3" fill="#3a2418"/><rect x="11" y="20" width="18" height="16" rx="2" fill="#fbf3e2" opacity=".85"/></svg>`;
const LEAF = (on: boolean): string =>
  `<svg viewBox="0 0 40 40" width="44" height="44" aria-hidden="true"><path d="M8 32C8 16 18 6 34 6c0 16-10 26-26 26z" fill="${on ? '#5f8f3a' : 'none'}" stroke="${on ? '#3f6a22' : '#b9a27a'}" stroke-width="2.5"/><path d="M8 32L28 12" stroke="${on ? '#e8f2d0' : '#b9a27a'}" stroke-width="1.6" fill="none"/></svg>`;

const mix = (a: string, b: string, t: number): string => {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i]! - v) * t)).join(',')})`;
};

export class TeaGame {
  readonly el: HTMLElement;
  private stepsEl: HTMLElement;
  private body: HTMLElement;
  private step: Step = 'pick';
  private round!: TeaRound;
  private heating = false;
  private steeping = false;
  private raf = 0;
  private last = 0;
  private lastTea: string | null = null;
  private keyHeld = false;
  open = false;

  constructor(private host: TeaHost) {
    this.stepsEl = h('ol', { class: 'tg-steps' });
    this.body = h('div', { class: 'tg-body' });
    this.el = h(
      'section',
      { class: 'teagame', hidden: true, role: 'dialog', 'aria-label': 'Tee zubereiten' },
      h(
        'header',
        { class: 'tg-head' },
        h('h2', {}, h('span', { lang: 'zh' }, '泡茶'), ' ', h('i', {}, 'pào chá'), ' · Tee zubereiten'),
        h(
          'button',
          {
            class: 'dlg3-close',
            type: 'button',
            'aria-label': 'Abbrechen (Esc)',
            onclick: () => this.close(),
          },
          '×',
        ),
      ),
      this.stepsEl,
      this.body,
    );
    document.body.appendChild(this.el);
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
  }

  /** Neue Runde: der Meister bestellt */
  start(): void {
    const rounds = store.progress.games['tea-rounds'] ?? 0;
    const tea = nextOrder(TEAS, rounds, this.lastTea);
    this.lastTea = tea.id;
    this.round = { tea, wrongPicks: 0, temp: 20, minutes: 0, phraseOk: false };
    this.open = true;
    this.el.hidden = false;
    document.body.classList.add('dialog-open', 'tea-open');
    this.host.say(`${ORDER.zh(tea.zh)}`);
    this.show('pick');
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.heating = this.steeping = false;
    cancelAnimationFrame(this.raf);
    this.el.hidden = true;
    document.body.classList.remove('dialog-open', 'tea-open');
    this.host.onClose();
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (!this.open) return;
    if (down && e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (this.step === 'heat') {
        if (down && !e.repeat) this.keyHeld = true;
        if (!down) this.keyHeld = false;
        this.setHeating(this.keyHeld);
        return;
      }
      if (down && !e.repeat && this.step === 'steep') this.pourOff();
      return;
    }
    if (!down || e.repeat) return;
    if (e.key === 'Enter') {
      const b = this.body.querySelector<HTMLButtonElement>('.tg-next:not([disabled])');
      if (b) {
        e.preventDefault();
        b.click();
      }
    }
    const n = Number(e.key);
    if (n >= 1 && n <= 5) {
      const opts = this.body.querySelectorAll<HTMLButtonElement>('.tg-opt:not([disabled])');
      opts[n - 1]?.click();
    }
  }

  private renderSteps(): void {
    const cur = ORDER_STEPS.indexOf(this.step as Exclude<Step, 'result'>);
    this.stepsEl.replaceChildren(
      ...ORDER_STEPS.map((s, i) =>
        h(
          'li',
          { class: i < cur || this.step === 'result' ? 'done' : i === cur ? 'now' : '' },
          h('span', { lang: 'zh' }, STEP_TITLES[s][0]),
          h('small', {}, STEP_TITLES[s][2]),
        ),
      ),
    );
  }

  private show(step: Step): void {
    this.step = step;
    this.renderSteps();
    if (step === 'pick') this.renderPick();
    else if (step === 'heat') this.renderHeat();
    else if (step === 'steep') this.renderSteep();
    else if (step === 'serve') this.renderServe();
    else this.renderResult();
  }

  private title(step: Exclude<Step, 'result'>, text: string): HTMLElement {
    const [zh, py, de] = STEP_TITLES[step];
    return h(
      'div',
      { class: 'tg-title' },
      h('h3', {}, h('span', { lang: 'zh' }, zh), ' ', h('i', { class: 'q-py' }, py), ' ', de),
      h('p', {}, text),
    );
  }

  // ── 1. Teesorte
  private renderPick(): void {
    const t = this.round.tea;
    const order = h(
      'blockquote',
      { class: 'tg-order' },
      h('span', { lang: 'zh' }, ORDER.zh(t.zh)),
      h('span', {
        class: 'wc-py',
        html: pinyinHtml(ORDER.py(t.py)),
        'aria-label': pinyinText(ORDER.py(t.py)),
      }),
      h('small', {}, '„Bitte bring mir eine Tasse …“'),
    );
    const grid = h('div', { class: 'tg-tins' });
    const hint = h('p', { class: 'tg-hint', role: 'status' });
    TEAS.forEach((tea, i) => {
      const de = h('span', { class: 'tg-de', hidden: true }, tea.de);
      const b = h(
        'button',
        { class: 'tg-opt tg-tin', type: 'button', 'aria-label': `${i + 1}: ${tea.zh} ${pinyinText(tea.py)}` },
        h('span', { class: 'tg-key' }, String(i + 1)),
        h('span', { html: TIN(tea.color) }),
        h('span', { class: 'tg-zh', lang: 'zh' }, tea.zh),
        h('span', { class: 'wc-py', html: pinyinHtml(tea.py) }),
        de,
      );
      b.addEventListener('click', () => {
        de.hidden = false;
        if (tea.id === t.id) {
          b.classList.add('right');
          bus.emit('ui:click');
          for (const o of grid.querySelectorAll<HTMLButtonElement>('button')) o.disabled = true;
          hint.innerHTML = `Richtig: <b lang="zh">${tea.zh}</b> ist ${tea.de}. ${tea.note}`;
          this.host.act('nod');
          this.host.award(tea.id);
          window.setTimeout(() => this.show('heat'), 1700);
        } else {
          b.classList.add('wrong');
          b.disabled = true;
          this.round.wrongPicks++;
          this.host.act('shake');
          hint.textContent = `Das ist ${tea.de}. Der Meister möchte etwas anderes, hör noch einmal hin.`;
        }
      });
      grid.append(b);
    });
    this.body.replaceChildren(this.title('pick', 'Welche Dose passt zur Bestellung?'), order, grid, hint);
  }

  // ── 2. Wasser
  private renderHeat(): void {
    const t = this.round.tea;
    const fill = h('div', { class: 'tg-thermo-fill' });
    const band = h('div', {
      class: 'tg-thermo-band',
      style: `bottom:${t.temp[0] - 20}%;height:${t.temp[1] - t.temp[0]}%`,
    });
    const val = h('div', { class: 'tg-temp' }, '20 °C');
    const stage = h('div', { class: 'tg-stage' });
    const steam = h('div', { class: 'tg-steam' });
    const hold = h(
      'button',
      { class: 'btn tg-hold', type: 'button' },
      'Erhitzen ',
      h('small', {}, '(gedrückt halten oder Leertaste)'),
    );
    const go = h('button', { class: 'btn primary tg-next', type: 'button' }, 'Aufgießen');
    const on = (v: boolean) => (e: Event) => {
      e.preventDefault();
      this.setHeating(v);
    };
    hold.addEventListener('pointerdown', on(true));
    hold.addEventListener('pointerup', on(false));
    hold.addEventListener('pointerleave', on(false));
    go.addEventListener('click', () => {
      this.setHeating(false);
      cancelAnimationFrame(this.raf);
      bus.emit('scene:pour');
      this.host.act('pour');
      this.host.award('shui');
      if (this.round.temp >= 97) this.host.award('kaishui');
      this.show('steep');
    });
    this.body.replaceChildren(
      this.title(
        'heat',
        `Für ${t.zh} ${t.de} braucht das Wasser ${t.temp[0]}–${t.temp[1]} °C. Der grüne Bereich zeigt es an.`,
      ),
      h(
        'div',
        { class: 'tg-heat' },
        h('div', { class: 'tg-kettle' }, steam, h('div', { class: 'tg-kettle-body' })),
        h('div', { class: 'tg-thermo' }, band, fill),
        h('div', { class: 'tg-readout' }, val, stage),
      ),
      h('div', { class: 'tg-actions' }, hold, go),
    );
    const tick = (now: number): void => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.round.temp = stepWater(this.round.temp, this.heating, dt);
      const T = this.round.temp;
      fill.style.height = `${T - 20}%`;
      val.textContent = `${Math.round(T)} °C`;
      const st = [...WATER_STAGES].reverse().find((s) => T >= s.from)!;
      stage.innerHTML = `<span lang="zh">${st.zh}</span> <span class="wc-py">${pinyinHtml(st.py)}</span> ${st.de}`;
      steam.style.opacity = String(Math.max(0, (T - 55) / 45));
      val.classList.toggle('ok', offBy(T, t.temp) === 0);
      if (this.step === 'heat' && this.open) this.raf = requestAnimationFrame(tick);
    };
    this.last = performance.now();
    this.raf = requestAnimationFrame(tick);
  }

  private setHeating(v: boolean): void {
    this.heating = v;
    this.body.querySelector('.tg-hold')?.classList.toggle('active', v);
  }

  // ── 3. Ziehen
  private renderSteep(): void {
    const t = this.round.tea;
    this.round.minutes = 0;
    const cup = h('div', { class: 'tg-cup-liquid' });
    const bar = h('div', { class: 'tg-bar-fill' });
    const win = h('div', {
      class: 'tg-bar-win',
      style: `left:${(t.time[0] / MAX_STEEP) * 100}%;width:${((t.time[1] - t.time[0]) / MAX_STEEP) * 100}%`,
    });
    const clock = h('div', { class: 'tg-clock' }, fmtMin(0));
    const go = h(
      'button',
      { class: 'btn primary tg-next', type: 'button' },
      'Abgießen ',
      h('small', {}, '(Leertaste)'),
    );
    go.addEventListener('click', () => this.pourOff());
    this.body.replaceChildren(
      this.title(
        'steep',
        `${t.de} zieht am besten ${fmtMin(t.time[0])} bis ${fmtMin(t.time[1])}. Gieß ab, wenn der Zeiger im grünen Bereich ist. (Im Spiel vergeht eine Minute in ${SECONDS_PER_MINUTE} Sekunden.)`,
      ),
      h('div', { class: 'tg-steep' }, h('div', { class: 'tg-cup' }, cup), clock),
      h('div', { class: 'tg-bar' }, win, bar),
      h('div', { class: 'tg-actions' }, go),
    );
    this.steeping = true;
    const tick = (now: number): void => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (!this.steeping) return;
      this.round.minutes += dt / SECONDS_PER_MINUTE;
      const m = this.round.minutes;
      bar.style.width = `${Math.min(100, (m / MAX_STEEP) * 100)}%`;
      clock.textContent = fmtMin(m);
      cup.style.background = mix('#f4efd8', t.color, strength(m, t));
      clock.classList.toggle('ok', offBy(m, t.time) === 0);
      if (m >= MAX_STEEP) {
        this.pourOff();
        return;
      }
      if (this.open) this.raf = requestAnimationFrame(tick);
    };
    this.last = performance.now();
    this.raf = requestAnimationFrame(tick);
  }

  private pourOff(): void {
    if (!this.steeping) return;
    this.steeping = false;
    cancelAnimationFrame(this.raf);
    bus.emit('scene:pour');
    this.show('serve');
  }

  // ── 4. Servieren
  private renderServe(): void {
    const hint = h('p', { class: 'tg-hint', role: 'status' });
    const opts = [...SERVE_PHRASES].sort(() => Math.random() - 0.5);
    const grid = h('div', { class: 'tg-phrases' });
    opts.forEach((ph, i) => {
      const b = h(
        'button',
        { class: 'tg-opt tg-phrase', type: 'button' },
        h('span', { class: 'tg-key' }, String(i + 1)),
        h('span', { class: 'tg-zh', lang: 'zh' }, ph.zh),
        h('span', { class: 'wc-py', html: pinyinHtml(ph.py) }),
      );
      b.addEventListener('click', () => {
        for (const o of grid.querySelectorAll<HTMLButtonElement>('button')) o.disabled = true;
        b.classList.add(ph.ok ? 'right' : 'wrong');
        this.round.phraseOk = ph.ok;
        hint.innerHTML = ph.ok
          ? `Genau: <b lang="zh">${ph.zh}</b> heißt „${ph.de}“.`
          : `<b lang="zh">${ph.zh}</b> heißt „${ph.de}“. Beim Servieren sagt man <b lang="zh">请喝茶</b> qǐng hē chá.`;
        if (ph.ok) this.host.award('qinghecha');
        window.setTimeout(() => this.finish(), 1500);
      });
      grid.append(b);
    });
    this.body.replaceChildren(
      this.title('serve', 'Stell die Tasse vor den Meister. Was sagst du dazu?'),
      grid,
      hint,
    );
  }

  private rating: TeaRating | null = null;

  private finish(): void {
    const r = rateTea(this.round);
    this.rating = r;
    const rounds = (store.progress.games['tea-rounds'] ?? 0) + 1;
    store.setGame('tea-rounds', rounds);
    store.setGame('tea-best', Math.max(store.progress.games['tea-best'] ?? 0, r.leaves));
    store.addCoins(r.coins);
    this.host.act('taste');
    window.setTimeout(() => {
      const lines = MASTER_VERDICT[r.leaves];
      this.host.say(lines[Math.floor(Math.random() * lines.length)]!);
      this.host.act(r.leaves === 3 ? 'bow' : r.leaves === 2 ? 'nod' : 'laugh');
    }, 1600);
    this.show('result');
  }

  // ── Ergebnis
  private renderResult(): void {
    const r = this.rating!;
    const t: Tea = this.round.tea;
    const again = h(
      'button',
      { class: 'btn primary tg-next', type: 'button', onclick: () => this.start() },
      'Noch eine Kanne',
    );
    const done = h('button', { class: 'btn', type: 'button', onclick: () => this.close() }, 'Fertig');
    this.body.replaceChildren(
      h(
        'div',
        { class: 'tg-result' },
        h(
          'div',
          { class: 'tg-leaves', 'aria-label': `${r.leaves} von 3 Teeblättern` },
          ...[1, 2, 3].map((i) => h('span', { html: LEAF(i <= r.leaves) })),
        ),
        h('h3', {}, `${t.zh} ${t.de}: ${r.leaves} von 3 Teeblättern`),
        h('ul', { class: 'tg-notes' }, ...r.notes.map((n) => h('li', { class: n.ok ? 'ok' : 'no' }, n.text))),
        h(
          'p',
          { class: 'tg-coins' },
          h('b', {}, `+${r.coins}`),
          ' Münzen ',
          h('span', { lang: 'zh' }, '铜钱'),
          ` · zusammen ${store.coins}`,
        ),
      ),
      h('div', { class: 'tg-actions' }, done, again),
    );
    again.focus({ preventScroll: true });
  }
}
