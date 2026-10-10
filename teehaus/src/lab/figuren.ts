// Figuren-Labor (/lab/figuren/): jede Rolle im Vorher-Nachher-Vergleich (links Quaternius-Teile, rechts die neue
// geschneiderte Figur) und alle neuen Figuren nebeneinander. Bewegungen zum Prüfen von Kleidung und Gelenken:
// Stehen, Gehen, Laufen, Sitzen, Winken, Trinken, Sprechen, Verbeugen.
import {
  AmbientLight,
  Color,
  CylinderGeometry,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Timer,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadRig } from '../world/rig';
import { loadHairKit } from '../world/hairkit';
import { RigCharacter } from '../world/rigchar';
import type { Action, Look } from '../world/character';
import * as LOOKS from '../world/looks';

interface Role {
  label: string;
  role: string;
  before: Look;
  after: Look;
}

const ROLES: Role[] = [
  {
    label: 'Teemeister',
    role: 'alt, grauer Bart, Changshan, Schürze',
    before: LOOKS.MASTER_LOOK_OLD,
    after: LOOKS.MASTER_LOOK,
  },
  {
    label: 'Jackie Chan',
    role: 'kleiner, Tang-Anzug mit Goldstickerei',
    before: LOOKS.JACKIE_LOOK_OLD,
    after: LOOKS.JACKIE_LOOK,
  },
  {
    label: 'Yao Ming',
    role: '2,29 m, roter Mantel, Basketball',
    before: LOOKS.YAO_LOOK_OLD,
    after: LOOKS.YAO_LOOK,
  },
  ...LOOKS.PLAYER_LOOKS.map((l, i) => ({
    label: `Spielfigur ${l.label}`,
    role: ['Tang-Anzug', 'Hanfu, Zopf', 'Tang-Anzug, Weste, Reishut', 'Hanfu, Haarknoten'][i] ?? '',
    before: LOOKS.PLAYER_LOOKS_OLD[i]!,
    after: l,
  })),
  ...Object.keys(LOOKS.GUEST_LOOKS).map((k) => ({
    label:
      {
        boardA: 'Brettspieler',
        boardB: 'Brettspieler 2',
        poet: 'Dichterin',
        merchant: 'Händler',
        child: 'Kind',
        terrace: 'Gast Terrasse',
        wanderer: 'Reisender',
        visitor: 'Besucherin',
      }[k] ?? k,
    role:
      {
        boardA: 'Changshan, Gelehrtenkappe',
        boardB: 'Tang-Anzug mit Weste',
        poet: 'Hanfu, Pinsel',
        merchant: 'Changshan, Weste, Fächer',
        child: 'Tang-Jacke, Zöpfchen',
        terrace: 'Hanfu, graues Haar',
        wanderer: 'Reishut',
        visitor: 'Hanfu, Zopf',
      }[k] ?? '',
    before: LOOKS.GUEST_LOOKS_OLD[k]!,
    after: LOOKS.GUEST_LOOKS[k]!,
  })),
];

const host = document.getElementById('view')!;
const list = document.getElementById('list')!;
const info = document.getElementById('info')!;
const animBar = document.getElementById('anims')!;
const spinBox = document.getElementById('spin') as HTMLInputElement;
const beforeBox = document.getElementById('before') as HTMLInputElement;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
host.appendChild(renderer.domElement);
const scene = new Scene();
scene.background = new Color('#2a1d16');
scene.add(new HemisphereLight('#ffe9c8', '#3a2418', 1.3));
scene.add(new AmbientLight('#ffffff', 0.2));
const sun = new DirectionalLight('#ffd9a8', 2.4);
sun.position.set(2, 4, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);
const rim = new DirectionalLight('#9fc8ff', 1.0);
rim.position.set(-3, 2.5, -3);
scene.add(rim);
const floor = new Mesh(
  new PlaneGeometry(12, 12),
  new MeshStandardMaterial({ color: '#5a3a26', roughness: 0.9 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
scene.add(new GridHelper(12, 24, '#6b4a34', '#4a3324'));
const stoolMat = new MeshStandardMaterial({ color: '#2a1d16', roughness: 0.5 });
const camera = new PerspectiveCamera(32, 1, 0.05, 100);
camera.position.set(0.6, 1.4, 5.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.0, 0);
controls.enableDamping = true;

function resize(): void {
  const w = host.clientWidth;
  const h = host.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);

type Mode = 'idle' | 'walk' | 'run' | 'sit' | 'wave' | 'drink' | 'talk' | 'bow';
const MODES: [Mode, string][] = [
  ['idle', 'Stehen'],
  ['walk', 'Gehen'],
  ['run', 'Laufen'],
  ['sit', 'Sitzen'],
  ['wave', 'Winken'],
  ['drink', 'Trinken'],
  ['talk', 'Sprechen'],
  ['bow', 'Verbeugen'],
];
let mode: Mode = 'idle';
let figs: RigCharacter[] = [];
const stools: Mesh[] = [];

function clear(): void {
  for (const f of figs) scene.remove(f.root);
  for (const s of stools) scene.remove(s);
  figs = [];
  stools.length = 0;
}

function applyMode(): void {
  for (const f of figs) {
    f.speed = 0;
    f.standUp();
    for (const a of ['wave', 'drink', 'bow'] as Action[]) f.stop(a);
  }
  for (const s of stools) s.visible = mode === 'sit';
  for (const f of figs) {
    if (mode === 'sit') f.sitDown(0.46);
    if (mode === 'wave') f.play('wave', 1e6);
    if (mode === 'drink' || mode === 'bow') f.hold(mode);
    if (mode === 'drink') f.showProp('cup', true);
    else f.showProp('cup', false);
  }
  for (const b of animBar.querySelectorAll('button'))
    b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
}

function place(looks: Look[], gap: number): void {
  clear();
  const x0 = -((looks.length - 1) * gap) / 2;
  looks.forEach((l, i) => {
    const f = new RigCharacter(l);
    f.root.position.set(x0 + i * gap, 0, 0);
    f.root.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).castShadow = true;
    });
    scene.add(f.root);
    figs.push(f);
    const stool = new Mesh(new CylinderGeometry(0.2, 0.18, 0.46, 18), stoolMat);
    stool.position.set(x0 + i * gap, 0.23, -0.22);
    stool.castShadow = true;
    stool.visible = false;
    scene.add(stool);
    stools.push(stool);
  });
  applyMode();
}

