// Benchmark (?bench): fährt fünf feste Orte an, misst je 6 s die echte Bildrate (Mittel und 1-%-Tief),
// Bildzeit, Draw-Calls und Dreiecke und zeigt eine Tabelle mit „Ergebnis kopieren“. Gedacht zum Messen auf dem
// eigenen Rechner – die Testumgebung hat keine echte Grafikkarte. ?q=0|1|2 legt die Stufe fest, sonst Auto.
import type { World } from './world';
import { h } from '../ui/dom';

interface Spot {
  name: string;
  x: number;
  z: number;
  yaw: number;
}

const SPOTS: Spot[] = [
  { name: 'Teehaus innen', x: 0, z: 2, yaw: Math.PI },
  { name: 'Teich', x: 2, z: 26, yaw: Math.PI },
  { name: 'Dorfplatz', x: 38, z: 60, yaw: 3.4 },
  { name: 'Terrassen', x: -40, z: 70, yaw: 2.5 },
  { name: 'Aussicht', x: -24, z: 104, yaw: 2.4 },
];

export interface BenchRow {
  name: string;
  fps: number;
  low1: number;
  ms: number;
  calls: number;
  tris: number;
}

const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

/** Grafikkarte, soweit der Browser sie nennt */
function gpuName(world: World): string {
  const gl = world.renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
}

export async function runBench(world: World, secs = 6): Promise<BenchRow[]> {
  const rows: BenchRow[] = [];
  world.mode = 'cutscene';
  world.input.enabled = false;
  for (const s of SPOTS) {
    world.player.stopPath();
    world.player.place(s.x, s.z, s.yaw);
    world.cam.setShot(null);
    world.cam.snapBehind(s.yaw);
    world.cam.pitch = 0.22;
    world.cam.dist = 6;
    await wait(1500); // einschwingen (Zonen, Figuren, Schatten)
    const times: number[] = [];
    let calls = 0;
    let tris = 0;
    const f0 = world.frames;
    let last = performance.now();
    await new Promise<void>((done) => {
      const t0 = performance.now();
      const tick = (now: number): void => {
        times.push(now - last);
        last = now;
        const i = world.renderer.info.render;
        calls += i.calls;
        tris += i.triangles;
        if (now - t0 < secs * 1000) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    const n = Math.max(1, world.frames - f0);
    times.shift();
    const sorted = [...times].sort((a, b) => b - a);
    const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
    const worst1 = sorted.slice(0, Math.max(1, Math.floor(sorted.length / 100)));
    const low = worst1.reduce((a, b) => a + b, 0) / worst1.length;
    rows.push({
      name: s.name,
      fps: Math.round(1000 / avg),
      low1: Math.round(1000 / low),
      ms: +avg.toFixed(1),
      calls: Math.round(calls / Math.max(1, times.length)),
      tris: Math.round(tris / Math.max(1, times.length) / 1000),
    });
    void n;
  }
  return rows;
}

/** Ergebnis anzeigen (Tabelle, Kopierknopf) */
export function showBench(world: World, rows: BenchRow[]): void {
  const q = ['Niedrig', 'Mittel', 'Hoch'][world.quality] ?? '?';
  const head = `Teehaus-Benchmark · Stufe ${q} · Auflösung ${Math.round(world.resScale * 100)} % · ${window.innerWidth}×${window.innerHeight} @${devicePixelRatio} · ${gpuName(world)} · ${navigator.userAgent}`;
  const text = [
    head,
    'Ort | FPS | 1%-Tief | Bildzeit ms | Draw-Calls | Dreiecke k',
    ...rows.map((r) => `${r.name} | ${r.fps} | ${r.low1} | ${r.ms} | ${r.calls} | ${r.tris}`),
  ].join('\n');
  console.info(`[Teehaus] ${text}`);
  const table = h(
    'table',
    { class: 'bench-table' },
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        ...['Ort', 'FPS', '1 %-Tief', 'Bildzeit', 'Draw-Calls', 'Dreiecke'].map((t) => h('th', {}, t)),
      ),
    ),
    h(
      'tbody',
      {},
      ...rows.map((r) =>
        h(
          'tr',
          {},
          h('td', {}, r.name),
          h('td', { class: r.fps >= 58 ? 'ok' : r.fps >= 45 ? 'mid' : 'bad' }, String(r.fps)),
          h('td', {}, String(r.low1)),
          h('td', {}, `${r.ms} ms`),
          h('td', {}, String(r.calls)),
          h('td', {}, `${r.tris} k`),
        ),
      ),
    ),
  );
  const copy = h(
    'button',
    {
      class: 'btn primary',
      type: 'button',
      onclick: () => {
        void navigator.clipboard?.writeText(text).then(
          () => (copy.textContent = 'Kopiert'),
          () => (copy.textContent = 'Kopieren nicht möglich – siehe Konsole'),
        );
      },
    },
    'Ergebnis kopieren',
  );
  const box = h(
    'section',
    { class: 'bench', role: 'dialog', 'aria-label': 'Benchmark-Ergebnis' },
    h('h2', {}, 'Benchmark'),
    h('p', { class: 'bench-meta' }, head),
    table,
    h(
      'div',
      { class: 'bench-actions' },
      copy,
      h('button', { class: 'btn ghost', type: 'button', onclick: () => location.reload() }, 'Nochmal'),
    ),
  );
  document.body.appendChild(box);
}
