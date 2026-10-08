// Das Teehaus: Plattform, Pfosten, Balken, geschwungenes Dach, Papierfenster, Laternen und die Einrichtung.
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
  CatmullRomCurve3,
  TubeGeometry,
  ConeGeometry,
} from 'three';
import { FLOOR, FONT_BRUSH, HX, HZ, flat, mesh } from './shared';
import { glowTexture, makeTexture, paperTexture, rulerTexture, woodTexture } from './textures';

// ───────────────────────────────────────── Materialien

const lacquer = (): MeshStandardMaterial => flat('#6e1d14', { rough: 0.45 });
const darkWood = (): MeshStandardMaterial => flat('#4a2f1e', { rough: 0.7 });
const midWood = (): MeshStandardMaterial => flat('#7a5235', { rough: 0.75 });
const stone = (): MeshStandardMaterial => flat('#8f897d', { rough: 0.95 });

function box(
  w: number,
  h: number,
  d: number,
  mat: MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
): Mesh {
  const m = mesh(new BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// ───────────────────────────────────────── Laterne

export interface Lantern {
  group: Group;
  body: Mesh;
  light: PointLight | null;
  glow: Sprite;
  phase: number;
  swing: number;
  /** Basis-Helligkeit (Faktor) */
  base: number;
}

export function makeLantern(scale: number, withLight: boolean, cord: number): Lantern {
  const group = new Group();
  const pts: Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new Vector2(0.06 + Math.sin(t * Math.PI) * 0.16, t * 0.42 - 0.21));
  }
  const bodyMat = new MeshStandardMaterial({
    color: '#c0281c',
    emissive: new Color('#ff5a2a'),
    emissiveIntensity: 1,
    roughness: 0.6,
    flatShading: true,
  });
  const body = mesh(new LatheGeometry(pts, 10), bodyMat, 'none');
  body.scale.setScalar(scale);
  const gold = flat('#c9952e', { rough: 0.35, metal: 0.6 });
  const capT = mesh(new CylinderGeometry(0.07, 0.08, 0.04, 10), gold, 'none');
  capT.position.y = 0.22 * scale;
  capT.scale.setScalar(scale);
  const capB = capT.clone();
  capB.position.y = -0.22 * scale;
  const tassel = mesh(new ConeGeometry(0.03, 0.18, 6), flat('#b3261a'), 'none');
  tassel.rotation.x = Math.PI;
  tassel.position.y = -0.33 * scale;
  tassel.scale.setScalar(scale);
  const string = mesh(new CylinderGeometry(0.006, 0.006, cord, 4), flat('#2a1a10'), 'none');
  string.position.y = 0.22 * scale + cord / 2;
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
    light = new PointLight('#ff9850', 2.5, 7, 1.6);
    light.position.y = -0.05;
    group.add(light);
  }
  return { group, body, light, glow, phase: Math.random() * 10, swing: 0, base: 1 };
}

// ───────────────────────────────────────── Dach

