// Landschaft: Himmel, Berge im Nebel, Hügel, Teich mit Spiegelung, Brücke, Weg, Bäume, Bambus, Koi, Vögel.
// Alles prozedural (Low-Poly), keine Modelldateien.
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { clamp, fbm, lerp, noise2, rand, rng, smoothstep } from './noise';
import { addWind, flat, mesh, POND, SHARED } from './shared';
import { BRIDGE, bridgeY } from '../world/layout';
import { glowTexture, mistTexture } from './textures';
import type { Palette } from './palette';

// ───────────────────────────────────────── Gelände

function pondEdge(x: number, z: number): number {
  // < 1 im Teich; leicht unregelmäßiger Rand
  const dx = (x - POND.x) / POND.rx;
  const dz = (z - POND.z) / POND.rz;
  const a = Math.atan2(dz, dx);
  const wobble = 1 + Math.sin(a * 3 + 1.2) * 0.07 + Math.sin(a * 5 + 0.4) * 0.04;
  return Math.sqrt(dx * dx + dz * dz) / wobble;
}

/** Geländehöhe an (x, z). Das Teehaus steht auf einem flachen Plateau um (0, 0). */
export function heightAt(x: number, z: number): number {
  const r = Math.hypot(x, z * 0.85);
  const rise = smoothstep(11, 70, r);
  // hinter dem Haus steiler (Berghang), vorne offen zum Tal
  const back = smoothstep(4, -30, z) * 0.6 + 0.4;
  let h = rise * (fbm(x * 0.025 + 3, z * 0.025, 4) * 26 + 3) * back;
  h += (fbm(x * 0.18, z * 0.18, 3) - 0.5) * 0.5 * smoothstep(7, 12, r);
  // Teichmulde
  const e = pondEdge(x, z);
  h = lerp(h, -0.65, smoothstep(1.25, 0.82, e));
  return h;
}

function terrain(): Mesh {
  const size = 260;
  const seg = 128;
  const g = new PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const pos = g.attributes.position as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
  }
  const geo = g.toNonIndexed();
  geo.computeVertexNormals();
  const p = geo.attributes.position as BufferAttribute;
  const n = geo.attributes.normal as BufferAttribute;
  const colors = new Float32Array(p.count * 3);
  const grass = new Color('#8f9a4c');
  const grass2 = new Color('#6f8540');
  const dry = new Color('#b7a35e');
  const rock = new Color('#7d7568');
  const bank = new Color('#8a7a5a');
  const tmp = new Color();
  for (let i = 0; i < p.count; i += 3) {
    // pro Dreieck eine Farbe (Low-Poly-Look)
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const ny = n.getY(i);
    const v = noise2(cx * 0.35, cz * 0.35);
    tmp
      .copy(grass)
      .lerp(grass2, v)
      .lerp(dry, fbm(cx * 0.05, cz * 0.05, 2) * 0.6);
    if (ny < 0.8) tmp.lerp(rock, smoothstep(0.8, 0.55, ny));
    const e = pondEdge(cx, cz);
    if (e < 1.3) tmp.lerp(bank, smoothstep(1.3, 1.0, e));
    tmp.multiplyScalar(0.92 + noise2(cx * 1.7, cz * 1.7) * 0.16 + clamp(cy * 0.004, 0, 0.1));
    for (let k = 0; k < 3; k++) tmp.toArray(colors, (i + k) * 3);
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const m = mesh(
    geo,
    new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
    'receive',
  );
  m.name = 'terrain';
  return m;
}

// ───────────────────────────────────────── Berge (Ringe aus spitzen Karstgipfeln)

