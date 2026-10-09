// Modell-Labor (/lab/modelle/): zeigt jedes Charaktermodell aus public/charaktere/ drehbar mit Datei-, Skelett-
// und Animationsinfos. Die Animationen liegen getrennt in animationen.glb und passen auf alle Figuren, weil alle
// dasselbe Skelett (CharacterArmature) nutzen.
import {
  AmbientLight,
  AnimationClip,
  AnimationMixer,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SkeletonHelper,
  SkinnedMesh,
  SRGBColorSpace,
  Timer,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { AnimationAction, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface Entry {
  file: string;
  label: string;
  /** Vorschlag für die Rolle im Spiel */
  role: string;
  fit: boolean;
  note: string;
}

// Seite liegt unter /lab/modelle/: Modelle zwei Ebenen höher
const BASE = new URL('../../charaktere/', location.href).href;

const MODELS: Entry[] = [
  {
    file: 'king.glb',
    label: 'King',
    role: 'Teemeister (alt)',
    fit: true,
    note: 'Weißes Haar und Vollbart, langes Gewand. Krone und Umhang lassen sich ausblenden bzw. umfärben (Jade-Gewand, helle Schürze).',
  },
  {
    file: 'casual2.glb',
    label: 'Casual2',
    role: 'Spielfigur',
    fit: true,
    note: 'Neutrale, freundliche Figur. Jacke und Hose umfärbbar für die vier Outfits (Jade, Indigo, Ocker, Pflaume).',
  },
  {
    file: 'casual.glb',
    label: 'Casual',
    role: 'Jackie (Basis)',
    fit: true,
    note: 'Schlanke Grundform. Mit dunkler Kampfkunst-Jacke (Goldstickerei, helle Aufschläge) und rotem Gürtel; 1,73 m.',
  },
  {
    file: 'suit.glb',
    label: 'Suit',
    role: 'Yao (Basis)',
    fit: true,
    note: 'Langer Oberteil-Schnitt als Basis für den roten Mantel. Auf 2,29 m skaliert, breitere Schultern, Basketball.',
  },
  {
    file: 'farmer.glb',
    label: 'Farmer',
    role: 'Gast: Brettspieler',
    fit: true,
    note: 'Schlichte Kleidung, passt zum Teehaus. Umfärben in Braun/Indigo.',
  },
  {
    file: 'worker.glb',
    label: 'Worker',
    role: 'Gast: Händler',
    fit: true,
    note: 'Schnurrbart, kräftige Statur. Warnweste/Helm müssen ersetzt werden (Gewand-Farben, Kappe).',
  },
  {
    file: 'adventurer.glb',
    label: 'Adventurer',
    role: 'Gast: Reisender (Terrasse)',
    fit: true,
    note: 'Wanderer-Kleidung, Rucksack weglassen. Gut für einen Gast auf der Veranda.',
  },
  {
    file: 'beach.glb',
    label: 'Beach',
    role: 'Kind (verkleinert)',
    fit: true,
    note: 'Einfache Kleidung; verkleinert auf 1,12 m mit größerem Kopf (Knochen-Skalierung) für das Kind.',
  },
  {
    file: 'punk.glb',
    label: 'Punk',
    role: 'eher nicht',
    fit: false,
    note: 'Irokese und Lederjacke passen nicht ins Teehaus. Kopf/Körper höchstens als Teil für Varianten.',
  },
  {
    file: 'swat.glb',
    label: 'Swat',
    role: 'nicht verwenden',
    fit: false,
    note: 'Einsatzkleidung mit Helm, passt nicht.',
  },
  {
    file: 'spacesuit.glb',
    label: 'SpaceSuit',
    role: 'nicht verwenden',
    fit: false,
    note: 'Raumanzug, passt nicht.',
  },
  {
    file: 'haare.glb',
    label: 'Haare (Teile)',
    role: 'Frisuren-Ergänzung',
    fit: true,
    note: 'Haare und Augenbrauen aus „Universal Base Characters“ – ohne Skelett, werden an den Kopf gehängt.',
  },
];

const host = document.getElementById('view')!;
const list = document.getElementById('list')!;
const info = document.getElementById('info')!;
const animBar = document.getElementById('anims')!;
const skelBox = document.getElementById('skel') as HTMLInputElement;
const spinBox = document.getElementById('spin') as HTMLInputElement;
const speed = document.getElementById('speed') as HTMLInputElement;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = SRGBColorSpace;
renderer.shadowMap.enabled = true;
host.appendChild(renderer.domElement);
const scene = new Scene();
scene.background = new Color('#2a1d16');
scene.add(new HemisphereLight('#ffe9c8', '#3a2418', 1.2));
scene.add(new AmbientLight('#ffffff', 0.25));
const sun = new DirectionalLight('#ffd9a8', 2.2);
sun.position.set(2.5, 4, 3);
sun.castShadow = true;
scene.add(sun);
const rim = new DirectionalLight('#9fc8ff', 1.1);
rim.position.set(-3, 2.5, -3);
scene.add(rim);
const grid = new GridHelper(4, 16, '#6b4a34', '#3a2a20');
scene.add(grid);
const camera = new PerspectiveCamera(35, 1, 0.05, 100);
camera.position.set(1.8, 1.4, 3.6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.95, 0);
controls.enableDamping = true;

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
let clips: AnimationClip[] = [];
const clipsReady = loader
  .loadAsync(`${BASE}animationen.glb`)
  .then((g) => {
    clips = g.animations;
  })
  .catch(() => undefined);

let current: Object3D | null = null;
let mixer: AnimationMixer | null = null;
let action: AnimationAction | null = null;
let helper: SkeletonHelper | null = null;

function resize(): void {
  const w = host.clientWidth;
  const h = host.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);

const kb = (n: number): string => (n > 1e6 ? `${(n / 1e6).toFixed(2)} MB` : `${Math.round(n / 1024)} KB`);
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

async function show(e: Entry, btn: HTMLButtonElement): Promise<void> {
  for (const b of list.querySelectorAll('button')) b.setAttribute('aria-current', String(b === btn));
  info.innerHTML = `<h2>${esc(e.label)}</h2><p>Lade <code>${esc(e.file)}</code> …</p>`;
  const res = await fetch(BASE + e.file);
  const buf = await res.arrayBuffer();
  const gltf = await loader.parseAsync(buf, BASE);
  await clipsReady;
  if (current) scene.remove(current);
  if (helper) scene.remove(helper);
  mixer?.stopAllAction();
  action = null;
  const root = gltf.scene;
  current = root;
  scene.add(root);
  let tris = 0;
  const mats = new Map<string, string>();
  const meshes: string[] = [];
  let bones: string[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    const idx = m.geometry.index;
    tris += (idx ? idx.count : m.geometry.getAttribute('position').count) / 3;
    if (!meshes.includes(m.name)) meshes.push(m.name);
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      const sm = mat as MeshStandardMaterial;
      mats.set(sm.name || '–', sm.color ? `#${sm.color.getHexString()}` : '#888');
    }
    const sk = o as SkinnedMesh;
    if (sk.isSkinnedMesh && !bones.length) bones = sk.skeleton.bones.map((b) => b.name);
  });
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  // Haare stehen ohne Körper in Kopfhöhe: zur Mitte holen
  if (!bones.length) {
    root.position.y = -box.min.y + 0.6;
    root.position.x = -(box.min.x + box.max.x) / 2;
  }
  helper = bones.length ? new SkeletonHelper(root) : null;
  if (helper) {
    helper.visible = skelBox.checked;
    scene.add(helper);
  }
  mixer = bones.length ? new AnimationMixer(root) : null;
  // eigene Animationen in der Datei? sonst die gemeinsamen aus animationen.glb
  const own = gltf.animations;
  const usable = own.length ? own : bones.length ? clips : [];
  animBar.innerHTML = '';
  if (!usable.length) animBar.textContent = 'Keine Animationen (statische Teile).';
  for (const clip of usable) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${clip.name} · ${clip.duration.toFixed(1)} s`;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      if (!mixer) return;
      const next = mixer.clipAction(clip);
      next.reset().play();
      if (action && action !== next) action.crossFadeTo(next, 0.3, false);
      action = next;
      for (const x of animBar.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    });
    animBar.appendChild(b);
  }
  const idle = usable.find((c) => c.name === 'Idle');
  if (idle && mixer) (animBar.children[usable.indexOf(idle)] as HTMLButtonElement | undefined)?.click();
  info.innerHTML = `
    <h2>${esc(e.label)}</h2>
    <span class="tag ${e.fit ? '' : 'no'}">${esc(e.role)}</span>
    <div class="note">${esc(e.note)}</div>
    <dl>
      <dt>Datei</dt><dd><code>${esc(e.file)}</code></dd>
      <dt>Größe</dt><dd>${kb(buf.byteLength)} (Meshopt)</dd>
      <dt>Höhe</dt><dd>${size.y.toFixed(2)} m${bones.length ? ' (T-Pose ohne Animation)' : ''}</dd>
      <dt>Dreiecke</dt><dd>${Math.round(tris).toLocaleString('de-DE')}</dd>
      <dt>Teile</dt><dd>${esc(meshes.join(', '))}</dd>
      <dt>Skelett</dt><dd>${bones.length ? `${bones.length} Knochen` : 'keins'}</dd>
      <dt>Animationen</dt><dd>${own.length ? `${own.length} eigene` : bones.length ? `${clips.length} aus <code>animationen.glb</code>` : '–'}</dd>
      <dt>Morph Targets</dt><dd>keine</dd>
    </dl>
    <details><summary>Materialien (${mats.size})</summary>
      <p>${[...mats].map(([n, c]) => `<span class="sw" style="background:${c}"></span>${esc(n)}`).join('<br>')}</p>
    </details>
    ${bones.length ? `<details><summary>Knochen</summary><p class="bones">${esc(bones.join(' · '))}</p></details>` : ''}
    <p class="bones">Quelle: Quaternius, ${e.file === 'haare.glb' ? '„Universal Base Characters“' : '„Ultimate Modular Men“'} – CC0 1.0</p>`;
  controls.target.set(0, Math.min(1, size.y * 0.5 + (bones.length ? 0 : 0.6)), 0);
}

MODELS.forEach((e, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = `${esc(e.label)}<small>${esc(e.role)}</small>`;
  b.addEventListener('click', () => void show(e, b));
  list.appendChild(b);
  if (i === 0) void show(e, b);
});

skelBox.addEventListener('change', () => {
  if (helper) helper.visible = skelBox.checked;
});

const clock = new Timer();
clock.connect(document);
renderer.setAnimationLoop(() => {
  clock.update();
  const dt = Math.min(0.05, clock.getDelta());
  mixer?.update(dt * Number(speed.value));
  if (current && spinBox.checked) current.rotation.y += dt * 0.4;
  controls.update();
  renderer.render(scene, camera);
});
