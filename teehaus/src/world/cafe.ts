// Das begehbare Teehaus-Café: Halle mit Papierfenstern, Tür, Theke, Tischen, Terrasse, Treppe, Steinlöwen,
// geschwungenem Dach und Laternen. Statische Teile werden pro Material zu wenigen Meshes zusammengefasst
// (weniger Draw Calls); Wiederholtes (Hocker, Schalen, Krüge) läuft über Instancing.
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Quaternion,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import type { Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { flat } from '../three/shared';
import { glowTexture, makeTexture, paperTexture, woodTexture } from '../three/textures';
import { FONT_BRUSH } from '../three/shared';
import { vinyl } from './materials';
import {
  CEIL,
  COUNTER,
  DOOR,
  FLOOR,
  HALL,
  PILLARS,
  SEATS,
  STAIRS,
  STOOL_H,
  TABLES,
  TERRACE,
  WALL_T,
} from './layout';

// ───────────────────────────────────────── Zusammenfassen statischer Geometrie

class Batcher {
  private parts = new Map<Material, BufferGeometry[]>();
  private noShadow = new Set<Material>();

  add(
    geo: BufferGeometry,
    mat: Material,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
  ): void {
    const m = new Matrix4().compose(
      new Vector3(...pos),
      new Quaternion().setFromEuler(new Euler(...rot)),
      new Vector3(...scale),
    );
    const g = geo.index ? geo.clone() : geo.clone();
    g.applyMatrix4(m);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat)!.push(g);
  }

  box(w: number, h: number, d: number, mat: Material, x: number, y: number, z: number, ry = 0): void {
    this.add(new BoxGeometry(w, h, d), mat, [x, y, z], [0, ry, 0]);
  }

  shadowless(mat: Material): void {
    this.noShadow.add(mat);
  }

  build(name: string): Group {
    const g = new Group();
    g.name = name;
    for (const [mat, geos] of this.parts) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const m = new Mesh(merged, mat);
      m.castShadow = !this.noShadow.has(mat);
      m.receiveShadow = true;
      g.add(m);
      for (const x of geos) x.dispose();
    }
    return g;
  }
}

// ───────────────────────────────────────── Materialien

const M = {
  lacquer: () => vinyl('#7a2016', { rough: 0.42 }),
  darkWood: () => vinyl('#4a2f1e', { rough: 0.7, rim: 0.4 }),
  midWood: () => vinyl('#7a5235', { rough: 0.72, rim: 0.4 }),
  plaster: () => vinyl('#e6d6b6', { rough: 0.95, rim: 0.2 }),
  stone: () => flat('#8f897d', { rough: 0.95 }),
  gold: () => vinyl('#d4a54a', { rough: 0.32, metal: 0.55 }),
  tile: () => new MeshStandardMaterial({ color: '#3d4148', roughness: 0.6, flatShading: true }),
};

// ───────────────────────────────────────── Laterne

export interface Lantern {
  group: Group;
  body: Mesh;
  light: PointLight | null;
  glow: Sprite;
  phase: number;
  swing: number;
}

export function makeLantern(scale: number, withLight: boolean, cord: number): Lantern {
  const group = new Group();
  const pts: Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new Vector2(0.06 + Math.sin(t * Math.PI) * 0.17, t * 0.44 - 0.22));
  }
  const body = new Mesh(
    new LatheGeometry(pts, 14),
    new MeshStandardMaterial({
      color: '#c0281c',
      emissive: new Color('#ff5a2a'),
      emissiveIntensity: 1,
      roughness: 0.6,
    }),
  );
  body.scale.setScalar(scale);
  const gold = M.gold();
  const capT = new Mesh(new CylinderGeometry(0.075, 0.085, 0.045, 12), gold);
  capT.position.y = 0.23 * scale;
  capT.scale.setScalar(scale);
  const capB = capT.clone();
  capB.position.y = -0.23 * scale;
  const tassel = new Mesh(new ConeGeometry(0.03, 0.2, 8), vinyl('#b3261a'));
  tassel.rotation.x = Math.PI;
  tassel.position.y = -0.35 * scale;
  tassel.scale.setScalar(scale);
  const string = new Mesh(new CylinderGeometry(0.006, 0.006, cord, 4), vinyl('#2a1a10'));
  string.position.y = 0.23 * scale + cord / 2;
  group.add(body, capT, capB, tassel, string);
  const glow = new Sprite(
    new SpriteMaterial({
      map: glowTexture(),
      color: '#ff9a4a',
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      opacity: 0.6,
    }),
  );
  glow.scale.setScalar(1.3 * scale);
  glow.raycast = () => undefined;
  group.add(glow);
  let light: PointLight | null = null;
  if (withLight) {
    light = new PointLight('#ff9850', 3, 8, 1.6);
    light.position.y = -0.1;
    group.add(light);
  }
  return { group, body, light, glow, phase: Math.random() * 10, swing: 0 };
}

// ───────────────────────────────────────── Dach

