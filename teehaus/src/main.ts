import './style.css';

// Der Ladescreen steht in index.html (reines DOM). Hier wird die Engine nachgeladen.
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

/** Schriften vor dem Zeichnen laden, damit die Schrift-Texturen (Hängerolle, Messlatte) nicht mit Ersatzschrift entstehen. */
async function loadFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  const load = Promise.all([
    document.fonts.load('400 1em "Ma Shan Zheng"', '茶馆福春喜进'),
    document.fonts.load('700 1em "Noto Serif SC"', '茶馆以和为贵'),
    document.fonts.load('400 1em "Noto Serif SC"', '茶馆以和为贵'),
  ]).catch(() => undefined);
  await Promise.race([load, new Promise((r) => setTimeout(r, 3000))]);
}

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
  await loadFonts();
  const { Stage } = await import('./three/stage');
  await set(0.25, '<span lang="zh">烧水</span> <i>shāoshuǐ</i> · Wasser wird aufgesetzt …');
  const stage = new Stage();
  await stage.init($('stage'), (f) =>
    set(
      0.25 + f * 0.6,
      f < 0.7
        ? '<span lang="zh">烧水</span> <i>shāoshuǐ</i> · Wasser wird aufgesetzt …'
        : '<span lang="zh">泡茶</span> <i>pàochá</i> · Tee zieht …',
    ),
  );
  (window as unknown as { __teehaus: unknown }).__teehaus = stage;
  const { Game } = await import('./game');
  const game = new Game(stage);
  (window as unknown as { __game: unknown }).__game = game;
  await set(1, '<span lang="zh">请进</span> <i>qǐng jìn</i> · Bitte eintreten');
  document.body.classList.add('is-loaded');
  const enter = $<HTMLButtonElement>('enter');
  enter.disabled = false;
  enter.focus({ preventScroll: true });
  enter.addEventListener('click', async () => {
    enter.disabled = true;
    void game.audio.start();
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
    await stage.approach(11, skip, (u) => {
      document.body.classList.toggle('cap-1', u > 0.04 && u < 0.45);
      document.body.classList.toggle('cap-2', u >= 0.55 && u < 0.97);
    });
    stage.enterFree();
    document.body.classList.remove('cap-1', 'cap-2', 'is-entering');
    document.body.classList.add('is-inside');
    void game.greet();
  });
}

boot().catch((err) => {
  console.error(err);
  const msg = $('loader-msg');
  const webgl =
    !!document.createElement('canvas').getContext('webgl2') ||
    !!document.createElement('canvas').getContext('webgl');
  msg.textContent = webgl
    ? 'Das Teehaus konnte nicht geöffnet werden. Bitte lade die Seite neu.'
    : 'Das Teehaus braucht WebGL. Bitte aktiviere die Hardwarebeschleunigung in deinem Browser oder probiere einen aktuellen Browser aus.';
  msg.classList.add('error');
  document.getElementById('loader-bar')!.style.background = '#b3261a';
});
