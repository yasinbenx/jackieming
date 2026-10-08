// Obere Leiste: Marke, Fortschritt, Wörterbuch, Tageszeit (日 黄昏 夜 自动), Info.
import type { Stage } from '../scene/stage';
import type { TimePreset } from '../scene/timeOfDay';
import { bus } from '../core/bus';
import { h } from './dom';

interface TimeBtn {
  id: TimePreset | 'auto';
  zh: string;
  pinyin: string;
  de: string;
}

const TIME_BUTTONS: TimeBtn[] = [
  { id: 'day', zh: '日', pinyin: 'rì', de: 'Tag' },
  { id: 'golden', zh: '黄昏', pinyin: 'huánghūn', de: 'Abend' },
  { id: 'night', zh: '夜', pinyin: 'yè', de: 'Nacht' },
  { id: 'auto', zh: '自动', pinyin: 'zìdòng', de: 'Auto' },
];

export interface HudHandlers {
  onWords: () => void;
  onInfo: () => void;
  onToast: () => void;
  onSound?: (anchor: HTMLElement) => void;
}

export interface Hud {
  el: HTMLElement;
  setProgress(asked: number, total: number, words: number, totalWords: number): void;
  setToastReady(ready: boolean): void;
  setSoundIcon(muted: boolean): void;
}

const ICON_SOUND_ON = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" fill="currentColor"/></svg>`;
const ICON_SOUND_OFF = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.6.4-1.4 1.4 1.8 1.8-1.8 1.8 1.4 1.4 1.8-1.8 1.8 1.8 1.4-1.4-1.8-1.8 1.8-1.8-1.4-1.4-1.8 1.8-1.8-1.8z" fill="currentColor"/></svg>`;

export function createHud(stage: Stage, handlers: HudHandlers): Hud {
  const progress = h('span', { class: 'hud-progress-text' }, '0 / 28');
  const wordsCount = h('span', { class: 'hud-badge' }, '0');
  const toastBtn = h(
    'button',
    {
      class: 'hud-toast',
      type: 'button',
      hidden: true,
      onclick: handlers.onToast,
      title: 'Gemeinsam anstoßen und das Quiz spielen',
    },
    h('span', { lang: 'zh' }, '干杯'),
    h('small', {}, 'Anstoßen'),
  );
  const soundBtn = h('button', {
    class: 'hud-icon',
    type: 'button',
    'aria-label': 'Ton-Einstellungen',
    'aria-haspopup': 'dialog',
    onclick: () => handlers.onSound?.(soundBtn),
    html: ICON_SOUND_ON,
  });
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Tageszeit' });
  const buttons: HTMLButtonElement[] = [];
  const mark = (id: string): void => {
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.time === id));
  };
  for (const b of TIME_BUTTONS) {
    const btn = h('button', {
      type: 'button',
      'data-time': b.id,
      title: `${b.de} · ${b.pinyin}`,
      'aria-label': `Tageszeit: ${b.de}`,
      onclick: () => {
        bus.emit('ui:click');
        stage.setTime(b.id);
        mark(b.id);
      },
      html: `<span lang="zh">${b.zh}</span><small>${b.de}</small>`,
    });
    seg.appendChild(btn);
    buttons.push(btn);
  }
  mark('auto');

  const el = h(
    'header',
    { id: 'hud' },
    h(
      'div',
      { class: 'hud-left' },
      h('div', { class: 'hud-brand' }, h('span', { lang: 'zh' }, '茶馆'), h('i', {}, 'cháguǎn')),
      h(
        'div',
        { class: 'hud-progress', title: 'Gestellte Fragen' },
        h('span', { class: 'hud-progress-label' }, 'Fragen '),
        progress,
      ),
    ),
    h(
      'div',
      { class: 'hud-tools' },
      toastBtn,
      h(
        'button',
        { class: 'hud-words', type: 'button', onclick: handlers.onWords, title: 'Wörterbuch öffnen' },
        h('span', { lang: 'zh' }, '词典'),
        h('small', {}, 'Wörter'),
        wordsCount,
      ),
      seg,
      soundBtn,
      h(
        'button',
        { class: 'hud-icon', type: 'button', 'aria-label': 'Info und Hilfe', onclick: handlers.onInfo },
        'ⓘ',
      ),
    ),
  );
  document.body.appendChild(el);

  return {
    el,
    setProgress(asked, total, words, totalWords) {
      progress.textContent = `${asked} / ${total}`;
      wordsCount.textContent = `${words}/${totalWords}`;
    },
    setToastReady(ready) {
      toastBtn.hidden = !ready;
    },
    setSoundIcon(muted) {
      soundBtn.innerHTML = muted ? ICON_SOUND_OFF : ICON_SOUND_ON;
      soundBtn.setAttribute('aria-pressed', String(muted));
    },
  };
}
