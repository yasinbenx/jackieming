// Bewuchs der Welt: Bäume (6 Arten, nah/fern), Bambus, Teesträucher, Felsen, Gras. Alles instanziert;
// Detailstufe und Sichtweite werden alle paar Meter Kamerabewegung neu verteilt (wenige Draw-Calls, keine
// Arbeit für Unsichtbares). Gras sitzt in einer Kachel um die Kamera und liest die Bodenhöhe aus einer Textur.
import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DodecahedronGeometry,
  DoubleSide,
  Float32BufferAttribute,
  FloatType,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  Quaternion,
  RGBAFormat,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { colored, T } from './geo';
import { fbm, rand, rng } from './noise';
import { addWind, SHARED } from './shared';
import { boundaryK } from '../world/map';
import { scatter } from '../world/scatter';
import type { Item, TreeKind } from '../world/scatter';
import { field, FIELD, pondEdge, surfaceAt, terraceK } from '../world/terrain';
import { inGrove, inTeaField } from '../world/scatter';

// ───────────────────────────────────────── Geometrie-Bausteine (mit Farbe je Ecke)

interface TreeGeo {
  hi: BufferGeometry;
  lo: BufferGeometry;
  /** Höhe für den Wind */
  h: number;
}

function pineGeo(seed: number, tall: boolean): TreeGeo {
  const r = rng(seed);
  const h = tall ? 7.5 : 5.2;
  const parts: BufferGeometry[] = [];
  parts.push(colored(T(new CylinderGeometry(0.13, 0.26, h, 6), 0, h / 2, 0), '#5a4232', 0.06, seed));
  if (tall) {
    // Fichte/Tanne: gestapelte Kegel
    for (let i = 0; i < 4; i++) {
      const y = h * (0.35 + i * 0.17);
      const rr = 2.0 - i * 0.42;
      parts.push(
        colored(
          T(new ConeGeometry(rr, 2.2, 7), 0, y, 0, 1, 1, 1, r()),
          i % 2 ? '#3b5637' : '#43603c',
          0.1,
          seed + i,
        ),
      );
    }
  } else {
    // Huangshan-Kiefer: flache Nadel-Schichten
    const n = 4;
    for (let i = 0; i < n; i++) {
      const y = h * (0.55 + (i / n) * 0.5);
      const g = T(
        new DodecahedronGeometry(1, 0),
        rand(r, -1, 1) * (1 - i / n),
        y,
        rand(r, -0.8, 0.8),
        rand(r, 1.3, 2.0) * (1 - i * 0.12),
        rand(r, 0.28, 0.4),
        rand(r, 1.0, 1.6),
      );
      parts.push(colored(g, i % 2 ? '#3f5a3a' : '#46623f', 0.1, seed + i));
    }
  }
  const lo = mergeGeometries([
    colored(T(new CylinderGeometry(0.15, 0.25, h * 0.6, 4), 0, h * 0.3, 0), '#5a4232', 0, 3),
    colored(
      T(new ConeGeometry(tall ? 2 : 2.1, h * (tall ? 0.85 : 0.55), 5), 0, h * (tall ? 0.6 : 0.78), 0),
      '#425d3b',
      0.05,
      4,
    ),
  ])!;
  return { hi: mergeGeometries(parts)!, lo, h };
}