/** Walmdach mit konkaver Kurve und hochgezogenen Ecken (typisch chinesisch), mit sichtbarer Dicke. */
function roof(): Group {
  const g = new Group();
  g.name = 'roof';
  const W = HX + 1.25;
  const D = HZ + 1.15;
  const H = 1.85;
  const base = FLOOR + 3.05;
  const height = (x: number, z: number): number => {
    const ax = Math.abs(x);
    const az = Math.abs(z);
    const s = Math.max(0, Math.min((D - az) / D, (W - ax) / D));
    let y = H * Math.pow(s, 1.45);
    const ex = ax / W;
    const ez = az / D;
    // Ecken hochziehen, Traufen leicht anheben
    y += 0.55 * Math.pow(Math.min(ex, ez) > 0.6 ? Math.min(1, (Math.min(ex, ez) - 0.6) / 0.4) : 0, 2.2);
    y += 0.1 * (Math.pow(ex, 8) + Math.pow(ez, 8));
    // Ziegelreihen
    y += 0.03 * Math.sin((x / 0.24) * Math.PI) * Math.min(1, s * 6);
    return y;
  };
  const top = new PlaneGeometry(W * 2, D * 2, 48, 36).rotateX(-Math.PI / 2);
  const p = top.attributes.position as BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
  top.computeVertexNormals();
  const tiles = new MeshStandardMaterial({ color: '#3f454c', roughness: 0.65, flatShading: true });
  const topMesh = mesh(top, tiles);
  topMesh.position.y = base;
  g.add(topMesh);
  // Unterseite (Holz) etwas tiefer, Rückseite sichtbar
  const under = top.clone();
  const up = under.attributes.position as BufferAttribute;
  for (let i = 0; i < up.count; i++) up.setY(i, up.getY(i) - 0.16);
  under.computeVertexNormals();
  const underMesh = mesh(
    under,
    new MeshStandardMaterial({ color: '#5a3a24', roughness: 0.8, side: DoubleSide, flatShading: true }),
    'receive',
  );
  underMesh.position.y = base;
  g.add(underMesh);
  // Traufbrett rundherum
  const fascia: number[] = [];
  const edge = (x: number, z: number): [number, number, number] => [x, height(x, z), z];
  const N = 60;
  const ring: [number, number][] = [];
  for (let i = 0; i < N; i++) ring.push([-W + (2 * W * i) / N, D]);
  for (let i = 0; i < N; i++) ring.push([W, D - (2 * D * i) / N]);
  for (let i = 0; i < N; i++) ring.push([W - (2 * W * i) / N, -D]);
  for (let i = 0; i < N; i++) ring.push([-W, -D + (2 * D * i) / N]);
  for (let i = 0; i < ring.length; i++) {
    const a = edge(...ring[i]!);
    const b = edge(...ring[(i + 1) % ring.length]!);
    const a2: [number, number, number] = [a[0], a[1] - 0.16, a[2]];
    const b2: [number, number, number] = [b[0], b[1] - 0.16, b[2]];
    fascia.push(...a, ...a2, ...b, ...b, ...a2, ...b2);
  }
  const fg = new PlaneGeometry(1, 1);
  fg.setAttribute('position', new BufferAttribute(new Float32Array(fascia), 3));
  fg.setIndex(null);
  fg.deleteAttribute('uv');
  fg.deleteAttribute('normal');
  fg.computeVertexNormals();
  const fm = mesh(fg, new MeshStandardMaterial({ color: '#6e1d14', roughness: 0.5, side: DoubleSide }));
  fm.position.y = base;
  g.add(fm);
  // First mit Endverzierungen
  const ridgeLen = (W - D) * 2 + 0.4;
  const ridge = box(ridgeLen, 0.16, 0.2, flat('#2f3338', { rough: 0.6 }), 0, base + H + 0.05, 0);
  g.add(ridge);
  for (const s of [-1, 1]) {
    const orn = mesh(new ConeGeometry(0.09, 0.42, 5), flat('#2f3338'));
    orn.position.set((s * ridgeLen) / 2, base + H + 0.22, 0);
    orn.rotation.z = -s * 0.5;
    g.add(orn);
  }
  return g;
}

// ───────────────────────────────────────── Papierfenster

/** Gitterfenster: Papierfläche (lässt Sonne durch, wirft keinen Schatten) + Holzgitter (wirft Schatten) */
function lattice(w: number, h: number, paperMat: MeshStandardMaterial, axis: 'x' | 'z'): Group {
  const g = new Group();
  const paper = new Mesh(new PlaneGeometry(w, h), paperMat);
  paper.castShadow = false;
  paper.receiveShadow = false;
  g.add(paper);
  const bar = darkWood();
  const t = 0.035;
  const frame = [
    box(w, t * 2, t * 2, bar, 0, h / 2, 0),
    box(w, t * 2, t * 2, bar, 0, -h / 2, 0),
    box(t * 2, h, t * 2, bar, -w / 2, 0, 0),
    box(t * 2, h, t * 2, bar, w / 2, 0, 0),
  ];
  g.add(...frame);
  const cols = Math.max(2, Math.round(w / 0.28));
  const rows = Math.max(2, Math.round(h / 0.28));
  for (let i = 1; i < cols; i++) g.add(box(t, h, t, bar, -w / 2 + (w * i) / cols, 0, 0.01));
  for (let j = 1; j < rows; j++) g.add(box(w, t, t, bar, 0, -h / 2 + (h * j) / rows, 0.01));
  if (axis === 'x') g.rotation.y = Math.PI / 2;
  return g;
}