function mountainRing(radius: number, seed: number, amp: number, base: string, top: string): Mesh {
  const r = rng(seed);
  const N = 220;
  // Gipfel als Summe steiler Buckel
  const peaks = Array.from({ length: 26 }, () => ({
    a: r() * Math.PI * 2,
    w: rand(r, 0.1, 0.3),
    h: rand(r, 0.35, 1) * amp * (1 + r() * 0.3),
  }));
  const ridge = (a: number): number => {
    let h = amp * 0.18 + fbm(Math.cos(a) * 3 + seed, Math.sin(a) * 3, 3) * amp * 0.25;
    for (const p of peaks) {
      let d = Math.abs(a - p.a);
      d = Math.min(d, Math.PI * 2 - d);
      const k = Math.max(0, 1 - d / p.w);
      h = Math.max(h, p.h * (k * k * (3 - 2 * k)) * (0.85 + noise2(a * 30, seed) * 0.15));
    }
    // hinter dem Teehaus (-z) höher
    return h * (0.75 + 0.5 * Math.max(0, -Math.sin(a)));
  };
  const rows = 4;
  const verts: number[] = [];
  const cols: number[] = [];
  const cBase = new Color(base);
  const cTop = new Color(top);
  const pt = (i: number, j: number): [number, number, number] => {
    const a = (i / N) * Math.PI * 2;
    const h = ridge(a);
    const f = j / rows;
    const rr = radius + (1 - f) * 18 + noise2(i * 0.3, j) * 6;
    return [Math.cos(a) * rr, -8 + h * Math.pow(f, 0.85), Math.sin(a) * rr];
  };
  const tmp = new Color();
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < rows; j++) {
      const a = pt(i, j);
      const b = pt(i + 1, j);
      const c = pt(i + 1, j + 1);
      const d = pt(i, j + 1);
      for (const tri of [
        [a, b, c],
        [a, c, d],
      ]) {
        for (const v of tri) verts.push(...v);
        tmp
          .copy(cBase)
          .lerp(cTop, (j + 0.5) / rows)
          .multiplyScalar(0.9 + noise2(i * 0.7, j * 1.3) * 0.2);
        for (let k = 0; k < 3; k++) cols.push(tmp.r, tmp.g, tmp.b);
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const m = new Mesh(
    geo,
    new MeshLambertMaterial({ vertexColors: true, flatShading: true, side: DoubleSide }),
  );
  m.name = 'mountains';
  return m;
}

// ───────────────────────────────────────── Himmel

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = /* glsl */ `
uniform vec3 top;
uniform vec3 horizon;
uniform vec3 sunColor;
uniform vec3 sunDir;
uniform float night;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55));
  col = mix(col, horizon * 0.82, smoothstep(0.0, -0.25, h));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 6.0) * 0.35 + pow(s, 60.0) * 0.6) * (1.0 - night * 0.7);
  float disc = smoothstep(0.99935, 0.99965, s);
  col = mix(col, sunColor * (2.6 - night * 1.2), disc);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function makeSky(): Mesh {
  const mat = new ShaderMaterial({
    uniforms: {
      top: { value: new Color() },
      horizon: { value: new Color() },
      sunColor: { value: new Color() },
      sunDir: { value: new Vector3(0, 1, 0) },
      night: { value: 0 },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
  const m = new Mesh(new SphereGeometry(450, 32, 16), mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  m.name = 'sky';
  return m;
}

export function updateSky(sky: Mesh, p: Palette): void {
  const u = (sky.material as ShaderMaterial).uniforms;
  (u.top!.value as Color).copy(p.skyTop);
  (u.horizon!.value as Color).copy(p.skyHorizon);
  (u.sunColor!.value as Color).copy(p.sun);
  (u.sunDir!.value as Vector3).copy(p.sunDir);
  u.night!.value = p.stars;
}

// ───────────────────────────────────────── Wasser

const WATER_SHADER = {
  name: 'PondShader',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    time: SHARED.uTime,
    deep: { value: new Color('#1f4a4a') },
    opacity: { value: 0.9 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec3 deep;
    uniform float opacity;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vec2 w = vec2(
        sin(vWorld.x * 2.3 + time * 1.2) + sin(vWorld.z * 3.1 - time * 0.9),
        cos(vWorld.z * 2.6 + time * 1.0) + sin((vWorld.x + vWorld.z) * 1.6 + time * 0.7)
      ) * 0.006;
      vec4 uv = vUv;
      uv.xy += w * uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;
      vec3 col = mix(deep, refl * color, 0.78);
      gl_FragColor = vec4(col, opacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

function pondShape(): Shape {
  const s = new Shape();
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wob = 1 + Math.sin(a * 3 + 1.2) * 0.07 + Math.sin(a * 5 + 0.4) * 0.04;
    const x = Math.cos(a) * POND.rx * wob * 1.02;
    const y = Math.sin(a) * POND.rz * wob * 1.02;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return s;
}

/** Teich mit echter Spiegelung (Reflector) oder einfacher Glanzfläche auf niedriger Qualität. */
export function makeWater(reflect: boolean, res: number): Mesh {
  const geo = new ShapeGeometry(pondShape(), 6);
  let m: Mesh;
  if (reflect) {
    m = new Reflector(geo, {
      textureWidth: res,
      textureHeight: Math.round(res * 0.6),
      clipBias: 0.003,
      color: 0xb8c4c4,
      shader: WATER_SHADER,
    });
    (m.material as ShaderMaterial).transparent = true;
  } else {
    m = new Mesh(
      geo,
      new MeshStandardMaterial({
        color: '#2d5f5c',
        roughness: 0.08,
        metalness: 0.1,
        transparent: true,
        opacity: 0.88,
      }),
    );
  }
  m.rotation.x = -Math.PI / 2;
  m.position.set(POND.x, 0.02, POND.z);
  m.name = 'water';
  return m;
}

// ───────────────────────────────────────── Brücke und Weg

/** Bogenbrücke über den Teich (in z-Richtung) */
function bridge(): Group {
  const g = new Group();
  g.name = 'bridge';
  const x = BRIDGE.x;
  const z0 = BRIDGE.z0;
  const z1 = BRIDGE.z1;
  const L = z1 - z0;
  const yAt = bridgeY;
  const wood = flat('#7a5636', { rough: 0.8 });
  const red = flat('#8f2a1c', { rough: 0.55 });
  const N = 26;
  for (let i = 0; i < N; i++) {
    const s = (i + 0.5) / N;
    const ds = 0.002;
    const slope = (yAt(s + ds) - yAt(s - ds)) / (2 * ds * L);
    const plank = mesh(new CylinderGeometry(0.05, 0.05, 1.5, 5).rotateZ(Math.PI / 2), wood);
    plank.scale.set(1, 1, (L / N) * 9.2);
    plank.position.set(x, yAt(s), z0 + s * L);
    plank.rotation.x = -Math.atan(slope);
    g.add(plank);
  }
  // Geländer: Pfosten + Handlauf
  for (const side of [-0.72, 0.72]) {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const s = i / 10;
      const p = new Vector3(x + side, yAt(s) + 0.62, z0 + s * L);
      pts.push(p);
      const post = mesh(new CylinderGeometry(0.045, 0.05, 0.7, 6), red);
      post.position.set(x + side, yAt(s) + 0.3, z0 + s * L);
      g.add(post);
    }
    const rail = mesh(new TubeGeometry(new CatmullRomCurve3(pts), 40, 0.035, 5), red);
    g.add(rail);
    const pts2 = pts.map((p) => p.clone().setY(p.y - 0.3));
    g.add(mesh(new TubeGeometry(new CatmullRomCurve3(pts2), 40, 0.022, 5), red));
  }
  // Bogen-Unterseite (Steinbogen)
  const archPts: Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const s = i / 16;
    archPts.push(new Vector3(x, yAt(s) - 0.18, z0 + s * L));
  }
  const arch = mesh(new TubeGeometry(new CatmullRomCurve3(archPts), 32, 0.12, 4), flat('#8d8a80'));
  arch.scale.set(5.5, 1, 1);
  arch.position.x = x - x * 5.5;
  g.add(arch);
  return g;
}

function pathStones(): InstancedMesh {
  const curveB = new CatmullRomCurve3([
    new Vector3(BRIDGE.x, 0, BRIDGE.z1 + 0.5),
    new Vector3(-0.6, 0, 18),
    new Vector3(1.2, 0, 23),
    new Vector3(2.4, 0, 30),
    new Vector3(1.5, 0, 38),
  ]);
  const r = rng(21);
  const pts: Vector3[] = [];
  for (const [c, n] of [[curveB, 26]] as const) {
    for (let i = 0; i < n; i++) pts.push(c.getPoint(i / (n - 1)));
  }
  const geo = new CylinderGeometry(0.42, 0.46, 0.1, 7);
  const im = new InstancedMesh(geo, flat('#a59c8c', { rough: 0.95 }), pts.length);
  const o = new Object3D();
  pts.forEach((p, i) => {
    o.position.set(p.x + rand(r, -0.15, 0.15), heightAt(p.x, p.z) + 0.03, p.z);
    o.rotation.set(rand(r, -0.04, 0.04), r() * Math.PI, rand(r, -0.04, 0.04));
    const s = rand(r, 0.8, 1.15);
    o.scale.set(s, 1, s * rand(r, 0.75, 1));
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  im.receiveShadow = true;
  im.name = 'path';
  return im;
}

// ───────────────────────────────────────── Pflanzen

function rocks(): InstancedMesh {
  const r = rng(33);
  const N = 46;
  const im = new InstancedMesh(new DodecahedronGeometry(0.5, 0), flat('#8a8578', { rough: 1 }), N);
  const o = new Object3D();
  for (let i = 0; i < N; i++) {
    let x: number;
    let z: number;
    if (i < 30) {
      // Teichufer
      const a = r() * Math.PI * 2;
      x = POND.x + Math.cos(a) * POND.rx * 1.02;
      z = POND.z + Math.sin(a) * POND.rz * 1.05;
      if (Math.abs(x - BRIDGE.x) < 1.4) continue; // Brückenköpfe frei
    } else {
      const a = rand(r, 0, Math.PI * 2);
      const d = rand(r, 8, 22);
      x = Math.cos(a) * d;
      z = Math.sin(a) * d;
    }
    const s = rand(r, 0.35, 0.9);
    o.position.set(x, heightAt(x, z) + s * 0.1, z);
    o.rotation.set(r() * 3, r() * 3, r() * 3);
    o.scale.set(s * rand(r, 0.9, 1.6), s * rand(r, 0.5, 0.9), s * rand(r, 0.9, 1.4));
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  }
  im.castShadow = true;
  im.receiveShadow = true;
  return im;
}

/** Huangshan-Kiefer mit flachen Nadel-Schichten */
function pine(r: () => number): Group {
  const g = new Group();
  const h = rand(r, 3.5, 6);
  const trunkMat = flat('#5a4232');
  const trunk = mesh(new CylinderGeometry(0.1, 0.22, h, 6), trunkMat);
  trunk.position.y = h / 2;
  trunk.rotation.z = rand(r, -0.12, 0.12);
  g.add(trunk);
  const leaf = flat('#3f5a3a');
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const pad = mesh(new DodecahedronGeometry(1, 0), leaf);
    const y = h * (0.55 + (i / n) * 0.5);
    pad.position.set(rand(r, -1, 1) * (1 - i / n), y, rand(r, -0.8, 0.8));
    pad.scale.set(rand(r, 1.2, 2.0) * (1 - i * 0.12), rand(r, 0.28, 0.4), rand(r, 1.0, 1.6));
    g.add(pad);
  }
  return g;
}

/** Blühender Baum (Pflaume/Kirsche) vorn rechts; Quelle der Blütenblätter */
function blossomTree(): { group: Group; canopy: Vector3[]; perch: Vector3 } {
  const g = new Group();
  g.name = 'blossom';
  const r = rng(77);
  const bark = flat('#4a3326');
  const pink = [
    flat('#f2b9c6', { rough: 0.7 }),
    flat('#e89aae', { rough: 0.7 }),
    flat('#f7d4dc', { rough: 0.7 }),
  ];
  const trunk = mesh(new CylinderGeometry(0.16, 0.3, 2.4, 7), bark);
  trunk.position.y = 1.2;
  trunk.rotation.z = 0.12;
  g.add(trunk);
  const canopy: Vector3[] = [];
  const branchTips: Vector3[] = [
    new Vector3(-1.3, 3.3, 0.4),
    new Vector3(1.2, 3.6, -0.3),
    new Vector3(0.2, 4.1, 0.6),
    new Vector3(-0.6, 3.8, -0.9),
    new Vector3(1.6, 3.0, 0.8),
  ];
  for (const tip of branchTips) {
    const from = new Vector3(0.15, 2.2, 0);
    const curve = new CatmullRomCurve3([
      from,
      from
        .clone()
        .lerp(tip, 0.5)
        .add(new Vector3(0, 0.3, 0)),
      tip,
    ]);
    g.add(mesh(new TubeGeometry(curve, 8, 0.07, 5), bark));
    for (let k = 0; k < 9; k++) {
      const b = mesh(new IcosahedronGeometry(rand(r, 0.18, 0.34), 1), pink[Math.floor(r() * 3)]!, 'cast');
      b.position.copy(tip).add(new Vector3(rand(r, -0.7, 0.7), rand(r, -0.3, 0.45), rand(r, -0.7, 0.7)));
      g.add(b);
      canopy.push(b.position.clone());
    }
  }
  return { group: g, canopy, perch: new Vector3(1.2, 3.62 + 0.38, -0.3) };
}

/** Trauerweide am Teich: hängende Zweige wiegen im Wind */
function willow(): Group {
  const g = new Group();
  g.name = 'willow';
  const r = rng(91);
  const trunk = mesh(new CylinderGeometry(0.2, 0.35, 3.6, 7), flat('#55463a'));
  trunk.position.y = 1.8;
  trunk.rotation.z = -0.1;
  g.add(trunk);
  const crown = mesh(new IcosahedronGeometry(1.5, 0), flat('#7d9a4c'));
  crown.position.set(0.2, 3.9, 0);
  crown.scale.set(1.5, 0.7, 1.4);
  g.add(crown);
  // Zweige als dünne, lange Streifen (Instanced, mit Wind)
  const strand = new PlaneGeometry(0.09, 2.6, 1, 6).translate(0, -1.3, 0);
  const mat = new MeshStandardMaterial({
    color: '#7fa04a',
    side: DoubleSide,
    roughness: 0.9,
    flatShading: true,
  });
  addWindDown(mat);
  const N = 70;
  const im = new InstancedMesh(strand, mat, N);
  const o = new Object3D();
  for (let i = 0; i < N; i++) {
    const a = r() * Math.PI * 2;
    const d = rand(r, 0.8, 2.1);
    o.position.set(0.2 + Math.cos(a) * d, rand(r, 3.4, 4.1), Math.sin(a) * d * 0.9);
    o.rotation.set(0, a, 0);
    o.scale.set(1, rand(r, 0.7, 1.2), 1);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  }
  im.castShadow = true;
  g.add(im);
  return g;
}

/** Wind für hängende Zweige: unten (negatives y) stärker */
function addWindDown(mat: MeshStandardMaterial): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED.uTime;
    shader.uniforms.uWind = SHARED.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 ph = vec3(0.0);
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3].xyz;
        #endif
        float k = clamp(-transformed.y / 2.6, 0.0, 1.0);
        k = k * k;
        transformed.z += sin(uTime * 1.4 + ph.x * 1.3 + ph.z) * 0.35 * k * uWind;
        transformed.x += sin(uTime * 0.9 + ph.z * 2.1) * 0.15 * k * uWind;`,
      );
  };
  mat.customProgramCacheKey = () => 'wind-down';
}