function crownTree(seed: number, colors: string[], h: number, spread: number): TreeGeo {
  const r = rng(seed);
  const parts: BufferGeometry[] = [];
  parts.push(
    colored(
      T(new CylinderGeometry(0.14, 0.28, h * 0.62, 6), 0, h * 0.31, 0, 1, 1, 1, 0),
      '#4f3b2c',
      0.06,
      seed,
    ),
  );
  // zwei Äste
  for (const s of [-1, 1]) {
    const b = new CylinderGeometry(0.06, 0.1, h * 0.35, 5)
      .rotateZ(s * 0.7)
      .translate(s * h * 0.1, h * 0.55, 0);
    parts.push(colored(b, '#4f3b2c', 0.06, seed + 9));
  }
  // Krone aus vielen kleineren Ballen: außen ein Ring, oben ein paar, innen einer
  const n = 9;
  for (let i = 0; i < n; i++) {
    const ring = i < 6;
    const a = (i / 6) * Math.PI * 2 + r() * 0.6;
    const d = i === n - 1 ? 0 : ring ? spread * rand(r, 0.75, 1.0) : spread * rand(r, 0.25, 0.45);
    const y = h * (ring ? rand(r, 0.62, 0.74) : rand(r, 0.8, 0.9));
    const sz = spread * (ring ? rand(r, 0.5, 0.62) : rand(r, 0.6, 0.72));
    const g = T(
      new IcosahedronGeometry(1, 0),
      Math.cos(a) * d,
      y,
      Math.sin(a) * d,
      sz,
      sz * rand(r, 0.75, 0.9),
      sz,
    );
    parts.push(colored(g, colors[i % colors.length]!, 0.12, seed + i));
  }
  const lo = mergeGeometries([
    colored(T(new CylinderGeometry(0.16, 0.26, h * 0.6, 4), 0, h * 0.3, 0), '#4f3b2c', 0, 3),
    colored(T(new IcosahedronGeometry(spread * 1.35, 0), 0, h * 0.75, 0, 1, 0.75, 1), colors[0]!, 0.06, 4),
  ])!;
  return { hi: mergeGeometries(parts)!, lo, h };
}

function treeGeos(): Record<TreeKind, TreeGeo> {
  return {
    pine: pineGeo(11, false),
    pine2: pineGeo(12, true),
    broad: crownTree(13, ['#6f8a42', '#7d9a4a', '#64803c'], 5.5, 1.6),
    cherry: crownTree(14, ['#f2b9c6', '#e89aae', '#f7d4dc'], 4.4, 1.35),
    ginkgo: crownTree(15, ['#e8b93a', '#f0c84a', '#d9a62c'], 7, 1.7),
    maple: crownTree(16, ['#c8502c', '#d9653a', '#b8432a'], 4.8, 1.45),
  };
}

// ───────────────────────────────────────── Detailstufen

const _m = new Matrix4();
const _q = new Quaternion();
const _v = new Vector3();
const _s = new Vector3();
const UP = new Vector3(0, 1, 0);

function matrixOf(it: Item, sy = 1): Matrix4 {
  _q.setFromAxisAngle(UP, it.rot);
  return _m.compose(_v.set(it.x, it.y - 0.05, it.z), _q, _s.set(it.s, it.s * sy, it.s));
}

/**
 * Eine Menge gleicher Objekte mit zwei Stufen: nah (hi) mit Schatten, fern (lo) ohne; jenseits von `far`
 * unsichtbar. `update` verteilt die Instanzen neu, wenn sich die Kamera merklich bewegt hat.
 */
class Lod {
  readonly hi: InstancedMesh;
  readonly lo: InstancedMesh | null;
  private mats: Float32Array;
  private px: Float32Array;
  private pz: Float32Array;
  private last = new Vector3(1e9, 0, 0);
  readonly farMax: number;
  readonly nearMax: number;

  constructor(
    items: { m: Matrix4; x: number; z: number }[],
    hiGeo: BufferGeometry,
    loGeo: BufferGeometry | null,
    mat: MeshStandardMaterial,
    public near: number,
    public far: number,
  ) {
    this.farMax = far;
    this.nearMax = near;
    const n = items.length;
    this.mats = new Float32Array(n * 16);
    this.px = new Float32Array(n);
    this.pz = new Float32Array(n);
    items.forEach((it, i) => {
      it.m.toArray(this.mats, i * 16);
      this.px[i] = it.x;
      this.pz[i] = it.z;
    });
    this.hi = new InstancedMesh(hiGeo, mat, Math.max(1, n));
    this.hi.castShadow = true;
    this.hi.receiveShadow = true;
    this.hi.frustumCulled = false;
    this.hi.count = 0;
    this.lo = loGeo ? new InstancedMesh(loGeo, mat, Math.max(1, n)) : null;
    if (this.lo) {
      this.lo.frustumCulled = false;
      this.lo.receiveShadow = true;
      this.lo.count = 0;
    }
  }

