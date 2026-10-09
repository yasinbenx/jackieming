// Ton-Einstellungen: Stumm-Schalter, getrennte Regler für Musik (音乐), Stimmen (声音) und Effekte (音效). Wird gespeichert.
import { store } from '../state/store';
import { h } from './dom';

export class SoundPanel {
  readonly el: HTMLElement;
  private mute: HTMLInputElement;
  private music: HTMLInputElement;
  private sfx: HTMLInputElement;
  private voices: HTMLInputElement;
  private anchor: HTMLElement | null = null;

  constructor(private onChange: () => void) {
    this.mute = h('input', { type: 'checkbox', id: 'snd-mute', role: 'switch' });
    this.music = h('input', { type: 'range', id: 'snd-music', min: '0', max: '1', step: '0.05' });
    this.sfx = h('input', { type: 'range', id: 'snd-sfx', min: '0', max: '1', step: '0.05' });
    this.voices = h('input', { type: 'range', id: 'snd-voices', min: '0', max: '1', step: '0.05' });
    this.el = h(
      'div',
      { class: 'sound-panel', hidden: true, role: 'dialog', 'aria-label': 'Ton' },
      h(
        'label',
        { class: 'sp-row sp-mute', for: 'snd-mute' },
        h('span', {}, 'Ton aus'),
        h('span', { class: 'sp-switch' }, this.mute, h('span', { class: 'sp-knob' })),
      ),
      h(
        'label',
        { class: 'sp-row', for: 'snd-music' },
        h('span', {}, h('span', { lang: 'zh' }, '音乐'), ' Musik'),
        this.music,
      ),
      h(
        'label',
        { class: 'sp-row', for: 'snd-voices' },
        h('span', {}, h('span', { lang: 'zh' }, '声音'), ' Stimmen'),
        this.voices,
      ),
      h(
        'label',
        { class: 'sp-row', for: 'snd-sfx' },
        h('span', {}, h('span', { lang: 'zh' }, '音效'), ' Effekte'),
        this.sfx,
      ),
      h('p', { class: 'sp-hint' }, 'Tipp: Mit der Taste M schaltest du den Ton schnell aus oder an.'),
    );
    document.body.appendChild(this.el);
    const apply = (): void => {
      store.setSettings({
        muted: this.mute.checked,
        music: Number(this.music.value),
        sfx: Number(this.sfx.value),
        voices: Number(this.voices.value),
      });
      this.onChange();
    };
    this.mute.addEventListener('change', apply);
    this.music.addEventListener('input', apply);
    this.sfx.addEventListener('input', apply);
    this.voices.addEventListener('input', apply);
    document.addEventListener('pointerdown', (e) => {
      if (
        !this.el.hidden &&
        !this.el.contains(e.target as Node) &&
        !(this.anchor?.contains(e.target as Node) ?? false)
      )
        this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.el.hidden) this.close();
      if (
        (e.key === 'm' || e.key === 'M') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !(e.target instanceof HTMLInputElement)
      ) {
        store.setSettings({ muted: !store.settings.muted });
        this.sync();
        this.onChange();
      }
    });
    this.sync();
  }

  sync(): void {
    const s = store.settings;
    this.mute.checked = s.muted;
    this.music.value = String(s.music);
    this.sfx.value = String(s.sfx);
    this.voices.value = String(s.voices);
  }

  toggle(anchor: HTMLElement): void {
    this.anchor = anchor;
    if (this.el.hidden) {
      this.sync();
      this.el.hidden = false;
      const r = anchor.getBoundingClientRect();
      this.el.style.top = `${Math.round(r.bottom + 8)}px`;
      this.el.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
      this.mute.focus({ preventScroll: true });
    } else {
      this.close();
    }
  }

  close(): void {
    this.el.hidden = true;
  }
}