/** Bambushaine links, rechts und hinter dem Haus */
function bamboo(count: number): Group {
  const g = new Group();
  g.name = 'bamboo';
  const r = rng(55);
  const stalkGeo = new CylinderGeometry(0.045, 0.055, 1, 6, 8).translate(0, 0.5, 0);
  // Knoten als leichte Verdickungen
  const pos = stalkGeo.attributes.position as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const node = Math.abs((y * 8) % 1) < 0.02 ? 1.25 : 1;
    pos.setX(i, pos.getX(i) * node);
    pos.setZ(i, pos.getZ(i) * node);
  }
  stalkGeo.computeVertexNormals();
  const stalkMat = new MeshStandardMaterial({ color: '#8fa34a', roughness: 0.6, flatShading: true });
  addWind(stalkMat, 0.35, 1);
  const stalks = new InstancedMesh(stalkGeo, stalkMat, count);
  const leafGeo = new ConeGeometry(0.07, 0.55, 3).rotateZ(Math.PI / 2).translate(0.27, 0, 0);
  leafGeo.scale(1, 0.25, 1);
  const leafMat = new MeshStandardMaterial({
    color: '#6c8f3a',
    roughness: 0.8,
    flatShading: true,
    side: DoubleSide,
  });
  addWind(leafMat, 0.35, 7);
  const perStalk = 9;
  const leaves = new InstancedMesh(leafGeo, leafMat, count * perStalk);
  const o = new Object3D();
  const groves = [
    { x: -10.6, z: -2.5, rx: 1.8, rz: 3.4 },
    { x: 10.6, z: -2.5, rx: 1.8, rz: 3.2 },
    { x: 0, z: -9.4, rx: 8, rz: 1.6 },
    { x: -10.2, z: 6.6, rx: 1.4, rz: 1.4 },
  ];
  const m4 = new Matrix4();
  const q = new Quaternion();
  let li = 0;
  for (let i = 0; i < count; i++) {
    const gr = groves[i % groves.length]!;
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    const x = gr.x + Math.cos(a) * gr.rx * d;
    const z = gr.z + Math.sin(a) * gr.rz * d;
    const h = rand(r, 4.5, 8.5);
    const y0 = heightAt(x, z) - 0.1;
    const lean = new Vector3(rand(r, -0.06, 0.06), 1, rand(r, -0.06, 0.06)).normalize();
    q.setFromUnitVectors(new Vector3(0, 1, 0), lean);
    m4.compose(new Vector3(x, y0, z), q, new Vector3(1, h, 1));
    stalks.setMatrixAt(i, m4);
    for (let k = 0; k < perStalk; k++) {
      const ly = y0 + h * rand(r, 0.5, 1);
      o.position.set(x + lean.x * (ly - y0), ly, z + lean.z * (ly - y0));
      o.rotation.set(rand(r, -0.3, 0.3), r() * Math.PI * 2, rand(r, -0.6, -0.1));
      const s = rand(r, 0.8, 1.3);
      o.scale.set(s, s, s);
      o.updateMatrix();
      leaves.setMatrixAt(li++, o.matrix);
    }
  }
  stalks.castShadow = true;
  leaves.castShadow = true;
  stalks.receiveShadow = true;
  g.add(stalks, leaves);
  return g;
}