  update(cam: Vector3, force = false): void {
    if (!force && Math.hypot(cam.x - this.last.x, cam.z - this.last.z) < 3) return;
    this.last.copy(cam);
    const near2 = this.near * this.near;
    const far2 = this.far * this.far;
    const hiArr = this.hi.instanceMatrix.array as Float32Array;
    const loArr = this.lo ? (this.lo.instanceMatrix.array as Float32Array) : null;
    let nh = 0;
    let nl = 0;
    for (let i = 0; i < this.px.length; i++) {
      const dx = this.px[i]! - cam.x;
      const dz = this.pz[i]! - cam.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < near2 || (!loArr && d2 < far2)) {
        hiArr.set(this.mats.subarray(i * 16, i * 16 + 16), nh * 16);
        nh++;
      } else if (loArr && d2 < far2) {
        loArr.set(this.mats.subarray(i * 16, i * 16 + 16), nl * 16);
        nl++;
      }
    }
    this.hi.count = nh;
    this.hi.instanceMatrix.needsUpdate = true;
    if (this.lo) {
      this.lo.count = nl;
      this.lo.instanceMatrix.needsUpdate = true;
    }
  }
}

// ───────────────────────────────────────── Gras (GPU-Kachel um die Kamera)

/** Bodentextur: r = Höhe, g = Grasdichte 0..1, b = Trockenheit 0..1 */
export function groundTexture(): DataTexture {
  const f = field();
  const W = f.nx + 1;
  const H = f.nz + 1;
  const data = new Float32Array(W * H * 4);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = f.x0 + i * f.step;
      const z = f.z0 + j * f.step;
      const k = (j * W + i) * 4;
      data[k] = f.h[j * W + i]!;
      data[k + 1] = grassDensity(x, z);
      data[k + 2] = fbm(x * 0.05, z * 0.05, 2);
      data[k + 3] = 1;
    }
  }
  const tex = new DataTexture(data, W, H, RGBAFormat, FloatType);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function grassDensity(x: number, z: number): number {
  // Haus, Terrasse und Treppe
  if (x > -7.8 && x < 7.8 && z > -6.8 && z < 7.3) return 0;
  if (Math.abs(x) < 1.4 && z < 15.5 && z > 6) return 0;
  if (pondEdge(x, z) < 1.12) return 0;
  const sf = surfaceAt(x, z);
  if (sf.waterD < 0.5) return 0;
  const p = { d: sf.pathD };
  if (p.d < 0.15) return 0;
  const f = field();
  const s = f.slope(x, z);
  let d = 1 - Math.max(0, Math.min(1, (s - 0.5) / 0.5));
  d *= 1 - Math.max(0, Math.min(1, (0.6 - p.d) / 0.6)) * 0.7;
  if (inTeaField(x, z)) d *= 0.35;
  if (inGrove(x, z)) d *= 0.3;
  if (terraceK(x, z) > 0.3) d *= 0.25;
  d *= 1 - Math.max(0, boundaryK(x, z) - 0.5) * 2;
  // Plätze (Dorf, Schrein, Aussicht) frei
  for (const [px, pz, r] of [
    [40, 60, 14],
    [62, -60, 8.5],
    [-64, -42, 6.5],
  ] as const)
    if (Math.hypot(x - px, z - pz) < r) d = 0;
  return Math.max(0, d);
}

const GRASS_TILE = 48;
/** Höchstzahl Grasbüschel (Puffergröße) */
const GRASS_MAX = 18000;

