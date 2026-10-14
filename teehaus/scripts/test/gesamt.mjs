// Gesamttest (S4): alle Spielteile einmal durch – Menü, Bestellen auf Chinesisch, Wörterbuch, Quiz, Karte mit
// Schnellreise, Wetter, Laden, Tee-Mini-Spiel, Xiangqi, Pausemenü, F3, Speichern und Weiterspielen – plus
// Messwerte (Draw-Calls) an festen Orten. Exit-Code 1 bei Fehlern oder Konsolenfehlern.
// Aufruf (Build muss laufen, z. B. npm run build && npm run preview):
//   node scripts/test/gesamt.mjs [ausgabe-präfix] [port]
// Benötigt Playwright oder PLAYWRIGHT_MODULE/CHROMIUM_PATH (wie rundgang.mjs).
const mod = process.env.PLAYWRIGHT_MODULE ?? 'playwright';
const { chromium } = await import(mod);
const [, , out = 'gesamt', port = '4173'] = process.argv;
const URL = `http://localhost:${port}/`;
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => (m.type() === 'error' || m.text().includes('GL_INVALID')) && logs.push(m.text()));
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

let failed = 0;
const ok = (label, cond, info = '') => {
  if (!cond) failed++;
  console.log(
    `${cond ? 'OK  ' : 'FEHL'} ${label}${info !== '' ? `: ${typeof info === 'string' ? info : JSON.stringify(info)}` : ''}`,
  );
};
const ev = (fn, arg) => p.evaluate(fn, arg);
const shot = (n) => p.screenshot({ path: `${out}-${n}.png`, timeout: 120000 });
const wait = (ms) => p.waitForTimeout(ms);
const visible = (sel) => ev((s) => !!document.querySelector(s) && !document.querySelector(s).hidden, sel);
const closeCards = () =>
  ev(() => document.querySelectorAll('.wordcard:not([hidden]) button').forEach((b) => b.click()));
const place = (x, z, yaw = 0) =>
  ev(
    ([x, z, yaw]) => {
      const w = window.__world;
      w.player.place(x, z, yaw);
      w.cam.snapBehind(yaw);
    },
    [x, z, yaw],
  );
const use = (id) => ev((id) => window.__world.interactables.find((i) => i.id === id)?.use(), id);

// ── Start
const t0 = Date.now();
await p.goto(`${URL}?q=1`);
await p.waitForSelector('#mainmenu.show', { timeout: 300000 });
ok('Ladezeit bis Hauptmenü (s)', true, ((Date.now() - t0) / 1000).toFixed(0));
ok('Bewohner vorbereitet', await ev(() => window.__villagers.list.every((r) => !!r.rig)));
await p.click('#mainmenu [data-id=new]');
await p.waitForSelector('.outfit');
await p.click('.outfit .btn.primary');
await p.click('#skip');
await p.waitForFunction(() => document.body.classList.contains('is-inside'), null, { timeout: 240000 });
await ev(() => document.querySelector('.tutorial .btn.ghost')?.click());
await wait(2000);
ok('im Spiel', (await ev(() => window.__world.mode)) === 'free');

// ── Bestellen auf Chinesisch
await place(-4.4, -2.6, Math.PI);
await wait(800);
await use('order-tea');
await p.waitForSelector('#order:not([hidden])');
await p.click('.order-tea:has-text("乌龙茶")');
const tile = (zh) =>
  ev(
    (zh) =>
      [...document.querySelectorAll('.order-pool .order-tile')]
        .find((b) => b.querySelector('.order-zh').textContent === zh)
        ?.click(),
    zh,
  );
for (const t of ['我', '要', '乌龙茶']) await tile(t);
await p.keyboard.press('Enter');
await wait(200);
ok('fehlende Menge wird bemängelt', (await p.textContent('.order-hint')).includes('一杯'));
await p.keyboard.press('Backspace');
await tile('一杯');
await tile('乌龙茶');
await p.keyboard.press('Enter');
await wait(3500);
ok('Bestellung angenommen', await ev(() => window.__game.npcs.master.state === 'order'));
await shot('bestellt');
await wait(6000);
await closeCards();
ok(
  'Wort 要 gesammelt',
  await ev(() => JSON.parse(localStorage.getItem('teehaus.save')).words.includes('yao4')),
);

// ── Wörterbuch und Quiz
await ev(() => {
  for (const id of ['cha', 'nihao', 'xiexie', 'mao', 'long', 'shanghai']) window.__game.award(id);
});
await closeCards();
await p.click('.hud-words, [data-hud=words], #hud-words').catch(() => ev(() => window.__game.dict.open()));
await wait(600);
if (!(await visible('#dict'))) await ev(() => window.__game.dict.open());
await wait(400);
await p.fill('.dict-search', 'wulong');
ok(
  'Suche „wulong“',
  (
    await ev(() =>
      [...document.querySelectorAll('.dict-item:not([hidden]) .dict-zh')].map((e) => e.textContent),
    )
  ).includes('乌龙茶'),
);
await p.fill('.dict-search', '');
await p.click('.dict-chip[data-chip=tee]');
await p.click('.dict-chip[data-chip=offen]');
ok(
  'Filter Tee/offen ohne gesammelte',
  await ev(() => document.querySelectorAll('.dict-item:not([hidden]):not(.locked)').length === 0),
);
await p.click('.dict-quiz');
await p.waitForSelector('#quiz:not([hidden])');
await wait(300);
await p.click('#quiz .btn.primary');
let n = 0;
while ((await ev(() => !!document.querySelector('.quiz-opt'))) && n < 12) {
  await p.keyboard.press('1');
  await wait(80);
  await p.keyboard.press('Enter');
  await wait(80);
  n++;
}
ok('Quiz mit 8 Fragen', n === 8, n);
await wait(700);
await wait(700);
ok(
  'Abzeichen vergeben',
  (await ev(() => JSON.parse(localStorage.getItem('teehaus.save')).quiz.badges)).includes('quiz-erstes'),
);
await p.keyboard.press('Escape');
await wait(500);
ok('Eingabe wieder frei', await ev(() => window.__world.input.enabled));