function pines(): Group {
  const g = new Group();
  const r = rng(13);
  const spots: [number, number][] = [];
  for (let i = 0; i < 40; i++) {
    const a = rand(r, 0, Math.PI * 2);
    const d = rand(r, 14, 46);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    // Blick vom Weg aufs Haus freihalten
    if (z > 4 && Math.abs(x) < 9) continue;
    if (pondEdge(x, z) < 1.6) continue;
    spots.push([x, z]);
  }
  for (const [x, z] of spots) {
    const p = pine(r);
    p.position.set(x, heightAt(x, z) - 0.1, z);
    p.scale.setScalar(rand(r, 0.8, 1.4));
    p.rotation.y = r() * 6;
    g.add(p);
  }
  return g;
}

function lotus(): Group {
  const g = new Group();
  const r = rng(61);
  const padGeo = new CylinderGeometry(0.32, 0.32, 0.02, 9, 1, false, 0.3, Math.PI * 2 - 0.6);
  const padMat = flat('#5f8a3c');
  const flower = flat('#f3b2c4', { rough: 0.6 });
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.82;
    const x = POND.x + Math.cos(a) * POND.rx * d;
    const z = POND.z + Math.sin(a) * POND.rz * d;
    if (Math.abs(x - BRIDGE.x) < 1.1) continue;
    const pad = mesh(padGeo, padMat, 'receive');
    pad.position.set(x, 0.035, z);
    pad.rotation.y = r() * 6;
    pad.scale.setScalar(rand(r, 0.6, 1.1));
    g.add(pad);
    if (r() < 0.35) {
      const f = mesh(new ConeGeometry(0.11, 0.16, 6, 1, true), flower, 'cast');
      f.rotation.x = Math.PI;
      f.position.set(x, 0.13, z);
      g.add(f);
    }
  }
  return g;
}

