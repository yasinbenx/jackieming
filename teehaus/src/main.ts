import './style.css';

// Der Ladescreen steht in index.html (reines DOM). Hier wird die 3D-Welt nachgeladen.
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

/** Schriften vor dem Zeichnen laden, damit Schilder und Hängerollen nicht mit Ersatzschrift entstehen. */
async function loadFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  const load = Promise.all([
    document.fonts.load('400 1em "Ma Shan Zheng"', '茶馆香四溢宾至如归以和为贵成龙姚明楚河汉界'),
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
  const { World } = await import('./world/world');
  await set(0.25, '<span lang="zh">烧水</span> <i>shāoshuǐ</i> · Wasser wird aufgesetzt …');
  const world = new World();
  await world.init($('stage'), (f) =>
    set(
      0.25 + f * 0.6,
      f < 0.7
        ? '<span lang="zh">烧水</span> <i>shāoshuǐ</i> · Wasser wird aufgesetzt …'
        : '<span lang="zh">泡茶</span> <i>pàochá</i> · Tee zieht …',
    ),
  );
  (window as unknown as { __world: unknown }).__world = world;
  const { Game } = await import('./game');
  const game = new Game(world);
  (window as unknown as { __game: unknown }).__game = game;
  // Bewohner und alle Shader jetzt vorbereiten, damit es später im Spiel nicht ruckelt
  const prep = '<span lang="zh">请客</span> <i>qǐngkè</i> · Gäste werden eingeladen …';
  await game.villagers.prepare((f) => set(0.85 + f * 0.1, prep));
  await set(0.96, prep);
  await world.precompile();
  const params = new URLSearchParams(location.search);
  if (params.has('galerie')) {
    const { gallery } = await import('./world/gallery');
    (window as unknown as { __gal: unknown }).__gal = gallery(
      world,
      params.get('anim'),
      (params.get('ansicht') as 'front' | 'side' | 'close') ?? 'front',
    );
    document.body.classList.add('is-loaded', 'is-picking');
    return;
  }
  const intro = await import('./world/intro');
  const { MainMenu, confirmView } = await import('./ui/menu');
  const { store } = await import('./state/store');
  await set(1, '<span lang="zh">请进</span> <i>qǐng jìn</i> · Bitte eintreten');
  document.body.classList.add('is-loaded');
  // Vorschaubild (scripts/make-og.mjs): beim Startbild bleiben
  if (params.has('og')) return;

  const menu = new MainMenu();
  // Ton darf erst nach einer Geste starten (Klick, Taste, Tippen)
  const unlock = (): void => void game.audio.start();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  let entered = false;
  const skip = { requested: false };
  $('skip').addEventListener('click', () => (skip.requested = true));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('is-entering')) skip.requested = true;
  });

  /** Kleiderwahl, Weg ins Haus, Tutorial */
  const newGame = async (): Promise<void> => {
    menu.hide();
    document.body.classList.add('is-picking');
    await intro.pickOutfit(world);
    store.markStarted();
    document.body.classList.remove('is-picking');
    document.body.classList.add('is-entering');
    skip.requested = false;
    await intro.walkIn(world, skip, (u) => {
      document.body.classList.toggle('cap-1', u > 0.02 && u < 0.45);
      document.body.classList.toggle('cap-2', u >= 0.55 && u < 0.98);
    });
    document.body.classList.remove('cap-1', 'cap-2', 'is-entering');
    afterEnter();
    game.tutorial.begin();
  };
  /** Weiterspielen an der gespeicherten Stelle */
  const continueGame = async (): Promise<void> => {
    menu.hide();
    if (entered) {
      // aus der Pause zurück ins laufende Spiel
      world.hidePlayer = false;
      world.cam.setShot(null);
      world.mode = 'free';
      world.input.enabled = true;
      document.body.classList.add('is-inside');
      return;
    }
    const t = store.progress.time;
    world.setTime(t, true);
    await intro.enterDirect(world, store.progress.pos);
    afterEnter();
    game.tutorial.begin();
  };
  const afterEnter = (): void => {
    entered = true;
    document.body.classList.add('is-inside');
    game.audio.setInside(true);
    game.onEntered();
  };

  const showMenu = (): void => {
    intro.menuShot(world);
    document.body.classList.remove('is-inside');
    const has = store.hasProgress;
    const p = store.progress;
    menu.show(
      [
        {
          id: 'continue',
          label: 'Weiter',
          zh: '继续',
          primary: true,
          hidden: !has && !entered,
          onClick: () => {
            void game.audio.start();
            void continueGame();
          },
        },
        {
          id: 'new',
          label: 'Neues Spiel',
          zh: '新游戏',
          primary: !has && !entered,
          onClick: async () => {
            void game.audio.start();
            if (has || entered) {
              const ok = await confirmView(menu.body, {
                title: 'Neues Spiel beginnen?',
                text: `Dein bisheriger Fortschritt (${p.asked.length} Fragen, ${p.words.length} Wörter) wird gelöscht. Einstellungen bleiben.`,
                yes: 'Neu beginnen',
                danger: true,
              });
              if (!ok) return;
              store.resetProgress();
              if (entered) {
                // Die Welt ist schon im Spielzustand: sauber neu laden und direkt mit der Kleiderwahl beginnen
                try {
                  sessionStorage.setItem('teehaus.start', 'new');
                } catch {
                  /* egal */
                }
                location.reload();
                return;
              }
              game.refresh();
            }
            void newGame();
          },
        },
        { id: 'settings', label: 'Einstellungen', zh: '设置', onClick: () => game.settings.open() },
        { id: 'credits', label: 'Credits', zh: '鸣谢', onClick: () => game.credits.open() },
        { id: 'info', label: 'Info und Hinweis', zh: '关于', onClick: () => game.openInfo() },
      ],
      store.recovered
        ? 'Der alte Spielstand war beschädigt und wurde gesichert; es beginnt ein neues Spiel.'
        : store.saveFailed
          ? 'Hinweis: Dein Browser erlaubt kein Speichern, der Fortschritt geht beim Schließen verloren.'
          : '',
    );
  };
  game.onMainMenu = () => {
    store.flush();
    showMenu();
  };
  game.onProgressReset = () => {
    try {
      sessionStorage.setItem('teehaus.start', 'menu');
    } catch {
      /* egal */
    }
    location.reload();
  };

  let start: string | null = null;
  try {
    start = sessionStorage.getItem('teehaus.start');
    sessionStorage.removeItem('teehaus.start');
  } catch {
    /* egal */
  }
  if (start === 'new') {
    document.body.classList.add('is-menu');
    void newGame();
  } else {
    document.body.classList.add('is-menu');
    showMenu();
  }
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
