// Rig-Figur: Quaternius-Körper (Skelett + Animationen) mit Teehaus-Gewändern. Zusammengesetzt aus Kopf, Körper,
// Beinen und Füßen verschiedener Grundfiguren, umgefärbt, mit Stickerei, angesetztem Mantelschoß, Gürtel,
// Frisuren und Requisiten. Dieselbe Schnittstelle wie die gezeichnete Figur (character.ts), damit Agent, NPCs
// und Hauptfiguren unverändert bleiben.
import {
  AnimationMixer,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  Group,
  LoopOnce,
  LoopRepeat,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import type { AnimationAction, Bone, Material, MeshStandardMaterial } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Action, HairFit, Look, Prop } from './character';
import { embroidery, fabricNormals, vinyl } from './materials';
import type { Front } from './materials';
import { attachRigid, rigAssets } from './rig';
import type { RigAssets, RigBase, RigPart } from './rig';
import { hairKit } from './hairkit';
import { makeProp } from './props';
import { groundY } from './nav';

export type Role =
  | 'skin'
  | 'hair'
  | 'brows'
  | 'eye'
  | 'top'
  | 'inner'
  | 'trim'
  | 'pants'
  | 'shoes'
  | 'sole'
  | 'stripe'
  | 'belt'
  | 'hat'
  | 'band'
  | 'hide'
  | 'keep';

export interface BodyShape {
  /** Kopfgröße (Knochen-Skalierung) */
  head?: number;
  /** Schulterbreite (Abstand der Schultergelenke) */
  shoulders?: number;
  /** Rumpf und Arme breiter/kräftiger */
  girth?: number;
  /** Armlänge/-stärke */
  arms?: number;
  hands?: number;
  feet?: number;
  /** weite Hosenbeine */
  wide?: number;
}

export interface RigSpec {
  head: RigBase;
  body: RigBase;
  legs: RigBase;
  feet: RigBase;
  /** Material-Rollen überschreiben, Schlüssel „Teil:Material“ (z. B. „Body:White“) oder nur „Material“ */
  roles?: Record<string, Role>;
  /** Haar des Kopfteils ausblenden (für Haarmodelle aus haare.glb) */
  hideHair?: boolean;
  /** Haarmodelle aus haare.glb (Dutt, lange Haare …) */
  hair?: HairFit[];
  shape?: BodyShape;
}

/** Standard-Rollen der Materialien je Teil */
const DEFAULT_ROLES: Record<string, Role> = {
  Skin: 'skin',
  Skin_Darker: 'skin',
  Eye: 'eye',
  Eyebrows: 'brows',
  Hair: 'hair',
  Hair_White: 'hair',
  Moustache: 'hair',
  Earrings: 'hide',
  'Head:Gold': 'hide',
  'Head:Worker_Yellow': 'hide',
  'Head:Beige': 'hat',
  'Head:Red': 'band',
  'Body:White': 'inner',
  'Body:Tie': 'inner',
  'Body:Beige': 'trim',
  'Body:LightGreen': 'inner',
  'Feet:White': 'sole',
  'Feet:Red_Dark': 'shoes',
  'Feet:Grey': 'sole',
  'Feet:Brown2': 'sole',
};

function roleOf(part: RigPart, mat: string, spec: RigSpec): Role {
  return (
    spec.roles?.[`${part}:${mat}`] ??
    spec.roles?.[mat] ??
    DEFAULT_ROLES[`${part}:${mat}`] ??
    DEFAULT_ROLES[mat] ??
    (part === 'Body' ? 'top' : part === 'Legs' ? 'pants' : part === 'Feet' ? 'shoes' : 'keep')
  );
}

interface ActionState {
  t: number;
  dur: number;
  loop: boolean;
  w: number;
  stopping: boolean;
}

const CLIP_ACTIONS: Partial<Record<Action, string>> = { wave: 'Wave', kungfu: 'Punch_Right' };

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const _q1 = new Quaternion();
const _q2 = new Quaternion();
const _v1 = new Vector3();
const _v2 = new Vector3();
const _v3 = new Vector3();
const _v4 = new Vector3();
const _h = new Vector3();
const _k = new Vector3();
const _e = new Vector3();
const _t = new Vector3();
const _q3 = new Quaternion();
const _q4 = new Quaternion();
const THIGH_L = new Vector3(0.14, -0.04, 1);
const THIGH_R = new Vector3(-0.14, -0.04, 1);
const SHIN = new Vector3(0, -1, 0.06);
const _m = new Matrix4();

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Morph-Ziele für Blinzeln (Augen schließen) und Brauen heben, einmal je Geometrie */
const morphDone = new WeakSet<BufferGeometry>();
function addMorph(geo: BufferGeometry, world: Matrix4, kind: 'blink' | 'brow'): void {
  if (morphDone.has(geo)) return;
  morphDone.add(geo);
  const pos = geo.getAttribute('position');
  const inv = world.clone().invert();
  const p = new Vector3();
  // Weltlage der Vertices, Augenmitte je Seite
  const centers = { l: { y: 0, n: 0 }, r: { y: 0, n: 0 } };
  const wpos: Vector3[] = [];
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(world);
    wpos.push(p.clone());
    const c = p.x >= 0 ? centers.l : centers.r;
    c.y += p.y;
    c.n++;
  }
  const delta = new Float32Array(pos.count * 3);
  const a = new Vector3();
  const b = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    const w = wpos[i]!;
    const c = w.x >= 0 ? centers.l : centers.r;
    const cy = c.y / Math.max(1, c.n);
    const target = w.clone();
    if (kind === 'blink') target.y = cy + (w.y - cy) * 0.08;
    else target.y += 0.012;
    a.copy(w).applyMatrix4(inv);
    b.copy(target).applyMatrix4(inv);
    delta[i * 3] = b.x - a.x;
    delta[i * 3 + 1] = b.y - a.y;
    delta[i * 3 + 2] = b.z - a.z;
  }
  geo.morphAttributes.position = [new BufferAttribute(delta, 3)];
  geo.morphTargetsRelative = true;
}