function roof(cx: number, cz: number, W: number, D: number, H: number, base: number): Group {
  const g = new Group();
  g.name = 'roof';
  const height = (x: number, z: number): number => {
    const ax = Math.abs(x);
    const az = Math.abs(z);
    const s = Math.max(0, Math.min((D - az) / D, (W - ax) / D));
    let y = H * Math.pow(s, 1.45);
    const ex = ax / W;
    const ez = az / D;
    const m = Math.min(ex, ez);
    y += 0.75 * Math.pow(m > 0.62 ? Math.min(1, (m - 0.62) / 0.38) : 0, 2.2);
    y += 0.14 * (Math.pow(ex, 8) + Math.pow(ez, 8));
    y += 0.035 * Math.sin((x / 0.26) * Math.PI) * Math.min(1, s * 6);
    return y;
  };
  const top = new PlaneGeometry(W * 2, D * 2, 72, 52).rotateX(-Math.PI / 2);
  const p = top.attributes.position as BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
  top.computeVertexNormals();
  const topMesh = new Mesh(top, M.tile());
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  const under = top.clone();
  const up = under.attributes.position as BufferAttribute;
  for (let i = 0; i < up.count; i++) up.setY(i, up.getY(i) - 0.2);
  under.computeVertexNormals();
  const underMat = new MeshStandardMaterial({ color: '#5a3a24', roughness: 0.8, side: DoubleSide });
  const underMesh = new Mesh(under, underMat);
  underMesh.receiveShadow = true;
  // Traufbrett
  const ring: [number, number][] = [];
  const N = 80;
  for (let i = 0; i < N; i++) ring.push([-W + (2 * W * i) / N, D]);
  for (let i = 0; i < N; i++) ring.push([W, D - (2 * D * i) / N]);
  for (let i = 0; i < N; i++) ring.push([W - (2 * W * i) / N, -D]);
  for (let i = 0; i < N; i++) ring.push([-W, -D + (2 * D * i) / N]);
  const v: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]!;
    const [bx, bz] = ring[(i + 1) % ring.length]!;
    const ay = height(ax, az);
    const by = height(bx, bz);
    v.push(ax, ay, az, ax, ay - 0.2, az, bx, by, bz, bx, by, bz, ax, ay - 0.2, az, bx, by - 0.2, bz);
  }
  const fg = new BufferGeometry();
  fg.setAttribute('position', new BufferAttribute(new Float32Array(v), 3));
  fg.computeVertexNormals();
  const fascia = new Mesh(
    fg,
    new MeshStandardMaterial({ color: '#7a2016', roughness: 0.5, side: DoubleSide }),
  );
  // First mit Endverzierungen (Drachenschwänzen nachempfunden)
  const ridgeLen = (W - D) * 2 + 0.6;
  const ridge = new Mesh(new BoxGeometry(ridgeLen, 0.22, 0.26), flat('#2f3338', { rough: 0.6 }));
  ridge.position.y = H + 0.08;
  g.add(topMesh, underMesh, fascia, ridge);
  for (const s of [-1, 1]) {
    const orn = new Mesh(new TorusGeometry(0.28, 0.07, 6, 10, Math.PI * 1.2), flat('#2f3338'));
    orn.position.set((s * ridgeLen) / 2, H + 0.35, 0);
    orn.rotation.set(0, 0, s > 0 ? -0.4 : Math.PI + 0.4);
    g.add(orn);
    const pearl = new Mesh(new SphereGeometry(0.1, 10, 8), M.gold());
    pearl.position.set(0, H + 0.3, 0);
    if (s > 0) g.add(pearl);
  }
  g.position.set(cx, base, cz);
  return g;
}

// ───────────────────────────────────────── Texturen (Schilder, Paravent, Messlatte, Spielbrett)

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function signTexture(): MeshStandardMaterial {
  const [c, g] = canvas(512, 192);
  g.fillStyle = '#2a1a10';
  g.fillRect(0, 0, 512, 192);
  g.strokeStyle = '#d4a54a';
  g.lineWidth = 10;
  g.strokeRect(10, 10, 492, 172);
  g.fillStyle = '#e8c06a';
  g.font = `130px ${FONT_BRUSH}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('茶 馆', 256, 104);
  return new MeshStandardMaterial({
    map: makeTexture(c),
    roughness: 0.5,
    emissive: new Color('#3a2408'),
    emissiveIntensity: 0.4,
  });
}

function coupletTexture(text: string): MeshStandardMaterial {
  const [c, g] = canvas(96, 512);
  g.fillStyle = '#b3261a';
  g.fillRect(0, 0, 96, 512);
  g.fillStyle = '#f0c75a';
  g.font = `76px ${FONT_BRUSH}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  Array.from(text).forEach((ch, i) => g.fillText(ch, 48, 64 + i * 120));
  return new MeshStandardMaterial({ map: makeTexture(c), roughness: 0.8 });
}

function screenTexture(): MeshStandardMaterial {
  // Paravent mit Tuschelandschaft: Berge, Kiefer, Mond
  const [c, g] = canvas(1024, 512);
  g.fillStyle = '#efe2c4';
  g.fillRect(0, 0, 1024, 512);
  const layers = ['rgba(60,70,70,0.25)', 'rgba(40,50,50,0.45)', 'rgba(25,30,30,0.7)'];
  layers.forEach((col, li) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, 512);
    for (let x = 0; x <= 1024; x += 16) {
      const y = 200 + li * 70 + Math.sin(x * 0.012 + li * 2) * 50 - Math.abs(Math.sin(x * 0.006 + li)) * 120;
      g.lineTo(x, y);
    }
    g.lineTo(1024, 512);
    g.fill();
  });
  g.fillStyle = 'rgba(200,60,40,0.8)';
  g.beginPath();
  g.arc(800, 110, 46, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(30,25,20,0.85)';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(180, 512);
  g.bezierCurveTo(200, 400, 150, 320, 230, 250);
  g.stroke();
  for (let i = 0; i < 4; i++) {
    g.fillStyle = 'rgba(40,60,40,0.75)';
    g.beginPath();
    g.ellipse(200 + i * 30 - 30, 260 + i * 35, 70 - i * 6, 16, -0.15, 0, Math.PI * 2);
    g.fill();
  }
  // Paneelfugen
  g.fillStyle = '#5a3a24';
  for (let x = 0; x <= 1024; x += 256) g.fillRect(x - 6, 0, 12, 512);
  return new MeshStandardMaterial({ map: makeTexture(c), roughness: 0.9, side: DoubleSide });
}

function rulerMaterial(): MeshStandardMaterial {
  // 2,40 m auf 512 px; Markierungen für Jackie (ca. 1,73 m), den Türbalken und Yao (2,29 m)
  const [c, g] = canvas(64, 512);
  g.fillStyle = '#e8d6b0';
  g.fillRect(0, 0, 64, 512);
  g.fillStyle = '#3a2414';
  for (let cm = 0; cm <= 240; cm += 10) {
    const y = 512 - (cm / 240) * 512;
    g.fillRect(0, y - 1, cm % 50 === 0 ? 34 : 18, 2);
  }
  const mark = (cm: number, color: string, label: string): void => {
    const y = 512 - (cm / 240) * 512;
    g.fillStyle = color;
    g.fillRect(0, y - 3, 64, 6);
    g.font = `20px ${FONT_BRUSH}`;
    g.fillText(label, 26, y - 8);
  };
  mark(173, '#b3261a', '成龙');
  mark(229, '#1d4e89', '姚明');
  return new MeshStandardMaterial({ map: makeTexture(c), roughness: 0.8 });
}