// ───────────────────────────────────────── Einrichtung

function teapot(): Group {
  const g = new Group();
  g.name = 'teapot';
  const clay = new MeshStandardMaterial({ color: '#8a4a2c', roughness: 0.45, metalness: 0.05 });
  const pts: Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new Vector2(0.02 + Math.sin(t * Math.PI * 0.95) * 0.085, t * 0.12));
  }
  const body = mesh(new LatheGeometry(pts, 16), clay);
  g.add(body);
  const lid = mesh(new SphereGeometry(0.045, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), clay);
  lid.position.y = 0.112;
  const knob = mesh(new SphereGeometry(0.014, 8, 6), clay);
  knob.position.y = 0.16;
  const spoutCurve = new CatmullRomCurve3([
    new Vector3(0.07, 0.04, 0),
    new Vector3(0.12, 0.07, 0),
    new Vector3(0.15, 0.11, 0),
  ]);
  const spout = mesh(new TubeGeometry(spoutCurve, 8, 0.013, 6), clay);
  const handle = mesh(new TorusGeometry(0.045, 0.01, 6, 12, Math.PI * 1.2), clay);
  handle.position.set(-0.085, 0.065, 0);
  handle.rotation.z = Math.PI * 0.4;
  g.add(lid, knob, spout, handle);
  return g;
}

function cup(): Mesh {
  const pts = [
    new Vector2(0, 0),
    new Vector2(0.025, 0),
    new Vector2(0.03, 0.01),
    new Vector2(0.038, 0.045),
    new Vector2(0.034, 0.045),
    new Vector2(0.026, 0.012),
    new Vector2(0, 0.012),
  ];
  const c = mesh(new LatheGeometry(pts, 14), new MeshStandardMaterial({ color: '#e9e4d6', roughness: 0.3 }));
  return c;
}

function stool(): Mesh {
  const pts: Vector2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new Vector2(0.17 + Math.sin(t * Math.PI) * 0.06, t * 0.45));
  }
  pts.push(new Vector2(0, 0.45));
  return mesh(
    new LatheGeometry(pts, 12),
    new MeshStandardMaterial({ color: '#2f5f6b', roughness: 0.35, flatShading: true }),
  );
}

function table(): Group {
  const g = new Group();
  g.name = 'table';
  const w = 0.92;
  const d = 0.62;
  const h = 0.72;
  const wood = new MeshStandardMaterial({ color: '#5a3520', roughness: 0.45, map: woodTexture() });
  g.add(box(w, 0.045, d, wood, 0, h, 0));
  const leg = darkWood();
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) g.add(box(0.05, h, 0.05, leg, sx * (w / 2 - 0.06), h / 2, sz * (d / 2 - 0.06)));
  // Zarge
  g.add(
    box(w - 0.08, 0.07, 0.02, leg, 0, h - 0.06, d / 2 - 0.06),
    box(w - 0.08, 0.07, 0.02, leg, 0, h - 0.06, -d / 2 + 0.06),
  );
  return g;
}