/** Mantelschoß als Röhre ab der Taille, an Hüfte und Beinen „angenäht“ (Skinning), optional vorne offen */
function skirtGeometry(
  bones: { hips: number; ulL: number; ulR: number; llL: number; llR: number },
  o: { y0: number; len: number; rx: number; rz: number; flare: number; z: number; gap: number; arc?: number },
): BufferGeometry {
  const S = 28;
  const R = 8;
  const pos: number[] = [];
  const uv: number[] = [];
  const si: number[] = [];
  const sw: number[] = [];
  const idx: number[] = [];
  const arc = o.arc ?? Math.PI * 2;
  const a0 = o.arc ? -arc / 2 : o.gap / 2;
  const span = o.arc ? arc : arc - o.gap;
  for (let j = 0; j <= R; j++) {
    const t = j / R;
    const y = o.y0 - t * o.len;
    const grow = 1 + o.flare * Math.pow(t, 1.2);
    for (let i = 0; i <= S; i++) {
      const a = a0 + (i / S) * span;
      const sx = Math.sin(a);
      pos.push(sx * o.rx * grow, y, o.z + Math.cos(a) * o.rz * grow);
      uv.push((((a / (Math.PI * 2)) % 1) + 1) % 1, 1 - t);
      // Gewichte: oben Hüfte, unten zunehmend die Beine der jeweiligen Seite
      const tt = smoothstep(0, 0.7, t);
      const wh = 1 - 0.8 * tt;
      const rest = 1 - wh;
      const side = Math.max(-1, Math.min(1, sx * 1.4));
      let wl = rest * (0.5 + 0.5 * side);
      let wr = rest * (0.5 - 0.5 * side);
      const low = smoothstep(0.55, 1, t) * 0.4;
      const wLow = (sx >= 0 ? wl : wr) * low;
      if (sx >= 0) wl -= wLow;
      else wr -= wLow;
      si.push(bones.hips, bones.ulL, bones.ulR, sx >= 0 ? bones.llL : bones.llR);
      sw.push(wh, wl, wr, wLow);
    }
  }
  for (let j = 0; j < R; j++)
    for (let i = 0; i < S; i++) {
      const a = j * (S + 1) + i;
      const b = a + S + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute('skinIndex', new BufferAttribute(new Uint16Array(si), 4));
  g.setAttribute('skinWeight', new BufferAttribute(new Float32Array(sw), 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class RigCharacter {
  readonly root = new Group();
  readonly look: Look;
  readonly H: number;
  /** Kopfmitte (folgt dem Kopfknochen) */
  readonly head = new Object3D();
  private model = new Group();
  private inst: Group;
  private bones = new Map<string, Bone>();
  private mixer: AnimationMixer;
  private loco: {
    idle: AnimationAction;
    idle2: AnimationAction;
    walk: AnimationAction;
    run: AnimationAction;
  };
  /** Mischung der beiden Idle-Varianten (0 = erste, 1 = zweite), wechselt zufällig */
  private idleMix = 0;
  private idleTarget = 0;
  private idleSwap = 6 + Math.random() * 10;
  // Sprechgesten
  private gest = 0;
  private gestTimer = 0;
  private gestPose = { side: 1, lift: 0.5, open: 0.5 };
  private talkHold = 0;
  // Nachschwingen (Quasten, Haare)
  private dangles: {
    obj: Object3D;
    rest: Quaternion;
    prev: Vector3;
    vel: Vector3;
    ang: Vector3;
    angVel: Vector3;
    k: number;
    gain: number;
    hang: boolean;
  }[] = [];
  private clipActs = new Map<Action, AnimationAction>();
  private A: RigAssets;
  private S: number;
  private eyes: Mesh[] = [];
  private brows: Mesh[] = [];
  private mouth!: Mesh;
  private mouthOpen!: Mesh;
  private props: Partial<Record<Exclude<Prop, null>, Object3D>> = {};
  private detail = true;
  // Zustand (wie character.ts)
  speed = 0;
  talk = 0;
  stoop = 0;
  private stoopSmooth = 0;
  private talkSmooth = 0;
  private sit = 0;
  private sitTarget = 0;
  private seatH = 0.46;
  private actions = new Map<Action, ActionState>();
  private blink = 2 + Math.random() * 3;
  private lookTarget: Vector3 | null = null;
  private lookYaw = 0;
  private lookPitch = 0;
  private time = Math.random() * 10;
  private seed = Math.random() * 100;
  private hasBall = false;
  /**
   * Vom prozeduralen Teil veränderte Knochen mit ihrer Pose davor. Der Animationsmixer schreibt einen Wert nur,
   * wenn er sich ändert; ohne Zurücksetzen würden sich die Zusatzdrehungen von Bild zu Bild aufaddieren.
   */
  private touched = new Map<Object3D, { q: Quaternion; p: Vector3 }>();
  // Bewegung: geglättete Mischgewichte, Drehrate (für Kurvenneigung und Trippeln im Stand)
  private wMove = 0;
  private wRun = 0;
  private wStep = 0;
  private lastYaw = 0;
  private yawRate = 0;

  constructor(look: Look) {
    const A = rigAssets()!;
    this.A = A;
    this.look = look;
    const spec = look.rig!;
    this.H = look.height;
    this.root.name = `rig-${look.id}`;
    // Grundkörper klonen, fremde Teile entfernen und aus den anderen Grundfiguren einsetzen
    this.inst = cloneSkinned(A.bases.get(spec.body)!) as Group;
    this.inst.updateMatrixWorld(true);
    this.inst.traverse((o) => {
      // Endpunkte (…_end) sind keine Skin-Knochen, werden aber für Füße/Kopf gebraucht
      if ((o as Bone).isBone || o.name.endsWith('_end')) this.bones.set(o.name, o as Bone);
    });
    const want: Record<RigPart, RigBase> = {
      Head: spec.head,
      Body: spec.body,
      Legs: spec.legs,
      Feet: spec.feet,
    };
    const drop: Object3D[] = [];
    this.inst.traverse((o) => {
      const m = o as SkinnedMesh;
      if (m.isSkinnedMesh && want[m.userData.part as RigPart] !== spec.body) drop.push(m);
    });
    for (const m of drop) m.removeFromParent();
    for (const part of ['Head', 'Legs', 'Feet'] as RigPart[]) {
      if (want[part] === spec.body) continue;
      const src = A.bases.get(want[part])!;
      src.traverse((o) => {
        const sm = o as SkinnedMesh;
        if (!sm.isSkinnedMesh || sm.userData.part !== part) return;
        const m = new SkinnedMesh(sm.geometry, sm.material);
        m.name = sm.name;
        m.userData.part = part;
        sm.matrixWorld.decompose(m.position, m.quaternion, m.scale);
        const bones = sm.skeleton.bones.map((b) => this.bones.get(b.name)!);
        m.bind(
          new Skeleton(
            bones,
            sm.skeleton.boneInverses.map((x) => x.clone()),
          ),
          sm.bindMatrix.clone(),
        );
        m.frustumCulled = false;
        this.inst.add(m);
      });
    }
    // Materialien nach Rollen
    const mats = this.materials();
    const meshes: SkinnedMesh[] = [];
    this.inst.traverse((o) => {
      const m = o as SkinnedMesh;
      if (m.isSkinnedMesh) meshes.push(m);
    });
    for (const m of meshes) {
      const name = (m.material as Material).name;
      const part = m.userData.part as RigPart;
      let role = roleOf(part, name, spec);
      if (role === 'hair' && spec.hideHair && name !== 'Moustache') role = 'hide';
      m.castShadow = true;
      m.receiveShadow = false;
      if (role === 'hide') {
        m.visible = false;
        continue;
      }
      const mat = mats[role] ?? (role === 'keep' ? (m.material as Material) : mats.top!);
      m.material = mat;
      if (name === 'Eye') {
        addMorph(m.geometry, m.matrixWorld, 'blink');
        m.updateMorphTargets();
        this.eyes.push(m);
      }
      if (name === 'Eyebrows') {
        addMorph(m.geometry, m.matrixWorld, 'brow');
        m.updateMorphTargets();
        this.brows.push(m);
      }
    }
    this.model.add(this.inst);
    this.root.add(this.model);
    this.S = this.H / A.rest.headTopY;
    this.root.updateMatrixWorld(true);

    this.addClothes(mats);
    this.addHead();
    // Requisiten in der Ruhepose anhängen (später nur ein-/ausblenden)
    for (const p of ['cup', 'teapot', 'brush', 'fan', 'bowl'] as const) this.makeProp(p);
    if (look.prop === 'ball') this.makeProp('ball');
    if (look.prop) this.showProp(look.prop, true);
    this.shapeBody(spec.shape ?? {});
    // erst jetzt skalieren: alle Bindungen oben wurden in der Ruhepose bei Maßstab 1 berechnet
    this.model.scale.setScalar(this.S);

    // Animationen: Bewegungs-Mischung (Idle/Gehen/Laufen) mit zufälligem Zeitversatz
    this.mixer = new AnimationMixer(this.inst);
    const clip = (n: string) => A.clips.get(n)!;
    const first = look.id === 'master' || Math.random() < 0.5;
    const idle = this.mixer.clipAction(clip(first ? 'Idle_Neutral' : 'Idle'));
    const idle2 = this.mixer.clipAction(clip(first ? 'Idle' : 'Idle_Neutral'));
    const walk = this.mixer.clipAction(clip('Walk'));
    const run = this.mixer.clipAction(clip('Run'));
    for (const a of [idle, idle2, walk, run]) {
      a.setLoop(LoopRepeat, Infinity);
      a.play();
      a.time = Math.random() * a.getClip().duration;
      a.setEffectiveWeight(a === idle ? 1 : 0);
    }
    idle.timeScale = 0.85 + Math.random() * 0.3;
    idle2.timeScale = 0.85 + Math.random() * 0.3;
    this.loco = { idle, idle2, walk, run };
    // Quasten und lange Haare schwingen nach
    this.root.updateMatrixWorld(true);
    this.inst.traverse((o) => {
      if (o.userData.tassel) this.addDangle(o, 28, 0.06, true);
      if (o.userData.hairSway) this.addDangle(o, 60, 0.012, false);
    });
  }

  // ───────────────────────────────────────── Aufbau

  private materials(): Partial<Record<Role, Material>> {
    const L = this.look;
    const gold = L.top.gold ?? '#d9a94a';
    const front: Front = L.top.trim && !L.top.open ? { kind: 'closed', trim: L.top.trim } : { kind: 'none' };
    const topTex = L.top.motif ? embroidery(L.top.color, gold, L.top.motif, 1, front) : null;
    const pantsTex = L.pants.motif ? embroidery(L.pants.color, L.pants.gold ?? gold, L.pants.motif) : null;
    const cloth = (m: MeshStandardMaterial): MeshStandardMaterial => {
      // eigene Instanz, damit die Falten-Normalen nicht auf andere Nutzer des Material-Caches durchschlagen
      const c = m.clone();
      c.onBeforeCompile = m.onBeforeCompile;
      c.customProgramCacheKey = m.customProgramCacheKey;
      c.normalMap = fabricNormals();
      c.normalScale.set(0.55, 0.55);
      return c;
    };
    return {
      skin: vinyl(L.skin, { rough: 0.55, warm: 0.1 }),
      hair: vinyl(L.hair, { rough: 0.5 }),
      brows: vinyl(L.brows ?? L.hair, { rough: 0.6 }),
      eye: vinyl('#1c120c', { rough: 0.25, rim: 0 }),
      top: cloth(vinyl(topTex ? '#ffffff' : L.top.color, { rough: 0.72, map: topTex })),
      inner: vinyl(L.inner?.color ?? L.cuff ?? L.top.trim ?? L.top.color, { rough: 0.7 }),
      trim: vinyl(L.top.trim ?? gold, { rough: 0.5, metal: 0.2 }),
      pants: cloth(vinyl(pantsTex ? '#ffffff' : L.pants.color, { rough: 0.78, map: pantsTex })),
      shoes: vinyl(L.shoes.color, { rough: 0.45 }),
      sole: vinyl(L.shoes.sole ?? '#f2efe6', { rough: 0.6 }),
      stripe: vinyl(L.shoes.stripe ?? L.shoes.sole ?? L.shoes.color, { rough: 0.5 }),
      belt: vinyl(L.belt?.color ?? L.pants.color, { rough: 0.5 }),
      hat: vinyl('#d9b56a', { rough: 0.9 }),
      band: vinyl('#b3261a', { rough: 0.6 }),
    };
  }

  /** Taillenumfang aus den Körpervertices in Ruhepose */
  private waist(): { rx: number; rz: number; z: number } {
    const R = this.A.rest;
    const xs: number[] = [];
    const zs: number[] = [];
    const v = new Vector3();
    this.inst.updateMatrixWorld(true);
    this.inst.traverse((o) => {
      const m = o as SkinnedMesh;
      if (!m.isSkinnedMesh || !m.visible) return;
      const part = m.userData.part as RigPart;
      if (part !== 'Body' && part !== 'Legs') return;
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i += 2) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        if (Math.abs(v.y - R.hipY - 0.04) > 0.05 || Math.abs(v.x) > R.shoulderX) continue;
        xs.push(Math.abs(v.x));
        zs.push(v.z);
      }
    });
    if (xs.length < 10) return { rx: 0.15, rz: 0.11, z: R.chestZ };
    // Ausreißer (Taschen, Knöpfe) ignorieren
    xs.sort((a, b) => a - b);
    zs.sort((a, b) => a - b);
    const q = (arr: number[], f: number): number => arr[Math.floor((arr.length - 1) * f)]!;
    const z0 = q(zs, 0.03);
    const z1 = q(zs, 0.97);
    return { rx: q(xs, 0.95), rz: Math.max(0.08, (z1 - z0) / 2), z: (z0 + z1) / 2 };
  }

  private boneIndex(skel: Skeleton, name: string): number {
    return Math.max(
      0,
      skel.bones.findIndex((b) => b.name === name),
    );
  }

  private addClothes(mats: Partial<Record<Role, Material>>): void {
    const L = this.look;
    const R = this.A.rest;
    const w = this.waist();
    const skelBones = [...this.bones.values()].filter((b) => b.isBone);
    const skel = new Skeleton(skelBones);
    const ids = {
      hips: this.boneIndex(skel, 'Hips'),
      ulL: this.boneIndex(skel, 'UpperLegL'),
      ulR: this.boneIndex(skel, 'UpperLegR'),
      llL: this.boneIndex(skel, 'LowerLegL'),
      llR: this.boneIndex(skel, 'LowerLegR'),
    };
    const legLen = R.hipY;
    // Mantelschoß / Gewand
    if (L.top.skirt > 0.18) {
      const len = legLen * Math.min(0.95, L.top.skirt) + 0.08;
      const gold = L.top.gold ?? '#d9a94a';
      const tex = L.top.motif
        ? embroidery(L.top.color, gold, L.top.motif === 'dragon' ? 'cloud' : L.top.motif)
        : null;
      const mat = vinyl(tex ? '#ffffff' : L.top.color, {
        rough: 0.72,
        map: tex,
        key: `skirt-${L.id}-${L.top.color}`,
      });
      mat.side = DoubleSide;
      mat.normalMap = fabricNormals();
      mat.normalScale.set(0.8, 0.8);
      const open = !!L.top.open;
      const geo = skirtGeometry(ids, {
        y0: R.hipY + 0.07,
        len,
        rx: w.rx + 0.05,
        rz: w.rz + 0.07,
        flare: 0.4 + L.top.skirt * 0.5,
        z: w.z,
        gap: open ? 0.55 : 0,
      });
      this.addSkinned(geo, mat, skel);
    }
    // Schürze (Teemeister)
    if (L.apron) {
      const mat = vinyl(L.apron, { rough: 0.85 }).clone();
      mat.onBeforeCompile = vinyl(L.apron, { rough: 0.85 }).onBeforeCompile;
      mat.side = DoubleSide;
      mat.normalMap = fabricNormals();
      mat.normalScale.set(1.2, 1.2);
      const geo = skirtGeometry(ids, {
        y0: R.hipY + 0.16,
        len: legLen * 0.8,
        rx: w.rx + 0.09,
        rz: w.rz + 0.115,
        flare: 0.45 + L.top.skirt * 0.5,
        z: w.z,
        gap: 0,
        arc: 1.7,
      });
      this.addSkinned(geo, mat, skel);
    }
    // Gürtel mit Quasten
    const hips = this.bones.get('Hips')!;
    if (L.belt) {
      // Gürtel als schmales Band, das wie der Stoff an der Hüfte hängt
      const band = skirtGeometry(ids, {
        y0: R.hipY + 0.13,
        len: 0.055,
        rx: w.rx + 0.012,
        rz: w.rz + 0.016,
        flare: 0.02,
        z: w.z,
        gap: 0,
      });
      this.addSkinned(band, mats.belt!, skel);
      if (L.belt.tassels) {
        const gold = vinyl('#d9a94a', { rough: 0.3, metal: 0.5 });
        for (const dx of [-0.035, 0.02]) {
          const knot = new Mesh(new SphereGeometry(0.016, 8, 6), gold);
          const tas = new Mesh(new ConeGeometry(0.02, 0.13, 8), mats.belt!);
          const g = new Group();
          g.add(knot, tas);
          tas.position.y = -0.075;
          g.userData.tassel = true;
          tas.userData.tassel = false;
          attachRigid(
            hips,
            g,
            new Matrix4().makeTranslation(w.rx * 0.55 + dx, R.hipY + 0.08, w.z + w.rz + 0.025),
          );
        }
      }
    }
  }

  private addSkinned(geo: BufferGeometry, mat: Material, skel: Skeleton): void {
    const m = new SkinnedMesh(geo, mat);
    m.castShadow = true;
    m.frustumCulled = false;
    this.inst.add(m);
    this.inst.updateMatrixWorld(true);
    m.bind(new Skeleton(skel.bones), m.matrixWorld);
  }

  private addHead(): void {
    const R = this.A.rest;
    const headBone = this.bones.get('Head')!;
    attachRigid(headBone, this.head, new Matrix4().makeTranslation(R.head.c.x, R.head.c.y, R.head.c.z));
    // Haarmodelle
    const kit = hairKit();
    if (kit && this.look.rig?.hair) for (const fit of this.look.rig.hair) this.addHair(fit, headBone);
    // Mund: kleines Lächeln und Mundöffnung beim Sprechen (die Modelle haben keinen Mund)
    const r = R.head.r;
    const mp = R.mouth;
    const lip = vinyl('#7a2a22', { rough: 0.4, rim: 0 });
    const smile = new Mesh(new TorusGeometry(r.x * 0.22, r.x * 0.03, 6, 14, Math.PI), lip);
    attachRigid(
      headBone,
      smile,
      new Matrix4().compose(
        new Vector3(mp.x, mp.y + r.y * 0.02, mp.z - 0.002),
        new Quaternion().setFromAxisAngle(Z, Math.PI),
        new Vector3(1, 0.65, 1),
      ),
    );
    const open = new Mesh(new SphereGeometry(r.x * 0.18, 12, 8), vinyl('#4a1612', { rough: 0.5, rim: 0 }));
    attachRigid(
      headBone,
      open,
      new Matrix4().compose(
        new Vector3(mp.x, mp.y - r.y * 0.04, mp.z - 0.006),
        new Quaternion(),
        new Vector3(1.2, 0.25, 0.45),
      ),
    );
    this.mouth = smile;
    this.mouthOpen = open;
  }

  private addHair(fit: HairFit, headBone: Bone): void {
    const part = hairKit()?.get(fit.piece);
    if (!part) return;
    const mat = vinyl(fit.color ?? this.look.hair, {
      rough: 0.55,
      key: `hair-${fit.piece}-${this.look.hair}`,
    });
    mat.map = part.map;
    mat.normalMap = part.normalMap;
    mat.side = DoubleSide;
    const hsl = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(hsl);
    mat.color.multiplyScalar(hsl.l > 0.5 ? 1.75 : 1.35);
    const m = new Mesh(part.geo, mat);
    m.castShadow = true;
    const R = this.A.rest.head;
    const [sx, sy, sz] = fit.scale ?? [1, 1, 1];
    const [ox, oy, oz] = fit.offset ?? [0, 0, 0];
    const world = new Matrix4().compose(
      new Vector3(R.c.x + ox * R.r.x, R.c.y + oy * R.r.y, R.c.z + oz * R.r.z),
      new Quaternion().setFromAxisAngle(X, fit.tilt ?? 0),
      new Vector3(R.r.x * sx * 1.04, R.r.y * sy * 1.02, R.r.z * sz * 1.04),
    );
    attachRigid(headBone, m, world);
    if (fit.piece === 'Hair_Long' || fit.piece === 'Hair_Buns') m.userData.hairSway = true;
  }

  /** Körpertypen über Knochen: Kopf, Schultern, Rumpf, Arme, Hände, Füße, Hosenweite */
  private shapeBody(sh: BodyShape): void {
    const b = (n: string): Bone | undefined => this.bones.get(n);
    if (sh.head) b('Head')?.scale.setScalar(sh.head);
    if (sh.shoulders)
      for (const n of ['ShoulderL', 'ShoulderR']) {
        const s = b(n);
        if (s) {
          s.position.x *= sh.shoulders;
          s.position.z *= sh.shoulders;
        }
      }
    if (sh.girth) {
      b('Torso')?.scale.set(sh.girth, 1, sh.girth);
      const g = 1 / sh.girth;
      b('Neck')?.scale.set(g, 1, g);
    }
    if (sh.arms) for (const n of ['UpperArmL', 'UpperArmR']) b(n)?.scale.setScalar(sh.arms);
    if (sh.hands) for (const n of ['WristL', 'WristR']) b(n)?.scale.setScalar(sh.hands);
    if (sh.feet) for (const n of ['FootL', 'FootR']) b(n)?.scale.setScalar(sh.feet);
    if (sh.wide) for (const n of ['LowerLegL', 'LowerLegR']) b(n)?.scale.set(sh.wide, 1, sh.wide);
  }

  // ───────────────────────────────────────── Requisiten

  private makeProp(p: Exclude<Prop, null>): void {
    {
      const m = makeProp(p, 1);
      m.visible = false;
      const R = this.A.rest;
      if (p === 'ball') {
        // unter dem linken Arm
        attachRigid(
          this.bones.get('Chest')!,
          m,
          new Matrix4().makeTranslation(R.shoulderX + 0.12, R.armY - 0.33, R.chestZ - 0.01),
        );
      } else {
        const left = p === 'bowl';
        const s = left ? 'L' : 'R';
        const wrist = this.bones.get(`Wrist${s}`)!;
        // Griffpunkt in der Ruhepose: ein Stück über das Handgelenk hinaus in Armrichtung, leicht unter der
        // Handfläche; das Requisit steht dabei aufrecht und folgt danach der Hand
        this.inst.updateMatrixWorld(true);
        const w = wrist.getWorldPosition(new Vector3());
        const e = this.bones.get(`LowerArm${s}`)!.getWorldPosition(new Vector3());
        const dir = w.clone().sub(e).normalize();
        const grip = w.addScaledVector(dir, 0.075);
        grip.y -= 0.025;
        attachRigid(wrist, m, new Matrix4().makeTranslation(grip.x, grip.y, grip.z));
      }
      this.props[p] = m;
    }
  }

  showProp(p: Exclude<Prop, null>, on: boolean): void {
    const m = this.props[p];
    if (m) m.visible = on;
    if (p === 'ball') this.hasBall = on && !!m;
  }

  // ───────────────────────────────────────── Steuerung (wie character.ts)

  get yaw(): number {
    return this.root.rotation.y;
  }

  set yaw(v: number) {
    this.root.rotation.y = v;
  }

  get position(): Vector3 {
    return this.root.position;
  }

  headWorld(out = new Vector3()): Vector3 {
    return this.head.getWorldPosition(out);
  }

  sitDown(seatH: number): void {
    this.seatH = seatH;
    this.sitTarget = 1;
  }

  standUp(): void {
    this.sitTarget = 0;
  }

  get sitAmount(): number {
    return this.sit;
  }

  play(a: Action, dur = 1.4): void {
    this.actions.set(a, { t: 0, dur, loop: false, w: this.actions.get(a)?.w ?? 0, stopping: false });
    if (a === 'drink') this.showProp('cup', true);
    const clipName = CLIP_ACTIONS[a];
    if (clipName) {
      const act = this.clipActs.get(a) ?? this.mixer.clipAction(this.A.clips.get(clipName)!);
      this.clipActs.set(a, act);
      act.setLoop(LoopOnce, 1);
      act.clampWhenFinished = true;
      act.reset().play();
      act.timeScale = act.getClip().duration / Math.max(0.4, dur);
      act.setEffectiveWeight(0);
    }
  }

  hold(a: Action): void {
    const cur = this.actions.get(a);
    if (cur && cur.loop && !cur.stopping) return;
    this.actions.set(a, { t: 0, dur: 1, loop: true, w: cur?.w ?? 0, stopping: false });
  }

  stop(a: Action): void {
    const cur = this.actions.get(a);
    if (cur) cur.stopping = true;
  }

  isPlaying(a: Action): boolean {
    const c = this.actions.get(a);
    return !!c && !c.stopping && (c.loop || c.t < c.dur);
  }

  lookAt(p: Vector3 | null): void {
    this.lookTarget = p ? p.clone() : null;
  }

  setDetail(on: boolean): void {
    this.detail = on;
    this.mouth.visible = on;
  }

  // ───────────────────────────────────────── Animation

  private w(a: Action): number {
    return this.actions.get(a)?.w ?? 0;
  }

  private touch(b: Object3D): void {
    if (this.touched.has(b)) return;
    this.touched.set(b, { q: b.quaternion.clone(), p: b.position.clone() });
  }

  /** Knochen um eine Achse im Figurenraum drehen (x = links, y = oben, z = vorne) */
  private rot(name: string, axis: Vector3, ang: number): void {
    if (Math.abs(ang) < 1e-4) return;
    const b = this.bones.get(name);
    if (!b || !b.parent) return;
    this.touch(b);
    const pq = b.parent.getWorldQuaternion(_q1);
    _v1.copy(axis).applyQuaternion(this.root.quaternion);
    _q2.setFromAxisAngle(_v1, ang);
    // lokal' = P⁻¹ · Δ · P · lokal
    const inv = pq.clone().invert();
    b.quaternion.premultiply(pq).premultiply(_q2).premultiply(inv);
    b.updateMatrixWorld(true);
  }

  /**
   * Knochen so drehen, dass er (vom Gelenk zum Kind-Gelenk) in eine Richtung im Figurenraum zeigt.
   * Unabhängig von der Ausgangspose (die Idle-Animation steht z. B. leicht schräg).
   */
  private aim(name: string, child: string, dir: Vector3, k: number): void {
    this.aimWorld(name, child, _v4.copy(dir).applyQuaternion(this.root.quaternion), k);
  }

  /** wie aim(), Richtung in Weltkoordinaten */
  private aimWorld(name: string, child: string, worldDir: Vector3, k: number): void {
    if (k < 1e-3) return;
    const b = this.bones.get(name);
    const c = this.bones.get(child);
    if (!b || !c || !b.parent) return;
    this.touch(b);
    const p0 = b.getWorldPosition(_v1);
    const cur = c.getWorldPosition(_v2).sub(p0).normalize();
    const target = _v3.copy(worldDir).normalize();
    _q3.setFromUnitVectors(cur, target);
    _q3.slerp(_q4.identity(), 1 - k);
    const pq = b.parent.getWorldQuaternion(_q1);
    const inv = _q2.copy(pq).invert();
    b.quaternion.premultiply(pq).premultiply(_q3).premultiply(inv);
    b.updateMatrixWorld(true);
  }

  private addDangle(obj: Object3D, k: number, gain: number, hang: boolean): void {
    this.dangles.push({
      obj,
      rest: obj.quaternion.clone(),
      prev: obj.getWorldPosition(new Vector3()),
      vel: new Vector3(),
      ang: new Vector3(),
      angVel: new Vector3(),
      k,
      gain,
      hang,
    });
  }

  /**
   * Nachschwingen: Beschleunigung des Aufhängepunkts lenkt eine gedämpfte Feder aus (Quasten, lange Haare).
   * Quasten hängen zusätzlich immer nach unten, auch wenn sich die Hüfte beim Sitzen dreht.
   */
  private swing(dt: number): void {
    if (dt <= 0) return;
    const inv = _q1.copy(this.root.quaternion).invert();
    for (const d of this.dangles) {
      const p = d.obj.getWorldPosition(_v1);
      const vel = _v2.copy(p).sub(d.prev).divideScalar(dt);
      const acc = _v3.copy(vel).sub(d.vel).divideScalar(dt).applyQuaternion(inv);
      d.prev.copy(p);
      d.vel.copy(vel);
      // Zielauslenkung: gegen die Beschleunigung (vorne/hinten → Drehung um x, seitlich → um z)
      const tx = Math.max(-0.9, Math.min(0.9, acc.z * d.gain));
      const tz = Math.max(-0.9, Math.min(0.9, -acc.x * d.gain));
      d.angVel.x += ((tx - d.ang.x) * d.k - d.angVel.x * Math.sqrt(d.k) * 1.2) * dt;
      d.angVel.z += ((tz - d.ang.z) * d.k - d.angVel.z * Math.sqrt(d.k) * 1.2) * dt;
      d.ang.x += d.angVel.x * dt;
      d.ang.z += d.angVel.z * dt;
      d.obj.quaternion.copy(d.rest);
      if (d.hang && d.obj.parent) {
        // nach unten ausrichten (Lot) …
        d.obj.updateMatrixWorld(true);
        const wq = d.obj.getWorldQuaternion(_q2);
        const down = _v4.set(0, -1, 0).applyQuaternion(wq);
        _q3.setFromUnitVectors(down, _v1.set(0, -1, 0));
        const pq = d.obj.parent.getWorldQuaternion(_q4);
        d.obj.quaternion.premultiply(pq).premultiply(_q3).premultiply(pq.clone().invert());
      }
      // … und auslenken (um Achsen im Figurenraum)
      const pq = d.obj.parent!.getWorldQuaternion(_q4);
      _q3.setFromAxisAngle(_v1.copy(X).applyQuaternion(this.root.quaternion), d.ang.x);
      _q2.setFromAxisAngle(_v2.copy(Z).applyQuaternion(this.root.quaternion), d.ang.z);
      d.obj.quaternion.premultiply(pq).premultiply(_q3).premultiply(_q2).premultiply(pq.clone().invert());
    }
  }

  /**
   * Fuß-IK auf unebenem Boden (Stufen, Brücke): Becken senkt sich zum tieferen Fuß, der höhere Fuß wird mit
   * zwei Gelenken (Hüfte, Knie) angehoben, das Knie zeigt dabei in die bisherige Richtung.
   */
  private footIK(): void {
    const base = this.root.position.y;
    const d: number[] = [];
    for (const s of ['L', 'R']) {
      const f = this.bones.get(`Foot${s}`);
      if (!f) return;
      f.getWorldPosition(_t);
      d.push(groundY(_t.x, _t.z) - base);
    }
    if (Math.abs(d[0]!) < 0.015 && Math.abs(d[1]!) < 0.015) return;
    const drop = Math.max(-0.25, Math.min(0, d[0]!, d[1]!));
    this.model.position.y += drop;
    this.root.updateMatrixWorld(true);
    ['L', 'R'].forEach((s, i) => {
      const lift = Math.min(0.3, d[i]! - drop);
      if (lift < 0.01) return;
      const up = this.bones.get(`UpperLeg${s}`)!;
      const lo = this.bones.get(`LowerLeg${s}`)!;
      const end = this.bones.get(`LowerLeg${s}_end`)!;
      const foot = this.bones.get(`Foot${s}`)!;
      up.getWorldPosition(_h);
      lo.getWorldPosition(_k);
      end.getWorldPosition(_e);
      const a = _h.distanceTo(_k);
      const b = _k.distanceTo(_e);
      _t.copy(_e).y += lift;
      const dir = _v4.copy(_t).sub(_h);
      const dist = Math.min(a + b - 1e-3, Math.max(0.05, dir.length()));
      dir.normalize();
      // Knie-Richtung: bisherige Knie-Auslenkung senkrecht zur Hüfte-Fuß-Linie, sonst nach vorn
      const pole = _k.clone().sub(_h);
      pole.addScaledVector(dir, -pole.dot(dir));
      if (pole.lengthSq() < 1e-6) pole.copy(Z).applyQuaternion(this.root.quaternion);
      pole.normalize();
      const x = (a * a - b * b + dist * dist) / (2 * dist);
      const hk = Math.sqrt(Math.max(0, a * a - x * x));
      const knee = _h.clone().addScaledVector(dir, x).addScaledVector(pole, hk);
      this.aimWorld(`UpperLeg${s}`, `LowerLeg${s}`, knee.clone().sub(_h), 1);
      const kneeNow = lo.getWorldPosition(new Vector3());
      this.aimWorld(`LowerLeg${s}`, `LowerLeg${s}_end`, _t.clone().sub(kneeNow), 1);
      this.touch(foot);
      foot.getWorldPosition(_v2);
      _v2.y += lift;
      foot.position.copy(foot.parent!.worldToLocal(_v2));
      foot.updateMatrixWorld(true);
    });
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    for (const [a, s] of this.actions) {
      s.t += dt;
      const ending = s.stopping || (!s.loop && s.t > s.dur - 0.25);
      s.w = Math.max(0, Math.min(1, s.w + (ending ? -dt : dt) * 5));
      if (ending && s.w <= 0) {
        this.actions.delete(a);
        if (a === 'drink') this.showProp('cup', false);
        this.clipActs.get(a)?.stop();
      }
    }
    this.sit += (this.sitTarget - this.sit) * Math.min(1, dt * 4);
    const sitK = this.sit;
    this.stoopSmooth += (this.stoop - this.stoopSmooth) * Math.min(1, dt * 4);

    // ── Bewegungs-Mischung nach Geschwindigkeit, Abspieltempo passend zur Bodengeschwindigkeit
    const sp = this.speed * (1 - sitK);
    const walkNat = this.A.walkSpeed * this.S;
    const runNat = this.A.runSpeed * this.S;
    // Drehrate (rad/s), geglättet
    let dyaw = this.root.rotation.y - this.lastYaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    this.lastYaw = this.root.rotation.y;
    if (dt > 0) this.yawRate += (dyaw / dt - this.yawRate) * Math.min(1, dt * 8);
    // Zielgewichte, dann weich nachführen (kein Springen beim Anlaufen und Stoppen)
    const f = Math.min(1, dt * 9);
    this.wMove += (smoothstep(0.05, 0.5, sp) - this.wMove) * f;
    this.wRun += (smoothstep(walkNat * 1.15, runNat * 0.85, sp) - this.wRun) * f;
    // Drehen im Stand: kleine Trippelschritte
    const stepT = sp < 0.3 && sitK < 0.1 ? smoothstep(0.8, 2.5, Math.abs(this.yawRate)) * 0.55 : 0;
    this.wStep += (stepT - this.wStep) * Math.min(1, dt * 6);
    const wMove = Math.max(this.wMove, this.wStep);
    const wRun = this.wRun;
    let clipW = 0;
    for (const [a, act] of this.clipActs) clipW = Math.max(clipW, this.w(a) * (act.isRunning() ? 1 : 0));
    for (const [a, act] of this.clipActs) act.setEffectiveWeight(this.w(a));
    const free = 1 - clipW;
    // Idle-Varianten gelegentlich wechseln (weiche Überblendung, nie alle gleichzeitig)
    this.idleSwap -= dt;
    if (this.idleSwap < 0) {
      this.idleSwap = 8 + Math.random() * 14;
      this.idleTarget = this.idleTarget > 0.5 ? 0 : 1;
    }
    this.idleMix += (this.idleTarget - this.idleMix) * Math.min(1, dt * 1.2);
    this.loco.idle.setEffectiveWeight((1 - wMove) * free * (1 - this.idleMix));
    this.loco.idle2.setEffectiveWeight((1 - wMove) * free * this.idleMix);
    this.loco.walk.setEffectiveWeight(wMove * (1 - wRun) * free);
    this.loco.run.setEffectiveWeight(wMove * wRun * free);
    this.loco.walk.timeScale = Math.min(1.8, Math.max(0.55, sp / walkNat, this.wStep * 1.2));
    this.loco.run.timeScale = Math.min(1.6, Math.max(0.7, sp / runNat));
    // Gehen und Laufen im gleichen Schritt halten (weicher Übergang)
    if (wRun > 0 && wRun < 1) {
      const ph = this.loco.walk.time / this.loco.walk.getClip().duration;
      this.loco.run.time = ph * this.loco.run.getClip().duration;
    }
    for (const [b, s] of this.touched) {
      b.quaternion.copy(s.q);
      b.position.copy(s.p);
    }
    this.touched.clear();
    this.mixer.update(dt);
    this.root.updateMatrixWorld(true);

    // ── Prozedurale Schicht
    this.procedural(dt, t, sitK, sp);

    // ── Gesicht
    this.blink -= dt;
    let lid = 0;
    if (this.blink < 0.14) lid = 1 - Math.abs(this.blink - 0.07) / 0.07;
    if (this.blink < 0) this.blink = 2.2 + Math.random() * 4;
    const laugh = this.w('laugh');
    lid = Math.max(lid, laugh * 0.6);
    for (const e of this.eyes)
      if (e.morphTargetInfluences) e.morphTargetInfluences[0] = Math.max(0, Math.min(1, lid));
    const browUp = Math.max(laugh, this.talkSmooth * 0.5 * (0.5 + 0.5 * Math.sin(t * 3 + this.seed)));
    for (const b of this.brows) if (b.morphTargetInfluences) b.morphTargetInfluences[0] = browUp;
    this.talkSmooth += (this.talk - this.talkSmooth) * Math.min(1, dt * 18);
    // Mund klappt pro Silbe auf und von selbst wieder zu
    this.talk = Math.max(0, this.talk - dt * 7);
    const open = Math.max(this.talkSmooth, laugh * (0.6 + Math.abs(Math.sin(t * 16)) * 0.4));
    this.mouthOpen.scale.y = 0.08 + open * 0.3;
    this.mouthOpen.visible = this.detail && open > 0.05;
    this.mouth.visible = this.detail && open < 0.4;
  }

  private procedural(dt: number, t: number, sitK: number, sp: number): void {
    const w = (a: Action): number => this.w(a);
    // Gewichtsverlagerung im Stehen (langsam, je Figur anders)
    const still = (1 - Math.min(1, sp)) * (1 - sitK);
    if (still > 0.01) {
      this.rot('Body', Z, Math.sin(t * 0.37 + this.seed) * 0.022 * still);
      this.rot('Torso', Y, Math.sin(t * 0.23 + this.seed * 2) * 0.05 * still);
    }
    // Sprechgesten: beim Reden Hände öffnen, mal links, mal rechts, dazu leichtes Nicken
    if (this.talkSmooth > 0.2) this.talkHold = 1.2;
    this.talkHold -= dt;
    let busy = 0;
    for (const s of this.actions.values()) busy = Math.max(busy, s.w);
    const gTarget = this.talkHold > 0 && sp < 0.3 ? 1 - busy : 0;
    this.gest += (gTarget - this.gest) * Math.min(1, dt * 3);
    this.gestTimer -= dt;
    if (this.gestTimer < 0) {
      this.gestTimer = 1.2 + Math.random() * 1.4;
      this.gestPose = {
        side: Math.random() < 0.35 ? 0 : Math.random() < 0.5 ? 1 : -1,
        lift: Math.random(),
        open: Math.random(),
      };
    }
    if (this.gest > 0.01) {
      const g = this.gest;
      const gp = this.gestPose;
      for (const [s, dir] of [
        ['L', 1],
        ['R', -1],
      ] as const) {
        if (gp.side !== 0 && gp.side !== dir) continue;
        const k = g * (0.6 + 0.4 * Math.sin(t * 2.3 + dir));
        this.rot(`UpperArm${s}`, X, -(0.25 + 0.3 * gp.lift) * k);
        this.rot(`UpperArm${s}`, Z, dir * 0.15 * gp.open * k);
        this.rot(`LowerArm${s}`, X, -(0.7 + 0.4 * gp.lift) * k);
      }
      this.rot('Head', X, Math.sin(t * 5.5) * 0.04 * this.talkSmooth);
    }
    // Kurvenneigung: Oberkörper neigt sich in die Kurve, stärker beim Laufen
    const lean = Math.max(-0.22, Math.min(0.22, -this.yawRate * sp * 0.045));
    if (Math.abs(lean) > 0.002) {
      this.rot('Torso', Z, lean);
      this.rot('Neck', Z, -lean * 0.5);
    }
    // Atmen
    const breath = Math.sin(t * 1.7 + this.seed) * 0.018 * (1 - Math.min(1, sp));
    this.rot('Chest', X, -breath);
    // Sitzen: Oberschenkel nach vorn, Unterschenkel nach unten, Körper auf Sitzhöhe
    if (sitK > 0.001) {
      for (const s of ['L', 'R']) {
        this.aim(`UpperLeg${s}`, `LowerLeg${s}`, s === 'L' ? THIGH_L : THIGH_R, sitK);
        this.aim(`LowerLeg${s}`, `LowerLeg${s}_end`, SHIN, sitK);
      }
      this.rot('Torso', X, -0.05 * sitK);
    }
    const hipH = this.A.rest.hipY * this.S;
    this.model.position.y = -Math.max(0, hipH - (this.seatH + 0.1)) * sitK;
    // Bücken (Türbalken) und Ducken
    const duck = Math.max(this.stoopSmooth, w('duck'));
    if (duck > 0.001) {
      this.rot('Torso', X, 0.45 * duck);
      this.rot('Neck', X, 0.2 * duck);
      for (const s of ['L', 'R']) {
        this.rot(`UpperLeg${s}`, X, -0.35 * duck);
        this.rot(`LowerLeg${s}`, X, 0.7 * duck);
      }
      this.model.position.y -= 0.12 * duck;
    }
    // Gesten
    let k: number;
    if ((k = w('nod'))) this.rot('Head', X, 0.22 * k * (0.5 + 0.5 * Math.sin(t * 9)));
    if ((k = w('bow'))) {
      this.rot('Torso', X, 0.55 * k);
      this.rot('Chest', X, 0.15 * k);
      this.rot('Head', X, 0.15 * k);
    }
    if ((k = w('laugh'))) {
      this.rot('Chest', X, -0.14 * k + Math.sin(t * 22) * 0.03 * k);
      this.rot('Head', X, -0.2 * k);
    }
    if ((k = w('drink'))) {
      this.rot('UpperArmR', X, -0.7 * k);
      this.rot('UpperArmR', Y, 0.75 * k);
      this.rot('LowerArmR', X, -1.95 * k);
      this.rot('LowerArmR', Y, 0.4 * k);
      this.rot('Head', X, -0.12 * k * (0.5 + 0.5 * Math.sin(t * 2)));
    }
    if ((k = w('pour'))) {
      this.rot('UpperArmR', X, -0.85 * k);
      this.rot('LowerArmR', X, -0.5 * k);
      this.rot('WristR', Z, 0.5 * k * (0.5 + 0.5 * Math.sin(t * 2)));
    }
    if ((k = w('polish'))) {
      for (const [s, dir] of [
        ['L', 1],
        ['R', -1],
      ] as const) {
        this.rot(`UpperArm${s}`, X, -0.75 * k);
        this.rot(`UpperArm${s}`, Y, -dir * 0.4 * k);
        this.rot(`LowerArm${s}`, X, -0.95 * k + Math.sin(t * 5 + (dir > 0 ? 0 : 1.6)) * 0.15 * k);
      }
    }
    if ((k = w('write'))) {
      this.rot('Torso', X, 0.15 * k);
      this.rot('UpperArmR', X, -0.6 * k);
      this.rot('LowerArmR', X, -0.9 * k + Math.sin(t * 7) * 0.08 * k);
      this.rot('LowerArmR', Y, Math.sin(t * 3.3) * 0.12 * k);
    }
    if ((k = w('fan'))) {
      this.rot('UpperArmR', X, -0.55 * k);
      this.rot('LowerArmR', X, -1.6 * k);
      this.rot('LowerArmR', Z, Math.sin(t * 9) * 0.35 * k);
    }
    if ((k = w('play'))) {
      const reach = 0.5 + 0.5 * Math.sin(t * 2.2);
      this.rot('Torso', X, 0.25 * k);
      this.rot('UpperArmR', X, -(0.6 + 0.4 * reach) * k);
      this.rot('LowerArmR', X, -0.5 * k);
    }
    if ((k = w('think'))) {
      this.rot('UpperArmR', X, -0.5 * k);
      this.rot('LowerArmR', X, -2.2 * k);
      this.rot('Head', Z, 0.12 * k);
    }
    if ((k = w('point'))) this.rot('UpperArmR', X, -1.3 * k);
    if ((k = w('shrug'))) {
      this.rot('UpperArmL', Z, 0.35 * k);
      this.rot('UpperArmR', Z, -0.35 * k);
      this.rot('LowerArmL', X, -1.1 * k);
      this.rot('LowerArmR', X, -1.1 * k);
      this.rot('Head', Z, 0.15 * k);
    }
    if ((k = w('clap'))) {
      const c = Math.sin(t * 14) * 0.2;
      for (const [s, dir] of [
        ['L', 1],
        ['R', -1],
      ] as const) {
        this.rot(`UpperArm${s}`, X, -0.85 * k);
        this.rot(`UpperArm${s}`, Y, -dir * (0.55 + c) * k);
        this.rot(`LowerArm${s}`, X, -0.9 * k);
      }
    }
    if ((k = w('spin'))) {
      this.rot('UpperArmR', X, -2.5 * k);
      this.rot('LowerArmR', X, -0.3 * k);
    }
    if ((k = w('pet'))) {
      this.rot('Torso', X, 0.6 * k);
      this.rot('UpperArmR', X, -0.7 * k);
      for (const s of ['L', 'R']) {
        this.rot(`UpperLeg${s}`, X, -0.5 * k);
        this.rot(`LowerLeg${s}`, X, 1.0 * k);
      }
      this.model.position.y -= 0.18 * k;
    }
    if ((k = w('hop'))) this.model.position.y += Math.abs(Math.sin(t * 10)) * 0.08 * k;
    // Ball unter dem Arm: linken Arm leicht abspreizen
    if (this.hasBall && !w('spin')) {
      this.rot('UpperArmL', Z, 0.42);
      this.rot('LowerArmL', X, -0.45);
    }
    // Blick: Hals und Kopf drehen sich zum Ziel (begrenzt, weich)
    let ty = 0;
    let tp = 0;
    if (this.lookTarget) {
      const hp = this.headWorld(_v2);
      _v1.copy(this.lookTarget).sub(hp);
      _v1.applyQuaternion(_q1.copy(this.root.quaternion).invert());
      ty = Math.atan2(_v1.x, _v1.z);
      tp = Math.atan2(_v1.y, Math.hypot(_v1.x, _v1.z));
      if (Math.abs(ty) > 1.9) ty = 0;
      ty = Math.max(-1.1, Math.min(1.1, ty));
      tp = Math.max(-0.45, Math.min(0.45, tp));
    }
    // In Kurven führt der Blick (Kopf dreht schon in die neue Richtung)
    if (sp > 0.2) ty = Math.max(-0.7, Math.min(0.7, ty + this.yawRate * 0.18));
    const f = Math.min(1, dt * 5);
    this.lookYaw += (ty - this.lookYaw) * f;
    this.lookPitch += (tp - this.lookPitch) * f;
    this.rot('Neck', Y, this.lookYaw * 0.4);
    this.rot('Head', Y, this.lookYaw * 0.6);
    this.rot('Head', X, -this.lookPitch * 0.8);
    if (sitK < 0.05 && this.detail) this.footIK();
    if (this.detail) this.swing(dt);
    // Füße folgen den gebeugten Beinen (die Fußknochen hängen am Wurzelknochen)
    if (sitK > 0.001 || duck > 0.001 || w('pet') > 0.001) {
      for (const s of ['L', 'R']) {
        const foot = this.bones.get(`Foot${s}`);
        const end = this.bones.get(`LowerLeg${s}_end`);
        if (!foot || !end || !foot.parent) continue;
        end.getWorldPosition(_v1);
        foot.getWorldPosition(_v2);
        const k2 = Math.max(sitK, duck, w('pet'));
        _v2.lerp(_v1, k2);
        this.touch(foot);
        foot.position.copy(foot.parent.worldToLocal(_v2));
        foot.updateMatrixWorld(true);
      }
    }
    void _m;
  }
}

export type { MeshStandardMaterial };
