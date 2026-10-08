// Obere Leiste: Tageszeit-Umschalter (日 Tag · 黄昏 Abend · 夜 Nacht · 自动 Auto).
import type { Stage } from '../scene/stage';
import type { TimePreset } from '../scene/timeOfDay';

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

export function createHud(stage: Stage): HTMLElement {
  const bar = document.createElement('header');
  bar.id = 'hud';
  bar.innerHTML = `
    <div class="hud-brand"><span lang="zh">茶馆</span><i>cháguǎn</i></div>
    <div class="hud-tools">
      <div class="seg" role="group" aria-label="Tageszeit"></div>
    </div>`;
  const seg = bar.querySelector('.seg')!;
  const buttons: HTMLButtonElement[] = [];
  for (const b of TIME_BUTTONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.time = b.id;
    btn.title = `${b.de} · ${b.pinyin}`;
    btn.setAttribute('aria-label', `Tageszeit: ${b.de}`);
    btn.innerHTML = `<span lang="zh">${b.zh}</span><small>${b.de}</small>`;
    btn.addEventListener('click', () => {
      stage.setTime(b.id);
      mark(b.id);
    });
    seg.appendChild(btn);
    buttons.push(btn);
  }
  const mark = (id: string): void => {
    for (const btn of buttons) btn.setAttribute('aria-pressed', String(btn.dataset.time === id));
  };
  mark('auto');
  document.body.appendChild(bar);
  return bar;
}
