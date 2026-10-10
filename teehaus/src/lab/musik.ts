// Musik-Labor (/lab/musik/): drei prozedurale Soundtrack-Vorschauen zum Vergleichen.
// Der AudioContext entsteht erst beim ersten Klick (Autoplay-Regeln der Browser).
import { PREVIEW_INFO, playPreview } from './musik-synth';
import type { PreviewHandle, PreviewId } from './musik-synth';

interface RenderStats {
  id: PreviewId;
  seconds: number;
  duration: number;
  peak: number;
  rms: number;
  /** RMS des lautesten 1-s-Fensters */
  maxWindowRms: number;
  nan: number;
}

declare global {
  interface Window {
    /** Test-Hilfe: rendert eine Vorschau offline und misst Pegel */
    __renderPreview?: (id: PreviewId, seconds?: number) => Promise<RenderStats>;
  }
}

const IDS: PreviewId[] = ['A', 'B', 'C'];

let ctx: AudioContext | null = null;
let volume: GainNode | null = null;
let current: { id: PreviewId; handle: PreviewHandle } | null = null;

const volInput = document.getElementById('vol') as HTMLInputElement;
const volOut = document.getElementById('vol-out') as HTMLOutputElement;
const cardsEl = document.getElementById('cards')!;

const ui = new Map<
  PreviewId,
  { card: HTMLElement; btn: HTMLButtonElement; bar: HTMLElement; time: HTMLElement }
>();

const fmt = (s: number): string => {
  const x = Math.max(0, Math.round(s));
  return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

for (const id of IDS) {
  const info = PREVIEW_INFO[id];
  const card = el('article', 'card');
  const head = el('div', 'card-head');
  const text = el('div');
  const h2 = el('h2');
  h2.append(el('span', 'letter', id), info.title, ' ');
  const zh = el('span', 'zh', info.zh);
  zh.lang = 'zh';
  h2.append(zh);
  text.append(h2, el('p', '', info.description), el('p', 'details', info.details));
  const btn = el('button', 'play', '▶ Abspielen');
  btn.type = 'button';
  btn.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-label', `${info.title} abspielen`);
  head.append(text, btn);
  const prog = el('div', 'progress');
  const bar = el('div', 'bar');
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', 'Fortschritt');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  const fill = el('span');
  bar.append(fill);
  const time = el('span', 'time', 'bereit');
  prog.append(bar, time);
  card.append(head, prog);
  cardsEl.append(card);
  ui.set(id, { card, btn, bar: fill, time });
  btn.addEventListener('click', () => void toggle(id));
}

function ensureAudio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'playback' });
    volume = ctx.createGain();
    volume.gain.value = Number(volInput.value);
    volume.connect(ctx.destination);
  }
  return ctx;
}

function setPlaying(id: PreviewId, on: boolean): void {
  const u = ui.get(id)!;
  u.card.classList.toggle('playing', on);
  u.btn.setAttribute('aria-pressed', String(on));
  u.btn.textContent = on ? '■ Stopp' : '▶ Abspielen';
  u.btn.setAttribute('aria-label', `${PREVIEW_INFO[id].title} ${on ? 'stoppen' : 'abspielen'}`);
  if (!on) {
    u.bar.style.width = '0';
    u.bar.parentElement!.setAttribute('aria-valuenow', '0');
  }
}

function stopCurrent(): void {
  if (!current) return;
  current.handle.stop(0.7);
  setPlaying(current.id, false);
  ui.get(current.id)!.time.textContent = 'gestoppt';
  current = null;
}

async function toggle(id: PreviewId): Promise<void> {
  const ac = ensureAudio();
  if (ac.state !== 'running') {
    try {
      await ac.resume();
    } catch {
      /* wird beim nächsten Klick erneut versucht */
    }
  }
  if (current?.id === id) {
    stopCurrent();
    return;
  }
  stopCurrent();
  const handle = playPreview(id, ac, volume!, {
    onEnded: () => {
      if (current?.handle === handle) {
        setPlaying(id, false);
        ui.get(id)!.time.textContent = `${fmt(handle.duration)} · fertig`;
        current = null;
      }
    },
  });
  current = { id, handle };
  setPlaying(id, true);
  requestAnimationFrame(frame);
}

function frame(): void {
  if (!current || !ctx) return;
  const { id, handle } = current;
  const u = ui.get(id)!;
  const el2 = Math.max(0, ctx.currentTime - handle.startTime);
  const p = Math.min(1, el2 / handle.duration);
  u.bar.style.width = `${(p * 100).toFixed(2)}%`;
  u.bar.parentElement!.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  u.time.textContent = `${fmt(el2)} / ${fmt(handle.duration)}`;
  requestAnimationFrame(frame);
}

volInput.addEventListener('input', () => {
  const v = Number(volInput.value);
  volOut.textContent = `${Math.round(v * 100)} %`;
  if (ctx && volume) volume.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
});

// Test-Hilfe: Offline-Rendering ohne Lautsprecher, liefert Spitzen- und Effektivpegel
window.__renderPreview = async (id, seconds) => {
  const sr = 44100;
  const probe = new OfflineAudioContext(2, sr, sr);
  const dur = seconds ?? playPreview(id, probe, probe.destination).duration + 0.5;
  const off = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
  const h = playPreview(id, off, off.destination);
  const buf = await off.startRendering();
  let peak = 0;
  let sum = 0;
  let nan = 0;
  let maxWin = 0;
  const win = sr;
  const chans = [buf.getChannelData(0), buf.getChannelData(1)];
  for (let start = 0; start < buf.length; start += win) {
    let ws = 0;
    let wn = 0;
    for (const d of chans) {
      const stop = Math.min(d.length, start + win);
      for (let i = start; i < stop; i++) {
        const x = d[i]!;
        if (!Number.isFinite(x)) {
          nan++;
          continue;
        }
        const a = Math.abs(x);
        if (a > peak) peak = a;
        ws += x * x;
        wn++;
      }
    }
    sum += ws;
    if (wn) maxWin = Math.max(maxWin, Math.sqrt(ws / wn));
  }
  return {
    id,
    seconds: dur,
    duration: h.duration,
    peak,
    rms: Math.sqrt(sum / (buf.length * 2)),
    maxWindowRms: maxWin,
    nan,
  };
};
