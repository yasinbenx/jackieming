// Belastungstest: Laden und Übergang ins Spiel unter erschwerten Bedingungen (Chrome-DevTools-Drosselung über
// CDP). Prüft je Szenario: Hauptmenü erscheint, Übergang ins Spiel endet im freien Spiel,
// die Hauptschleife läuft weiter, die Figur lässt sich bewegen, keine Konsolenfehler (Warnungen über
// Zeitlimits sind erlaubt und werden ausgegeben). Exit-Code 1 bei Fehlern.
// Aufruf (Build muss laufen): node scripts/test/belastung.mjs [port] [szenario …]
//   Szenarien: netz (langsames Netz), cpu (CPU 4× gedrosselt), alle (Standard). Nur Desktop.
// Benötigt Playwright oder PLAYWRIGHT_MODULE/CHROMIUM_PATH (wie rundgang.mjs).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const [, , port = '4173', ...wanted] = process.argv;
const all = ['netz', 'cpu'];
const run = wanted.length && !wanted.includes('alle') ? wanted : all;
const URL = `http://localhost:${port}/?q=0&debug`;
let failed = 0;
const ok = (label, cond, info = '') => {
  if (!cond) failed++;
  console.log(
    `${cond ? 'OK  ' : 'FEHL'} ${label}${info !== '' ? `: ${typeof info === 'string' ? info : JSON.stringify(info)}` : ''}`,
  );
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

async function scenario(name) {
  console.log(`\n── ${name}`);
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errors = [];
  const warns = [];
  p.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error') errors.push(t.slice(0, 200));
    else if (t.includes('[Teehaus]') && m.type() === 'warning') warns.push(t.split(' {')[0].slice(0, 160));
  });
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const cdp = await ctx.newCDPSession(p);
  if (name === 'netz') {
    // etwa „Fast 3G“: 1,6 Mbit/s, 150 ms Latenz
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  }
  if (name === 'cpu') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  await p.goto(URL, { timeout: 600000 });
  await p.waitForSelector('#mainmenu.show', { timeout: 900000 });
  ok('Hauptmenü erscheint', true, `${((Date.now() - t0) / 1000).toFixed(0)} s`);
  // Neues Spiel bis ins Teehaus
  const t1 = Date.now();
  await p.click('#mainmenu [data-id=new]');
  await p.waitForSelector('.outfit');
  await p.click('.outfit .btn.primary');
  const inGame = await p
    .waitForFunction(
      () => document.body.classList.contains('is-inside') && window.__world?.mode === 'free',
      null,
      {
        timeout: 300000,
      },
    )
    .then(() => true)
    .catch(() => false);
  ok('Übergang ins Spiel endet im freien Spiel', inGame, `${((Date.now() - t1) / 1000).toFixed(0)} s`);
  await p.evaluate(() => document.querySelector('.tutorial .btn.ghost')?.click());
  // läuft die Schleife, reagiert die Figur?
  const f0 = await p.evaluate(() => window.__world.frames);
  {
    // Bei sehr wenigen Bildern pro Sekunde (Software-Grafik + Drosselung) bewegt sich die Figur in 4 s kaum;
    // geprüft wird darum, dass die Taste ankommt und die Figur Fahrt aufnimmt
    await p.keyboard.down('KeyW');
    const t = Date.now();
    let speed = 0;
    while (Date.now() - t < 8000 && speed < 0.05) {
      await p.waitForTimeout(500);
      speed = await p.evaluate(() => window.__world.player.vel.length());
    }
    await p.keyboard.up('KeyW');
    ok('Taste kommt an, Figur nimmt Fahrt auf', speed > 0.05, `${speed.toFixed(2)} m/s`);
  }
  await p.waitForTimeout(5000);
  const f1 = await p.evaluate(() => window.__world.frames);
  ok('Hauptschleife läuft', f1 > f0, `${f1 - f0} Bilder in ~9 s`);
  const load = await p.evaluate(() => {
    const d = document.getElementById('debug');
    return d?.textContent?.split('\n').find((l) => l.startsWith('Laden')) ?? '';
  });
  if (load) console.log('     ' + load);
  ok('keine Konsolenfehler', errors.length === 0, errors.slice(0, 3));
  if (warns.length)
    console.log('     Warnungen:\n       ' + [...new Set(warns)].slice(0, 8).join('\n       '));
  await ctx.close();
}

for (const s of run) await scenario(s);
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : '\nalle Prüfungen bestanden');
await b.close();
process.exit(failed ? 1 : 0);