// ── Karte und Schnellreise
await place(38, 66, 3.4);
await wait(2500);
await p.keyboard.press('m');
await wait(800);
ok('Karte offen', await visible('#worldmap'));
await shot('karte');
await ev(() =>
  [...document.querySelectorAll('.map-place')].find((b) => b.textContent.includes('Teehaus'))?.click(),
);
await wait(3500);
ok(
  'Schnellreise zum Teehaus',
  await ev(() => Math.hypot(window.__world.player.x, window.__world.player.z) < 6),
);

// ── Wetter
await place(2, 26, Math.PI);
await ev(() => {
  const w = window.__world;
  w.weather.fixed = 'regen';
  w.weather.rain = 1;
  w.weather.cloud = 1;
});
await wait(2500);
ok('Regen sichtbar', await ev(() => window.__world.scene.getObjectByName('rain').visible));
await shot('regen');
await ev(() => {
  const w = window.__world;
  w.weather.fixed = null;
  w.weather.rain = 0;
});

// ── Laden
await ev(() => window.__game.shop.show());
await wait(400);
ok('Laden offen', await visible('#shop'));
await p.keyboard.press('Escape');
await wait(400);

// ── Tee-Mini-Spiel und Xiangqi öffnen und schließen
await place(-4.4, -2.6, Math.PI);
await wait(500);
await use('brew-tea');
await wait(2500);
ok('Tee-Mini-Spiel offen', await ev(() => window.__game.tea.open));
await p.keyboard.press('Escape');
await wait(2500);
ok('Tee-Mini-Spiel zu', await ev(() => !window.__game.tea.open && window.__world.mode === 'free'));
await use('xiangqi');
await wait(3000);
ok('Xiangqi offen', await ev(() => window.__game.xq.open));
await p.keyboard.press('Escape');
await wait(2500);
ok('Xiangqi zu', await ev(() => !window.__game.xq.open));

// ── Pausemenü und F3
await p.keyboard.press('Escape');
await wait(600);
const items = await ev(() => [...document.querySelectorAll('.pause [data-id]')].map((b) => b.dataset.id));
ok('Pausemenü mit Wörterbuch und Quiz', items.includes('words') && items.includes('quiz'), items);
await p.click('.pause [data-id=resume]');
await wait(400);
await p.keyboard.press('F3');
await p
  .waitForFunction(() => (document.getElementById('debug')?.textContent ?? '').includes('Zustand'), null, {
    timeout: 60000,
  })
  .catch(() => undefined);
const dbg = await ev(() => document.getElementById('debug')?.textContent ?? '');
ok(
  'F3 zeigt Speicher und Zustand',
  dbg.includes('Speicher') && dbg.includes('Zustand'),
  dbg.split('\n').slice(0, 7).join(' | '),
);

// ── Messwerte an festen Orten
const spots = [
  // Ort, Position, Blickrichtung, Obergrenze (Software-Grafik, Mittel)
  ['Teehaus innen', 0, 2, Math.PI, 800],
  ['Teich (Blick aufs Teehaus)', 2, 26, Math.PI, 1300],
  ['Dorfplatz', 38, 60, 3.4, 900],
  ['Terrassen', -40, 70, 2.5, 900],
];
for (const [name, x, z, yaw, max] of spots) {
  await place(x, z, yaw);
  // Mittel über 8 Bilder (Schatten und Spiegelung werden nur jedes zweite Bild gezeichnet)
  const f0 = await ev(() => window.__world.frameNo);
  await p.waitForFunction((f0) => window.__world.frameNo > f0 + 10, f0, { timeout: 120000 });
  const calls = await ev(() => {
    const r = window.__world.debug.recent.slice(-8);
    return Math.round(r.reduce((a, b) => a + b, 0) / r.length);
  });
  ok(`Draw-Calls ${name} unter ${max}`, calls > 0 && calls < max, calls);
}
await shot('dorf');

// ── Speichern und Weiterspielen
await place(38, 60, 1);
await wait(800);
await p.keyboard.press('Escape');
await wait(500);
await p.reload();
await p.waitForSelector('#mainmenu.show', { timeout: 300000 });
await p.click('#mainmenu [data-id=continue]');
await p.waitForFunction(() => window.__world?.mode === 'free', null, { timeout: 240000 });
await wait(1500);
const pos = await ev(() => [window.__world.player.x, window.__world.player.z]);
ok(
  'Weiterspielen an der gespeicherten Stelle',
  Math.hypot(pos[0] - 38, pos[1] - 60) < 2,
  pos.map((v) => v.toFixed(1)),
);
ok(
  'Abzeichen nach Neuladen noch da',
  await ev(() => JSON.parse(localStorage.getItem('teehaus.save')).quiz.badges.length >= 2),
);

ok('keine Konsolenfehler', logs.length === 0, logs.slice(0, 3));
console.log(failed ? `${failed} Prüfung(en) fehlgeschlagen` : 'alle Prüfungen bestanden');
await b.close();
process.exit(failed ? 1 : 0);
