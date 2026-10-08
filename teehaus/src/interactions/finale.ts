// Das Finale: kleines Quiz (5 Fragen) → gemeinsamer Toast mit Tee (干杯 gānbēi) → Ergebnis-Karte.
import type { Game } from '../game';
import { QUIZ } from '../content/quiz';
import type { QuizItem } from '../content/types';
import { LINES } from '../content/extras';
import { WORDS, wordById } from '../content/words';
import { JACKIE } from '../content/jackie';
import { YAO } from '../content/yao';
import { pinyinHtml } from '../content/pinyin';
import { bus } from '../core/bus';
import { store } from '../state/store';
import { h, prefersReducedMotion } from '../ui/dom';
import { EGGS } from '../content/extras';

const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

interface Rank {
  zh: string;
  py: string;
  de: string;
  text: string;
}

const rankFor = (score: number): Rank => {
  if (score >= 5)
    return {
      zh: '茶师',
      py: 'cha2shi1',
      de: 'Teemeister',
      text: 'Makellos! Du kennst dich im Teehaus bestens aus.',
    };
  if (score >= 4)
    return { zh: '茶友', py: 'cha2you3', de: 'Teefreund', text: 'Sehr gut! Du hast gut zugehört.' };
  if (score >= 2)
    return {
      zh: '茶客',
      py: 'cha2ke4',
      de: 'Teegast',
      text: 'Schön gemacht! Beim nächsten Besuch klappt es noch besser.',
    };
  return {
    zh: '茶童',
    py: 'cha2tong2',
    de: 'Teelehrling',
    text: 'Jeder fängt klein an. Frag uns noch ein bisschen aus und versuch es noch einmal!',
  };
};

const shuffle = <T>(a: T[]): T[] => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
};

/** Fragen bevorzugen, deren Thema der Gast schon angesprochen hat. */
function pickQuiz(n: number): QuizItem[] {
  const scored = QUIZ.map((q) => ({
    q,
    s: (q.related?.some((r) => store.hasAsked(r)) ? 1 : 0) + Math.random() * 0.95,
  }));
  return scored
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.q);
}

export class Finale {
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(private game: Game) {}

  async start(): Promise<void> {
    const g = this.game;
    const { stage } = g;
    if (g.finaleActive) return;
    g.finaleActive = true;
    g.dialog.close();
    g.bubbles.dismissAll();
    g.wordCard.hide();
    document.body.classList.add('is-finale');
    stage.goTo('table');
    const { jackie } = stage.cast;
    jackie.react('hello');
    await g.bubbles.say(jackie, 'Zeit für den Höhepunkt! Erst ein kleines Quiz, dann stoßen wir an.', 900);
    const score = await this.quiz();
    await this.cheers(score);
  }

  // ───────────────────────────────────────── Quiz
  private quiz(): Promise<number> {
    const g = this.game;
    const { jackie, yao } = g.stage.cast;
    const items = pickQuiz(5);
    let score = 0;
    let i = 0;
    const box = h('section', { class: 'quiz', role: 'dialog', 'aria-label': 'Mini-Quiz' });
    document.body.appendChild(box);

    return new Promise((resolve) => {
      const showQuestion = (): void => {
        const item = items[i]!;
        const order = shuffle(item.options.map((_, idx) => idx));
        const status = h('p', { class: 'quiz-status', 'aria-live': 'polite' });
        const nextBtn = h(
          'button',
          { class: 'btn primary', type: 'button', hidden: true },
          i === items.length - 1 ? 'Zum Anstoßen' : 'Weiter',
        );
        const buttons: HTMLButtonElement[] = [];
        let answered = false;
        const choose = (idx: number, btn: HTMLButtonElement): void => {
          if (answered) return;
          answered = true;
          const right = idx === item.correct;
          if (right) score++;
          bus.emit(right ? 'quiz:right' : 'quiz:wrong');
          for (const b of buttons) {
            b.disabled = true;
            if (Number(b.dataset.idx) === item.correct) b.classList.add('right');
          }
          if (!right) btn.classList.add('wrong');
          status.textContent = `${right ? 'Richtig! ' : 'Fast! '}${item.explain}`;
          status.classList.add('show');
          (right ? jackie : yao).react(right ? 'laugh' : 'think');
          nextBtn.hidden = false;
          nextBtn.focus({ preventScroll: true });
        };
        order.forEach((idx, pos) => {
          const b = h(
            'button',
            {
              class: 'quiz-opt',
              type: 'button',
              'data-idx': idx,
              'aria-keyshortcuts': String(pos + 1),
              onclick: () => choose(idx, b),
            },
            h('span', { class: 'quiz-key' }, String(pos + 1)),
            h('span', {}, item.options[idx]!),
          );
          buttons.push(b);
        });
        nextBtn.addEventListener('click', () => {
          bus.emit('ui:click');
          i++;
          if (i >= items.length) {
            this.dropKeys();
            box.remove();
            resolve(score);
          } else showQuestion();
        });
        const onKey = (e: KeyboardEvent): void => {
          if (e.key >= '1' && e.key <= '9') buttons[Number(e.key) - 1]?.click();
          if ((e.key === 'Enter' || e.key === ' ') && answered && !(e.target instanceof HTMLButtonElement))
            nextBtn.click();
        };
        window.removeEventListener(
          'keydown',
          (box as unknown as { _k?: (e: KeyboardEvent) => void })._k as never,
        );
        (box as unknown as { _k?: (e: KeyboardEvent) => void })._k = onKey;
        window.addEventListener('keydown', onKey);
        box.replaceChildren(
          h(
            'header',
            { class: 'quiz-head' },
            h(
              'span',
              { class: 'quiz-title' },
              h('span', { lang: 'zh' }, '小测验'),
              ' ',
              h('i', { html: pinyinHtml('xiao3 ce4yan4') }),
              ' · Mini-Quiz',
            ),
            h('span', { class: 'quiz-n' }, `${i + 1} / ${items.length}`),
          ),
          h('h2', { class: 'quiz-q' }, item.q),
          h('div', { class: 'quiz-opts' }, ...buttons),
          status,
          h('div', { class: 'ans-actions' }, nextBtn),
        );
        buttons[0]?.focus({ preventScroll: true });
      };
      showQuestion();
    });
  }