function grassMesh(count: number, tex: DataTexture): Mesh {
  // ein Büschel: 5 schmale Halme (je ein Dreieck), leicht gefächert
  const pos: number[] = [];
  const r = rng(5);
  for (let b = 0; b < 5; b++) {
    const a = r() * Math.PI;
    const ox = (r() - 0.5) * 0.22;
    const oz = (r() - 0.5) * 0.22;
    const w = 0.035 + r() * 0.025;
    const h = 0.17 + r() * 0.16;
    const lean = (r() - 0.5) * 0.18;
    const cx = Math.cos(a) * w;
    const cz = Math.sin(a) * w;
    pos.push(ox - cx, 0, oz - cz, ox + cx, 0, oz + cz, ox + lean, h, oz + lean * 0.5);
  }
  const geo = new InstancedBufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  // Normalen nach oben: Gras wirkt weich beleuchtet statt flackernd
  geo.setAttribute(
    'normal',
    new Float32BufferAttribute(
      pos.map((_, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  );
  // aTip je Ecke: 0, 0, 1 pro Halm (Spitze)
  const tips = new Float32Array(15);
  for (let b = 0; b < 5; b++) tips[b * 3 + 2] = 1;
  geo.setAttribute('aTip', new BufferAttribute(tips, 1));
  const off = new Float32Array(count * 3);
  const rr = rng(9);
  for (let i = 0; i < count; i++) {
    off[i * 3] = rr() * GRASS_TILE;
    off[i * 3 + 1] = rr() * GRASS_TILE;
    off[i * 3 + 2] = rr();
  }
  geo.setAttribute('aOff', new InstancedBufferAttribute(off, 3));
  geo.instanceCount = count;

  const mat = new MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.95,
    side: DoubleSide,
    vertexColors: false,
  });
  const F = FIELD;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED.uTime;
    shader.uniforms.uWind = SHARED.uWind;
    shader.uniforms.uGround = { value: tex };
    shader.uniforms.uCam = GRASS_CAM;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWind;
        uniform sampler2D uGround;
        uniform vec3 uCam;
        attribute vec3 aOff;
        attribute float aTip;
        varying vec3 vGrass;
        vec4 groundAt(vec2 p) {
          vec2 g = (p - vec2(${F.x0.toFixed(1)}, ${F.z0.toFixed(1)})) / ${F.step.toFixed(1)};
          vec2 i = floor(g);
          vec2 f = g - i;
          ivec2 c = ivec2(i);
          vec4 a = texelFetch(uGround, c, 0);
          vec4 b = texelFetch(uGround, c + ivec2(1, 0), 0);
          vec4 d = texelFetch(uGround, c + ivec2(0, 1), 0);
          vec4 e = texelFetch(uGround, c + ivec2(1, 1), 0);
          // gleiche Dreiecksteilung wie das Gelände-Mesh
          if (f.x + f.y <= 1.0) return a + (b - a) * f.x + (d - a) * f.y;
          return e + (d - e) * (1.0 - f.x) + (b - e) * (1.0 - f.y);
        }`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec2 tile = vec2(${GRASS_TILE.toFixed(1)});
        vec2 wp = uCam.xz + mod(aOff.xy - uCam.xz + tile * 0.5, tile) - tile * 0.5;
        vec4 gr = groundAt(wp);
        float dist = length(wp - uCam.xz);
        float fade = smoothstep(tile.x * 0.5, tile.x * 0.5 - 7.0, dist);
        float keep = step(aOff.z, gr.g) * fade;
        float rot = aOff.z * 37.0;
        mat2 R = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
        vec3 transformed = vec3(position);
        transformed.xz = R * transformed.xz;
        transformed *= keep * (0.7 + aOff.z * 0.45);
        float sway = sin(uTime * 1.8 + wp.x * 0.35 + wp.y * 0.21) * 0.6 + sin(uTime * 3.1 + wp.x * 0.9) * 0.3;
        transformed.x += sway * aTip * 0.09 * uWind;
        transformed.z += cos(uTime * 1.4 + wp.y * 0.4) * aTip * 0.05 * uWind;
        transformed += vec3(wp.x, gr.r - 0.02, wp.y);
        vGrass = vec3(aTip, gr.b, aOff.z);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrass;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 base = mix(vec3(0.33, 0.42, 0.18), vec3(0.50, 0.55, 0.24), vGrass.y);
        vec3 tipc = mix(vec3(0.60, 0.66, 0.30), vec3(0.75, 0.68, 0.38), vGrass.y);
        diffuseColor.rgb = mix(base, tipc, vGrass.x);
        // vereinzelt Blüten an der Spitze
        if (vGrass.z > 0.985 && vGrass.x > 0.8) diffuseColor.rgb = mix(vec3(0.95, 0.85, 0.35), vec3(0.92, 0.62, 0.75), step(0.993, vGrass.z));`,
      );
  };
  mat.customProgramCacheKey = () => 'grass';
  const m = new Mesh(geo, mat);
  m.frustumCulled = false;
  m.receiveShadow = true;
  m.name = 'grass';
  return m;
}

/** Kameraposition für die Gras-Kachel */
const GRASS_CAM = { value: new Vector3() };

