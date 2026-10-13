// Kurzes Tutorial beim ersten Spiel: Gehen, Kamera, Ansprechen, Hinsetzen. Jede Einblendung erledigt sich, sobald
// man es getan hat (oder mit „Weiter“), „Überspringen“ beendet alles. Der Stand wird gespeichert.
import { h } from './dom';
import { store } from '../state/store';
import { keyLabel } from '../state/savefile';

export interface TutorialHost {
  /** Position der Spielfigur */
  player: () => { x: number; z: number; seated: boolean };
  /** Touch-Steuerung aktiv? */
  touch: () => boolean;
}

interface Step {
  id: string;
  title: string;
  text: () => string;
}

const STEPS: Step[] = [
  {
    id: 'move',
    title: 'Gehen',
    text: () => {
      const k = store.settings.keys;
      return document.body.classList.contains('touch')
        ? 'Zieh den Joystick links unten. Weit ziehen heißt laufen. Oder tippe auf den Boden.'
        : `Geh mit ${keyLabel(k.forward)} ${keyLabel(k.left)} ${keyLabel(k.back)} ${keyLabel(k.right)} oder den Pfeiltasten. ${keyLabel(k.run)} halten zum Laufen. Ein Klick auf den Boden geht auch.`;
    },
  },
  {
    id: 'look',
    title: 'Umsehen',
    text: () =>
      document.body.classList.contains('touch')
        ? 'Wisch über das Bild, um die Kamera zu drehen. Zwei Finger zoomen.'
        : 'Zieh mit der Maus, um die Kamera zu drehen. Das Mausrad zoomt.',
  },
  {
    id: 'talk',
    title: 'Ansprechen',
    text: () =>
      document.body.classList.contains('touch')
        ? 'Geh zu einer Figur, zum Beispiel zum Teemeister an der Theke. Tipp auf den Knopf, der unten erscheint.'
        : `Geh zu einer Figur, zum Beispiel zum Teemeister an der Theke. Wenn unten ein Hinweis erscheint, drück ${keyLabel(store.settings.keys.use)}.`,
  },
  {
    id: 'sit',
    title: 'Hinsetzen',
    text: () =>
      'Geh an einen freien Hocker und wähle „Hinsetzen“. Zum Aufstehen einfach loslaufen. Jackie und Yao sitzen hinten rechts am großen Tisch.',
  },
];

export class Tutorial {
  private el: HTMLElement;
  private titleEl: HTMLElement;
  private textEl: HTMLElement;
  private countEl: HTMLElement;
  private idx = -1;
  private start = { x: 0, z: 0 };
  private look = 0;
  private timer = 0;

  constructor(private host: TutorialHost) {
    this.titleEl = h('b', {});
    this.textEl = h('p', {});
    this.countEl = h('span', { class: 'tut-count' });
    this.el = h(
      'aside',
      { class: 'tutorial', hidden: true, role: 'status', 'aria-live': 'polite' },
      h('div', { class: 'tut-head' }, this.countEl, this.titleEl),
      this.textEl,
      h(
        'div',
        { class: 'tut-actions' },
        h(
          'button',
          { class: 'btn ghost small', type: 'button', onclick: () => this.finish() },
          'Tutorial überspringen',
        ),
        h('button', { class: 'btn small', type: 'button', onclick: () => this.next() }, 'Weiter'),
      ),
    );
    document.body.appendChild(this.el);
  }

  get active(): boolean {
    return this.idx >= 0;
  }

  /** Beginnt (oder setzt fort), wenn noch nicht erledigt; force = neu von vorn */
  begin(force = false): void {
    if (force) store.setTutorialDone(false);
    if (store.progress.tutorial.done) return;
    const done = new Set(store.progress.tutorial.steps);
    const first = STEPS.findIndex((s) => !done.has(s.id));
    if (first < 0) {
      this.finish();
      return;
    }
    this.show(first);
  }

  private show(i: number): void {
    this.idx = i;
    const s = STEPS[i]!;
    const p = this.host.player();
    this.start = { x: p.x, z: p.z };
    this.look = 0;
    this.timer = 0;
    this.countEl.textContent = `${i + 1}/${STEPS.length}`;
    this.titleEl.textContent = s.title;
    this.textEl.textContent = s.text();
    this.el.hidden = false;
    this.el.classList.remove('done');
  }

  private next(): void {
    if (this.idx < 0) return;
    store.tutorialStep(STEPS[this.idx]!.id);
    if (this.idx + 1 >= STEPS.length) this.finish();
    else this.show(this.idx + 1);
  }

  finish(): void {
    store.setTutorialDone(true);
    this.idx = -1;
    this.el.hidden = true;
  }

  /** Kameradrehung (Pixel) melden */
  looked(px: number): void {
    this.look += Math.abs(px);
  }

  /** Eine Interaktion wurde benutzt */
  used(id: string): void {
    const s = STEPS[this.idx];
    if (!this.pending && s?.id === 'talk' && !id.startsWith('sit-') && id !== 'stand') this.complete();
  }

  private complete(): void {
    if (this.pending) return;
    this.pending = true;
    this.el.classList.add('done');
    const i = this.idx;
    window.setTimeout(() => {
      this.pending = false;
      if (this.idx === i) this.next();
    }, 700);
  }
  private pending = false;

  /** Pro Bild */
  update(dt: number): void {
    if (this.idx < 0 || this.pending) return;
    const s = STEPS[this.idx]!;
    this.timer += dt;
    const p = this.host.player();
    if (s.id === 'move' && Math.hypot(p.x - this.start.x, p.z - this.start.z) > 1.5) this.complete();
    else if (s.id === 'look' && (this.look > 160 || this.timer > 14)) this.complete();
    else if (s.id === 'sit' && p.seated) this.complete();
  }
}
