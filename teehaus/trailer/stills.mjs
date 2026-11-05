// Standbilder der Mini-Spiele für den Trailer (echte Screenshots aus dem Spiel, 1920×1080). Die Fenster der
// Mini-Spiele sind HTML und liegen über der 3D-Szene, darum hier echte Seiten-Screenshots statt Canvas-Bilder.
// Aufruf (Build muss laufen): node trailer/stills.mjs [port]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [, , port = '5300'] = process.argv;
const OUT = path.join(HERE, 'work', 'stills');
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await p.goto(`http://localhost:${port}/?q=2&ladebudget=300&wetter=klar&jahreszeit=fruehling`);
await p.waitForSelector('#mainmenu.show', { timeout: 600000 });
await p.click('#mainmenu [data-id=new]');
await p.waitForSelector('.outfit');
await p.click('.outfit .btn.primary');
await p.click('#skip');
await p.waitForFunction(() => window.__world?.mode === 'free', null, { timeout: 300000 });
await p.evaluate(() => document.querySelector('.tutorial .btn.ghost')?.click());
// Spieloberfläche (Kopfleiste, Hinweise) ausblenden, die Fenster der Mini-Spiele bleiben
await p.addStyleTag({
  content:
    '#hud,.act-prompt,.hud-toast,.tutorial,.wordcard,.toast,#bubbles,.hero-tag,.name-tag,[class*="tag"]{display:none!important}',
});
const settle = async (s) => {
  await p.evaluate((s) => {
    const w = window.__world;
    for (let i = 0; i < s * 20; i++) w.tick(0.05, 0.05);
  }, s);
  await p.waitForTimeout(3500);
};
const wait = (sel) =>
  p
    .waitForFunction((s) => document.querySelector(s)?.getAnimations().every((a) => a.playState !== 'running'), sel, {
      timeout: 30000,
    })
    .catch(() => undefined);

// 1) Tee zubereiten: im Teehaus, goldene Stunde
await p.evaluate(() => {
  const w = window.__world;
  w.auto = false;
  w.t = w.tTarget = 0.42;
  w.applyTime(true);
  w.player.place(-2.5, -1.5, Math.PI * 0.75);
  w.cam.snapBehind(Math.PI * 0.75);
});
await settle(4);
await p.evaluate(() => window.__game.tea.start());
await wait('.teagame');
await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(OUT, 'tee.png') });
await p.evaluate(() => window.__game.tea.close());
console.log('tee');

// 2) Xiangqi
await p.evaluate(() => window.__game.xq.start());
await wait('.xiangqi');
await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(OUT, 'xiangqi.png') });
await p.evaluate(() => window.__game.xq.close());
console.log('xiangqi');

// 3) Angeln am Teich, Tag
await p.evaluate(() => {
  const w = window.__world;
  w.t = w.tTarget = 0.15;
  w.applyTime(true);
  const f = window.__game.fishing;
  const s = f.spots.find((s) => s.where === 'teich') ?? f.spots[0];
  w.player.place(s.x, s.z, Math.atan2(s.wx - s.x, s.wz - s.z));
  w.cam.snapBehind(Math.atan2(s.wx - s.x, s.wz - s.z));
  w.cam.pitch = 0.32;
  w.cam.dist = 5;
  f.start(s);
  f.waitFor = 0.1;
});
await settle(1.5);
await p.keyboard.down('Space');
await settle(1.2);
await p.keyboard.up('Space');
await p.waitForTimeout(800);
await p.screenshot({ path: path.join(OUT, 'angeln.png') });
console.log('angeln');
await b.close();