// ───────────────────────────────────────── Zusammenbau

export interface NatureOpts {
  /** Anzahl Grasbüschel (0 = aus, höchstens 18000) */
  grass: number;
  /** Sichtweite der Detailmodelle (m) */
  near: number;
  /** Sichtweite überhaupt (m) */
  far: number;
}

export class Nature {
  readonly group = new Group();
  private lods: Lod[] = [];
  private grass: Mesh | null = null;
  readonly ground: DataTexture;

  constructor(opts: NatureOpts) {
    this.group.name = 'nature';
    const sc = scatter();
    const geos = treeGeos();
    const treeMat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
    addWind(treeMat, 0.05, 6);
    for (const kind of Object.keys(geos) as TreeKind[]) {
      const items = sc.trees.filter((t) => t.kind === kind);
      if (!items.length) continue;
      const lod = new Lod(
        items.map((t) => ({ m: matrixOf(t).clone(), x: t.x, z: t.z })),
        geos[kind].hi,
        geos[kind].lo,
        treeMat,
        opts.near,
        opts.far,
      );
      this.lods.push(lod);
    }
    // Teesträucher: runde, dichte Büsche
    const teaGeo = colored(
      new IcosahedronGeometry(0.55, 1).scale(1, 0.62, 1).translate(0, 0.32, 0),
      '#3d5a2c',
      0.12,
      21,
    );
    const teaMat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
    addWind(teaMat, 0.02, 0.7);
    this.lods.push(
      new Lod(
        sc.tea.map((t) => ({ m: matrixOf(t).clone(), x: t.x, z: t.z })),
        teaGeo,
        teaGeo,
        teaMat,
        Math.min(opts.near, 40),
        Math.min(opts.far, 110),
      ),
    );
    // Felsen: zwei Formen
    const rockMat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
    const rockA = colored(new DodecahedronGeometry(0.5, 0).scale(1.3, 0.7, 1.1), '#8a8578', 0.1, 31);
    const rockB = colored(new IcosahedronGeometry(0.5, 0).scale(1.1, 0.8, 1.4), '#7d786c', 0.1, 32);
    const r = rng(3);
    const rocks = sc.rocks.map((k) => {
      const m = new Matrix4().compose(
        new Vector3(k.x, k.y + k.s * 0.08, k.z),
        new Quaternion().setFromAxisAngle(
          new Vector3(rand(r, -0.3, 0.3), 1, rand(r, -0.3, 0.3)).normalize(),
          k.rot,
        ),
        new Vector3(k.s, k.s * rand(r, 0.6, 1), k.s),
      );
      return { m, x: k.x, z: k.z };
    });
    this.lods.push(
      new Lod(
        rocks.filter((_, i) => i % 2 === 0),
        rockA,
        rockA,
        rockMat,
        Math.min(opts.near, 40),
        Math.min(opts.far, 160),
      ),
    );
    this.lods.push(
      new Lod(
        rocks.filter((_, i) => i % 2 === 1),
        rockB,
        rockB,
        rockMat,
        Math.min(opts.near, 40),
        Math.min(opts.far, 160),
      ),
    );
    for (const l of this.lods) {
      this.group.add(l.hi);
      if (l.lo) this.group.add(l.lo);
    }
    this.ground = groundTexture();
    this.grass = grassMesh(GRASS_MAX, this.ground);
    this.group.add(this.grass);
    this.setGrass(opts.grass);
  }

  update(cam: Vector3): void {
    for (const l of this.lods) l.update(cam);
    GRASS_CAM.value.copy(cam);
  }

  /** Anzahl sichtbarer Grasbüschel (0 = aus) */
  setGrass(n: number): void {
    if (!this.grass) return;
    const g = this.grass.geometry as InstancedBufferGeometry;
    g.instanceCount = Math.min(GRASS_MAX, n);
    this.grass.visible = n > 0;
  }

  /** Sichtweiten und Grasmenge ändern (Qualitätsstufe) */
  setRange(near: number, far: number, grass: number): void {
    for (const l of this.lods) {
      l.near = Math.min(l.nearMax, near);
      l.far = Math.min(l.farMax, far);
    }
    this.setGrass(grass);
    for (const l of this.lods) l.update(GRASS_CAM.value, true);
  }
}