// ───────────────────────────────────────── Tiere

export class Koi {
  readonly group = new Group();
  readonly fish: { o: Group; r: number; speed: number; phase: number; depth: number }[] = [];
  private startle = 0;

  constructor() {
    this.group.name = 'koi';
    const r = rng(17);
    const colors = ['#f08a3c', '#f4f0e6', '#e5582c', '#f2c14e', '#f08a3c', '#f4f0e6'];
    for (let i = 0; i < 6; i++) {
      const o = new Group();
      const body = mesh(new SphereGeometry(0.12, 7, 5), flat(colors[i]!, { rough: 0.5 }), 'none');
      body.scale.set(1, 0.45, 2.3);
      const tail = mesh(new ConeGeometry(0.1, 0.18, 4), flat(colors[(i + 1) % 6]!, { rough: 0.5 }), 'none');
      tail.rotation.x = -Math.PI / 2;
      tail.scale.set(1, 1, 0.25);
      tail.position.z = -0.32;
      tail.name = 'tail';
      o.add(body, tail);
      this.group.add(o);
      this.fish.push({
        o,
        r: rand(r, 0.25, 0.8),
        speed: rand(r, 0.25, 0.45) * (r() < 0.5 ? -1 : 1),
        phase: r() * 6,
        depth: rand(r, 0.1, 0.22),
      });
    }
  }

