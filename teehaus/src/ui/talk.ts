// Gespräch mit Jackie Chan oder Yao Ming: Charakterkarte, Fragen in Kategorien (fest vorgegeben), Antworten als
// Sprechblase über der Figur, Zwischenrufe, „Wort des Moment“, „Etwas anderes fragen“.
import type { FigureId, FigureProfile, Question } from '../content/types';
import { CARDS, DISCLAIMER, FALLBACK, JACKIE, YAO } from '../content/dialogs';
import { CATEGORIES } from '../content/categories';
import { pinyinHtml } from '../content/pinyin';
import { wordById } from '../content/words';
import { bus } from '../core/bus';
import { store } from '../state/store';
import { clear, h } from './dom';

const PROFILES: Record<FigureId, FigureProfile> = { jackie: JACKIE, yao: YAO };
const ALL = [...JACKIE.questions, ...YAO.questions];

const LOCK = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-9h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6z" fill="currentColor"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z" fill="currentColor"/></svg>`;

/** Was das Gesprächsfenster von außen braucht */
export interface TalkHost {
  /** Antwort als Sprechblase über der Figur; löst auf, wenn fertig getippt */
  answer: (id: FigureId, text: string) => Promise<void>;
  /** Zwischenruf der anderen Figur */
  banter: (by: FigureId, text: string) => void;
  /** Geste zur Stimmung der Antwort */
  gesture: (id: FigureId, mood: Question['mood'] | 'shrug' | 'hello') => void;
  /** Tippen sofort beenden */
  skip: (id: FigureId) => void;
  award: (wordId: string) => void;
  onClose: () => void;
  /** Wechsel zur anderen Figur möglich? (Yao muss im Haus sein) */
  canSwitch: (to: FigureId) => boolean;
  onSwitch: (to: FigureId) => void;
}

export class TalkPanel {
  readonly el: HTMLElement;
  private head: HTMLElement;
  private card: HTMLElement;
  private body: HTMLElement;
  private progress: HTMLElement;
  private switchBtn: HTMLButtonElement;
  private id: FigureId = 'jackie';
  private cat = CATEGORIES[0]!.id;
  private answering = false;
  private token = 0;
  open = false;

  constructor(private host: TalkHost) {
    this.head = h('div', { class: 'dlg3-name' });
    this.progress = h('div', { class: 'dlg3-progress', 'aria-live': 'polite' });
    this.switchBtn = h('button', {
      class: 'btn ghost small',
      type: 'button',
      onclick: () => this.switchTo(),
    });
    this.card = h('aside', { class: 'dlg3-card', 'aria-label': 'Charakterkarte' });
    this.body = h('div', { class: 'dlg3-body' });
    this.el = h(
      'section',
      { class: 'dlg3', role: 'dialog', 'aria-label': 'Gespräch', hidden: true },
      h(
        'header',
        { class: 'dlg3-head' },
        h('div', { class: 'dlg3-who' }, this.head, this.progress),
        h(
          'div',
          { class: 'dlg3-tools' },
          this.switchBtn,
          h(
            'button',
            { class: 'btn ghost small', type: 'button', onclick: () => this.other() },
            'Etwas anderes fragen',
          ),
          h(
            'button',
            {
              class: 'dlg3-close',
              type: 'button',
              'aria-label': 'Gespräch beenden (Esc)',
              onclick: () => this.close(),
            },
            '×',
          ),
        ),
      ),
      h('div', { class: 'dlg3-main' }, this.card, this.body),
    );
    document.body.appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
      if (e.key === ' ' && this.answering) {
        e.preventDefault();
        this.host.skip(this.id);
      }
    });
  }

  get who(): FigureId {
    return this.id;
  }

  show(id: FigureId): void {
    this.id = id;
    this.open = true;
    this.el.hidden = false;
    this.el.className = `dlg3 dlg3-${id}`;
    document.body.classList.add('dialog-open');
    bus.emit('ui:open');
    this.renderHead();
    this.renderCard();
    this.cat = this.firstOpenCat();
    if (!store.settings.disclaimerSeen) this.renderDisclaimer();
    else this.renderMenu();
  }

  close(): void {
    if (!this.open) return;
    this.token++;
    this.open = false;
    this.answering = false;
    this.el.hidden = true;
    document.body.classList.remove('dialog-open');
    bus.emit('ui:close');
    this.host.onClose();
  }

  private get profile(): FigureProfile {
    return PROFILES[this.id];
  }

  private isUnlocked(q: Question): boolean {
    return !q.needs || store.hasAsked(q.needs);
  }

  private firstOpenCat(): Question['cat'] {
    const q = this.profile.questions.find((x) => this.isUnlocked(x) && !store.hasAsked(x.id));
    return q?.cat ?? this.profile.questions[0]!.cat;
  }

  private renderHead(): void {
    const p = this.profile;
    this.head.innerHTML = `<span lang="zh">${p.zh}</span> <i>${pinyinHtml(p.py)}</i> <span class="dlg3-de">${p.nameDe}</span>`;
    const asked = p.questions.filter((q) => store.hasAsked(q.id)).length;
    this.progress.textContent = `Fragen entdeckt: ${asked}/${p.questions.length}`;
    const other: FigureId = this.id === 'jackie' ? 'yao' : 'jackie';
    this.switchBtn.textContent = `Mit ${PROFILES[other].nameDe.split(' ')[0]} sprechen`;
    this.switchBtn.hidden = !this.host.canSwitch(other);
  }

  private renderCard(): void {
    const p = this.profile;
    clear(this.card);
    this.card.append(
      h('div', { class: 'card-seal', lang: 'zh' }, p.zh),
      h('div', { class: 'card-py', html: pinyinHtml(p.py) }),
      h('div', { class: 'card-name' }, p.nameDe),
      h(
        'dl',
        { class: 'card-fields' },
        ...CARDS[this.id].flatMap((f) => [h('dt', {}, f.label), h('dd', {}, f.value)]),
      ),
      h(
        'p',
        { class: 'card-parts' },
        ...p.parts.map(([zh, de]) => h('span', {}, h('b', { lang: 'zh' }, zh), ` ${de}`)),
      ),
    );
  }

  private renderDisclaimer(): void {
    clear(this.body);
    const ok = h(
      'button',
      {
        class: 'btn primary',
        type: 'button',
        onclick: () => {
          store.setSettings({ disclaimerSeen: true });
          this.renderMenu(true);
        },
      },
      'Verstanden',
    );
    this.body.append(
      h('div', { class: 'notice-box', role: 'note' }, h('b', {}, 'Bevor es losgeht: '), DISCLAIMER),
      h(
        'p',
        { class: 'dlg3-hint' },
        'Wähle Fragen aus der Liste. Die Figuren antworten in Sprechblasen über ihren Köpfen.',
      ),
      h('div', { class: 'dlg3-actions' }, ok),
    );
    ok.focus({ preventScroll: true });
  }

  private renderMenu(animate = false): void {
    this.answering = false;
    this.renderHead();
    const p = this.profile;
    const cats = CATEGORIES.filter((c) => p.questions.some((q) => q.cat === c.id));
    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Themen' });
    for (const c of cats) {
      const qs = p.questions.filter((q) => q.cat === c.id);
      const asked = qs.filter((q) => store.hasAsked(q.id)).length;
      const fresh = qs.some((q) => this.isUnlocked(q) && !store.hasAsked(q.id));
      tabs.append(
        h(
          'button',
          {
            class: `tab${c.id === this.cat ? ' active' : ''}${fresh ? ' has-new' : ''}`,
            type: 'button',
            role: 'tab',
            'aria-selected': c.id === this.cat,
            onclick: () => {
              bus.emit('ui:click');
              this.cat = c.id;
              this.renderMenu();
              (this.body.querySelector('.tab.active') as HTMLElement | null)?.focus({ preventScroll: true });
            },
          },
          h('span', { class: 'tab-zh', lang: 'zh' }, c.zh),
          h('span', { class: 'tab-de' }, c.de),
          h('span', { class: 'tab-n' }, `${asked}/${qs.length}`),
        ),
      );
    }
    const list = h('ul', { class: 'qlist', role: 'list' });
    for (const q of p.questions.filter((x) => x.cat === this.cat)) {
      const unlocked = this.isUnlocked(q);
      const asked = store.hasAsked(q.id);
      const need = q.needs ? ALL.find((x) => x.id === q.needs) : null;
      list.append(
        h(
          'li',
          {},
          h(
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
              asked && unlocked ? h('small', {}, 'schon gefragt – nochmal hören') : null,
            ),
          ),
        ),
      );
    }
    clear(this.body);
    this.body.append(tabs, h('div', { class: `tabpanel${animate ? ' pop' : ''}`, role: 'tabpanel' }, list));
    if (animate)
      (list.querySelector('.q:not([disabled])') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  private ask(q: Question): void {
    bus.emit('ui:click');
    const mine = ++this.token;
    this.answering = true;
    const first = store.markAsked(q.id);
    const skip = h(
      'button',
      { class: 'btn ghost', type: 'button', onclick: () => this.host.skip(this.id) },
      'Überspringen',
    );
    const actions = h('div', { class: 'dlg3-actions' }, skip);
    clear(this.body);
    this.body.append(
      h(
        'p',
        { class: 'ans-q' },
        h('span', { class: 'ans-quote' }, '„'),
        q.q,
        h('span', { class: 'ans-quote' }, '“'),
      ),
      h(
        'p',
        { class: 'dlg3-hint', 'aria-live': 'polite' },
        `${this.profile.nameDe.split(' ')[0]} antwortet in der Sprechblase …`,
      ),
      actions,
    );
    this.renderHead();
    this.host.gesture(this.id, q.mood);
    void this.host.answer(this.id, q.a).then(() => {
      if (mine !== this.token) return;
      this.answering = false;
      const more = h(
        'button',
        { class: 'btn primary', type: 'button', onclick: () => this.renderMenu(true) },
        'Weitere Fragen',
      );
      actions.replaceChildren(more);
      const unlocked = ALL.filter((x) => x.needs === q.id && !store.hasAsked(x.id));
      if (first && unlocked.length) {
        bus.emit('ui:unlock');
        actions.prepend(h('span', { class: 'unlock', html: `${CHECK} Neue Frage freigeschaltet` }));
      }
      (this.body.querySelector('.dlg3-hint') as HTMLElement).textContent = 'Antwort fertig.';
      more.focus({ preventScroll: true });
      if (q.word && wordById(q.word))
        window.setTimeout(() => mine === this.token && this.host.award(q.word!), 300);
      if (q.banter) {
        const b = q.banter;
        window.setTimeout(() => mine === this.token && this.host.banter(b.by, b.text), 1200);
      }
    });
  }

  /** „Etwas anderes fragen“ */
  private other(): void {
    if (this.answering) return;
    bus.emit('ui:click');
    this.host.gesture(this.id, 'shrug');
    void this.host.answer(this.id, FALLBACK);
  }

  private switchTo(): void {
    const other: FigureId = this.id === 'jackie' ? 'yao' : 'jackie';
    if (!this.host.canSwitch(other)) return;
    this.token++;
    this.host.onSwitch(other);
  }
}
