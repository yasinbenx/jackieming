import './style.css';
import { createHud } from './ui/hud';

// Der Ladescreen steht in index.html (reines DOM). Hier wird die Engine nachgeladen.
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

async function boot(): Promise<void> {
  const bar = $('loader-bar');
  const msg = $('loader-msg');
  const set = async (f: number, text: string): Promise<void> => {
    bar.style.transform = `scaleX(${f})`;
    msg.innerHTML = text;
    await nextFrame();
    await nextFrame();
  };
  await set(0.08, '<span lang="zh">研墨</span> <i>yánmò</i> · Tusche wird angerieben …');
  const { Stage } = await import('./scene/stage');
  await set(0.35, '<span lang="zh">烧水</span> <i>shāoshuǐ</i> · Wasser wird aufgesetzt …');
  const stage = new Stage();
  await stage.init($('stage'));
  await set(0.9, '<span lang="zh">泡茶</span> <i>pàochá</i> · Tee zieht …');
  (window as unknown as { __teehaus: unknown }).__teehaus = stage;
  createHud(stage);
  await set(1, '<span lang="zh">请进</span> <i>qǐng jìn</i> · Bitte eintreten');
  document.body.classList.add('is-loaded');
  const enter = $<HTMLButtonElement>('enter');
  enter.disabled = false;
  enter.focus({ preventScroll: true });
  enter.addEventListener('click', async () => {
    enter.disabled = true;
    document.body.classList.add('is-entering');
    const skip = { requested: false };
    const skipBtn = $('skip');
    const onSkip = (): void => {
      skip.requested = true;
    };
    skipBtn.addEventListener('click', onSkip);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === ' ') onSkip();
    });
    await stage.approach(10, skip, (u) => {
      document.body.classList.toggle('cap-1', u > 0.04 && u < 0.5);
      document.body.classList.toggle('cap-2', u >= 0.62);
    });
    document.body.classList.add('is-flash');
    await new Promise((r) => setTimeout(r, 650));
    stage.setMode('inside');
    document.body.classList.remove('cap-1', 'cap-2', 'is-entering');
    document.body.classList.add('is-inside');
    await new Promise((r) => setTimeout(r, 200));
    document.body.classList.remove('is-flash');
  });
}

boot().catch((err) => {
  console.error(err);
  $('loader-msg').textContent = 'Das Teehaus konnte nicht geöffnet werden. Bitte Seite neu laden.';
});