  scare(): void {
    this.startle = 2.2;
  }

  update(dt: number, t: number): void {
    this.startle = Math.max(0, this.startle - dt);
    const boost = 1 + this.startle * 2.2;
    for (const f of this.fish) {
      f.phase += dt * f.speed * boost;
      const a = f.phase;
      const x = POND.x + Math.cos(a) * POND.rx * f.r * 0.85;
      const z = POND.z + Math.sin(a * 1.0) * POND.rz * f.r * 0.85;
      const nx = POND.x + Math.cos(a + 0.05 * Math.sign(f.speed)) * POND.rx * f.r * 0.85;
      const nz = POND.z + Math.sin(a + 0.05 * Math.sign(f.speed)) * POND.rz * f.r * 0.85;
      f.o.position.set(x, -f.depth - this.startle * 0.05, z);
      f.o.rotation.y = Math.atan2(nx - x, nz - z);
      const tail = f.o.getObjectByName('tail');
      if (tail) tail.rotation.y = Math.sin(t * 6 * boost + f.phase * 3) * 0.5;
    }
  }
}

/** Kleiner Low-Poly-Vogel (Elster oder Schwarmvogel) mit Flügelschlag */
export function makeBird(magpie: boolean): Group {
  const g = new Group();
  const dark = flat(magpie ? '#1d2230' : '#2b2a30', { rough: 0.6 });
  const body = mesh(new SphereGeometry(0.1, 6, 4), dark, 'cast');
  body.scale.set(0.8, 0.8, 1.6);
  g.add(body);
  if (magpie) {
    const belly = mesh(new SphereGeometry(0.075, 6, 4), flat('#f1efe8'), 'none');
    belly.position.set(0, -0.025, 0.02);
    belly.scale.set(1, 0.8, 1.3);
    g.add(belly);
    const tail = mesh(new ConeGeometry(0.04, 0.3, 4), flat('#2c4a7a', { rough: 0.4 }), 'cast');
    tail.rotation.x = Math.PI / 2 + 0.25;
    tail.position.set(0, 0.02, -0.25);
    g.add(tail);
  }
  const head = mesh(new SphereGeometry(0.065, 6, 4), dark, 'cast');
  head.position.set(0, 0.07, 0.15);
  g.add(head);
  const beak = mesh(new ConeGeometry(0.02, 0.07, 4), flat('#2a2a2a'), 'none');
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.06, 0.23);
  g.add(beak);
  const wingGeo = new BufferGeometry();
  wingGeo.setAttribute('position', new Float32BufferAttribute([0, 0, 0.08, 0.32, 0, -0.02, 0, 0, -0.1], 3));
  wingGeo.computeVertexNormals();
  const wingMat = new MeshStandardMaterial({
    color: magpie ? '#1d2230' : '#2b2a30',
    side: DoubleSide,
    flatShading: true,
  });
  for (const s of [1, -1]) {
    const w = new Mesh(wingGeo, wingMat);
    w.scale.x = s;
    w.position.y = 0.03;
    w.name = s > 0 ? 'wingR' : 'wingL';
    g.add(w);
  }
  return g;
}

