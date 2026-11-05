// Automatischer Rundgang durch das Spiel (Ende-zu-Ende): Laufen, alle freien Plätze, Gespräch mit Weg zum Platz,
// Esc, Wechsel zu Yao, Tageszeiten, Panels. Schreibt Prüfwerte und Screenshots; Exit-Code 1 bei Fehlern.
// Aufruf (Build muss laufen, z. B. npm run build && npm run preview):
//   node scripts/test/rundgang.mjs [ausgabe-präfix] [breite] [höhe] [port]
// Benötigt Playwright (npm i -D playwright && npx playwright install chromium) oder PLAYWRIGHT_MODULE/CHROMIUM_PATH.
const mod = process.env.PLAYWRIGHT_MODULE ?? 'playwright';
const { chromium } = await import(mod);
const [, , out = 'rundgang', w = '1280', h = '720', port = '4173'] = process.argv;
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
let failed = 0;
const expectEq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  notes.push(
    `${ok ? 'OK  ' : 'FEHL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ` (erwartet ${JSON.stringify(want)})`}`,
  );
};
const ctx = await b.newContext({
  viewport: { width: +w, height: +h },
  hasTouch: +w < 900,
  isMobile: +w < 900,
});
const p = await ctx.newPage();
const logs = [];
const notes = [];

