// Langzeittest (P4): das Spiel läuft MINUTES Minuten (Standard 20) echt weiter. Jede Minute wechselt die
// Spielfigur den Ort (Teehaus, Teich, Dorfplatz, Terrassen, Drachenwiese), Tageszeit und Wetter wechseln, Ereignisse
// werden ausgelöst. Gemessen wird jede Minute: JS-Speicher, Geometrien, Texturen, Shader, Draw-Calls, Bildrate.
// Prüft am Ende: kein Speicherleck (Wachstum nach der Aufwärmphase begrenzt), Geometrien/Texturen stabil,
// Bildrate fällt nicht ab, keine Konsolenfehler. Exit-Code 1 bei Fehlern.
// Aufruf (Build muss laufen): MINUTES=20 node scripts/test/langzeit.mjs [port] [ausgabe.json]
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const [, , port = '4173', outFile = ''] = process.argv;
const MINUTES = Number(process.env.MINUTES ?? 20);
// MODE=schnell: jede Minute Spielzeit wird im Schnelldurchlauf gerechnet (1200 Logikschritte à 50 ms, dazwischen
// wird normal gezeichnet). Gemessen wird dann die Logikzeit je Bild statt der Bildrate (in der Software-Grafik
// der Testumgebung ist die Bildrate ohnehin nicht aussagekräftig).
const FAST = process.env.MODE === 'schnell';
const fs = await import('node:fs');

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-precise-memory-info',
    '--js-flags=--expose-gc',
  ],
});
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await p.goto(`http://localhost:${port}/?q=${process.env.Q ?? 1}&ladebudget=300`);
await p.waitForSelector('#mainmenu.show', { timeout: 600000 });
await p.click('#mainmenu [data-id=new]');
await p.waitForSelector('.outfit');
await p.click('.outfit .btn.primary');
await p.click('#skip');
await p.waitForFunction(() => window.__world?.mode === 'free', null, { timeout: 300000 });
await p.evaluate(() => document.querySelector('.tutorial .btn.ghost')?.click());
// Bildzähler im Seitenkontext
await p.evaluate(() => {
  window.__frames = 0;
  const f = () => {
    window.__frames++;
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
});

const SPOTS = [
  ['Teehaus', 0, 5, Math.PI],
  ['Teich', -1, 20, Math.PI],
  ['Dorfplatz', 40, 70.5, Math.PI],
  ['Terrassen', -30, 100, 0],
  ['Drachenwiese', 27, 70, -2.4],
];
const PHASES = [0.05, 0.28, 0.55, 0.82];
const WEATHER = ['klar', 'regen', 'nebel', 'klar', 'wolkig'];
const rows = [];
const t0 = Date.now();
for (let m = 0; m < MINUTES; m++) {
  const [name, x, z, yaw] = SPOTS[m % SPOTS.length];
  await p.evaluate(
    ([x, z, yaw, u, wx, m]) => {
      const w = window.__world;
      w.player.place(x, z, yaw);
      w.cam.snapBehind(yaw);
      w.auto = true;
      w.autoPhase = u * Math.PI * 2 - Math.PI / 2;
      w.weather.set(wx);
      const pl = window.__plaza;
      if (m % 3 === 1) pl?.startDragon();
      if (m % 4 === 2) pl?.startFishCat();
      if (m % 5 === 3) window.__game?.photo?.shoot();
    },
    [x, z, yaw, PHASES[m % 4], WEATHER[m % WEATHER.length], m],
  );
  let fps;
  let msTick = 0;
  if (FAST) {
    msTick = await p.evaluate(() => {
      const w = window.__world;
      const t = performance.now();
      for (let i = 0; i < 1200; i++) w.tick(0.05, 0.05);
      return (performance.now() - t) / 1200;
    });
    await p.waitForTimeout(3000);
    fps = 1000 / Math.max(0.01, msTick);
  } else {
    // eine Minute laufen lassen, Bilder zählen (die letzten 20 s)
    await p.waitForTimeout(40000);
    const f0 = await p.evaluate(() => window.__frames);
    const s0 = Date.now();
    await p.waitForTimeout(20000);
    const f1 = await p.evaluate(() => window.__frames);
    fps = ((f1 - f0) * 1000) / (Date.now() - s0);
  }
  const r = await p.evaluate(() => {
    window.gc?.();
    const w = window.__world;
    const i = w.renderer.info;
    return {
      heap: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576),
      geo: i.memory.geometries,
      // ohne Knochen-Texturen: jede Figur bekommt beim ersten Zeichnen eine (begrenzt durch die Zahl der Skelette)
      tex:
        i.memory.textures -
        (() => {
          const sk = new Set();
          w.scene.traverse((o) => o.isSkinnedMesh && o.skeleton?.boneTexture && sk.add(o.skeleton));
          return sk.size;
        })(),
      prog: i.programs?.length ?? 0,
      calls: i.render.calls,
      quality: w.quality,
    };
  });
  rows.push({
    min: m + 1,
    ort: name,
    fps: Math.round(fps * 10) / 10,
    msTick: Math.round(msTick * 100) / 100,
    ...r,
  });
  console.log(JSON.stringify(rows[rows.length - 1]));
}