export function flap(bird: Group, t: number, amount: number): void {
  const a = Math.sin(t) * amount;
  const r = bird.getObjectByName('wingR');
  const l = bird.getObjectByName('wingL');
  if (r) r.rotation.z = a;
  if (l) l.rotation.z = -a;
}

/** Elster auf dem Blütenbaum: fliegt beim Antippen weg und kommt später zurück. */
export class Magpie {
  readonly bird = makeBird(true);
  private home: Vector3;
  private state: 'perch' | 'away' | 'back' = 'perch';
  private t = 0;
  private hop = 0;

  constructor(perch: Vector3) {
    this.home = perch.clone();
    this.bird.position.copy(perch);
    this.bird.rotation.y = -0.6;
    this.bird.scale.setScalar(1.25);
    this.bird.name = 'magpie';
  }

  get present(): boolean {
    return this.state === 'perch';
  }

  scare(): boolean {
    if (this.state !== 'perch') return false;
    this.state = 'away';
    this.t = 0;
    return true;
  }

  reset(): void {
    if (this.state === 'away') {
      this.state = 'back';
      this.t = 0;
    }
  }

  update(dt: number, time: number): void {
    this.t += dt;
    const b = this.bird;
    if (this.state === 'perch') {
      this.hop -= dt;
      if (this.hop < 0) this.hop = 2 + Math.random() * 5;
      const k = this.hop < 0.25 ? Math.sin((this.hop / 0.25) * Math.PI) : 0;
      b.position.copy(this.home).add(new Vector3(0, k * 0.06, 0));
      b.rotation.y = -0.6 + Math.sin(time * 0.4) * 0.5;
      flap(b, 0, 0);
      return;
    }
    if (this.state === 'away') {
      const u = Math.min(1, this.t / 4);
      b.position.copy(this.home).add(new Vector3(u * 26, Math.sin(u * Math.PI * 0.5) * 14, -u * 30));
      b.rotation.y = Math.atan2(26, -30);
      flap(b, time * 22, 0.9);
      b.visible = u < 1;
      return;
    }
    const u = Math.min(1, this.t / 4);
    b.visible = true;
    const v = 1 - u;
    b.position.copy(this.home).add(new Vector3(-v * 20, v * 10, v * 18));
    b.rotation.y = Math.atan2(20, -18);
    flap(b, time * 22, 0.9 * v);
    if (u >= 1) this.state = 'perch';
  }
}

/** Ein kleiner Vogelschwarm, der ab und zu weit hinten über die Berge zieht. */
export class Flock {
  readonly group = new Group();
  private birds: Group[] = [];
  private t = 12;

  constructor() {
    for (let i = 0; i < 7; i++) {
      const b = makeBird(false);
      b.scale.setScalar(6);
      this.birds.push(b);
      this.group.add(b);
    }
    this.group.visible = false;
  }

  update(dt: number, time: number): void {
    this.t += dt;
    const dur = 28;
    const cycle = 46;
    const u = this.t % cycle;
    this.group.visible = u < dur;
    if (!this.group.visible) return;
    const f = u / dur;
    this.birds.forEach((b, i) => {
      const row = Math.ceil(i / 2);
      const side = i % 2 === 0 ? 1 : -1;
      b.position.set(
        -120 + f * 240 - row * 5,
        34 + Math.sin(f * 3 + i) * 2 + row * 1.2,
        -95 + side * row * 4,
      );
      b.rotation.y = Math.PI / 2;
      flap(b, time * 9 + i, 0.8);
    });
  }
}