function showRole(r: Role, btn: HTMLButtonElement): void {
  for (const b of list.querySelectorAll('button')) b.setAttribute('aria-current', String(b === btn));
  const looks = beforeBox.checked ? [r.before, r.after] : [r.after];
  place(looks, 1.1);
  const h = r.after.height;
  controls.target.set(0, h * 0.55, 0);
  camera.position.set(0.8, h * 0.7, h * 2.2 + 1.2);
  info.innerHTML = `<h2>${r.label}</h2><p>${r.role}</p>
    <dl>
      <dt>Größe</dt><dd>${h.toFixed(2).replace('.', ',')} m</dd>
      <dt>Schnitt</dt><dd>${{ tang: 'Tang-Anzug', hanfu: 'Hanfu-Jacke (Überlappkragen)', changshan: 'Changshan', coat: 'offener Mantel' }[r.after.top.cut ?? 'tang']}</dd>
      <dt>Frisur</dt><dd>${r.after.hairStyle}</dd>
    </dl>
    <div class="note">Links: bisher (Quaternius-Kleidung und -Kopf). Rechts: neu, Körper und Kleidung aus der Schneiderei,
    stilisierter Kopf. Skelett, Animationen und Hände sind bei beiden dieselben.</div>`;
}

function showAll(btn: HTMLButtonElement): void {
  for (const b of list.querySelectorAll('button')) b.setAttribute('aria-current', String(b === btn));
  const looks = ROLES.map((r) => r.after);
  place(looks, 0.85);
  controls.target.set(0, 1.0, 0);
  camera.position.set(0, 1.6, 11);
  info.innerHTML = `<h2>Alle neuen Figuren</h2><p>${ROLES.map((r) => r.label).join(' · ')}</p>`;
}

async function main(): Promise<void> {
  RigCharacter.groundIK = false;
  info.textContent = 'Lade Skelett, Animationen und Haare …';
  const base = new URL('../../charaktere/', location.href).href;
  await Promise.all([loadRig(base), loadHairKit(`${base}haare.glb`)]);
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.innerHTML = 'Alle nebeneinander<small>nur neu</small>';
  allBtn.addEventListener('click', () => showAll(allBtn));
  list.appendChild(allBtn);
  ROLES.forEach((r, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `${r.label}<small>${r.role}</small>`;
    b.addEventListener('click', () => showRole(r, b));
    list.appendChild(b);
    if (i === 0) showRole(r, b);
  });
  for (const [m, label] of MODES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.mode = m;
    b.addEventListener('click', () => {
      mode = m;
      applyMode();
    });
    animBar.appendChild(b);
  }
  beforeBox.addEventListener('change', () =>
    (list.querySelector('[aria-current="true"]') as HTMLButtonElement | null)?.click(),
  );
  applyMode();
}

const clock = new Timer();
clock.connect(document);
let t = 0;
renderer.setAnimationLoop(() => {
  clock.update();
  const dt = Math.min(0.05, clock.getDelta());
  t += dt;
  for (const f of figs) {
    // Gehen/Laufen auf der Stelle mit passender Geschwindigkeit; Sprechen mit Silbenrhythmus
    if (mode === 'walk') f.speed = 1.4;
    if (mode === 'run') f.speed = 3.4;
    if (mode === 'talk') f.talk = Math.abs(Math.sin(t * 9)) > 0.5 ? 1 : f.talk;
    if (spinBox.checked) f.yaw += dt * 0.5;
    f.update(dt);
  }
  controls.update();
  renderer.render(scene, camera);
});

// Test-Hilfe
(window as unknown as { __figlab: unknown }).__figlab = {
  figs: () => figs,
  setMode: (m: Mode) => {
    mode = m;
    applyMode();
  },
  camera,
  controls,
};

void main();