function boardMaterial(): MeshStandardMaterial {
  // Xiangqi-Brett (9 × 10 Linien, Fluss in der Mitte)
  const [c, g] = canvas(256, 288);
  g.fillStyle = '#e2bf7e';
  g.fillRect(0, 0, 256, 288);
  g.strokeStyle = '#5a3418';
  g.lineWidth = 2;
  const x0 = 20;
  const y0 = 18;
  const dx = 27;
  const dy = 28;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.moveTo(x0 + i * dx, y0);
    g.lineTo(x0 + i * dx, y0 + 4 * dy);
    g.moveTo(x0 + i * dx, y0 + 5 * dy);
    g.lineTo(x0 + i * dx, y0 + 9 * dy);
    g.stroke();
  }
  for (let j = 0; j < 10; j++) {
    g.beginPath();
    g.moveTo(x0, y0 + j * dy);
    g.lineTo(x0 + 8 * dx, y0 + j * dy);
    g.stroke();
  }
  g.fillStyle = '#5a3418';
  g.font = `20px ${FONT_BRUSH}`;
  g.fillText('楚河', 50, y0 + 4.7 * dy);
  g.fillText('汉界', 160, y0 + 4.7 * dy);
  return new MeshStandardMaterial({ map: makeTexture(c), roughness: 0.7 });
}

function scrollMaterial(): MeshStandardMaterial {
  const [c, g] = canvas(160, 512);
  g.fillStyle = '#efe2c6';
  g.fillRect(0, 0, 160, 512);
  g.fillStyle = '#6a1a12';
  g.fillRect(0, 0, 160, 30);
  g.fillRect(0, 482, 160, 30);
  g.fillStyle = '#1c130e';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `150px ${FONT_BRUSH}`;
  g.fillText('茶', 80, 190);
  g.font = `44px ${FONT_BRUSH}`;
  ['以', '和', '为', '贵'].forEach((ch, i) => g.fillText(ch, 80, 320 + i * 40));
  g.fillStyle = '#b3261a';
  g.fillRect(110, 440, 22, 22);
  return new MeshStandardMaterial({ map: makeTexture(c), roughness: 0.9 });
}

// ───────────────────────────────────────── Steinlöwe

function stoneLion(): Group {
  const g = new Group();
  const st = flat('#9a958a', { rough: 0.95 });
  const dark = flat('#7f7a70', { rough: 0.95 });
  const base = new Mesh(new BoxGeometry(0.62, 0.32, 0.62), dark);
  base.position.y = 0.16;
  const body = new Mesh(new IcosahedronGeometry(0.3, 1), st);
  body.scale.set(0.9, 1.05, 1.15);
  body.position.set(0, 0.6, -0.05);
  const mane = new Mesh(new IcosahedronGeometry(0.27, 1), dark);
  mane.position.set(0, 0.98, 0.06);
  const head = new Mesh(new IcosahedronGeometry(0.2, 1), st);
  head.position.set(0, 1.0, 0.16);
  const ball = new Mesh(new IcosahedronGeometry(0.11, 1), dark);
  ball.position.set(0.16, 0.42, 0.24);
  const legs = [-0.13, 0.13].map((x) => {
    const l = new Mesh(new CylinderGeometry(0.07, 0.08, 0.36, 6), st);
    l.position.set(x, 0.5, 0.22);
    return l;
  });
  for (const sx of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.035, 6, 5), dark);
    eye.position.set(sx * 0.08, 1.05, 0.33);
    g.add(eye);
  }
  g.add(base, body, mane, head, ball, ...legs);
  g.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return g;
}

// ───────────────────────────────────────── Ergebnis

export interface Cafe {
  group: Group;
  /** Unsichtbare Kollisionsflächen für die Kamera */
  blockers: Mesh[];
  /** Flächen für „Hinlaufen per Klick“ */
  floors: Mesh[];
  lanterns: Lantern[];
  bigLantern: Lantern;
  windowMats: MeshStandardMaterial[];
  shaftWindows: { center: Vector3; w: number; h: number }[];
  door: { left: Group; right: Group; set(open: number): void };
  teapot: Group;
  incense: Group;
  scroll: Mesh;
  ruler: Mesh;
  /** Weltpositionen für Dampf */
  steam: { pos: Vector3; rate: number; size: number }[];
  incenseTip: Vector3;
  cushion: Vector3;
  boardPieces: InstancedMesh;
}