// ───────────────────────────────────────── Nebel, Wolken, Sterne

export class Atmosphere {
  readonly group = new Group();
  private mists: { s: Sprite; base: Vector3; speed: number; op: number }[] = [];
  readonly stars: Points;

  constructor(count: number) {
    const r = rng(41);
    const tex = mistTexture();
    for (let i = 0; i < count; i++) {
      const high = i % 3 === 0;
      const a = rand(r, -Math.PI * 0.95, -Math.PI * 0.05) + (r() < 0.25 ? Math.PI : 0);
      const d = high ? rand(r, 160, 260) : rand(r, 70, 190);
      const mat = new SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        fog: false,
        opacity: 0,
      });
      const s = new Sprite(mat);
      const w = high ? rand(r, 70, 120) : rand(r, 60, 130);
      s.scale.set(w, w * (high ? 0.22 : 0.3), 1);
      const base = new Vector3(Math.cos(a) * d, high ? rand(r, 45, 70) : rand(r, 4, 18), Math.sin(a) * d);
      s.position.copy(base);
      this.group.add(s);
      this.mists.push({
        s,
        base,
        speed: rand(r, 0.3, 1.2),
        op: high ? rand(r, 0.35, 0.6) : rand(r, 0.45, 0.8),
      });
    }
    // Sterne
    const N = 700;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.05;
      const rr = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * rr * 420, y * 420, Math.sin(th) * rr * 420], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    this.stars = new Points(
      g,
      new PointsMaterial({
        size: 1.6,
        sizeAttenuation: false,
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        map: glowTexture(),
        blending: AdditiveBlending,
      }),
    );
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
  }

  update(time: number, p: Palette, motion: number): void {
    for (const m of this.mists) {
      m.s.position.x = m.base.x + Math.sin(time * 0.01 * m.speed + m.base.z) * 12 * motion;
      const mat = m.s.material as SpriteMaterial;
      mat.color.copy(p.fog).lerp(p.skyHorizon, 0.4);
      mat.opacity = m.op * (1 - p.stars * 0.45);
    }
    (this.stars.material as PointsMaterial).opacity = p.stars * (0.75 + Math.sin(time * 0.7) * 0.08);
  }
}

// ───────────────────────────────────────── Zusammenbau

export interface Landscape {
  group: Group;
  water: Mesh;
  koi: Koi;
  magpie: Magpie;
  flock: Flock;
  atmosphere: Atmosphere;
  blossomCanopy: Vector3[];
  blossomPos: Vector3;
}

export function buildLandscape(opts: {
  reflect: boolean;
  reflectRes: number;
  bamboo: number;
  mist: number;
}): Landscape {
  const group = new Group();
  group.name = 'landscape';
  group.add(terrain());
  group.add(mountainRing(110, 1, 30, '#44523e', '#64735a'));
  group.add(mountainRing(155, 2, 46, '#4c5870', '#6f7d96'));
  group.add(mountainRing(215, 3, 66, '#5d6584', '#858ca8'));
  group.add(mountainRing(285, 4, 84, '#6d7192', '#9a9db8'));
  const water = makeWater(opts.reflect, opts.reflectRes);
  group.add(water);
  // Teichboden (dunkel, damit die Koi Kontrast haben)
  const bed = new Mesh(new ShapeGeometry(pondShape(), 4), flat('#2f3a2c'));
  bed.rotation.x = -Math.PI / 2;
  bed.position.set(POND.x, -0.4, POND.z);
  group.add(bed);
  group.add(bridge());
  group.add(pathStones());
  group.add(rocks());
  group.add(lotus());
  group.add(pines());
  group.add(bamboo(opts.bamboo));
  const bt = blossomTree();
  const blossomPos = new Vector3(9.4, heightAt(9.4, 5.6), 5.6);
  bt.group.position.copy(blossomPos);
  group.add(bt.group);
  const w = willow();
  w.position.set(-12.5, heightAt(-12.5, 6.5), 6.5);
  w.scale.setScalar(0.8);
  group.add(w);
  const koi = new Koi();
  group.add(koi.group);
  const magpie = new Magpie(bt.perch.clone().add(blossomPos));
  group.add(magpie.bird);
  const flock = new Flock();
  group.add(flock.group);
  const atmosphere = new Atmosphere(opts.mist);
  group.add(atmosphere.group);
  return {
    group,
    water,
    koi,
    magpie,
    flock,
    atmosphere,
    blossomCanopy: bt.canopy.map((p) => p.clone().add(blossomPos)),
    blossomPos,
  };
}