// Auswertung: ab Minute 3 (Aufwärmphase: Figuren, Shader, Texturen entstehen beim ersten Besuch jedes Orts)
let failed = 0;
const ok = (label, cond, info = '') => {
  if (!cond) failed++;
  console.log(`${cond ? 'OK  ' : 'FEHL'} ${label}${info !== '' ? `: ${info}` : ''}`);
};
const warm = rows.slice(Math.min(rows.length - 1, SPOTS.length));
const first = warm[0];
const last = warm[warm.length - 1];
const maxHeap = Math.max(...warm.map((r) => r.heap));
ok(
  'JS-Speicher ohne Leck (Anstieg nach Aufwärmen < 25 %)',
  last.heap <= first.heap * 1.25 + 8,
  `${first.heap} → ${last.heap} MB (max ${maxHeap})`,
);
ok('Geometrien stabil (< 10 % mehr)', last.geo <= first.geo * 1.1 + 20, `${first.geo} → ${last.geo}`);
ok('Texturen stabil (< 10 % mehr)', last.tex <= first.tex * 1.1 + 5, `${first.tex} → ${last.tex}`);
ok('Shader stabil', last.prog <= first.prog + 6, `${first.prog} → ${last.prog}`);
// gleiche Orte vergleichen: Bildrate in der zweiten Hälfte nicht deutlich unter der ersten
const half = Math.floor(warm.length / 2);
const avg = (a) => a.reduce((s, r) => s + r.fps, 0) / Math.max(1, a.length);
const fa = avg(warm.slice(0, half));
const fb = avg(warm.slice(half));
if (FAST) {
  // gleiche Orte vergleichen: zweite Runde (Minute 6–10) gegen die letzte Runde
  const cmp = (a) => a.reduce((s2, r) => s2 + r.msTick, 0) / Math.max(1, a.length);
  const ta = cmp(rows.slice(5, 10));
  const tb = cmp(rows.slice(-5));
  ok(
    'Logikzeit je Bild steigt nicht (letzte Runde ≤ 125 % der zweiten)',
    tb <= ta * 1.25 + 0.3,
    `${ta.toFixed(2)} → ${tb.toFixed(2)} ms`,
  );
} else
  ok(
    'Bildrate fällt nicht ab (zweite Hälfte ≥ 85 % der ersten)',
    fb >= fa * 0.85,
    `${fa.toFixed(1)} → ${fb.toFixed(1)} fps`,
  );
ok('keine Konsolenfehler', errs.length === 0, errs.slice(0, 5).join(' | '));
console.log(`Dauer ${((Date.now() - t0) / 60000).toFixed(1)} min`);
if (outFile) fs.writeFileSync(outFile, JSON.stringify({ rows, errs }, null, 2));
await b.close();
process.exit(failed ? 1 : 0);
