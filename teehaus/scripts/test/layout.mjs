// Layout-Test (nur Desktop): Spiel bei verschiedenen Fenstergrößen und Seitenverhältnissen ab 1280×720 öffnen und
// prüfen, dass HUD, Gesprächsleiste, Karte, Quiz und Pausemenü ganz im Bild liegen und nichts waagrecht scrollt.
// Schreibt je Größe ein Bildschirmfoto. Exit-Code 1 bei Fehlern.
// Aufruf (Build muss laufen): node scripts/test/layout.mjs [ausgabe-präfix] [port]
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const [, , out = 'layout', port = '4173'] = process.argv;
const SIZES = [
  [1280, 720, '16:9 klein'],
  [1920, 1080, '16:9 Full HD'],
  [1440, 900, '16:10'],
  [1280, 1024, '5:4 Beamer'],
  [2560, 1080, '21:9'],
];
let failed = 0;
const ok = (label, cond, info = '') => {
  if (!cond) failed++;
  console.log(`${cond ? 'OK  ' : 'FEHL'} ${label}${info !== '' ? `: ${JSON.stringify(info)}` : ''}`);
};
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
// alle sichtbaren Elemente der Auswahl: ragt eines aus dem Fenster?
const outside = (sel) => {
  const res = [];
  for (const el of document.querySelectorAll(sel)) {
    if (
      el.closest('[hidden]') ||
      getComputedStyle(el).display === 'none' ||
      getComputedStyle(el).visibility === 'hidden'
    )
      continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)
      res.push(
        `${el.className || el.id}: ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)}`,
      );
  }
  return res;
};
for (const [w, h, name] of SIZES) {
  console.log(`\n── ${w}×${h} (${name})`);
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`http://localhost:${port}/?q=0&ladebudget=1`);
  await p.waitForSelector('#mainmenu.show', { timeout: 600000 });
  ok('Hauptmenü im Bild', (await p.evaluate(outside, '.menu-panel, .menu-title, .menu-list')).length === 0);
  await p.click('#mainmenu [data-id=new]');
  await p.waitForSelector('.outfit');
  ok('Kleiderwahl im Bild', (await p.evaluate(outside, '.outfit')).length === 0);
  await p.click('.outfit .btn.primary');
  await p.click('#skip');
  await p.waitForFunction(
    () => document.body.classList.contains('is-inside') && window.__world.mode === 'free',
    null,
    { timeout: 300000 },
  );
  await p.evaluate(() => document.querySelector('.tutorial .btn.ghost')?.click());
  ok(
    'HUD im Bild',
    (await p.evaluate(outside, '.hud button, .hud-words, .hud > *')).length === 0,
    await p.evaluate(outside, '.hud > *'),
  );
  // Gespräch mit Jackie (im Stehen reicht für das Layout)
  await p.evaluate(() => window.__game.startTalk('jackie'));
  await p.waitForFunction(() => window.__world.mode === 'dialog', null, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(2500);
  ok(
    'Gesprächsleiste im Bild',
    (await p.evaluate(outside, '.dlg3:not([hidden])')).length === 0,
    await p.evaluate(outside, '.dlg3:not([hidden])'),
  );
  await p.screenshot({ path: `${out}-${w}x${h}-gespraech.png`, timeout: 180000 });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1500);
  await p.keyboard.press('m');
  await p.waitForTimeout(800);
  ok(
    'Karte im Bild',
    (await p.evaluate(outside, '.map-card')).length === 0,
    await p.evaluate(outside, '.map-card'),
  );
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  await p.evaluate(() => window.__game.quizPanel.show());
  await p.waitForTimeout(500);
  ok('Quiz-Fenster im Bild', (await p.evaluate(outside, '#quiz .modal-card')).length === 0);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  // Mini-Spiele: Tee zubereiten und Xiangqi
  for (const [name, key, sel] of [
    ['Tee-Spiel', 'tea', '.teagame'],
    ['Xiangqi', 'xq', '.xiangqi'],
  ]) {
    await p.evaluate((k) => window.__game[k].start(), key);
    // Einblende-Animation abwarten (in der Software-Grafik dauert sie deutlich länger)
    await p
      .waitForFunction((s) => document.querySelector(s)?.getAnimations().every((a) => a.playState !== 'running'), sel, {
        timeout: 20000,
      })
      .catch(() => undefined);
    const bad = await p.evaluate(outside, sel);
    ok(`${name} im Bild`, bad.length === 0, bad);
    await p.screenshot({ path: `${out}-${w}x${h}-${key}.png`, timeout: 180000 }).catch(() => undefined);
    await p.evaluate((k) => window.__game[k].close(), key);
    await p.waitForTimeout(400);
  }
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);
  ok(
    'Pausemenü im Bild',
    (await p.evaluate(outside, '.pause .menu-panel')).length === 0,
    await p.evaluate(outside, '.pause .menu-panel'),
  );
  await p.screenshot({ path: `${out}-${w}x${h}-pause.png`, timeout: 180000 });
  ok(
    'kein waagrechtes Scrollen',
    (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1,
  );
  ok('keine Konsolenfehler', errors.length === 0, errors.slice(0, 2));
  await p.close();
}
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : '\nalle Prüfungen bestanden');
await b.close();
process.exit(failed ? 1 : 0);
