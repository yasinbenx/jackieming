// Hänger-Test: spielt Tageslauf, Wetter, Dorf, Karte, Gespräch und einen Qualitätswechsel durch und zeichnet
// dabei jede Blockade des Hauptthreads über 80 ms auf, mit den Funktionen, die in ihrem Zeitfenster liefen, und
// jedem Shader, dessen Übersetzung länger als 150 ms dauerte. Exit-Code 1, wenn eine Blockade über 500 ms dauert.
// Aufruf (Build muss laufen): node scripts/test/haenger.mjs [port] [qualität 0–2]
// Benötigt Playwright oder PLAYWRIGHT_MODULE/CHROMIUM_PATH (wie rundgang.mjs).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const [, , port = '4173', Q = '1'] = process.argv;
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.addInitScript(() => {
  window.__used = [];
  const proto = WebGL2RenderingContext.prototype;
  const orig = proto.getProgramInfoLog;
  proto.getProgramInfoLog = function (prog) {
    const t = performance.now();
    const r = orig.call(this, prog);
    window.__used.push([t, performance.now() - t, prog]);
    return r;
  };
  window.__lt = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]);
  }).observe({ type: 'longtask', buffered: true });
  window.__marks = [];
});
await p.goto(`http://localhost:${port}/?q=${Q}`);
await p.waitForSelector('#mainmenu.show', { timeout: 400000 });
await p.click('#mainmenu [data-id=new]');
await p.waitForSelector('.outfit');
await p.click('.outfit .btn.primary');
await p.click('#skip');
await p.waitForFunction(() => document.body.classList.contains('is-inside'), null, { timeout: 300000 });
await p.evaluate(() => document.querySelector('.tutorial .btn.ghost')?.click());
await p.waitForTimeout(3000);
const cdp = await p.context().newCDPSession(p);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
await cdp.send('Profiler.start');
const t0 = await p.evaluate(() => performance.now());
const step = async (name, fn, ms = 4000) => {
  await p.evaluate((n) => window.__marks.push([performance.now(), n]), name);
  await fn();
  await p.waitForTimeout(ms);
};
const place = (x, z, yaw) =>
  p.evaluate(
    ([x, z, yaw]) => {
      const w = window.__world;
      w.player.place(x, z, yaw);
      w.cam.snapBehind(yaw);
    },
    [x, z, yaw],
  );
const walk = (x, z) =>
  p.evaluate(([x, z]) => window.__world.player.walkTo?.(x, z) ?? window.__world.player.goTo?.(x, z), [x, z]);
