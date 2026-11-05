// Häuser-Labor (/lab/haeuser/): alle Hausvarianten aus dem Baukasten nebeneinander, mit dem Teehaus als
// Stilvergleich. Tageszeit (Papierfenster und Laternen leuchten abends) und Fern-Stufe umschaltbar.
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildCafe } from '../world/cafe';
import { buildHouse, HOUSE_PAPER, HOUSE_SPECS, LANTERN_MAT } from '../three/houses';
import type { HouseModel } from '../three/houses';

const view = document.getElementById('view')!;
const list = document.getElementById('list')!;
const info = document.getElementById('info')!;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.toneMapping = ACESFilmicToneMapping;
view.appendChild(renderer.domElement);

const scene = new Scene();
scene.fog = new FogExp2('#e8d8bc', 0.006);
const camera = new PerspectiveCamera(42, 1, 0.1, 500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;

const hemi = new HemisphereLight('#fff1d8', '#6d6a4a', 1.2);
const sun = new DirectionalLight('#fff0d0', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -40;
sc.right = 40;
sc.top = 30;
sc.bottom = -30;
sc.far = 160;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(hemi, sun, sun.target);

const ground = new Mesh(
  new PlaneGeometry(260, 160),
  new MeshStandardMaterial({ color: '#8f9a4c', roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const plaza = new Mesh(
  new PlaneGeometry(96, 9),
  new MeshStandardMaterial({ color: '#a59e8e', roughness: 0.95 }),
);
plaza.rotation.x = -Math.PI / 2;
plaza.position.set(14, 0.01, 7.5);
const plaza2 = plaza.clone();
plaza2.position.z = -12.5;
scene.add(plaza2);
plaza.receiveShadow = true;
scene.add(plaza);

// ── Teehaus als Vergleich, dann die Varianten in einer Reihe (Front nach +z, zum Platz)
interface Entry {
  id: string;
  name: string;
  zh: string;
  note: string;
  x: number;
  z: number;
  group: Group;
  lo: Mesh | null;
  model?: HouseModel;
}
const entries: Entry[] = [];
const cafe = buildCafe(0);
const cafeX = -20;
cafe.group.position.set(cafeX, 0, -2);
cafe.group.scale.setScalar(1);
scene.add(cafe.group);
entries.push({
  id: 'teehaus',
  name: 'Teehaus (Vergleich)',
  zh: '茶馆',
  note: 'Das bestehende Teehaus: Maßstab und Stil für alle Dorfhäuser.',
  x: cafeX,
  z: 0,
  group: cafe.group,
  lo: null,
});

// zwei Reihen: vorn Teehaus, Wohnhaus, Teeladen, Werkstatt; hinten Gasthaus, Schreinchen, Hofhaus
const ROWS: [number, string[]][] = [
  [0, ['wohnhaus', 'teeladen', 'werkstatt', 'lagerhaus']],
  [-20, ['gasthaus', 'schreinchen', 'hofhaus']],
];
for (const [rz, ids] of ROWS) {
  let x = rz === 0 ? -8 : -18;
  for (const id of ids) {
    const spec = HOUSE_SPECS.find((s) => s.id === id)!;
    const m = buildHouse(spec);
    const cx = x + spec.w / 2;
    const z = rz - spec.d / 2 + 2.5;
    m.hi.position.set(cx, 0, z);
    m.lo.position.set(cx, 0, z);
    m.lo.visible = false;
    scene.add(m.hi, m.lo);
    entries.push({
      id: spec.id,
      name: spec.name,
      zh: spec.zh,
      note: spec.note,
      x: cx,
      z: rz,
      group: m.hi,
      lo: m.lo,
      model: m,
    });
    x += spec.w + 6;
  }
}

// ── Kennzahlen je Haus
function stats(g: Group | Mesh): { calls: number; tris: number } {
  let calls = 0;
  let tris = 0;
  g.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    calls++;
    const geo = mesh.geometry;
    tris += (geo.index ? geo.index.count : geo.attributes.position!.count) / 3;
  });
  return { calls, tris: Math.round(tris) };
}

function show(e: Entry): void {
  for (const b of list.querySelectorAll('button'))
    b.setAttribute('aria-current', String(b.dataset.id === e.id));
  const hi = stats(e.group);
  const lo = e.lo ? stats(e.lo) : null;
  info.innerHTML = `<h2>${e.name} <span lang="zh">${e.zh}</span></h2><p>${e.note}</p><dl>
    <dt>Nah</dt><dd>${hi.calls} Draw-Calls, ${hi.tris.toLocaleString('de')} Dreiecke</dd>
    ${lo ? `<dt>Fern</dt><dd>${lo.calls} Draw-Call, ${lo.tris.toLocaleString('de')} Dreiecke</dd>` : ''}
    ${e.model ? `<dt>Grundfläche</dt><dd>${e.model.spec.w} × ${e.model.spec.d} m, ${e.model.spec.floors === 2 ? 'zweistöckig' : 'einstöckig'}, Dach: ${ROOF[e.model.spec.roof]}</dd>` : ''}
  </dl>`;
  target.set(e.x, 2.5, e.z);
  camGoal.set(e.x + 7, 5, e.z + 13);
  flying = true;
}
const ROOF = { hip: 'Walmdach', gable: 'Satteldach', xieshan: 'Krüppelwalm (歇山)' };

for (const e of entries) {
  const b = document.createElement('button');
  b.dataset.id = e.id;
  b.innerHTML = `${e.name}<br><small lang="zh">${e.zh}</small>`;
  b.onclick = () => show(e);
  list.appendChild(b);
}
const overview = document.createElement('button');
overview.dataset.id = 'alle';
overview.textContent = 'Alle zeigen';
overview.onclick = () => {
  for (const b of list.querySelectorAll('button')) b.setAttribute('aria-current', String(b === overview));
  target.set(4, 1, -9);
  camGoal.set(6, 30, 40);
  flying = true;
  info.innerHTML =
    '<h2>Alle Varianten</h2><p>Gleiche Farben und Materialien wie das Teehaus: Rot, Dunkelholz, Gold, warmes Papierweiß, dunkle Ziegel.</p>';
};
list.prepend(overview);

let flying = false;
controls.addEventListener('start', () => (flying = false));
const target = new Vector3(4, 1, -9);
const camGoal = new Vector3(6, 30, 40);
camera.position.copy(camGoal);
controls.target.copy(target);

// ── Tageszeit
const TIMES = {
  day: {
    sky: '#bcd3e0',
    fog: '#e8dcc4',
    sun: 2.6,
    sunCol: '#fff0d0',
    hemi: 1.2,
    paper: 0.25,
    lantern: 0.5,
    dir: [30, 40, 25],
  },
  dusk: {
    sky: '#e8a878',
    fog: '#d89a70',
    sun: 1.4,
    sunCol: '#ffb070',
    hemi: 0.7,
    paper: 0.9,
    lantern: 1.4,
    dir: [40, 14, 20],
  },
  night: {
    sky: '#1a2236',
    fog: '#1e2536',
    sun: 0.25,
    sunCol: '#9ab0ff',
    hemi: 0.25,
    paper: 1.6,
    lantern: 2.4,
    dir: [-20, 30, 10],
  },
} as const;
function setTime(t: keyof typeof TIMES): void {
  const p = TIMES[t];
  scene.background = new Color(p.sky);
  (scene.fog as FogExp2).color.set(p.fog);
  sun.intensity = p.sun;
  sun.color.set(p.sunCol);
  hemi.intensity = p.hemi;
  sun.position.set(4 + p.dir[0], p.dir[1], -9 + p.dir[2]);
  sun.target.position.set(4, 0, -9);
  HOUSE_PAPER.emissiveIntensity = p.paper;
  LANTERN_MAT.emissiveIntensity = p.lantern;
  for (const m of cafe.windowMats) (m as MeshStandardMaterial).emissiveIntensity = p.paper;
}
for (const r of document.querySelectorAll<HTMLInputElement>('input[name=time]'))
  r.onchange = () => setTime(r.value as keyof typeof TIMES);
setTime('day');
(document.getElementById('lod') as HTMLInputElement).onchange = (ev) => {
  const lo = (ev.target as HTMLInputElement).checked;
  for (const e of entries) {
    if (!e.lo) continue;
    e.lo.visible = lo;
    e.group.visible = !lo;
  }
};

function resize(): void {
  const w = view.clientWidth;
  const h = view.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);
resize();

renderer.setAnimationLoop(() => {
  // Kamerafahrt nur nach Klick auf einen Namen; danach frei drehbar
  if (flying) {
    camera.position.lerp(camGoal, 0.08);
    controls.target.lerp(target, 0.1);
    if (camera.position.distanceTo(camGoal) < 0.05) flying = false;
  }
  controls.update();
  renderer.render(scene, camera);
});
// für Tests
(window as unknown as { __lab: unknown }).__lab = {
  entries,
  show,
  setTime,
  camGoal,
  target,
  camera,
  controls,
};
