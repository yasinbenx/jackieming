// Das Gespräch: Figur anklicken → Kategorien und Fragen → Antwort mit Typewriter → Wort des Moments → Zwischenruf.
import { askChat, CHAT_MESSAGES, chatAvailability, type ChatTurn } from './chat';
import type { Category, FigureId, FigureProfile, Question } from '../content/types';
import { CATEGORIES } from '../content/categories';
import { JACKIE } from '../content/jackie';
import { YAO } from '../content/yao';
import { wordById } from '../content/words';
import { pinyinHtml } from '../content/pinyin';
import { bus } from '../core/bus';
import { store } from '../state/store';
import type { PaperFigure as Figure } from '../three/paperFigure';
import { clear, h, prefersReducedMotion } from './dom';
import { Typer } from './typewriter';
import type { WordCard } from './wordcard';
import type { Bubbles } from './bubble';

const PROFILES: Record<FigureId, FigureProfile> = { jackie: JACKIE, yao: YAO };
const ALL_QUESTIONS: Question[] = [...JACKIE.questions, ...YAO.questions];

const LOCK = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4V7z" fill="currentColor"/></svg>`;
const UNLOCK = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-9h-1V6a5 5 0 0 0-9.9-1h2A3 3 0 0 1 15 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2z" fill="currentColor"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z" fill="currentColor"/></svg>`;

export class Dialog {
  readonly el: HTMLElement;
  /** Gerade aktive Figur (null = Dialog zu) */
  current: Figure | null = null;
  private profile: FigureProfile = JACKIE;
  private body: HTMLElement;
  private headerName: HTMLElement;
  private headerCount: HTMLElement;
  private seal: HTMLElement;
  private activeCat: Category['id'] = 'kindheit';
  private typer: Typer | null = null;
  private token = 0;
  private pick: HTMLElement;
  private chatOn = false;
  private chatMax = 200;
  private chatHistory: ChatTurn[] = [];
  onChange?: () => void;
  onOpenFigure?: (id: FigureId) => void;

  constructor(
    private figures: Record<FigureId, Figure>,
    private wordCard: WordCard,
    private bubbles: Bubbles,
  ) {
    this.seal = h('div', { class: 'dlg-seal', lang: 'zh' });
    this.headerName = h('div', { class: 'dlg-name' });
    this.headerCount = h('div', { class: 'dlg-count' });
    this.body = h('div', { class: 'dlg-body' });
    this.el = h(
      'section',
      { id: 'dialog', class: 'dialog', role: 'dialog', 'aria-label': 'Gespräch', hidden: true },
      h(
        'header',
        { class: 'dlg-head' },
        this.seal,
        h('div', { class: 'dlg-who' }, this.headerName, this.headerCount),
        h(
          'div',
          { class: 'dlg-switch' },
          h(
            'button',
            { class: 'dlg-other', type: 'button', onclick: () => this.switchFigure() },
            'Gesprächspartner wechseln',
          ),
        ),
        h(
          'button',
          {
            class: 'dlg-close',
            type: 'button',
            'aria-label': 'Gespräch beenden',
            onclick: () => this.close(),
          },
          '×',
        ),
      ),
      this.body,
    );
    document.body.appendChild(this.el);
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() =>
        document.documentElement.style.setProperty(
          '--dlg-h',
          `${this.el.hidden ? 0 : this.el.offsetHeight}px`,
        ),
      ).observe(this.el);
    }

    // Auswahl-Leiste unten (auch für Tastatur und Touch ohne Treffgenauigkeit)
    this.pick = h(
      'nav',
      { id: 'pick', 'aria-label': 'Mit wem möchtest du sprechen?' },
      h('p', { class: 'pick-hint' }, 'Tippe auf Jackie oder Yao, um ein Gespräch zu beginnen'),
      h(
        'div',
        { class: 'pick-row' },
        this.pickButton('jackie', '成龙', 'Jackie Chan'),
        this.pickButton('yao', '姚明', 'Yao Ming'),
      ),
    );
    document.body.appendChild(this.pick);

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape' && this.current) this.close();
      if (e.key === ' ' || e.key === 'Enter') {
        if (this.typer && !this.typer.finished && this.current && !(e.target instanceof HTMLButtonElement)) {
          e.preventDefault();
          this.typer.skip();
        }
      }
      if (
        !this.current &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        document.body.classList.contains('is-inside')
      ) {
        if (e.key === 'j' || e.key === 'J') this.open('jackie');
        if (e.key === 'y' || e.key === 'Y') this.open('yao');
      }
    });
    store.subscribe(() => this.refreshHeader());
  }

  private pickButton(id: FigureId, zh: string, name: string): HTMLButtonElement {
    return h(
      'button',
      {
        class: `pick-btn pick-${id}`,
        type: 'button',
        'aria-keyshortcuts': id === 'jackie' ? 'J' : 'Y',
        onclick: () => this.open(id),
      },
      h('span', { class: 'pick-seal', lang: 'zh' }, zh[0]),
      h('span', { class: 'pick-label' }, h('b', {}, name), h('i', { lang: 'zh' }, zh)),
    );
  }

  get isOpen(): boolean {
    return this.current !== null;
  }

  // ───────────────────────────────────────── Öffnen / Schließen
  open(id: FigureId): void {
    const fig = this.figures[id];
    const wasOpen = this.current !== null;
    if (this.current && this.current !== fig) this.current.selected = false;
    this.cancelAnswer();
    this.bubbles.dismissAll();
    this.current = fig;
    this.profile = PROFILES[id];
    for (const f of Object.values(this.figures)) f.selected = f === fig;
    fig.react('hello');
    bus.emit('ui:select', { who: id });
    if (!wasOpen) bus.emit('ui:open');

    this.seal.className = `dlg-seal seal-${id}`;
    this.seal.replaceChildren(this.portrait(id));
    this.onOpenFigure?.(id);
    this.refreshHeader();
    this.el.className = `dialog dlg-${id}`;
    this.el.hidden = false;
    document.body.classList.add('dialog-open');

    const greet = this.profile.greetings[Math.floor(Math.random() * this.profile.greetings.length)]!;
    void this.bubbles.say(fig, greet, 1400);
    this.activeCat = this.firstAvailableCat();
    this.renderMenu(true);
    this.onChange?.();
  }

  close(): void {
    if (!this.current) return;
    this.cancelAnswer();
    this.bubbles.dismissAll();
    for (const f of Object.values(this.figures)) f.selected = false;
    this.current = null;
    this.el.hidden = true;
    document.body.classList.remove('dialog-open');
    bus.emit('ui:close');
    this.onChange?.();
  }

  /** Blendet das Freitext-Feld ein, sobald der Server den Chat anbietet. */
  async enableChat(): Promise<void> {
    const a = await chatAvailability();
    this.chatOn = a.enabled;
    this.chatMax = a.maxChars;
    if (this.chatOn && this.current && this.body.querySelector('.tabpanel')) this.renderMenu();
  }

  private chatForm(): HTMLElement | null {
    if (!this.chatOn) return null;
    const input = h('input', {
      class: 'chat-input',
      type: 'text',
      maxlength: String(this.chatMax),
      placeholder: 'Eigene Frage …',
      'aria-label': `Eigene Frage an ${this.profile.nameDe}`,
      autocomplete: 'off',
    }) as HTMLInputElement;
    const send = h('button', { class: 'btn primary', type: 'submit' }, 'Fragen');
    const form = h(
      'form',
      {
        class: 'chat',
        onsubmit: (e: Event) => {
          e.preventDefault();
          const text = input.value.trim();
          if (text) void this.askFree(text);
        },
      },
      h('div', { class: 'chat-row' }, input, send),
      h(
        'small',
        { class: 'chat-note' },
        'Freie Frage (KI): Dein Text wird an unseren Server und die Claude-API gesendet. Bitte nichts Persönliches eingeben. Antworten sind frei formuliert, keine echten Zitate.',
      ),
    );
    return form;
  }

  private async askFree(text: string): Promise<void> {
    const fig = this.current;
    if (!fig) return;
    bus.emit('ui:click');
    const mine = ++this.token;
    this.bubbles.dismissAll();
    this.wordCard.hide();
    const textEl = h('p', { class: 'ans-text', 'aria-live': 'polite' }, '…');
    const actions = h('div', { class: 'ans-actions' });
    const nextBtn = h(
      'button',
      { class: 'btn primary', type: 'button', onclick: () => this.renderMenu() },
      'Weitere Fragen',
    );
    clear(this.body);
    this.body.append(
      h(
        'div',
        { class: 'ans-q' },
        h('span', { class: 'ans-quote' }, '„'),
        text,
        h('span', { class: 'ans-quote' }, '“'),
      ),
      textEl,
      actions,
    );
    fig.react('think');
    const res = await askChat(fig.style.id, text, this.chatHistory);
    if (mine !== this.token) return;
    const answer = res.ok ? res.answer : CHAT_MESSAGES[res.reason]!;
    if (res.ok) {
      this.chatHistory.push({ role: 'user', content: text }, { role: 'assistant', content: res.answer });
      this.chatHistory = this.chatHistory.slice(-6);
    }
    fig.speaking = true;
    bus.emit('voice:start', { who: fig.style.id });
    this.typer = new Typer(textEl, answer, {
      speed: 30,
      instant: prefersReducedMotion() || store.settings.calm,
      onBlip: (ch) => {
        fig.pulse(1);
        bus.emit('voice:blip', { who: fig.style.id, ch });
      },
      onDone: () => {
        fig.speaking = false;
        bus.emit('voice:end', { who: fig.style.id });
        if (mine !== this.token) return;
        if (res.ok) {
          actions.append(h('span', { class: 'ai-tag' }, 'KI-generiert · fiktiv, kein echtes Zitat'));
          if (res.word) {
            const w = { id: 'ai', zh: res.word.zh, py: res.word.py, de: res.word.de };
            window.setTimeout(() => mine === this.token && this.wordCard.show(w, false, 'KI-Vorschlag'), 250);
          }
        }
        actions.append(nextBtn);
        nextBtn.focus({ preventScroll: true });
      },
    });
    this.typer.start();
  }

  /** Porträt-Ausschnitt aus dem Foto; ohne Foto das Schriftzeichen als Siegel */
  private portrait(id: FigureId): HTMLElement {
    const fig = this.figures[id];
    if (!fig.photo) return h('span', { lang: 'zh' }, this.profile.zh[0] ?? '');
    const img = h('img', { src: `avatars/${id}-portrait.webp`, alt: '', width: 64, height: 64 });
    img.addEventListener('error', () => img.replaceWith(h('span', { lang: 'zh' }, this.profile.zh[0] ?? '')));
    return img;
  }

  private switchFigure(): void {
    if (!this.current) return;
    this.open(this.current.style.id === 'jackie' ? 'yao' : 'jackie');
  }

  private cancelAnswer(): void {
    this.token++;
    this.typer?.cancel();
    this.typer = null;
    if (this.current) this.current.speaking = false;
    this.wordCard.hide();
  }

  // ───────────────────────────────────────── Menü
  private isUnlocked(q: Question): boolean {
    return !q.needs || store.hasAsked(q.needs);
  }

  private firstAvailableCat(): Category['id'] {
    const qs = this.profile.questions;
    const open = qs.find((q) => this.isUnlocked(q) && !store.hasAsked(q.id));
    return open?.cat ?? qs[0]!.cat;
  }

  private refreshHeader(): void {
    if (!this.current) return;
    const done = this.profile.questions.filter((q) => store.hasAsked(q.id)).length;
    this.headerName.innerHTML = `<span lang="zh">${this.profile.zh}</span> <i>${pinyinHtml(this.profile.py)}</i> <span class="dlg-de">${this.profile.nameDe}</span>`;
    this.headerCount.textContent = `${done} von ${this.profile.questions.length} Fragen gestellt`;
  }

  private renderMenu(animate = false): void {
    this.cancelAnswer();
    const cats = CATEGORIES.filter((c) => this.profile.questions.some((q) => q.cat === c.id));
    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Themen' });
    for (const c of cats) {
      const qs = this.profile.questions.filter((q) => q.cat === c.id);
      const asked = qs.filter((q) => store.hasAsked(q.id)).length;
      const unlockedNew = qs.some((q) => this.isUnlocked(q) && !store.hasAsked(q.id));
      const tab = h(
        'button',
        {
          class: `tab${c.id === this.activeCat ? ' active' : ''}${unlockedNew ? ' has-new' : ''}`,
          type: 'button',
          role: 'tab',
          'aria-selected': c.id === this.activeCat,
          onclick: () => {
            bus.emit('ui:click');
            this.activeCat = c.id;
            this.renderMenu();
          },
        },
        h('span', { class: 'tab-zh', lang: 'zh' }, c.zh),
        h('span', { class: 'tab-de' }, c.de),
        h('span', { class: 'tab-n' }, `${asked}/${qs.length}`),
      );
      tabs.append(tab);
    }

    const list = h('ul', { class: 'qlist', role: 'list' });
    const catInfo = CATEGORIES.find((c) => c.id === this.activeCat)!;
    for (const q of this.profile.questions.filter((x) => x.cat === this.activeCat)) {
      const unlocked = this.isUnlocked(q);
      const asked = store.hasAsked(q.id);
      const need = q.needs ? ALL_QUESTIONS.find((x) => x.id === q.needs) : null;
      const btn = h(
        'button',
        {
          class: `q${asked ? ' asked' : ''}${unlocked ? '' : ' locked'}`,
          type: 'button',
          disabled: !unlocked,
          'aria-disabled': !unlocked,
          onclick: () => this.ask(q),
        },
        h('span', { class: 'q-ico', html: unlocked ? (asked ? CHECK : '') : LOCK }),
        h(
          'span',
          { class: 'q-text' },
          unlocked ? q.q : 'Noch verschlossen',
          unlocked ? null : h('small', {}, `Stelle zuerst: „${need?.q ?? '…'}“`),
        ),
      );
      list.append(h('li', {}, btn));
    }
    clear(this.body);
    this.body.append(
      tabs,
      h(
        'div',
        { class: `tabpanel${animate ? ' pop' : ''}`, role: 'tabpanel' },
        h(
          'h3',
          { class: 'cat-title' },
          h('span', { lang: 'zh' }, catInfo.zh),
          ' ',
          h('i', { html: pinyinHtml(catInfo.py) }),
          ' · ',
          catInfo.de,
        ),
        list,
        this.chatForm(),
      ),
    );
    this.refreshHeader();
  }

  // ───────────────────────────────────────── Antwort
  private ask(q: Question): void {
    const fig = this.current;
    if (!fig) return;
    bus.emit('ui:click');
    const mine = ++this.token;
    this.bubbles.dismissAll();
    this.wordCard.hide();
    const firstTime = store.markAsked(q.id);

    const textEl = h('p', { class: 'ans-text', 'aria-live': 'polite' });
    const skipBtn = h(
      'button',
      { class: 'btn ghost', type: 'button', onclick: () => this.typer?.skip() },
      'Überspringen',
    );
    const nextBtn = h(
      'button',
      { class: 'btn primary', type: 'button', onclick: () => this.renderMenu() },
      'Weitere Fragen',
    );
    const actions = h('div', { class: 'ans-actions' }, skipBtn);
    clear(this.body);
    this.body.append(
      h(
        'div',
        { class: 'ans-q' },
        h('span', { class: 'ans-quote' }, '„'),
        q.q,
        h('span', { class: 'ans-quote' }, '“'),
      ),
      textEl,
      actions,
    );

    fig.speaking = true;
    bus.emit('voice:start', { who: fig.style.id });
    if (q.mood) fig.react(q.mood === 'nod' ? 'nod' : q.mood === 'laugh' ? 'laugh' : 'think');
    const instant = prefersReducedMotion() || store.settings.calm;
    this.typer = new Typer(textEl, q.a, {
      speed: 30,
      instant,
      onBlip: (ch) => {
        fig.pulse(1);
        bus.emit('voice:blip', { who: fig.style.id, ch });
      },
      onDone: () => {
        fig.speaking = false;
        bus.emit('voice:end', { who: fig.style.id });
        if (mine !== this.token) return;
        actions.replaceChildren(nextBtn);
        nextBtn.focus({ preventScroll: true });
        // freigeschaltete Fragen ankündigen
        const unlocked = ALL_QUESTIONS.filter((x) => x.needs === q.id && !store.hasAsked(x.id));
        if (firstTime && unlocked.length) {
          bus.emit('ui:unlock');
          actions.prepend(
            h('span', { class: 'unlock' }, h('span', { html: UNLOCK }), ' Neue Frage freigeschaltet'),
          );
        }
        // Wort des Moments
        if (q.word) {
          const w = wordById(q.word);
          if (w) {
            const isNew = store.addWord(w.id);
            window.setTimeout(() => mine === this.token && this.wordCard.show(w, isNew), 250);
          }
        }
        // Zwischenruf der anderen Figur
        if (q.banter) {
          const other = this.figures[q.banter.by];
          const line = q.banter.text;
          window.setTimeout(() => {
            if (mine !== this.token) return;
            other.react(q.mood === 'laugh' ? 'laugh' : 'nod');
            void this.bubbles.say(other, line, 2200);
          }, 1300);
        }
        this.onChange?.();
      },
    });
    this.typer.start();
  }

  /** Von außen: Dialog-Leiste ein-/ausblenden (z. B. beim Finale) */
  setSuspended(on: boolean): void {
    document.body.classList.toggle('dialog-suspended', on);
    this.pick.hidden = on;
    if (on && this.current) this.close();
  }
}