await step('innen laufen', () => p.evaluate(() => window.__world.player.goTo(3, -3)));
await step('raus zum Teich', () => place(2, 22, Math.PI));
await step(
  'Tageszeit automatisch, schnell',
  () =>
    p.evaluate(() => {
      const w = window.__world;
      w.setTime('auto');
      let k = 0;
      const id = setInterval(() => {
        w.autoPhase += 0.35;
        if (++k > 12) clearInterval(id);
      }, 700);
    }),
  10000,
);
await step('Abend', () => p.evaluate(() => window.__world.setTime('golden')), 5000);
await step('Nacht', () => p.evaluate(() => window.__world.setTime('night')), 5000);
await step('Tag', () => p.evaluate(() => window.__world.setTime('day')), 5000);
await step(
  'Wetter Regen',
  () =>
    p.evaluate(() => {
      window.__world.weather.fixed = 'regen';
    }),
  6000,
);
await step(
  'Wetter Nebel',
  () =>
    p.evaluate(() => {
      window.__world.weather.fixed = 'nebel';
    }),
  5000,
);
await step(
  'Wetter klar',
  () =>
    p.evaluate(() => {
      window.__world.weather.fixed = 'klar';
    }),
  3000,
);
await step('ins Dorf', () => place(30, 50, 0.4), 6000);
await step('Dorfplatz', () => place(40, 62, 2.6), 6000);
await step(
  'Bewohner ansprechen',
  () =>
    p.evaluate(() => {
      const w = window.__world;
      const it = w.interactables
        .filter((i) => i.id.startsWith('talk-v-') && i.enabled())
        .sort(
          (a, b) =>
            a.pos().distanceTo(w.player.ch.root.position) - b.pos().distanceTo(w.player.ch.root.position),
        )[0];
      it?.use();
    }),
  5000,
);
await step('Karte', () => p.keyboard.press('m'), 2500);
await step('Karte zu', () => p.keyboard.press('Escape'), 1500);
await step('Terrassen', () => place(-40, 70, 2.5), 6000);
await step('Schrein', () => place(-30, 100, 0), 6000);
await step('Wörterbuch', () => p.evaluate(() => window.__game.dict.open()), 2000);
await step('Wörterbuch zu', () => p.keyboard.press('Escape'), 1500);
await step('zurück ins Teehaus (Reise)', () => place(0, 2, Math.PI), 6000);
await step('Gespräch Jackie', () => p.evaluate(() => window.__game.startTalk('jackie')), 9000);
await step('Gespräch Ende', () => p.keyboard.press('Escape'), 3000);
await step(
  'Qualitätswechsel Automatik',
  () => p.evaluate(() => window.__world.setQuality(Math.max(0, window.__world.quality - 1), false)),
  6000,
);
const t1 = await p.evaluate(() => performance.now());
const { profile } = await cdp.send('Profiler.stop');
const lt = (await p.evaluate(() => window.__lt)).filter(([s]) => s > t0 && s < t1 && true);
const marks = await p.evaluate(() => window.__marks);
// Profil-Zeitstempel (µs, Monotonic) auf performance.now abbilden: Profilstart ~ t0
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
let ts = profile.startTime;
const samples = profile.samples.map((id, i) => {
  ts += profile.timeDeltas[i];
  return [ts, id];
});
const off = t0 - profile.startTime / 1000; // grob
const name = (n) =>
  `${n.callFrame.functionName || '(anon)'}@${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`;
for (const [s, d] of lt.filter(([, d]) => d > 80)) {
  const mark = marks.filter(([m]) => m <= s).pop()?.[1] ?? '?';
  const self = new Map();
  const incl = new Map();
  for (const [t, id] of samples) {
    const tt = t / 1000 + off;
    if (tt < s || tt > s + d) continue;
    const n = byId.get(id);
    self.set(name(n), (self.get(name(n)) ?? 0) + 1);
    const seen = new Set();
    let cur = id;
    while (cur) {
      const nn = byId.get(cur);
      const k = name(nn);
      if (!seen.has(k)) {
        seen.add(k);
        incl.set(k, (incl.get(k) ?? 0) + 1);
      }
      cur = parent.get(cur);
    }
  }
  const top = (m) =>
    [...m]
      .filter(([k]) => !/^\(root|^\(program|^\(idle/.test(k))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, v]) => `${k}×${v}`)
      .join(' | ');
  console.log(
    `\n${Math.round(d)} ms bei „${mark}“ (+${((s - t0) / 1000).toFixed(1)} s)\n  selbst: ${top(self)}\n  inkl.: ${top(incl)}`,
  );
}
const used = await p.evaluate(() => {
  const progs = window.__world.renderer.info.programs;
  return window.__used.map(([t, d, h]) => {
    const pr = progs.find((x) => x.program === h);
    return [t, d, pr ? `${pr.name} (${pr.cacheKey.slice(0, 40)})` : '?'];
  });
});
for (const [t, d, n] of used)
  if (d > 150 && t > t0)
    console.log(`  langsamer Shader: ${n} ${Math.round(d)} ms bei +${((t - t0) / 1000).toFixed(1)} s`);
for (let i = 0; i < marks.length; i++) {
  const [m, n] = marks[i];
  const e = marks[i + 1]?.[0] ?? 1e12;
  const u = used.filter(([t]) => t >= m && t < e);
  if (u.length)
    console.log(
      `Shader-Prüfungen bei „${n}“: ${u.length}, ${Math.round(u.reduce((a, [, d]) => a + d, 0))} ms`,
    );
}
console.log(
  '\nlange Aufgaben >80 ms:',
  lt.filter(([, d]) => d > 80).length,
  'Summe',
  Math.round(lt.reduce((a, [, d]) => a + d, 0)),
  'ms',
);
console.log('errors', errs.slice(0, 4));
const worst = Math.max(0, ...lt.map(([, d]) => d));
await b.close();
process.exit(worst > 500 ? 1 : 0);