p.on(
  'console',
  (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(m.type() + ': ' + m.text()),
);
p.on('pageerror', (e) => logs.push('pageerror: ' + e.stack));
const shot = async (n) => {
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}-${n}.png`, timeout: 120000 });
};
const sim = (secs) =>
  p.evaluate((secs) => {
    const w = window.__world;
    for (let i = 0; i < secs * 20; i++) {
      for (let k = w.tickers.length - 1; k >= 0; k--) if (w.tickers[k](0.05) === true) w.tickers.splice(k, 1);
      for (const a of w.agents) a.update(0.05, null);
      w.cam.update(0.05, w.playerTarget(), w.cafe.blockers);
    }
  }, secs);
const check = async (label, fn, arg) => {
  try {
    const r = await p.evaluate(fn, arg);
    notes.push(`${label}: ${JSON.stringify(r)}`);
    return r;
  } catch (e) {
    notes.push(`${label}: FEHLER ${e.message.split('\n')[0]}`);
  }
};
// Figurenköpfe, die vom Gesprächsfenster oder anderen Panels verdeckt sind
const covered = () => {
  const w = window.__world;
  const g = window.__game;
  const res = [];
  const els = [...document.querySelectorAll('.dlg3:not([hidden]), .wordcard:not([hidden])')].map((e) =>
    e.getBoundingClientRect(),
  );
  for (const hro of [g.heroes.jackie, g.heroes.yao]) {
    const s = w.toScreenLoose(hro.face());
    if (!s.visible) {
      res.push(hro.id + ':unsichtbar');
      continue;
    }
    for (const r of els)
      if (s.x > r.left && s.x < r.right && s.y > r.top && s.y < r.bottom) res.push(hro.id + ':verdeckt');
  }
  const pl = w.toScreenLoose(w.playerTarget());
  for (const r of els)
    if (pl.x > r.left && pl.x < r.right && pl.y > r.top && pl.y < r.bottom) res.push('player:verdeckt');
  return res;
};

await p.goto(`http://localhost:${port}/?q=1&ladebudget=300`);
await p.waitForSelector('#mainmenu.show', { timeout: 240000 });
await shot('00-start');
// echter Klick: findet unsichtbare Ebenen, die Klicks abfangen
await p.click('#mainmenu [data-id=new]', { timeout: 30000 });
await p.waitForSelector('.outfit', { timeout: 60000 });
await shot('01-outfit');
await p.click('.outfit .btn.primary', { timeout: 30000 });
await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('#skip')?.click());
await p.waitForFunction(() => document.body.classList.contains('is-inside'), null, { timeout: 240000 });
await shot('02-drinnen');
// Laufen per Tastatur (echte Schleife)
if (+w >= 900) {
  const before = await p.evaluate(() => {
    const q = window.__world.player.ch.root.position;
    return [q.x, q.z];
  });
  await p.keyboard.down('KeyW');
  await p.waitForTimeout(3000);
  await p.keyboard.up('KeyW');
  await p.keyboard.down('KeyA');
  await p.waitForTimeout(1500);
  await p.keyboard.up('KeyA');
  const after = await p.evaluate(() => {
    const q = window.__world.player.ch.root.position;
    return [q.x, q.z];
  });
  notes.push(`laufen: ${before.map((v) => v.toFixed(2))} -> ${after.map((v) => v.toFixed(2))}`);
  await shot('03-gelaufen');
}
// alle freien Plätze im Teehaus; dazu zwei Bänke im Dorf, dort startet die Figur davor
const seats = await p.evaluate(() =>
  window.__world.interactables
    .filter((i) => i.id.startsWith('sit-'))
    .filter((i) => {
      const q = i.pos();
      return Math.abs(q.x) < 8 && q.z < 8;
    })
    .map((i) => i.id),
);
seats.push('sit-bank-0', 'sit-bank-2');
// Plätze, auf denen gerade ein Dorfbewohner sitzt, sind gesperrt
const busySeat = await p.evaluate(() => {
  const w = window.__world;
  const v = window.__villagers.list.find((r) => r.sitting);
  if (!v) return null;
  const it = w.interactables.find(
    (i) => i.id.startsWith('sit-') && i.pos().distanceTo({ x: v.x, y: i.pos().y, z: v.z }) < 0.4,
  );
  return it ? [it.id, it.enabled()] : null;
});
if (busySeat) expectEq(`besetzt ${busySeat[0]}`, busySeat[1], false);
for (const id of seats) {
  await p.evaluate((id) => {
    const w = window.__world;
    const it = w.interactables.find((i) => i.id === id);
    const q = it.pos();
    if (Math.abs(q.x) < 8 && q.z < 8) w.player.place(-1.1, 1.8, 0);
    else {
      // freien Punkt nahe am Platz suchen
      const n = w.nav.nearest(q.x + 1.2, q.z + 1.2, 3) ?? [q.x + 1.5, q.z];
      w.player.place(n[0], n[1], 0);
    }
    if (!it.enabled || it.enabled()) it.use();
  }, id);
  await sim(15);
  const st = await p.evaluate(() => {
    const pl = window.__world.player;
    return [pl.seated, pl.seat?.id];
  });
  expectEq(`sitzen ${id}`, st, [true, id.slice(4)]);
  if (id === seats[0]) await shot('04-sitzt');
  await p.evaluate(() => window.__world.player.standUp());
  await sim(2);
}
await p.evaluate(() => window.__game.heroes.enterYao());
for (let i = 0; i < 12; i++) await sim(2);
// Gespräch
await p.evaluate(() => {
  const w = window.__world;
  w.player.place(4.4, -1.4, Math.PI);
  w.interactables.find((i) => i.id === 'talk-jackie').use();
});
await sim(1.5);
await shot('05-weg');
for (let i = 0; i < 12; i++) {
  await sim(1);
  if (await p.evaluate(() => window.__world.mode === 'dialog')) break;
}
expectEq(
  'nach Weg',
  await p.evaluate(() => [window.__world.mode, window.__world.player.seated, window.__world.player.seat?.id]),
  ['dialog', true, 'main-2'],
);
await sim(2);
await shot('06-dialog');
await check('verdeckt (Hinweis)', covered);
await p.evaluate(() => document.querySelector('.dlg3 .btn.primary')?.click());
await p.evaluate(() => document.querySelector('.dlg3 .q:not([disabled])')?.click());
await sim(2);
await p.evaluate(() => window.__game.bubbles.skip('jackie'));
await sim(3);
await shot('07-antwort');
expectEq('verdeckt (Antwort)', await p.evaluate(covered), []);
expectEq(
  'Blasen überlappen',
  await p.evaluate(() => {
    const r = [...document.querySelectorAll('.bubble:not(.offscreen)')]
      .map((e) => e.getBoundingClientRect())
      .filter((x) => x.width);
    let n = 0;
    for (let i = 0; i < r.length; i++)
      for (let j = i + 1; j < r.length; j++)
        if (
          r[i].left < r[j].right &&
          r[i].right > r[j].left &&
          r[i].top < r[j].bottom &&
          r[i].bottom > r[j].top
        )
          n++;
    return n;
  }),
  0,
);
await check('Blasen im Bild', () =>
  [...document.querySelectorAll('.bubble:not(.offscreen)')].map((e) => {
    const x = e.getBoundingClientRect();
    return x.top >= 0 && x.left >= 0 && x.right <= innerWidth + 1;
  }),
);
await check('Panel-Anteil', () => {
  const r = document.querySelector('.dlg3').getBoundingClientRect();
  return +((r.width * r.height) / (innerWidth * innerHeight)).toFixed(2);
});
expectEq(
  'Panel abgeschnitten',
  await p.evaluate(() => {
    const r = document.querySelector('.dlg3').getBoundingClientRect();
    return r.top < 0 || r.bottom > innerHeight + 1 || r.right > innerWidth + 1;
  }),
  false,
);
// Wechsel zu Yao
await p.evaluate(() => document.querySelector('.dlg3-tools .btn.small')?.click());
await sim(3);
await shot('08-yao');
expectEq('verdeckt (Yao)', await p.evaluate(covered), []);
await p.keyboard.press('Escape');
await sim(3);
expectEq(
  'nach Esc',
  await p.evaluate(() => [
    window.__world.mode,
    document.querySelector('.dlg3').hidden,
    window.__world.player.seated,
    window.__game.talking,
  ]),
  ['free', true, false, false],
);
// Esc während des Weges
await p.evaluate(() => {
  const w = window.__world;
  w.player.place(2, -1, 0);
  w.interactables.find((i) => i.id === 'talk-yao').use();
});
await sim(0.5);
await p.keyboard.press('Escape');
await sim(2);
expectEq(
  'Esc unterwegs',
  await p.evaluate(() => [
    window.__world.mode,
    window.__game.talking,
    !!document.querySelector('.approach-hint'),
  ]),
  ['free', false, false],
);
// Tageszeiten
for (const [i, n] of [
  [0, 'tag'],
  [1, 'abend'],
  [2, 'nacht'],
]) {
  await p.evaluate((i) => document.querySelectorAll('#hud [data-time]')[i]?.click(), i);
  await p.waitForTimeout(2500);
  await shot(`09-${n}`);
}
// Panels
for (const [sel, n] of [
  ['#hud .hud-words', 'woerter'],
  ['#hud [aria-label="Info und Hilfe"]', 'info'],
  ['#hud [aria-label="Ton-Einstellungen"]', 'ton'],
]) {
  const ok = await p.evaluate((sel) => {
    const e = document.querySelector(sel);
    e?.click();
    return !!e;
  }, sel);
  await p.waitForTimeout(800);
  if (ok) await shot(`10-${n}`);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
}
await check(
  'offene Dialoge',
  () =>
    [...document.querySelectorAll('dialog[open], .modal:not([hidden]), .sound-panel:not([hidden])')].length,
);
await check('Leistung', () => {
  const w = window.__world;
  const t0 = performance.now();
  for (let i = 0; i < 60; i++) {
    for (const a of w.agents) a.update(1 / 60, null);
  }
  return +((performance.now() - t0) / 60).toFixed(2);
});
console.log(notes.join('\n'));
console.log('--- Konsole');
console.log([...new Set(logs)].slice(0, 20).join('\n') || 'keine Fehler');
await b.close();
if (logs.some((l) => l.startsWith('pageerror') || l.startsWith('error'))) failed++;
console.log(failed ? `${failed} Prüfung(en) fehlgeschlagen` : 'alle Prüfungen bestanden');
process.exit(failed ? 1 : 0);
