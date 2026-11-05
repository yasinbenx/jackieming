// Einblendungen für den Trailer: Titel, Untertitel, Sprechblase, Wortkarte, Schlusskarte und Hinweis.
// Jede Karte wird als HTML mit den Schriften des Spiels (Ma Shan Zheng, Noto Serif SC – SIL OFL, vollständig aus
// @fontsource) gesetzt und als PNG (1920×1080, transparent) gespeichert. Aufruf: node trailer/overlays.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const NM = path.join(HERE, '..', 'node_modules', '@fontsource');
const OUT = path.join(HERE, 'work', 'overlays');
fs.mkdirSync(OUT, { recursive: true });

const css = `
@import url('file://${NM}/ma-shan-zheng/index.css');
@import url('file://${NM}/noto-serif-sc/400.css');
@import url('file://${NM}/noto-serif-sc/700.css');
html, body { margin: 0; width: 1920px; height: 1080px; background: transparent; overflow: hidden; }
body { font-family: 'Noto Serif SC', 'WenQuanYi Zen Hei', serif; color: #f6ead2; }
.brush { font-family: 'Ma Shan Zheng', 'Noto Serif SC', serif; }
.shadow { text-shadow: 0 2px 18px rgba(0,0,0,.75), 0 0 2px rgba(0,0,0,.9); }
.cap { position: absolute; left: 110px; bottom: 110px; padding: 18px 30px 20px; border-left: 4px solid #e3b450;
  background: linear-gradient(90deg, rgba(20,12,8,.72), rgba(20,12,8,0)); font-size: 40px; }
.cap small { display: block; font-size: 28px; color: #e8cf9c; margin-top: 6px; }
.cap b { font-family: 'Ma Shan Zheng', serif; font-weight: 400; color: #ffcf73; font-size: 48px; margin-right: 10px; }
i { font-style: italic; color: #e3b450; }
`;

const CARDS = {
  titel: `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center" class="shadow">
    <div class="brush" style="font-size:260px;line-height:1;color:#ffd98a;text-shadow:0 0 60px rgba(255,170,80,.55),0 4px 24px rgba(0,0,0,.8)">茶馆</div>
    <div style="font-size:54px;margin-top:6px"><i>cháguǎn</i></div>
    <div style="font-size:64px;margin-top:4px;letter-spacing:.06em">Das Teehaus</div></div>`,
  anflug: `<div class="cap shadow">Ein kleines Teehaus im Tal<small>山谷 <i>shāngǔ</i> – das Tal</small></div>`,
  innen1: `<div class="cap shadow">Zwei berühmte Gäste warten auf dich<small>成龙 <i>Chéng Lóng</i> · 姚明 <i>Yáo Míng</i></small></div>`,
  bubble: `<div style="position:absolute;right:170px;top:150px;max-width:620px;padding:22px 30px 24px;background:#fbf4e3;color:#2a1c10;
      border-radius:18px;box-shadow:0 8px 30px rgba(0,0,0,.45);font-size:38px;line-height:1.35">
      <span style="display:inline-block;background:#5a3a22;color:#fbe9c8;border-radius:8px;padding:2px 12px;font-size:28px;margin-right:12px;vertical-align:4px">茶师</span>欢迎光临！ Herzlich willkommen im Teehaus.
      <div style="position:absolute;left:70px;bottom:-26px;width:0;height:0;border:16px solid transparent;border-top:16px solid #fbf4e3"></div></div>`,
  wortkarte: `<div style="position:absolute;left:110px;top:150px;width:520px;padding:26px 34px 30px;border-radius:14px;
      background:linear-gradient(180deg,#fbf4e3,#efe0c0);color:#2a1c10;box-shadow:0 0 0 6px #6a4a2a,0 14px 40px rgba(0,0,0,.5)">
      <div style="font-size:24px;color:#9b2a1a;letter-spacing:.08em">NEUES WORT · 新词</div>
      <div class="brush" style="font-size:110px;line-height:1.1;color:#9b2a1a">欢迎光临</div>
      <div style="font-size:36px"><i style="color:#b0702a">huānyíng guānglín</i></div>
      <div style="font-size:34px;margin-top:6px">Herzlich willkommen</div></div>`,
  dorf1: `<div class="cap shadow">Ein Dorf voller Leben<small>市场 <i>shìchǎng</i> – der Markt</small></div>`,
  dorf2: `<div class="cap shadow">Abends leuchten die Laternen<small>灯笼 <i>dēnglong</i> – Laterne</small></div>`,
  tee: `<div class="cap shadow"><b>泡茶</b><i>pào chá</i> · Tee zubereiten<small>Wasser erhitzen, ziehen lassen, einschenken</small></div>`,
  xiangqi: `<div class="cap shadow"><b>象棋</b><i>xiàngqí</i> · Chinesisches Schach<small>eine kleine Partie am Brettspieltisch</small></div>`,
  angeln: `<div class="cap shadow"><b>钓鱼</b><i>diàoyú</i> · Angeln<small>am Teich und am Fluss</small></div>`,
  ende: `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,#4a2a16 0%,#1e120c 55%,#0c0806 100%);
      display:flex;flex-direction:column;align-items:center;justify-content:center">
      <div style="position:absolute;left:50%;top:38%;width:900px;height:900px;margin:-450px 0 0 -450px;
        background:radial-gradient(circle,rgba(255,170,80,.16),rgba(255,170,80,0) 60%)"></div>
      <div class="brush" style="font-size:200px;line-height:1;color:#ffd98a;text-shadow:0 0 50px rgba(255,170,80,.5)">茶馆</div>
      <div style="font-size:60px;margin-top:10px">Das Teehaus · <i>cháguǎn</i></div>
      <div style="font-size:46px;margin-top:56px;color:#fbe9c8">Jetzt im Browser spielen</div>
      <div style="font-size:44px;margin-top:14px;color:#ffcf73;letter-spacing:.02em">jackieming-teehaus.vercel.app</div>
      <div style="font-size:30px;margin-top:22px;color:#cdb68a">Am Computer öffnen · Maus und Tastatur</div></div>`,
  hinweis: `<div style="position:absolute;left:0;right:0;bottom:46px;text-align:center;font-size:24px;color:#bfa77c">
      Fiktive Gespräche, basieren auf öffentlich bekannten Fakten. Keine echten Zitate. Nicht mit den dargestellten Personen verbunden.</div>`,
};

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [name, html] of Object.entries(CARDS)) {
  // als Datei laden, damit die Schriften über file:// gefunden werden
  const file = path.join(OUT, `${name}.html`);
  fs.writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`);
  await p.goto(`file://${file}`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: name !== 'ende' });
  console.log('Karte', name);
}
await b.close();
