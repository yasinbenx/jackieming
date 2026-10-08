// Partikel und Lichteffekte: Lichtstrahlen mit Staub, Teedampf, Blütenblätter, Glühwürmchen.
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { glowTexture } from './textures';
import { rand, rng } from './noise';
import { SHARED } from './shared';

// ───────────────────────────────────────── Lichtstrahlen

const SHAFT_VERT = /* glsl */ `
varying vec3 vLocal;
varying vec3 vView;
varying vec3 vNormalV;
void main() {
  vLocal = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;
const SHAFT_FRAG = /* glsl */ `
uniform vec3 color;
uniform float intensity;
uniform float time;
varying vec3 vLocal;
varying vec3 vView;
varying vec3 vNormalV;
void main() {
  // vLocal.x: 0 am Fenster .. 1 am Ende; y/z: Querschnitt -0.5..0.5
  float along = clamp(vLocal.x, 0.0, 1.0);
  float fade = pow(1.0 - along, 1.6) * smoothstep(0.0, 0.08, along);
  float edge = (1.0 - smoothstep(0.25, 0.5, abs(vLocal.y))) * (1.0 - smoothstep(0.25, 0.5, abs(vLocal.z)));
  float facing = abs(dot(normalize(vNormalV), normalize(vView)));
  float flick = 0.85 + 0.15 * sin(time * 0.6 + vLocal.y * 9.0 + vLocal.z * 5.0);
  float a = fade * edge * mix(0.35, 1.0, facing) * intensity * flick;
  gl_FragColor = vec4(color * a, a);
}`;

export class LightShafts {
  readonly group = new Group();
  private mats: ShaderMaterial[] = [];
  private shafts: { mesh: Mesh; origin: Vector3 }[] = [];
  readonly dust: Points;
  private dustPos: Float32Array;
  private dustSeed: Float32Array;
  private length = 6;

  constructor(windows: { center: Vector3; w: number; h: number }[], dustCount: number) {
    const geo = new BoxGeometry(1, 1, 1, 1, 1, 1).translate(0.5, 0, 0);
    for (const w of windows) {
      const mat = new ShaderMaterial({
        uniforms: { color: { value: new Color('#ffcf8f') }, intensity: { value: 0.2 }, time: SHARED.uTime },
        vertexShader: SHAFT_VERT,
        fragmentShader: SHAFT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      });
      const m = new Mesh(geo, mat);
      m.scale.set(this.length, w.h * 0.9, w.w * 0.85);
      m.raycast = () => undefined;
      m.renderOrder = 5;
      this.group.add(m);
      this.mats.push(mat);
      this.shafts.push({ mesh: m, origin: w.center.clone() });
    }
    // Staub: Punkte im Volumen der Strahlen
    const r = rng(99);
    this.dustPos = new Float32Array(dustCount * 3);
    this.dustSeed = new Float32Array(dustCount * 4);
    for (let i = 0; i < dustCount; i++) {
      this.dustSeed.set([Math.floor(r() * windows.length), r() * 0.75, r() - 0.5, r() - 0.5], i * 4);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.dustPos, 3));
    const sizes = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) sizes[i] = rand(r, 0.6, 1.6);
    g.setAttribute('size', new BufferAttribute(sizes, 1));
    g.setAttribute('alpha', new BufferAttribute(new Float32Array(dustCount).fill(1), 1));
    this.dust = new Points(g, particleMaterial('#ffe2b0', AdditiveBlending, 0.016));
    this.dust.frustumCulled = false;
    this.group.add(this.dust);
  }

  /** Richtung des Lichts = von der Sonne weg */
  update(lightDir: Vector3, intensity: number, color: Color, time: number, motion: number): void {
    const q = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), lightDir);
    for (const s of this.shafts) {
      s.mesh.quaternion.copy(q);
      s.mesh.position.copy(s.origin);
    }
    for (const m of this.mats) {
      m.uniforms.intensity!.value = intensity;
      (m.uniforms.color!.value as Color).copy(color);
    }
    const dm = this.dust.material as ShaderMaterial;
    dm.uniforms.opacity!.value = Math.min(1, intensity * 2.4);
    // Staub schwebt langsam durch die Strahlen
    const tmp = new Vector3();
    const n = this.dustPos.length / 3;
    for (let i = 0; i < n; i++) {
      const wi = this.dustSeed[i * 4]!;
      const s = this.shafts[wi]!;
      let along = this.dustSeed[i * 4 + 1]! + Math.sin(time * 0.05 * motion + i) * 0.04;
      along = ((along % 0.75) + 0.75) % 0.75;
      const cy = this.dustSeed[i * 4 + 2]! * 0.8 + Math.sin(time * 0.21 * motion + i * 1.7) * 0.05;
      const cz = this.dustSeed[i * 4 + 3]! * 0.8 + Math.cos(time * 0.17 * motion + i * 2.3) * 0.05;
      tmp.set(along, cy, cz).multiply(s.mesh.scale).applyQuaternion(q).add(s.origin);
      this.dustPos.set([tmp.x, tmp.y, tmp.z], i * 3);
    }
    (this.dust.geometry.attributes.position as BufferAttribute).needsUpdate = true;
  }
}

// ───────────────────────────────────────── Partikel-Material

function particleMaterial(
  color: string,
  blending: typeof AdditiveBlending | typeof NormalBlending,
  size: number,
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      map: { value: glowTexture() },
      color: { value: new Color(color) },
      opacity: { value: 1 },
      scale: { value: size },
      uPx: SHARED.uPx,
    },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float alpha;
      uniform float scale;
      uniform float uPx;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, size * scale * uPx / max(0.1, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec3 color;
      uniform float opacity;
      varying float vAlpha;
      void main() {
        float a = texture2D(map, gl_PointCoord).a * opacity * vAlpha;
        if (a < 0.003) discard;
        gl_FragColor = vec4(color, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending,
  });
}

/** Punktwolke mit Alpha pro Punkt (Standard 1) */
function pointsGeo(n: number): {
  geo: BufferGeometry;
  pos: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
} {
  const pos = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const alpha = new Float32Array(n).fill(1);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('size', new BufferAttribute(size, 1));
  geo.setAttribute('alpha', new BufferAttribute(alpha, 1));
  return { geo, pos, size, alpha };
}

// ───────────────────────────────────────── Dampf

interface Emitter {
  pos: Vector3;
  rate: number;
  acc: number;
  spread: number;
  size: number;
}

export class Steam {
  readonly points: Points;
  private pos: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private base: Float32Array;
  private next = 0;
  private emitters: Emitter[] = [];

  constructor(private max: number) {
    const p = pointsGeo(max);
    this.pos = p.pos;
    this.size = p.size;
    this.alpha = p.alpha;
    this.alpha.fill(0);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max).fill(1);
    this.base = new Float32Array(max);
    this.points = new Points(p.geo, particleMaterial('#f6efe6', NormalBlending, 0.1));
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }

  addEmitter(pos: Vector3, rate: number, spread = 0.01, size = 1): void {
    this.emitters.push({ pos: pos.clone(), rate, acc: 0, spread, size });
  }

  private spawn(p: Vector3, spread: number, size: number, speed = 1): void {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([p.x + (Math.random() - 0.5) * spread, p.y, p.z + (Math.random() - 0.5) * spread], i * 3);
    this.vel.set(
      [(Math.random() - 0.5) * 0.04, (0.12 + Math.random() * 0.1) * speed, (Math.random() - 0.5) * 0.04],
      i * 3,
    );
    this.life[i] = 0;
    this.maxLife[i] = 1.8 + Math.random() * 1.6;
    this.base[i] = size * (0.6 + Math.random() * 0.5);
  }

  burst(p: Vector3, n: number): void {
    for (let k = 0; k < n; k++) this.spawn(p, 0.12, 1.6, 1.8);
  }

  update(dt: number, time: number, density: number): void {
    for (const e of this.emitters) {
      e.acc += dt * e.rate * density;
      while (e.acc >= 1) {
        e.acc -= 1;
        this.spawn(e.pos, e.spread, e.size);
      }
    }
    for (let i = 0; i < this.max; i++) {
      if (this.alpha[i] === 0 && this.life[i]! >= this.maxLife[i]!) continue;
      this.life[i]! += dt;
      const u = this.life[i]! / this.maxLife[i]!;
      if (u >= 1) {
        this.alpha[i] = 0;
        continue;
      }
      const j = i * 3;
      this.vel[j]! += Math.sin(time * 1.3 + i) * 0.02 * dt;
      this.pos[j]! += this.vel[j]! * dt;
      this.pos[j + 1]! += this.vel[j + 1]! * dt;
      this.pos[j + 2]! += this.vel[j + 2]! * dt;
      this.size[i] = this.base[i]! * (0.4 + u * 1.6);
      this.alpha[i] = Math.sin(u * Math.PI) * 0.32;
    }
    const a = this.points.geometry.attributes;
    (a.position as BufferAttribute).needsUpdate = true;
    (a.size as BufferAttribute).needsUpdate = true;
    (a.alpha as BufferAttribute).needsUpdate = true;
  }
}

// ───────────────────────────────────────── Blütenblätter

export class Petals {
  readonly mesh: InstancedMesh;
  private p: Float32Array;
  private v: Float32Array;
  private rot: Float32Array;
  private active: number;
  private o = new Object3D();
  private extra = 0;

  constructor(
    private max: number,
    private sources: Vector3[],
    private groundY: (x: number, z: number) => number,
  ) {
    const geo = new PlaneGeometry(0.05, 0.035);
    const mat = new MeshStandardMaterial({
      color: '#f5c2cf',
      side: DoubleSide,
      roughness: 0.7,
      emissive: new Color('#3a1a20'),
    });
    this.mesh = new InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.rot = new Float32Array(max * 3);
    this.active = max;
    for (let i = 0; i < max; i++) this.respawn(i, true);
  }

  setActive(n: number): void {
    this.active = Math.min(this.max, n);
    this.mesh.count = this.active;
  }

  private respawn(i: number, anywhere = false): void {
    // meist am Blütenbaum, manchmal irgendwo über dem Vorplatz (vom Wind herangetragen)
    let x: number;
    let y: number;
    let z: number;
    if (Math.random() < 0.7) {
      const s = this.sources[Math.floor(Math.random() * this.sources.length)]!;
      x = s.x + (Math.random() - 0.5) * 1.2;
      y = s.y + (Math.random() - 0.5) * 0.6;
      z = s.z + (Math.random() - 0.5) * 1.2;
    } else {
      x = -6 + Math.random() * 12;
      y = 3 + Math.random() * 3;
      z = -1 + Math.random() * 10;
    }
    if (anywhere) y -= Math.random() * 3;
    this.p.set([x, y, z], i * 3);
    this.v.set(
      [0.25 + Math.random() * 0.35, -(0.25 + Math.random() * 0.2), -0.05 + Math.random() * 0.1],
      i * 3,
    );
    this.rot.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3);
  }

  /** Viele Blätter auf einmal (z. B. beim Anstoßen) */
  burst(n: number): void {
    this.extra = Math.min(this.max - this.active, n);
    for (let k = 0; k < this.extra; k++) {
      const i = this.active + k;
      this.respawn(i);
      this.p[i * 3] = -2 + Math.random() * 4;
      this.p[i * 3 + 1] = 3.2 + Math.random() * 1.2;
      this.p[i * 3 + 2] = -1.2 + Math.random() * 2.6;
    }
    this.mesh.count = this.active + this.extra;
  }

  update(dt: number, time: number, wind: number): void {
    const n = this.mesh.count;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      const flutter = Math.sin(time * 2.2 + i * 1.7);
      this.p[j]! += (this.v[j]! * wind + flutter * 0.12) * dt;
      this.p[j + 1]! += this.v[j + 1]! * dt;
      this.p[j + 2]! += (this.v[j + 2]! + Math.cos(time * 1.7 + i) * 0.08) * dt;
      this.rot[j]! += dt * 2.1;
      this.rot[j + 1]! += dt * 1.3;
      const x = this.p[j]!;
      const z = this.p[j + 2]!;
      // Boden: im Haus der Fußboden, draußen das Gelände
      const inside = Math.abs(x) < 3.4 && Math.abs(z) < 2.7;
      const ground = inside ? 0.52 : this.groundY(x, z) + 0.02;
      if (this.p[j + 1]! < ground) {
        if (i >= this.active) {
          this.p[j + 1] = -50;
        } else this.respawn(i);
      }
      this.o.position.set(this.p[j]!, this.p[j + 1]!, this.p[j + 2]!);
      this.o.rotation.set(this.rot[j]!, this.rot[j + 1]!, this.rot[j + 2]! + flutter * 0.3);
      this.o.updateMatrix();
      this.mesh.setMatrixAt(i, this.o.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ───────────────────────────────────────── Glühwürmchen (nachts am Teich)

export class Fireflies {
  readonly points: Points;
  private seed: Float32Array;
  private pos: Float32Array;
  private alpha: Float32Array;

  constructor(n: number, center: Vector3, rx: number, rz: number) {
    const p = pointsGeo(n);
    this.pos = p.pos;
    this.alpha = p.alpha;
    this.seed = new Float32Array(n * 4);
    const r = rng(7);
    for (let i = 0; i < n; i++) {
      this.seed.set(
        [center.x + rand(r, -rx, rx), rand(r, 0.3, 1.6), center.z + rand(r, -rz, rz), r() * 10],
        i * 4,
      );
      p.size[i] = rand(r, 0.5, 1.0);
    }
    this.points = new Points(p.geo, particleMaterial('#e8ff9a', AdditiveBlending, 0.09));
    this.points.frustumCulled = false;
  }

  update(time: number, amount: number): void {
    const n = this.alpha.length;
    this.points.visible = amount > 0.02;
    if (!this.points.visible) return;
    for (let i = 0; i < n; i++) {
      const s = i * 4;
      const ph = this.seed[s + 3]!;
      this.pos[i * 3] = this.seed[s]! + Math.sin(time * 0.3 + ph) * 0.8;
      this.pos[i * 3 + 1] = this.seed[s + 1]! + Math.sin(time * 0.7 + ph * 2) * 0.25;
      this.pos[i * 3 + 2] = this.seed[s + 2]! + Math.cos(time * 0.25 + ph) * 0.8;
      this.alpha[i] = amount * Math.max(0, Math.sin(time * 1.3 + ph * 3)) ** 2;
    }
    const a = this.points.geometry.attributes;
    (a.position as BufferAttribute).needsUpdate = true;
    (a.alpha as BufferAttribute).needsUpdate = true;
  }
}
