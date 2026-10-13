// Einstellungen (设置 shèzhì): Ton, Grafik, Steuerung mit Tastenbelegung, Darstellung (Pinyin, Schriftgröße,
// Kontrast, weniger Bewegung), Untertitel. Jede Änderung gilt sofort und wird gespeichert.
// Zurücksetzen der Einstellungen und des Fortschritts jeweils mit Sicherheitsabfrage.
import { store } from '../state/store';
import { ACTIONS, keyLabel, rebind, RESERVED } from '../state/savefile';
import type { Action } from '../state/savefile';
import { h } from './dom';
import { Modal } from './modal';
import { confirmView } from './menu';

export interface SettingsHost {
  /** nach jeder Änderung (Ton, Grafik, Darstellung anwenden) */
  apply: () => void;
  /** Fortschritt wurde gelöscht */
  onProgressReset: () => void;
}

const row = (label: string, control: HTMLElement, hint?: string): HTMLElement =>
  h(
    'div',
    { class: 'set-row' },
    h(
      'label',
      { class: 'set-label', for: control.id || undefined },
      label,
      hint ? h('small', {}, hint) : null,
    ),
    control,
  );

export class SettingsPage {
  readonly modal = new Modal('settings', 'Einstellungen', '设置');
  private waiting: { action: Action; btn: HTMLButtonElement } | null = null;