export function buildCafe(lightCount: number): Cafe {
  const root = new Group();
  root.name = 'cafe';
  const B = new Batcher();
  const paper = new MeshStandardMaterial({
    color: '#f4ead6',
    map: paperTexture(),
    emissive: new Color('#ffcf8a'),
    emissiveIntensity: 0.4,
    roughness: 0.9,
    side: DoubleSide,
  });
  B.shadowless(paper);
  const windowMats = [paper];
  const lac = M.lacquer();
  const dw = M.darkWood();
  const mw = M.midWood();
  const pl = M.plaster();
  const stone = M.stone();
  const gold = M.gold();
  const H = CEIL - FLOOR;
  const shaftWindows: Cafe['shaftWindows'] = [];

  // ── Sockel, Böden, Treppe
  B.box(
    HALL.x1 - HALL.x0 + 0.6,
    FLOOR - 0.06,
    TERRACE.z1 - HALL.z0 + 0.4,
    stone,
    0,
    (FLOOR - 0.06) / 2,
    (HALL.z0 + TERRACE.z1) / 2,
  );
  const floorTex = woodTexture().clone();
  floorTex.repeat.set(7, 6);
  floorTex.needsUpdate = true;
  const floorMat = vinyl('#b0815a', { rough: 0.62, map: floorTex, rim: 0.2, key: 'cafe-floor' });
  const floor = new Mesh(new BoxGeometry(HALL.x1 - HALL.x0 + 0.4, 0.1, TERRACE.z1 - HALL.z0 + 0.2), floorMat);
  floor.position.set(0, FLOOR - 0.05, (HALL.z0 + TERRACE.z1) / 2);
  floor.receiveShadow = true;
  floor.name = 'floor';
  root.add(floor);
  for (let i = 0; i < 3; i++) {
    const zc = STAIRS.z0 + 0.12 + i * 0.24;
    const top = FLOOR - (i + 1) * ((FLOOR - 0.2) / 3);
    B.box(STAIRS.x1 - STAIRS.x0 + 0.3, top + 0.02, 0.26, stone, 0, (top + 0.02) / 2, zc);
  }
  // Teppich in der Hallenmitte
  B.box(5.6, 0.012, 3.6, vinyl('#7a2418', { rough: 1, rim: 0.2 }), 0.2, FLOOR + 0.006, -0.6);
  B.box(5.2, 0.014, 3.2, vinyl('#94402a', { rough: 1, rim: 0.2 }), 0.2, FLOOR + 0.008, -0.6);

  // ── Wände
  const blockers: Mesh[] = [];
  const blockMat = new MeshBasicMaterial({ visible: false });
  const block = (w: number, h: number, d: number, x: number, y: number, z: number): void => {
    const m = new Mesh(new BoxGeometry(w, h, d), blockMat);
    m.position.set(x, y, z);
    m.updateMatrixWorld();
    blockers.push(m);
    root.add(m);
  };
  /** Wandstück entlang x (bei z) oder entlang z (bei x), mit Papierfenstern zwischen Pfosten */
  const wall = (
    axis: 'x' | 'z',
    fixed: number,
    a0: number,
    a1: number,
    windows: boolean,
    collectShafts = false,
  ): void => {
    const len = a1 - a0;
    const mid = (a0 + a1) / 2;
    const put = (along: number, y: number, w: number, h: number, mat: Material, depth = WALL_T): void => {
      if (axis === 'x') B.box(w, h, depth, mat, along, y, fixed);
      else B.box(depth, h, w, mat, fixed, y, along);
    };
    // unten Holzpaneel, oben Putz
    put(mid, FLOOR + 0.45, len, 0.9, mw);
    put(mid, FLOOR + 0.9 + 0.03, len, 0.06, dw, WALL_T + 0.04);
    put(mid, FLOOR + 2.65 + (H - 2.65) / 2, len, H - 2.65, pl);
    put(mid, FLOOR + 2.65, len, 0.08, dw, WALL_T + 0.04);
    put(mid, CEIL - 0.06, len, 0.12, dw, WALL_T + 0.06);
    const bays = Math.max(1, Math.round(len / 1.9));
    for (let i = 0; i <= bays; i++) put(a0 + (len * i) / bays, FLOOR + H / 2, 0.16, H, dw, WALL_T + 0.08);
    for (let i = 0; i < bays; i++) {
      const c = a0 + (len * (i + 0.5)) / bays;
      const w = len / bays - 0.16;
      const wy = FLOOR + 0.9 + 0.875;
      if (!windows) {
        put(c, wy, w, 1.75, pl);
        continue;
      }
      // Papier + Gitter
      if (axis === 'x') B.add(new PlaneGeometry(w, 1.75), paper, [c, wy, fixed]);
      else B.add(new PlaneGeometry(w, 1.75), paper, [fixed, wy, c], [0, Math.PI / 2, 0]);
      const cols = Math.round(w / 0.3);
      const rows = 6;
      for (let k = 1; k < cols; k++)
        put(a0 + (len * i) / bays + 0.08 + (w * k) / cols, wy, 0.035, 1.75, dw, 0.06);
      for (let k = 1; k < rows; k++) put(c, FLOOR + 0.9 + (1.75 * k) / rows, w, 0.035, dw, 0.06);
      if (collectShafts)
        shaftWindows.push({
          center: axis === 'x' ? new Vector3(c, wy, fixed) : new Vector3(fixed, wy, c),
          w,
          h: 1.75,
        });
    }
    if (axis === 'x') block(len, H, WALL_T + 0.1, mid, FLOOR + H / 2, fixed);
    else block(WALL_T + 0.1, H, len, fixed, FLOOR + H / 2, mid);
  };
  wall('x', HALL.z0, HALL.x0, HALL.x1, true);
  wall('z', HALL.x0, HALL.z0, HALL.z1, true, true);
  wall('z', HALL.x1, HALL.z0, HALL.z1, true);
  wall('x', HALL.z1, HALL.x0, DOOR.x0 - 0.1, true);
  wall('x', HALL.z1, DOOR.x1 + 0.1, HALL.x1, true);
  // über der Tür
  B.box(DOOR.x1 - DOOR.x0 + 0.2, CEIL - FLOOR - DOOR.h, WALL_T, pl, 0, (CEIL + FLOOR + DOOR.h) / 2, HALL.z1);
  block(
    DOOR.x1 - DOOR.x0 + 0.2,
    CEIL - FLOOR - DOOR.h,
    WALL_T + 0.1,
    0,
    (CEIL + FLOOR + DOOR.h) / 2,
    HALL.z1,
  );
  // Türrahmen und Türbalken (niedriger als Yao)
  B.box(DOOR.x1 - DOOR.x0 + 0.5, 0.2, WALL_T + 0.14, lac, 0, FLOOR + DOOR.h + 0.1, HALL.z1);
  for (const x of [DOOR.x0 - 0.06, DOOR.x1 + 0.06])
    B.box(0.14, DOOR.h, WALL_T + 0.12, lac, x, FLOOR + DOOR.h / 2, HALL.z1);
  // Schild über der Tür und Spruchbänder
  const sign = new Mesh(new PlaneGeometry(1.5, 0.56), signTexture());
  sign.position.set(0, FLOOR + DOOR.h + 0.62, HALL.z1 + WALL_T / 2 + 0.02);
  root.add(sign);
  for (const [x, txt] of [
    [-1.32, '茶香四溢'],
    [1.32, '宾至如归'],
  ] as const) {
    const cp = new Mesh(new PlaneGeometry(0.34, 1.8), coupletTexture(txt));
    cp.position.set(x, FLOOR + 1.35, HALL.z1 + WALL_T / 2 + 0.02);
    root.add(cp);
  }
  // Messlatte am inneren Türrahmen
  const ruler = new Mesh(new PlaneGeometry(0.1, 2.4), rulerMaterial());
  ruler.position.set(DOOR.x1 + 0.14, FLOOR + 1.2, HALL.z1 - WALL_T / 2 - 0.08);
  ruler.rotation.y = Math.PI;
  ruler.name = 'ruler';
  root.add(ruler);

  // Türflügel (öffnen nach außen)
  const leaf = (side: -1 | 1): Group => {
    const pivot = new Group();
    const w = (DOOR.x1 - DOOR.x0) / 2;
    pivot.position.set(side < 0 ? DOOR.x0 : DOOR.x1, FLOOR, HALL.z1 + 0.02);
    const panel = new Group();
    panel.position.x = -side * (w / 2);
    const frame = vinyl('#6b2416', { rough: 0.5 });
    const parts: Mesh[] = [
      new Mesh(new BoxGeometry(w, 0.9, 0.06), frame),
      new Mesh(new BoxGeometry(w, 0.08, 0.07), frame),
      new Mesh(new BoxGeometry(0.08, DOOR.h - 0.9, 0.07), frame),
      new Mesh(new BoxGeometry(0.08, DOOR.h - 0.9, 0.07), frame),
      new Mesh(new PlaneGeometry(w - 0.12, DOOR.h - 1.0), paper),
    ];
    parts[0]!.position.y = 0.45;
    parts[1]!.position.y = DOOR.h - 0.04;
    parts[2]!.position.set(-w / 2 + 0.04, 0.9 + (DOOR.h - 0.9) / 2, 0);
    parts[3]!.position.set(w / 2 - 0.04, 0.9 + (DOOR.h - 0.9) / 2, 0);
    parts[4]!.position.y = 0.9 + (DOOR.h - 0.9) / 2;
    for (let k = 1; k < 4; k++) {
      const bar = new Mesh(new BoxGeometry(0.025, DOOR.h - 1.0, 0.04), frame);
      bar.position.set(-w / 2 + 0.06 + ((w - 0.12) * k) / 4, 0.9 + (DOOR.h - 0.9) / 2, 0);
      parts.push(bar);
    }
    const ring = new Mesh(new TorusGeometry(0.05, 0.012, 6, 12), gold);
    ring.position.set(side * (w / 2 - 0.12), 1.0, 0.05);
    parts.push(ring);
    for (const m of parts) {
      m.castShadow = true;
      panel.add(m);
    }
    pivot.add(panel);
    root.add(pivot);
    return pivot;
  };
  const left = leaf(-1);
  const right = leaf(1);
  const door = {
    left,
    right,
    set(open: number): void {
      left.rotation.y = -open * 1.75;
      right.rotation.y = open * 1.75;
    },
  };

  // ── Säulen, Balken, Decke
  for (const [x, z] of PILLARS) {
    const p = new CylinderGeometry(0.17, 0.19, H, 12);
    B.add(p, lac, [x, FLOOR + H / 2, z]);
    B.add(new CylinderGeometry(0.26, 0.28, 0.14, 12), stone, [x, FLOOR + 0.07, z]);
    B.add(new CylinderGeometry(0.22, 0.2, 0.12, 12), gold, [x, CEIL - 0.3, z]);
    const m = new Mesh(new CylinderGeometry(0.2, 0.2, H, 8), blockMat);
    m.position.set(x, FLOOR + H / 2, z);
    m.updateMatrixWorld();
    blockers.push(m);
    root.add(m);
  }
  for (const z of [-4, -2.4, 1.6, 3]) B.box(HALL.x1 - HALL.x0, 0.22, 0.18, dw, 0, CEIL - 0.2, z);
  for (const x of [-2.4, 2.4])
    B.box(0.2, 0.24, HALL.z1 - HALL.z0, mw, x, CEIL - 0.34, (HALL.z0 + HALL.z1) / 2);
  B.box(
    HALL.x1 - HALL.x0,
    0.06,
    HALL.z1 - HALL.z0,
    vinyl('#5a3a24', { rough: 0.8, rim: 0.2 }),
    0,
    CEIL + 0.03,
    (HALL.z0 + HALL.z1) / 2,
  );
  block(HALL.x1 - HALL.x0 + 2, 0.3, HALL.z1 - HALL.z0 + 2, 0, CEIL + 0.15, (HALL.z0 + HALL.z1) / 2);

  // ── Terrasse: Geländer, Säulen unter dem Vordach
  const railZ = TERRACE.z1 - 0.06;
  for (let x = TERRACE.x0 + 0.05; x <= TERRACE.x1 + 0.01; x += 1.0) {
    if (Math.abs(x) < 1.15) continue;
    B.add(new CylinderGeometry(0.045, 0.05, 0.75, 8), lac, [x, FLOOR + 0.375, railZ]);
  }
  for (const [a, b] of [
    [TERRACE.x0, -1.1],
    [1.1, TERRACE.x1],
  ] as const) {
    B.box(b - a, 0.06, 0.08, lac, (a + b) / 2, FLOOR + 0.74, railZ);
    B.box(b - a, 0.04, 0.05, lac, (a + b) / 2, FLOOR + 0.38, railZ);
  }
  for (const x of [TERRACE.x0 + 0.05, TERRACE.x1 - 0.05]) {
    for (let z = TERRACE.z0 + 0.4; z <= TERRACE.z1; z += 1.0)
      B.add(new CylinderGeometry(0.045, 0.05, 0.75, 8), lac, [x, FLOOR + 0.375, z]);
    B.box(0.08, 0.06, TERRACE.z1 - TERRACE.z0, lac, x, FLOOR + 0.74, (TERRACE.z0 + TERRACE.z1) / 2);
  }
  for (const x of [-4.6, -1.3, 1.3, 4.6]) {
    B.add(new CylinderGeometry(0.13, 0.14, CEIL - FLOOR + 0.2, 10), lac, [
      x,
      (CEIL + FLOOR) / 2 + 0.1,
      TERRACE.z0 + 1.05,
    ]);
    B.add(new CylinderGeometry(0.2, 0.22, 0.12, 10), stone, [x, FLOOR + 0.06, TERRACE.z0 + 1.05]);
  }
  B.box(HALL.x1 - HALL.x0 + 0.4, 0.2, 0.2, dw, 0, CEIL + 0.05, TERRACE.z0 + 1.05);

  // Steinlöwen an der Treppe
  for (const sx of [-1, 1]) {
    const lion = stoneLion();
    lion.position.set(sx * 1.45, FLOOR, TERRACE.z1 - 0.3);
    lion.rotation.y = sx * 0.25;
    root.add(lion);
  }

  // Dach
  const roofGroup = roof(
    0,
    (HALL.z0 + HALL.z1) / 2 + 0.35,
    (HALL.x1 - HALL.x0) / 2 + 1.3,
    (HALL.z1 - HALL.z0) / 2 + 1.6,
    2.5,
    CEIL + 0.05,
  );
  root.add(roofGroup);
  block(HALL.x1 - HALL.x0 + 2.8, 2.6, HALL.z1 - HALL.z0 + 3.4, 0, CEIL + 1.4, (HALL.z0 + HALL.z1) / 2 + 0.35);

  // ── Theke mit Regal
  const cw = COUNTER.x1 - COUNTER.x0;
  const ccx = (COUNTER.x0 + COUNTER.x1) / 2;
  const ccz = (COUNTER.z0 + COUNTER.z1) / 2;
  B.box(cw, 0.98, COUNTER.z1 - COUNTER.z0, lac, ccx, FLOOR + 0.49, ccz);
  B.box(cw + 0.12, 0.06, COUNTER.z1 - COUNTER.z0 + 0.14, mw, ccx, FLOOR + 1.01, ccz);
  B.box(cw, 0.04, 0.02, gold, ccx, FLOOR + 0.82, COUNTER.z1 + 0.005);
  B.box(cw, 0.04, 0.02, gold, ccx, FLOOR + 0.14, COUNTER.z1 + 0.005);
  for (let i = 0; i < 6; i++)
    B.box(0.03, 0.6, 0.02, gold, COUNTER.x0 + 0.3 + (i * (cw - 0.6)) / 5, FLOOR + 0.48, COUNTER.z1 + 0.006);
  block(cw, 1.0, COUNTER.z1 - COUNTER.z0, ccx, FLOOR + 0.5, ccz);
  // Wandregal hinter der Theke
  for (const y of [1.2, 1.7, 2.2]) B.box(cw + 0.2, 0.05, 0.36, mw, ccx, FLOOR + y, HALL.z0 + 0.3);
  for (const x of [COUNTER.x0 - 0.1, COUNTER.x1 + 0.1])
    B.box(0.06, 1.3, 0.36, dw, x, FLOOR + 1.65, HALL.z0 + 0.3);
  // Krüge und Teekannen im Regal (Instancing)
  const jarGeo = new LatheGeometry(
    [0, 0.3, 0.6, 0.85, 1].map(
      (t, i) => new Vector2(0.03 + Math.sin(t * Math.PI) * 0.07 + (i === 4 ? -0.02 : 0), t * 0.24),
    ),
    12,
  );
  const jarCols = ['#3a5f7a', '#e6e0d0', '#8a4a2c', '#2e6b5e', '#c9a25a'];
  const jars = new InstancedMesh(jarGeo, vinyl('#ffffff', { rough: 0.3 }), 30);
  const o = new Object3D();
  let ji = 0;
  for (const y of [1.225, 1.725, 2.225]) {
    for (let k = 0; k < 10; k++) {
      o.position.set(COUNTER.x0 + 0.2 + (k * (cw - 0.3)) / 9, FLOOR + y, HALL.z0 + 0.3);
      const s = 0.8 + ((k * 7 + y * 10) % 5) * 0.08;
      o.scale.set(s, s, s);
      o.updateMatrix();
      jars.setMatrixAt(ji, o.matrix);
      jars.setColorAt(ji, new Color(jarCols[(k + Math.round(y * 3)) % jarCols.length]!));
      ji++;
    }
  }
  jars.castShadow = true;
  root.add(jars);
  // Ofen mit großem Kessel hinter der Theke
  B.add(new CylinderGeometry(0.3, 0.34, 0.7, 10), stone, [-6.45, FLOOR + 0.35, -5.35]);
  const kettle = new Mesh(new SphereGeometry(0.22, 14, 10), vinyl('#3a3632', { rough: 0.35, metal: 0.6 }));
  kettle.scale.y = 0.85;
  kettle.position.set(-6.45, FLOOR + 0.88, -5.35);
  kettle.castShadow = true;
  root.add(kettle);
  const ember = new Mesh(
    new SphereGeometry(0.1, 8, 6),
    new MeshStandardMaterial({ color: '#ff6a2a', emissive: '#ff5a1a', emissiveIntensity: 2.5 }),
  );
  ember.position.set(-6.45, FLOOR + 0.5, -5.05);
  root.add(ember);
  // Große Zier-Teekanne auf der Theke (Fundstück)
  const teapot = new Group();
  teapot.name = 'teapot';
  const clay = vinyl('#8a4a2c', { rough: 0.4 });
  const body = new Mesh(
    new LatheGeometry(
      [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1].map(
        (t) => new Vector2(0.03 + Math.sin(t * Math.PI * 0.95) * 0.13, t * 0.19),
      ),
      18,
    ),
    clay,
  );
  const lid = new Mesh(new SphereGeometry(0.07, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), clay);
  lid.position.y = 0.18;
  const knob = new Mesh(new SphereGeometry(0.022, 8, 6), clay);
  knob.position.y = 0.25;
  const spout = new Mesh(new CylinderGeometry(0.018, 0.03, 0.17, 8), clay);
  spout.position.set(0.17, 0.12, 0);
  spout.rotation.z = -0.9;
  const handle = new Mesh(new TorusGeometry(0.07, 0.016, 6, 12, Math.PI * 1.2), clay);
  handle.position.set(-0.13, 0.1, 0);
  handle.rotation.z = Math.PI * 0.4;
  teapot.add(body, lid, knob, spout, handle);
  teapot.traverse((m) => (m.castShadow = true));
  teapot.position.set(COUNTER.x1 - 0.45, FLOOR + 1.04, ccz);
  teapot.rotation.y = -0.8;
  root.add(teapot);
  // Schalenstapel auf der Theke
  const bowlGeo = new LatheGeometry(
    [new Vector2(0.0001, 0), new Vector2(0.04, 0), new Vector2(0.065, 0.045), new Vector2(0.062, 0.046)],
    14,
  );
  const bowls = new InstancedMesh(bowlGeo, vinyl('#e9ece6', { rough: 0.22 }), 6);
  for (let i = 0; i < 6; i++) {
    o.position.set(COUNTER.x0 + 0.5 + (i % 2) * 0.16, FLOOR + 1.04 + Math.floor(i / 2) * 0.03, ccz);
    o.scale.setScalar(1);
    o.updateMatrix();
    bowls.setMatrixAt(i, o.matrix);
  }
  root.add(bowls);

  // ── Tische und Hocker
  const tableTop = vinyl('#5a3520', { rough: 0.38, map: woodTexture(), key: 'table-top' });
  for (const t of TABLES) {
    B.add(new CylinderGeometry(t.r, t.r, 0.05, 28), tableTop, [t.x, FLOOR + t.h, t.z]);
    B.add(new CylinderGeometry(t.r * 0.96, t.r * 0.9, 0.06, 28), dw, [t.x, FLOOR + t.h - 0.05, t.z]);
    B.add(new CylinderGeometry(0.06, 0.08, t.h - 0.05, 10), dw, [t.x, FLOOR + (t.h - 0.05) / 2, t.z]);
    B.add(new CylinderGeometry(0.26, 0.3, 0.05, 14), dw, [t.x, FLOOR + 0.025, t.z]);
  }
  const stoolGeo = new LatheGeometry(
    [0, 0.15, 0.35, 0.5, 0.65, 0.85, 1]
      .map((t) => new Vector2(0.14 + Math.sin(t * Math.PI) * 0.05, t * STOOL_H))
      .concat([new Vector2(0.0001, STOOL_H)]),
    16,
  );
  const stools = new InstancedMesh(stoolGeo, vinyl('#2f6b72', { rough: 0.3 }), SEATS.length);
  SEATS.forEach((s, i) => {
    o.position.set(s.x, FLOOR, s.z);
    o.rotation.set(0, 0, 0);
    o.scale.setScalar(1);
    o.updateMatrix();
    stools.setMatrixAt(i, o.matrix);
    stools.setColorAt(
      i,
      new Color(
        s.table === 'main' ? '#9b2a1c' : i % 3 === 0 ? '#2f6b72' : i % 3 === 1 ? '#3a7a5e' : '#2f5f82',
      ),
    );
  });
  stools.castShadow = true;
  stools.receiveShadow = true;
  root.add(stools);
  // Teekannen und Schalen auf den Tischen
  const potGeo = new LatheGeometry(
    [0, 0.2, 0.45, 0.7, 0.9, 1].map(
      (t) => new Vector2(0.02 + Math.sin(t * Math.PI * 0.95) * 0.075, t * 0.12),
    ),
    14,
  );
  const pots = new InstancedMesh(potGeo, vinyl('#ffffff', { rough: 0.35 }), TABLES.length);
  const cupGeo = new LatheGeometry(
    [new Vector2(0.0001, 0), new Vector2(0.024, 0), new Vector2(0.036, 0.045), new Vector2(0.033, 0.046)],
    12,
  );
  const cupCount = SEATS.length;
  const cups = new InstancedMesh(cupGeo, vinyl('#efe9dc', { rough: 0.22 }), cupCount);
  const steam: Cafe['steam'] = [{ pos: new Vector3(-6.45, FLOOR + 1.1, -5.35), rate: 3, size: 1.2 }];
  TABLES.forEach((t, i) => {
    o.position.set(t.x + 0.12, FLOOR + t.h + 0.025, t.z - 0.08);
    o.scale.setScalar(1);
    o.updateMatrix();
    pots.setMatrixAt(i, o.matrix);
    pots.setColorAt(i, new Color(i % 2 ? '#8a4a2c' : '#3a5f7a'));
    steam.push({
      pos: new Vector3(t.x + 0.12 + 0.08, FLOOR + t.h + 0.16, t.z - 0.08),
      rate: t.id === 'main' ? 2.2 : 1.1,
      size: 0.7,
    });
  });
  SEATS.forEach((s, i) => {
    const t = TABLES.find((x) => x.id === s.table)!;
    const dx = s.x - t.x;
    const dz = s.z - t.z;
    const d = Math.hypot(dx, dz);
    o.position.set(t.x + (dx / d) * (t.r - 0.16), FLOOR + t.h + 0.025, t.z + (dz / d) * (t.r - 0.16));
    o.updateMatrix();
    cups.setMatrixAt(i, o.matrix);
  });
  pots.castShadow = true;
  cups.castShadow = true;
  root.add(pots, cups);
  // Haupttisch: roter Läufer, Teller mit Mondkuchen, Vase mit Blütenzweig
  const main = TABLES.find((t) => t.id === 'main')!;
  B.add(new CylinderGeometry(main.r * 0.75, main.r * 0.75, 0.006, 24), vinyl('#a8231a', { rough: 0.9 }), [
    main.x,
    FLOOR + main.h + 0.028,
    main.z,
  ]);
  B.add(new CylinderGeometry(0.11, 0.1, 0.015, 16), vinyl('#f2efe6', { rough: 0.3 }), [
    main.x - 0.18,
    FLOOR + main.h + 0.035,
    main.z + 0.08,
  ]);
  for (const [dx, dz] of [
    [-0.21, 0.06],
    [-0.15, 0.11],
  ] as const)
    B.add(new CylinderGeometry(0.035, 0.035, 0.025, 12), vinyl('#c88a3e', { rough: 0.6 }), [
      main.x + dx,
      FLOOR + main.h + 0.055,
      main.z + dz,
    ]);
  // Paravent hinter dem Haupttisch
  const screen = new Mesh(new PlaneGeometry(2.8, 1.5), screenTexture());
  screen.position.set(main.x, FLOOR + 0.95, HALL.z0 + 0.42);
  screen.castShadow = true;
  root.add(screen);
  B.box(2.9, 0.06, 0.06, dw, main.x, FLOOR + 1.72, HALL.z0 + 0.42);
  for (const dx of [-1.43, -0.7, 0, 0.7, 1.43])
    B.box(0.05, 1.6, 0.06, dw, main.x + dx, FLOOR + 0.9, HALL.z0 + 0.42);

  // Xiangqi-Brett mit Figuren
  const board = TABLES.find((t) => t.id === 'board')!;
  const bm = new Mesh(new BoxGeometry(0.4, 0.02, 0.44), boardMaterial());
  bm.position.set(board.x, FLOOR + board.h + 0.035, board.z);
  bm.rotation.y = Math.PI / 2;
  bm.receiveShadow = true;
  root.add(bm);
  const pieceGeo = new CylinderGeometry(0.017, 0.017, 0.012, 12);
  const pieces = new InstancedMesh(pieceGeo, vinyl('#f1e2c0', { rough: 0.5 }), 20);
  for (let i = 0; i < 20; i++) {
    const side = i < 10 ? -1 : 1;
    o.position.set(
      board.x + side * (0.08 + ((i * 37) % 9) * 0.012),
      FLOOR + board.h + 0.052,
      board.z - 0.17 + ((i * 13) % 10) * 0.037,
    );
    o.updateMatrix();
    pieces.setMatrixAt(i, o.matrix);
    pieces.setColorAt(i, new Color(side < 0 ? '#b3261a' : '#1c1a18'));
  }
  root.add(pieces);
  // Papier und Tuschestein der Dichterin
  const poet = TABLES.find((t) => t.id === 'poet')!;
  B.box(0.3, 0.004, 0.42, vinyl('#f6efdf', { rough: 0.9 }), poet.x - 0.12, FLOOR + poet.h + 0.03, poet.z);
  B.box(
    0.1,
    0.03,
    0.16,
    vinyl('#1c1a18', { rough: 0.3 }),
    poet.x + 0.2,
    FLOOR + poet.h + 0.04,
    poet.z + 0.15,
  );

  // Seitenregal mit Räucherwerk (links)
  B.box(0.5, 0.05, 1.1, mw, -6.65, FLOOR + 0.95, -2.8);
  B.box(0.5, 0.05, 1.1, mw, -6.65, FLOOR + 0.45, -2.8);
  for (const z of [-3.32, -2.28]) B.box(0.5, 0.97, 0.05, dw, -6.65, FLOOR + 0.485, z);
  const incense = new Group();
  incense.name = 'incense';
  const bronze = vinyl('#7c6a3a', { rough: 0.35, metal: 0.7 });
  incense.add(
    new Mesh(
      new LatheGeometry(
        [
          new Vector2(0.0001, 0.03),
          new Vector2(0.1, 0.03),
          new Vector2(0.11, 0.09),
          new Vector2(0.085, 0.13),
          new Vector2(0.0001, 0.13),
        ],
        12,
      ),
      bronze,
    ),
  );
  for (const dx of [-0.02, 0.02]) {
    const st = new Mesh(new CylinderGeometry(0.003, 0.003, 0.2, 3), vinyl('#6a2a18'));
    st.position.set(dx, 0.22, 0);
    incense.add(st);
  }
  incense.position.set(-6.62, FLOOR + 0.975, -3.0);
  root.add(incense);
  const vase = new Mesh(
    new LatheGeometry(
      [
        new Vector2(0.0001, 0),
        new Vector2(0.06, 0),
        new Vector2(0.09, 0.1),
        new Vector2(0.04, 0.22),
        new Vector2(0.055, 0.27),
      ],
      12,
    ),
    vinyl('#dfe6ea', { rough: 0.25 }),
  );
  vase.position.set(-6.62, FLOOR + 0.975, -2.5);
  root.add(vase);
  // Hängerolle an der Rückwand
  const scroll = new Mesh(new PlaneGeometry(0.62, 1.95), scrollMaterial());
  scroll.position.set(-0.4, FLOOR + 1.95, HALL.z0 + WALL_T / 2 + 0.03);
  scroll.name = 'scroll';
  root.add(scroll);
  B.box(0.74, 0.05, 0.05, dw, -0.4, FLOOR + 2.95, HALL.z0 + 0.16);
  B.box(0.7, 0.04, 0.04, dw, -0.4, FLOOR + 0.96, HALL.z0 + 0.16);
  // Katzenkissen und Pflanzen
  const cushion = new Vector3(6.2, FLOOR, 3.2);
  B.add(new CylinderGeometry(0.34, 0.36, 0.09, 14), vinyl('#9b2a1c', { rough: 0.9 }), [
    cushion.x,
    FLOOR + 0.045,
    cushion.z,
  ]);
  for (const [x, z] of [
    [-6.5, 3.5],
    [6.5, -1],
    [-6.4, 5.9],
    [6.4, 5.9],
  ] as const) {
    const y0 = FLOOR;
    B.add(new CylinderGeometry(0.26, 0.2, 0.4, 12), vinyl('#2f5f6b', { rough: 0.3 }), [x, y0 + 0.2, z]);
    for (let k = 0; k < 7; k++) {
      const h = 0.9 + ((k * 31) % 7) * 0.12;
      const ax = Math.sin(k * 2.4) * 0.12;
      const az = Math.cos(k * 2.4) * 0.12;
      B.add(new CylinderGeometry(0.018, 0.022, h, 6), vinyl('#7f9a3a', { rough: 0.5 }), [
        x + ax,
        y0 + 0.4 + h / 2,
        z + az,
      ]);
      B.add(
        new ConeGeometry(0.05, 0.32, 3),
        vinyl('#5e8a34', { rough: 0.7 }),
        [x + ax + 0.1, y0 + 0.4 + h * 0.85, z + az],
        [0, k, 1.3],
      );
    }
  }

  root.add(B.build('cafe-static'));

  // ── Laternen
  const lanterns: Lantern[] = [];
  const addL = (l: Lantern, x: number, y: number, z: number): Lantern => {
    l.group.position.set(x, y, z);
    root.add(l.group);
    lanterns.push(l);
    return l;
  };
  // Über Yao hängt eine große Laterne (Fundstück: er duckt sich)
  const bigLantern = addL(makeLantern(1.5, lightCount > 0, 0.7), main.x + 0.65, CEIL - 1.05, main.z - 0.35);
  bigLantern.group.name = 'bigLantern';
  addL(makeLantern(1.15, lightCount > 1, 0.6), -4.4, CEIL - 0.95, -1.4);
  addL(makeLantern(1.15, lightCount > 2, 0.6), 0.6, CEIL - 0.95, 1.0);
  addL(makeLantern(1.1, lightCount > 3, 0.6), -4.6, CEIL - 0.95, 2.2);
  addL(makeLantern(1.0, false, 0.6), -0.4, CEIL - 0.95, -3.4);
  for (const x of [-5.8, -3, 3, 5.8]) addL(makeLantern(1.0, false, 0.45), x, CEIL - 0.85, TERRACE.z0 + 1.05);

  // Bodenflächen zum Anklicken
  const floors: Mesh[] = [floor];

  return {
    group: root,
    blockers,
    floors,
    lanterns,
    bigLantern,
    windowMats,
    shaftWindows,
    door,
    teapot,
    incense,
    scroll,
    ruler,
    steam,
    incenseTip: new Vector3(-6.62, FLOOR + 1.3, -3.0),
    cushion,
    boardPieces: pieces,
  };
}
