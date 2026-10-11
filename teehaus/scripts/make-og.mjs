// Erzeugt public/og.png (1200×630) aus dem Startbild – selbst gezeichnet, kein Fremdmaterial.
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
// Vorschaubild = Startbild (gemalter Hintergrund, 茶馆, Pinyin, Titel), ohne Knopf; der Hinweis bleibt klein unten
await page.waitForSelector('#enter:not([disabled])', { timeout: 240000 });
await page.evaluate(() => {
  const css = document.createElement('style');
  css.textContent = '#enter,.bar,.petals{display:none!important}';
  document.head.appendChild(css);
});
await page.waitForTimeout(3000);
await page.screenshot({ path: out, type: 'png', timeout: 120000 });
await browser.close();
console.log('geschrieben:', out);
