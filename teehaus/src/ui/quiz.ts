// Quiz (测验 cèyàn) mit Abzeichen (徽章 huīzhāng): Startseite mit Bestwert und Abzeichen, dann acht Fragen aus den
// gesammelten Wörtern und dem Gespräch mit Jackie und Yao, am Ende das Ergebnis.
// Tastatur: 1–3 wählt eine Antwort, Enter geht weiter.
import { QUIZ_PRAISE } from '../content/lines';
import { Modal } from './modal';
import { h } from './dom';
import { pinyinHtml } from '../content/pinyin';
import { buildQuiz, QUIZ_MIN_WORDS } from '../content/quizgen';
import type { QuizQuestion } from '../content/quizgen';
import { BADGES } from '../content/badges';
import { store } from '../state/store';
import { speakChinese, speechAvailable } from './speech';

export interface QuizHost {
  /** neues Abzeichen melden */
  badge: (id: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export class QuizPanel {
  private modal = new Modal('quiz', 'Quiz und Abzeichen', '测验');
  private qs: QuizQuestion[] = [];
  private i = 0;
  private score = 0;
  private picked: number | null = null;

  constructor(private host: QuizHost) {
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  get open(): boolean {
    return this.modal.isOpen;
  }

  show(): void {
    this.qs = [];
    this.renderStart();
    this.host.onOpen?.();
    this.modal.open(() => this.host.onClose?.());
  }

  private start(): void {
    this.qs = buildQuiz(store.words, store.asked);
    this.i = 0;
    this.score = 0;
    this.picked = null;
    this.renderQuestion();
  }

  private answer(k: number): void {
    const q = this.qs[this.i];
    if (!q || this.picked !== null) return;
    this.picked = k;
    if (k === q.correct) this.score++;
    this.renderQuestion();
  }

  private next(): void {
    if (this.picked === null) return;
    this.i++;
    this.picked = null;
    if (this.i < this.qs.length) this.renderQuestion();
    else this.finish();
  }

  private finish(): void {
    const n = this.qs.length;
    store.setQuizBest(this.score);
    const earned: string[] = [];
    if (store.addBadge('quiz-erstes')) earned.push('quiz-erstes');
    if (this.score === n && n >= 8 && store.addBadge('quiz-perfekt')) earned.push('quiz-perfekt');
    for (const id of earned) this.host.badge(id);
    this.qs = [];
    const msg = QUIZ_PRAISE.find(([f]) => this.score >= n * f)?.[1] ?? '';
    this.modal.setContent(
      h('p', { class: 'quiz-result' }, h('b', {}, `${this.score} von ${n} richtig`)),
      h('p', { class: 'quiz-msg', lang: 'zh' }, msg),
      earned.length
        ? h(
            'p',
            { class: 'quiz-new' },
            'Neues Abzeichen: ',
            earned.map((id) => this.badgeName(id)).join(', '),
          )
        : null,
      this.badgeList(),
      h(
        'div',
        { class: 'order-actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => this.modal.close() }, 'Fertig'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => this.start() }, 'Noch eine Runde'),
      ),
    );
  }

  private badgeName(id: string): string {
    const b = BADGES.find((x) => x.id === id);
    return b ? `${b.zh} ${b.de}` : id;
  }

  private badgeList(): HTMLElement {
    const have = new Set(store.progress.quiz.badges);
    return h(
      'ul',
      { class: 'badge-list', 'aria-label': 'Abzeichen' },
      ...BADGES.map((b) =>
        h(
          'li',
          { class: `badge${have.has(b.id) ? ' got' : ''}`, title: b.how },
          h('span', { class: 'badge-zh', lang: 'zh' }, b.zh),
          h('span', { class: 'badge-de' }, b.de),
          h('span', { class: 'badge-how' }, have.has(b.id) ? 'erreicht' : b.how),
        ),
      ),
    );
  }

  private renderStart(): void {
    const words = store.words.size;
    const can = words >= QUIZ_MIN_WORDS;
    this.modal.setContent(
      h(
        'p',
        {},
        can
          ? 'Acht Fragen zu deinen gesammelten Wörtern und zu dem, was Jackie und Yao erzählt haben.'
          : `Sammle erst ${QUIZ_MIN_WORDS} Wörter (du hast ${words}). Sprich mit den Gästen, bestell Tee oder schau dich im Dorf um.`,
      ),
      store.quizBest > 0
        ? h('p', { class: 'dict-note' }, `Bisher bestes Ergebnis: ${store.quizBest} richtig`)
        : null,
      h('h3', {}, h('span', { lang: 'zh' }, '徽章'), ' Abzeichen'),
      this.badgeList(),
      h(
        'div',
        { class: 'order-actions' },
        h(
          'button',
          { class: 'btn primary', type: 'button', disabled: !can, onclick: () => this.start() },
          'Quiz starten',
        ),
      ),
    );
  }

  private renderQuestion(): void {
    const q = this.qs[this.i];
    if (!q) return;
    const done = this.picked !== null;
    this.modal.setContent(
      h(
        'div',
        { class: 'quiz-progress', 'aria-label': `Frage ${this.i + 1} von ${this.qs.length}` },
        ...this.qs.map((_, k) => h('span', { class: k < this.i ? 'past' : k === this.i ? 'now' : '' })),
      ),
      h('p', { class: 'quiz-q' }, q.prompt),
      q.zh
        ? h(
            'div',
            { class: 'quiz-word' },
            h('span', { class: 'quiz-zh', lang: 'zh' }, q.zh),
            h('span', { class: 'quiz-py', html: pinyinHtml(q.py ?? '') }),
            h(
              'button',
              {
                class: 'dict-speak',
                type: 'button',
                'aria-label': 'Anhören',
                disabled: !speechAvailable(),
                onclick: () => speakChinese(q.zh!),
              },
              '♪',
            ),
          )
        : null,
      h(
        'ol',
        { class: 'quiz-options' },
        ...q.options.map((o, k) =>
          h(
            'li',
            {},
            h(
              'button',
              {
                type: 'button',
                class: `quiz-opt${o.zh ? ' zh' : ''}${done && k === q.correct ? ' right' : ''}${
                  done && k === this.picked && k !== q.correct ? ' wrong' : ''
                }`,
                lang: o.zh ? 'zh' : undefined,
                disabled: done,
                onclick: () => this.answer(k),
              },
              h('span', { class: 'order-key', 'aria-hidden': 'true' }, String(k + 1)),
              o.label,
            ),
          ),
        ),
      ),
      done
        ? h(
            'p',
            { class: `quiz-explain ${this.picked === q.correct ? 'ok' : 'no'}`, role: 'status' },
            this.picked === q.correct ? '对！ Richtig. ' : '不对。 ',
            q.explain,
          )
        : null,
      h(
        'div',
        { class: 'order-actions' },
        h(
          'button',
          { class: 'btn primary', type: 'button', disabled: !done, onclick: () => this.next() },
          this.i + 1 < this.qs.length ? 'Weiter' : 'Ergebnis',
        ),
      ),
    );
    if (done) (this.modal.el.querySelector('.order-actions .btn.primary') as HTMLElement | null)?.focus();
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.open || !this.qs.length) return;
    if (/^[1-3]$/.test(e.key) && this.picked === null) this.answer(Number(e.key) - 1);
    else if (e.key === 'Enter' && this.picked !== null) this.next();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }
}