function cat(): Group {
  const g = new Group();
  g.name = 'cat';
  const fur = flat('#d9893f', { rough: 0.9 });
  const cream = flat('#f1dcb8', { rough: 0.9 });
  const cushion = mesh(new CylinderGeometry(0.32, 0.34, 0.08, 10), flat('#7a1f14'));
  cushion.position.y = 0.04;
  g.add(cushion);
  const body = mesh(new IcosahedronGeometry(0.17, 1), fur);
  body.scale.set(1.3, 0.62, 1);
  body.position.set(0, 0.17, 0);
  body.name = 'catBody';
  const head = mesh(new IcosahedronGeometry(0.085, 1), fur);
  head.position.set(0.2, 0.15, 0.06);
  const muzzle = mesh(new SphereGeometry(0.035, 6, 4), cream);
  muzzle.position.set(0.27, 0.13, 0.08);
  for (const s of [-1, 1]) {
    const ear = mesh(new ConeGeometry(0.03, 0.06, 4), fur);
    ear.position.set(0.2, 0.23, 0.06 + s * 0.04);
    g.add(ear);
  }
  const tail = mesh(new TorusGeometry(0.16, 0.025, 5, 10, Math.PI * 0.9), fur);
  tail.rotation.x = Math.PI / 2;
  tail.position.set(-0.04, 0.1, 0.02);
  g.add(body, head, muzzle, tail);
  return g;
}

function incense(): Group {
  const g = new Group();
  g.name = 'incense';
  const bronze = flat('#7c6a3a', { rough: 0.35, metal: 0.7 });
  const pts = [
    new Vector2(0, 0.03),
    new Vector2(0.09, 0.03),
    new Vector2(0.1, 0.08),
    new Vector2(0.08, 0.12),
    new Vector2(0, 0.12),
  ];
  const bowl = mesh(new LatheGeometry(pts, 10), bronze);
  g.add(bowl);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = mesh(new CylinderGeometry(0.008, 0.01, 0.04, 4), bronze);
    leg.position.set(Math.cos(a) * 0.06, 0.015, Math.sin(a) * 0.06);
    g.add(leg);
  }
  for (const dx of [-0.02, 0.02]) {
    const stick = mesh(new CylinderGeometry(0.003, 0.003, 0.18, 3), flat('#6a2a18'), 'none');
    stick.position.set(dx, 0.2, 0);
    g.add(stick);
  }
  return g;
}

function hangingScroll(): Group {
  const g = new Group();
  g.name = 'scroll';
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 512;
  const x = c.getContext('2d')!;
  x.fillStyle = '#efe2c6';
  x.fillRect(0, 0, 160, 512);
  x.fillStyle = '#6a1a12';
  x.fillRect(0, 0, 160, 30);
  x.fillRect(0, 482, 160, 30);
  x.fillStyle = '#1c130e';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `150px ${FONT_BRUSH}`;
  x.fillText('茶', 80, 190);
  x.font = `44px ${FONT_BRUSH}`;
  ['以', '和', '为', '贵'].forEach((ch, i) => x.fillText(ch, 80, 320 + i * 40));
  x.fillStyle = '#b3261a';
  x.fillRect(110, 440, 22, 22);
  const tex = makeTexture(c);
  const paper = new Mesh(
    new PlaneGeometry(0.55, 1.75),
    new MeshStandardMaterial({ map: tex, roughness: 0.9 }),
  );
  paper.receiveShadow = true;
  g.add(paper);
  const rod = flat('#3a2414');
  g.add(box(0.66, 0.04, 0.04, rod, 0, 0.9, 0.02), box(0.62, 0.035, 0.035, rod, 0, -0.9, 0.02));
  return g;
}

// ───────────────────────────────────────── Haus

export interface Teahouse {
  group: Group;
  lanterns: Lantern[];
  bigLantern: Lantern;
  windowMats: MeshStandardMaterial[];
  teapot: Group;
  cat: Group;
  incense: Group;
  scroll: Group;
  ruler: Mesh;
  cups: Mesh[];
  /** Weltpositionen für Dampf */
  spout: Vector3;
  kettle: Vector3;
  incenseTip: Vector3;
  /** Plätze der Figuren (Boden unter dem Hocker) */
  seats: { jackie: Vector3; yao: Vector3 };
  /** Mitte der Lichtfenster an der linken Wand (für Lichtstrahlen) */
  sunWindows: { center: Vector3; w: number; h: number }[];
}