  constructor(private host: SettingsHost) {
    // Tastendruck für die Neubelegung abfangen, bevor das Spiel ihn sieht
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.waiting) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const { action } = this.waiting;
        this.waiting = null;
        if (e.code !== 'Escape' && !RESERVED.has(e.code)) {
          store.setSettings({ keys: rebind(store.settings.keys, action, e.code) });
          this.host.apply();
        }
        this.render();
      },
      true,
    );
  }

  open(): void {
    this.render();
    this.modal.open(() => (this.waiting = null));
  }

  private set<K extends keyof typeof store.settings>(k: K, v: (typeof store.settings)[K]): void {
    store.setSettings({ [k]: v } as Partial<typeof store.settings>);
    this.host.apply();
  }

  private slider(
    id: string,
    k: 'music' | 'voices' | 'sfx' | 'camSpeed',
    min: number,
    max: number,
    step: number,
  ) {
    const el = h('input', { type: 'range', id, min: String(min), max: String(max), step: String(step) });
    el.value = String(store.settings[k]);
    el.addEventListener('input', () => this.set(k, Number(el.value)));
    return el;
  }

  private toggle(id: string, k: 'muted' | 'calm' | 'pinyin' | 'contrast' | 'captions'): HTMLInputElement {
    const el = h('input', { type: 'checkbox', id, class: 'set-check', role: 'switch' });
    el.checked = store.settings[k];
    el.addEventListener('change', () => this.set(k, el.checked));
    return el;
  }

  private select<T extends string | number>(
    id: string,
    options: [T, string][],
    value: T,
    onChange: (v: T) => void,
  ): HTMLSelectElement {
    const el = h('select', { id, class: 'select' });
    for (const [v, label] of options) {
      const o = h('option', { value: String(v) }, label);
      o.selected = v === value;
      el.append(o);
    }
    el.addEventListener('change', () => onChange(options.find(([v]) => String(v) === el.value)![0]));
    return el;
  }

  render(): void {
    const s = store.settings;
    const keys = h(
      'div',
      { class: 'keymap', role: 'table', 'aria-label': 'Tastenbelegung' },
      ...ACTIONS.map((a) => {
        const btn = h(
          'button',
          { class: 'key-btn', type: 'button', 'aria-label': `${a.label}: ${keyLabel(s.keys[a.id])}, ändern` },
          keyLabel(s.keys[a.id]),
        );
        btn.addEventListener('click', () => {
          this.waiting = { action: a.id, btn };
          btn.textContent = 'Taste drücken …';
          btn.classList.add('waiting');
        });
        return h('div', { class: 'key-row', role: 'row' }, h('span', { role: 'cell' }, a.label), btn);
      }),
    );
    const sections = h(
      'div',
      { class: 'settings' },
      h('h3', {}, h('span', { lang: 'zh' }, '声音'), ' Ton'),
      row('Ton aus', this.toggle('set-muted', 'muted')),
      row('Musik', this.slider('set-music', 'music', 0, 1, 0.05)),
      row('Stimmen', this.slider('set-voices', 'voices', 0, 1, 0.05)),
      row('Effekte', this.slider('set-sfx', 'sfx', 0, 1, 0.05)),
      row(
        'Untertitel fürs Gemurmel',
        this.toggle('set-captions', 'captions'),
        'zeigt unten, wer gerade leise spricht',
      ),

      h('h3', {}, h('span', { lang: 'zh' }, '画面'), ' Grafik'),
      row(
        'Grafikqualität',
        this.select<'auto' | 0 | 1 | 2>(
          'set-quality',
          [
            ['auto', 'Automatisch'],
            [2, 'Hoch'],
            [1, 'Mittel'],
            [0, 'Niedrig'],
          ],
          s.quality,
          (v) => this.set('quality', v),
        ),
        'Automatisch passt sich der Bildrate an',
      ),
      row(
        'Weniger Bewegung',
        this.toggle('set-calm', 'calm'),
        'ruhigere Kamera, keine Unschärfe, weniger Blüten',
      ),

      h('h3', {}, h('span', { lang: 'zh' }, '操作'), ' Steuerung'),
      row('Kamerageschwindigkeit', this.slider('set-cam', 'camSpeed', 0.4, 2, 0.1)),
      keys,
      h(
        'p',
        { class: 'set-hint' },
        'Pfeiltasten gehen immer, Esc öffnet die Pause. Belegte Tasten werden getauscht.',
      ),

      h('h3', {}, h('span', { lang: 'zh' }, '显示'), ' Darstellung'),
      row('Pinyin zeigen', this.toggle('set-pinyin', 'pinyin'), 'Lautschrift unter den Schriftzeichen'),
      row(
        'Schriftgröße',
        this.select<number>(
          'set-scale',
          [
            [0.9, 'Klein'],
            [1, 'Normal'],
            [1.15, 'Groß'],
            [1.3, 'Sehr groß'],
          ],
          s.uiScale,
          (v) => this.set('uiScale', v),
        ),
      ),
      row('Hoher Kontrast', this.toggle('set-contrast', 'contrast')),
    );
    const resetSettings = h('button', { class: 'btn ghost', type: 'button' }, 'Einstellungen zurücksetzen');
    const resetProgress = h(
      'button',
      { class: 'btn ghost danger', type: 'button' },
      'Fortschritt zurücksetzen',
    );
    const foot = h('div', { class: 'settings-foot' }, resetSettings, resetProgress);
    resetSettings.addEventListener('click', async () => {
      const ok = await confirmView(foot, {
        title: 'Einstellungen zurücksetzen?',
        text: 'Ton, Grafik, Tasten und Darstellung gehen auf die Standardwerte. Dein Fortschritt bleibt.',
        yes: 'Zurücksetzen',
      });
      if (!ok) return;
      store.resetSettings();
      this.host.apply();
      this.render();
    });
    resetProgress.addEventListener('click', async () => {
      const p = store.progress;
      const ok = await confirmView(foot, {
        title: 'Fortschritt löschen?',
        text: `Gestellte Fragen (${p.asked.length}), gesammelte Wörter (${p.words.length}), Aufgaben und Münzen werden gelöscht. Einstellungen bleiben. Das lässt sich nicht rückgängig machen.`,
        yes: 'Ja, alles löschen',
        danger: true,
      });
      if (!ok) return;
      store.resetProgress();
      this.modal.close();
      this.host.onProgressReset();
    });
    this.modal.setContent(sections, foot);
  }
}