  // ───────────────────────────────────────── Anstoßen
  private async cheers(score: number): Promise<void> {
    const g = this.game;
    const { stage } = g;
    const { jackie, yao } = stage.cast;
    const house = stage.house;
    const calm = prefersReducedMotion() || store.settings.calm;
    store.setQuizBest(score);
    store.setToasted();

    await g.bubbles.say(yao, 'Dann gießen wir ein.', 600);
    bus.emit('scene:pour');
    stage.steam.burst(house.spout, 14);
    await wait(1400);

    // Tassen heben, Mitte zwischen den beiden
    stage.cheers(true);
    await wait(1700);

    bus.emit('scene:clink');
    await wait(260);
    bus.emit('scene:gong');
    bus.emit('scene:finale');
    document.body.classList.add('glow-flash');
    window.setTimeout(() => document.body.classList.remove('glow-flash'), 2400);
    stage.steam.burst(house.cups[0]!.position, 18);
    jackie.react('laugh');
    yao.react('laugh');
    if (!calm) {
      stage.petals.burst(120);
    }
    // Wort und große Schrift
    const word = wordById('ganbei');
    const banner = h(
      'div',
      { class: 'cheers-banner', 'aria-hidden': 'true' },
      h('span', { class: 'cb-zh', lang: 'zh' }, '干杯'),
      h('span', { class: 'cb-py', html: pinyinHtml('gan1bei1') }),
      h('span', { class: 'cb-de' }, 'Prost!'),
    );
    document.body.appendChild(banner);
    if (word) {
      const isNew = store.addWord(word.id);
      g.wordCard.show(word, isNew);
    }

    for (const line of LINES.toast) {
      const fig = stage.cast[line.by];
      await g.bubbles.say(fig, line.text, 1100);
    }
    await wait(900);
    banner.classList.add('out');
    window.setTimeout(() => banner.remove(), 900);
    this.showResult(score);
  }

  // ───────────────────────────────────────── Ergebnis
  private showResult(score: number): void {
    const g = this.game;
    const rank = rankFor(score);
    store.addWord('xiexie');
    const totalQ = JACKIE.questions.length + YAO.questions.length;
    const share = (): void => {
      const url = location.origin + location.pathname;
      const text = `Ich war im Teehaus 茶馆 bei Jackie Chan und Yao Ming (fiktives Gespräch) und habe ${score} von 5 im Quiz geschafft: ${rank.zh} ${rank.de}.`;
      if (navigator.share) {
        void navigator.share({ title: 'Das Teehaus', text, url }).catch(() => undefined);
      } else {
        void navigator.clipboard
          ?.writeText(`${text} ${url}`)
          .then(() => g.toast.show('Link kopiert. Viel Spaß beim Teilen!'));
      }
    };
    const leaves = Array.from({ length: 5 }, (_, k) =>
      h('span', { class: `leaf${k < score ? ' on' : ''}`, 'aria-hidden': 'true' }, '叶'),
    );
    const card = h(
      'section',
      { class: 'result', role: 'dialog', 'aria-label': 'Ergebnis' },
      h('div', { class: 'result-seal', lang: 'zh' }, rank.zh),
      h('h2', {}, h('i', { html: pinyinHtml(rank.py) }), ' · ', rank.de),
      h('div', { class: 'leaves' }, ...leaves),
      h('p', { class: 'result-score' }, `${score} von 5 Fragen richtig`),
      h('p', {}, rank.text),
      h(
        'ul',
        { class: 'result-stats' },
        h('li', {}, h('b', {}, `${store.words.size} / ${WORDS.length}`), ' Wörter'),
        h('li', {}, h('b', {}, `${store.asked.size} / ${totalQ}`), ' Fragen'),
        h('li', {}, h('b', {}, `${store.eggs.size} / ${EGGS.length}`), ' Verstecke'),
      ),
      h(
        'p',
        { class: 'result-thanks' },
        h('span', { lang: 'zh' }, '谢谢'),
        ' ',
        h('i', { html: pinyinHtml('xie4xie5') }),
        ' fürs Vorbeikommen!',
      ),
      h(
        'div',
        { class: 'ans-actions result-actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: share }, 'Teilen'),
        h(
          'button',
          {
            class: 'btn ghost',
            type: 'button',
            onclick: () => {
              card.remove();
              this.end();
              void this.start();
            },
          },
          'Quiz nochmal',
        ),
        h(
          'button',
          {
            class: 'btn primary',
            type: 'button',
            onclick: () => {
              card.remove();
              this.end();
            },
          },
          'Zurück ins Teehaus',
        ),
      ),
    );
    document.body.appendChild(card);
    (card.querySelector('.btn.primary') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  private dropKeys(): void {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
  }

  private end(): void {
    const g = this.game;
    g.stage.cheers(false);
    document.body.classList.remove('is-finale');
    g.finaleActive = false;
    g.refresh();
  }
}
