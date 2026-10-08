// Erzeugt public/og.png (1200×630) aus der echten Szene – selbst gezeichnet, kein Fremdmaterial.
// Benötigt Playwright (npm i -D playwright) und einen laufenden Dev-Server:
//   npm run dev   (anderes Terminal)
//   node scripts/make-og.mjs http://localhost:5173
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright fehlt: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}
const url = process.argv[2] ?? 'http://localhost:5173';
const out = join(dirname(fileURLToPath(import.meta.url)), '../public/og.png');

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(url);
await page.waitForSelector('#enter:not([disabled])', { timeout: 240000 });
await page.evaluate(() => document.querySelector('#enter').click());
await page.evaluate(() => document.querySelector('#skip')?.click());
await page.waitForFunction(() => document.body.classList.contains('is-inside'), null, { timeout: 240000 });
await page.evaluate(() => {
  const s = window.__teehaus;
  s.setTime('golden', true);
  s.goTo('outside');
  if (s.fly) s.fly.t = 1;
  // Ohne Fotos: das Vorschaubild zeigt nur die selbst erzeugte Szene (keine Lizenzpflichten beim Teilen)
  for (const f of Object.values(s.cast)) f.group.visible = false;
  const css = document.createElement('style');
  css.textContent =
    '#hud,#pick,#loader,#captions,#skip,#bubbles,.wordcard,#toast,.cam-seg{display:none!important}';
  document.head.appendChild(css);
});
await page.waitForTimeout(8000);
// Titel-Overlay (nur im Bild, nicht in der App)
await page.evaluate(() => {
  const o = document.createElement('div');
  o.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;padding:34px 48px 30px;z-index:99;color:#f3e7cc;' +
    'background:linear-gradient(0deg,rgba(20,11,8,.92) 0%,rgba(20,11,8,.7) 55%,rgba(20,11,8,0) 100%);' +
    'display:flex;align-items:flex-end;gap:26px;font-family:Georgia,serif';
  o.innerHTML =
    "<div style=\"font:700 120px/1 'Ma Shan Zheng','Noto Serif SC',serif;text-shadow:0 0 40px rgba(179,38,26,.9)\">茶馆</div>" +
    '<div style="padding-bottom:10px"><div style="font-size:50px;font-weight:600;letter-spacing:.04em">Das Teehaus</div>' +
    '<div style="font-size:26px;color:#d9a94a;margin-top:4px">Gespräche bei Tee · Chinesisch lernen mit Pinyin</div>' +
    '<div style="font-size:17px;opacity:.75;margin-top:8px">Fiktives Gespräch mit Jackie Chan und Yao Ming, basiert auf öffentlich bekannten Fakten</div></div>';
  document.body.appendChild(o);
});
await page.waitForTimeout(600);
await page.screenshot({ path: out, type: 'png' });
await browser.close();
console.log('public/og.png geschrieben');