export function buildTeahouse(lightCount: number): Teahouse {
  const g = new Group();
  g.name = 'teahouse';
  // Sockel und Boden
  g.add(box(HX * 2 + 0.8, 0.36, HZ * 2 + 0.8, stone(), 0, 0.18, 0));
  const floorTex = woodTexture().clone();
  floorTex.repeat.set(4, 3);
  floorTex.needsUpdate = true;
  const floorMat = new MeshStandardMaterial({ color: '#a77a52', roughness: 0.7, map: floorTex });
  const floor = box(HX * 2 + 0.6, 0.14, HZ * 2 + 0.6, floorMat, 0, FLOOR - 0.07, 0);
  floor.castShadow = false;
  g.add(floor);
  // Treppe vorn
  for (let i = 0; i < 3; i++)
    g.add(box(2.0, 0.16, 0.32, stone(), 0, 0.08 + i * 0.14, HZ + 0.6 + 0.62 - i * 0.3));
  // Pfosten
  const xs = [-HX, -1.15, 1.15, HX];
  const posts: [number, number][] = [];
  for (const x of xs) for (const z of [-HZ, HZ]) posts.push([x, z]);
  posts.push([-HX, 0], [HX, 0]);
  for (const [x, z] of posts) {
    const p = mesh(new CylinderGeometry(0.1, 0.11, 3.05, 8), lacquer());
    p.position.set(x, FLOOR + 1.525, z);
    g.add(p);
    const foot = mesh(new CylinderGeometry(0.16, 0.18, 0.12, 8), stone());
    foot.position.set(x, FLOOR + 0.06, z);
    g.add(foot);
  }
  // Balken oben
  const by = FLOOR + 3.0;
  g.add(box(HX * 2 + 0.3, 0.22, 0.2, darkWood(), 0, by, HZ));
  g.add(box(HX * 2 + 0.3, 0.22, 0.2, darkWood(), 0, by, -HZ));
  g.add(box(0.2, 0.22, HZ * 2 + 0.3, darkWood(), HX, by, 0));
  g.add(box(0.2, 0.22, HZ * 2 + 0.3, darkWood(), -HX, by, 0));
  for (const z of [-1.35, 0, 1.35]) g.add(box(HX * 2, 0.16, 0.14, midWood(), 0, by + 0.12, z));
  // Decke
  const ceil = box(HX * 2 + 0.2, 0.06, HZ * 2 + 0.2, flat('#4c3020'), 0, by + 0.22, 0);
  ceil.castShadow = true;
  g.add(ceil);
  // Zierfries vorn (Gitter unter dem Balken)
  for (const [x0, x1] of [
    [-HX, -1.15],
    [-1.15, 1.15],
    [1.15, HX],
  ] as const) {
    const w = x1 - x0 - 0.2;
    const cx = (x0 + x1) / 2;
    g.add(box(w, 0.04, 0.05, lacquer(), cx, by - 0.32, HZ));
    for (let i = 0; i <= 8; i++)
      g.add(box(0.03, 0.2, 0.04, lacquer(), cx - w / 2 + (w * i) / 8, by - 0.21, HZ));
    // Eckstreben
    for (const s of [-1, 1]) {
      const br = box(0.06, 0.45, 0.06, lacquer(), cx + (s * (w + 0.1)) / 2 - s * 0.12, by - 0.25, HZ);
      br.rotation.z = s * 0.7;
      g.add(br);
    }
  }
  // Wände
  const paperMat = new MeshStandardMaterial({
    color: '#f4ead6',
    map: paperTexture(),
    emissive: new Color('#ffcf8a'),
    emissiveIntensity: 0.4,
    roughness: 0.9,
    side: DoubleSide,
  });
  const windowMats = [paperMat];
  const wallMat = flat('#d8c7a4', { rough: 0.95 });
  // Rückwand: links/rechts Fenster, Mitte Wand mit Hängerolle
  for (const sx of [-1, 1]) {
    const cx = sx * ((HX + 1.15) / 2);
    const w = HX - 1.15 - 0.2;
    g.add(box(w + 0.2, 0.75, 0.08, midWood(), cx, FLOOR + 0.375, -HZ));
    const win = lattice(w, 1.9, paperMat, 'z');
    win.position.set(cx, FLOOR + 0.75 + 0.98, -HZ);
    g.add(win);
    g.add(box(w + 0.2, 0.35, 0.08, midWood(), cx, FLOOR + 2.8, -HZ));
  }
  const back = box(2.1, 3.0, 0.1, wallMat, 0, FLOOR + 1.5, -HZ);
  g.add(back);
  // Seitenwände: unten Holz, oben Fenster (links fällt die Abendsonne herein)
  const sunWindows: Teahouse['sunWindows'] = [];
  for (const sx of [-1, 1]) {
    for (const [z0, z1] of [
      [-HZ, 0],
      [0, HZ],
    ] as const) {
      const cz = (z0 + z1) / 2;
      const w = z1 - z0 - 0.2;
      g.add(box(0.08, 0.9, w + 0.2, midWood(), sx * HX, FLOOR + 0.45, cz));
      const win = lattice(w, 1.65, paperMat, 'x');
      win.position.set(sx * HX, FLOOR + 0.9 + 0.86, cz);
      g.add(win);
      g.add(box(0.08, 0.35, w + 0.2, midWood(), sx * HX, FLOOR + 2.85, cz));
      if (sx < 0) sunWindows.push({ center: new Vector3(sx * HX, FLOOR + 1.76, cz), w, h: 1.65 });
    }
  }
  g.add(roof());

  // Teppich
  const rug = box(2.6, 0.012, 1.9, flat('#6e2318', { rough: 1 }), 0, FLOOR + 0.006, -0.1);
  rug.castShadow = false;
  g.add(rug);
  const rugBorder = box(2.3, 0.014, 1.6, flat('#8c3a22', { rough: 1 }), 0, FLOOR + 0.008, -0.1);
  rugBorder.castShadow = false;
  g.add(rugBorder);

  // Tisch, Hocker, Teeservice
  const t = table();
  t.position.set(0, FLOOR, -0.1);
  g.add(t);
  const topY = FLOOR + 0.72 + 0.023;
  const seats = { jackie: new Vector3(-0.78, FLOOR, -0.32), yao: new Vector3(0.82, FLOOR, -0.36) };
  for (const s of [seats.jackie, seats.yao, new Vector3(0, FLOOR, 0.55)]) {
    const st = stool();
    st.position.copy(s);
    g.add(st);
  }
  const tray = box(0.42, 0.02, 0.26, flat('#8a6a3a'), 0, topY + 0.01, -0.16);
  g.add(tray);
  const pot = teapot();
  pot.position.set(0.02, topY + 0.02, -0.18);
  pot.rotation.y = -0.6;
  g.add(pot);
  const cups: Mesh[] = [];
  for (const [x, z] of [
    [-0.3, -0.12],
    [0.32, -0.16],
    [0.02, 0.12],
  ] as const) {
    const c = cup();
    c.position.set(x, topY, z);
    g.add(c);
    cups.push(c);
  }
  // Hängerolle und Messlatte
  const scroll = hangingScroll();
  scroll.position.set(0, FLOOR + 1.85, -HZ + 0.07);
  g.add(scroll);
  const ruler = mesh(
    new PlaneGeometry(0.16, 2.4),
    new MeshStandardMaterial({ map: rulerTexture('"Noto Serif SC", serif'), roughness: 0.8 }),
    'receive',
  );
  ruler.position.set(1.15, FLOOR + 1.2, -HZ + 0.13);
  ruler.name = 'ruler';
  g.add(ruler);
  // Regal mit Räucherwerk (links hinten)
  const shelf = new Group();
  shelf.add(box(0.8, 0.04, 0.32, midWood(), 0, 0.9, 0), box(0.8, 0.04, 0.32, midWood(), 0, 0.45, 0));
  for (const sx of [-1, 1]) shelf.add(box(0.04, 0.95, 0.32, darkWood(), sx * 0.38, 0.475, 0));
  shelf.position.set(-2.55, FLOOR, -HZ + 0.3);
  g.add(shelf);
  const inc = incense();
  inc.position.set(-2.55, FLOOR + 0.92, -HZ + 0.3);
  g.add(inc);
  const vase = mesh(
    new LatheGeometry(
      [
        new Vector2(0, 0),
        new Vector2(0.06, 0),
        new Vector2(0.08, 0.1),
        new Vector2(0.04, 0.2),
        new Vector2(0.05, 0.24),
      ],
      10,
    ),
    new MeshStandardMaterial({ color: '#dfe6ea', roughness: 0.25 }),
  );
  vase.position.set(-2.75, FLOOR + 0.47, -HZ + 0.3);
  g.add(vase);
  // Teeofen mit Kessel (links vorn)
  const stove = mesh(new CylinderGeometry(0.22, 0.26, 0.45, 8), stone());
  stove.position.set(-2.6, FLOOR + 0.225, 1.7);
  g.add(stove);
  const kettle = mesh(new SphereGeometry(0.16, 10, 8), flat('#3a3632', { rough: 0.4, metal: 0.6 }));
  kettle.scale.y = 0.8;
  kettle.position.set(-2.6, FLOOR + 0.57, 1.7);
  g.add(kettle);
  const ember = mesh(
    new SphereGeometry(0.08, 6, 4),
    new MeshStandardMaterial({ color: '#ff6a2a', emissive: new Color('#ff5a1a'), emissiveIntensity: 2 }),
    'none',
  );
  ember.position.set(-2.6, FLOOR + 0.38, 1.92);
  g.add(ember);
  // Katze (rechts hinten)
  const c = cat();
  c.position.set(2.55, FLOOR, -1.85);
  c.rotation.y = -0.5;
  g.add(c);
  // Bonsai-Kübel an den Treppen
  for (const sx of [-1, 1]) {
    const pot2 = mesh(new CylinderGeometry(0.22, 0.17, 0.3, 8), flat('#3b5560', { rough: 0.4 }));
    pot2.position.set(sx * 1.55, FLOOR + 0.15, HZ + 0.1);
    const crown = mesh(new IcosahedronGeometry(0.32, 0), flat('#4e6e3a'));
    crown.scale.set(1.3, 0.7, 1);
    crown.position.set(sx * 1.55, FLOOR + 0.62, HZ + 0.1);
    g.add(pot2, crown);
  }

  // Laternen: zwei innen (eine große über Yao), vier unter dem Vordach
  const lanterns: Lantern[] = [];
  const add = (l: Lantern, x: number, y: number, z: number): Lantern => {
    l.group.position.set(x, y, z);
    g.add(l.group);
    lanterns.push(l);
    return l;
  };
  const bigLantern = add(makeLantern(1.35, lightCount > 0, 0.55), 0.9, FLOOR + 2.55, -0.45);
  bigLantern.group.name = 'bigLantern';
  add(makeLantern(1.0, lightCount > 1, 0.5), -1.2, FLOOR + 2.6, -0.6);
  add(makeLantern(1.0, lightCount > 2, 0.4), -2.3, FLOOR + 2.55, HZ + 0.25);
  add(makeLantern(1.0, lightCount > 3, 0.4), 2.3, FLOOR + 2.55, HZ + 0.25);
  add(makeLantern(0.9, false, 0.5), -HX - 0.6, FLOOR + 2.6, HZ + 0.7);
  add(makeLantern(0.9, false, 0.5), HX + 0.6, FLOOR + 2.6, HZ + 0.7);

  g.traverse((o: Object3D) => {
    if ((o as Mesh).isMesh && o.name !== 'ruler') o.matrixAutoUpdate = true;
  });

  return {
    group: g,
    lanterns,
    bigLantern,
    windowMats,
    teapot: pot,
    cat: c,
    incense: inc,
    scroll,
    ruler,
    cups,
    spout: new Vector3(0.02 + Math.cos(0.6) * 0.15, topY + 0.14, -0.18 - Math.sin(0.6) * 0.15 * -1),
    kettle: new Vector3(-2.6, FLOOR + 0.72, 1.7),
    incenseTip: new Vector3(-2.55, FLOOR + 1.22, -HZ + 0.3),
    seats,
    sunWindows,
  };
}
