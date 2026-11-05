// Trailer-Aufnahme (Variante A): echtes Spiel im Headless-Chromium (Software-WebGL), Bild für Bild mit fester
// Zeit pro Bild (1/30 s), festen Zufallswerten und geskripteter Kamera. Jede Szene landet als JPEG-Folge in
// trailer/work/<szene>/ und kann nach einem Abbruch fortgesetzt werden (fertige Bilder werden übersprungen,
// die Simulation bis dorthin ohne Zeichnen vorgespult).
// Aufruf (Build muss laufen, z. B. npx vite preview --port 5300):
//   node trailer/render.mjs <szene|alle> [port]
// Szenen: titel, anflug, innen, dorf
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [, , which = 'alle', port = '5300'] = process.argv;
const FPS = 30;
const W = 1280;
const H = 720;

/**
 * Szenen: Dauer (s), Tageszeit t (0 Tag, 0.5 goldene Stunde, 1 Nacht) als Funktion von u (0…1) und
 * Kamera (Position, Blickpunkt) als Funktion von u. Koordinaten in Metern (Teehaus bei 0/0, Dorf bei 40/57).
 * Alle Funktionen laufen im Browser.
 */
const SCENES = {
  titel: {
    secs: 5,
    pre: 20,
    time: '() => 1',
    cam: `(u) => ({ pos: [-3 + u * 1.0, 3.0 - u * 0.25, 24.5 - u * 3], look: [0, 2.0, 3], fov: 44 })`,
  },
  anflug: {
    secs: 9.5,
    pre: 20,
    time: '(u) => 0.5',
    cam: `(u) => {
      const e = u * u * (3 - 2 * u);
      const a = [58, 34, 112], b = [4, 3.6, 21];
      const p = a.map((v, i) => v + (b[i] - v) * e);
      p[1] += Math.sin(e * Math.PI) * 6;
      const la = [10, 4, 20], lb = [0, 2.2, 2];
      return { pos: p, look: la.map((v, i) => v + (lb[i] - v) * e), fov: 50 };
    }`,
  },
  innen: {
    secs: 12,
    pre: 40,
    time: '() => 0.42',
    // langsam um die beiden Gäste herum; Blickpunkt folgt ihnen weich
    cam: `(u, w, g) => {
      const a = g.heroes.jackie.agent.ch.root.position, b = g.heroes.yao.agent.ch.root.position;
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      window.__tl = window.__tl ?? { x: mx, z: mz };
      window.__tl.x += (mx - window.__tl.x) * 0.04; window.__tl.z += (mz - window.__tl.z) * 0.04;
      const c = window.__tl;
      // Kamera bleibt im Raum: Richtung von der Raummitte zu den Gästen, leicht seitlich wandernd
      const base = Math.atan2(c.x - 0, c.z - 0) + Math.PI + 0.9 - u * 0.7;
      const r = 3.6 - u * 0.6;
      return { pos: [c.x + Math.sin(base) * r, 2.05 - u * 0.25, c.z + Math.cos(base) * r], look: [c.x, 1.45, c.z], fov: 48 };
    }`,
  },
  dorf: {
    secs: 12,
    pre: 60,
    // Abend → Nacht: die Laternen gehen an
    time: '(u) => 0.42 + u * 0.55',
    cam: `(u) => {
      const e = u * u * (3 - 2 * u);
      return { pos: [29 + e * 20, 4.6 - e * 0.8, 73.5 - e * 2], look: [38 + e * 6, 1.6, 59], fov: 50 };
    }`,
  },
};

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function scene(name) {
  const S = SCENES[name];
  const dir = path.join(HERE, 'work', name);
  fs.mkdirSync(dir, { recursive: true });
  const total = Math.round(S.secs * FPS);
  const done = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).length;
  if (done >= total) {
    console.log(name, 'schon fertig');
    return;
  }
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  // feste Zufallswerte (gleiche Abläufe bei jedem Lauf, auch beim Fortsetzen)
  await p.addInitScript(() => {
    let s = 20261105;
    Math.random = () => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${port}/?q=2&ladebudget=300&wetter=klar&jahreszeit=fruehling`);
  await p.waitForSelector('#mainmenu.show', { timeout: 600000 });
  await p.click('#mainmenu [data-id=new]');
  await p.waitForSelector('.outfit');
  await p.click('.outfit .btn.primary');
  await p.click('#skip');
  await p.waitForFunction(() => window.__world?.mode === 'free', null, { timeout: 300000 });
  // eigene Bildschleife: die Spielschleife und ihr Neustart durch den Watchdog werden abgeschaltet
  await p.evaluate(
    ([pre, timeFn, camFn, name]) => {
      const w = window.__world;
      const g = window.__game;
      w.renderer.setAnimationLoop(null);
      w.restartLoop = () => {};
      w.hidePlayer = true;
      w.player.ch.root.visible = false;
      document.querySelector('.tutorial .btn.ghost')?.click();
      // Spielfigur aus dem Bild: im Dorf hinter ein Haus, sonst in eine Ecke
      if (name === 'dorf') w.player.place(64, 76, 0);
      else if (name === 'innen') w.player.place(-5.5, -2.2, 0);
      else w.player.place(-14, 40, 0);
      const T = eval(timeFn);
      const C = eval(camFn);
      w.auto = false;
      window.__trailer = {
        set(u) {
          w.t = w.tTarget = T(u);
          w.applyTime(true);
        },
        frame(u, dt, render) {
          this.set(u);
          w.tick(dt, dt);
          w.player.ch.root.visible = false;
          w.player.ch.root.scale.setScalar(0.001);
          const c = C(u, w, g);
          const cam = w.camera;
          cam.position.set(c.pos[0], c.pos[1], c.pos[2]);
          cam.fov = c.fov;
          cam.updateProjectionMatrix();
          cam.lookAt(c.look[0], c.look[1], c.look[2]);
          w.cam.lookPoint.set(c.look[0], c.look[1], c.look[2]);
          cam.updateMatrixWorld();
          // Bildzähler weiterzählen: die Teichspiegelung wird nur bei neuem Bild neu gezeichnet
          w.frameNo++;
          return render ? w.snapshot(1280, 0.93) : '';
        },
      };
      // vorspulen, damit Bewohner, Dampf und Partikel schon unterwegs sind
      window.__trailer.set(0);
      for (let i = 0; i < pre * 20; i++) w.tick(0.05, 0.05);
    },
    [S.pre, S.time, S.cam, name],
  );
  const t0 = Date.now();
  if (process.env.PROBE) {
    // Probebilder: Anfang, Mitte, Ende (dazwischen nur rechnen)
    const want = [0, Math.floor(total / 2), total - 1];
    for (let i = 0; i < total; i++) {
      const r = want.includes(i);
      const data = await p.evaluate(([u, render]) => window.__trailer.frame(u, 1 / 30, render), [i / (total - 1), r]);
      if (r) fs.writeFileSync(path.join(HERE, 'work', `probe-${name}-${i}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
    }
    console.log(name, 'Probe fertig', errs.slice(0, 3));
    await p.close();
    return;
  }
  for (let i = 0; i < total; i++) {
    const file = path.join(dir, `f${String(i).padStart(4, '0')}.jpg`);
    const exists = fs.existsSync(file);
    const data = await p.evaluate(([u, render]) => window.__trailer.frame(u, 1 / 30, render), [
      i / (total - 1),
      !exists,
    ]);
    if (!exists) fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    if (i % 30 === 0) console.log(name, i, '/', total, `${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  console.log(name, 'fertig', errs.length ? `Fehler: ${errs.slice(0, 3).join(' | ')}` : '');
  await p.close();
}

const list = which === 'alle' ? Object.keys(SCENES) : which.split(',');
for (const n of list) await scene(n);
await b.close();
