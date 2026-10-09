// Rig-Assets: Quaternius-Figuren (CC0) mit gemeinsamem Skelett „CharacterArmature“ und 24 Animationen.
// Beim Laden werden die kantigen Low-Poly-Flächen geglättet (weiche Normalen), Stickerei-Koordinaten (UV) für
// Jacken, Ärmel und Hosen berechnet und die Ruhemaße des Skeletts sowie die natürliche Geh-/Laufgeschwindigkeit
// der Animationen ausgemessen (damit die Füße beim Gehen nicht rutschen).
import {
  AnimationClip,
  AnimationMixer,
  BufferAttribute,
  Group,
  Matrix4,
  Object3D,
  Quaternion,
  SkinnedMesh,
  Vector3,
} from 'three';
import type { Bone, BufferGeometry, Material, Mesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type RigBase = 'casual2' | 'casual' | 'suit' | 'king' | 'farmer' | 'worker' | 'adventurer' | 'beach';
export const RIG_BASES: RigBase[] = [
  'casual2',
  'casual',
  'suit',
  'king',
  'farmer',
  'worker',
  'adventurer',
  'beach',
];
export type RigPart = 'Head' | 'Body' | 'Legs' | 'Feet';

/** Ruhemaße des Skeletts (Meter, Welt-Ruhepose, Figur schaut nach +z) */
export interface RestInfo {
  hipY: number;
  waistY: number;
  neckY: number;
  headY: number;
  headTopY: number;
  shoulderX: number;
  armY: number;
  wristX: number;
  legX: number;
  kneeY: number;
  chestZ: number;
  /** Kopfmitte und Halbachsen (aus der Kopfhaut des Kopfteils) */
  head: { c: Vector3; r: Vector3 };
  /** Mundpunkt auf der Gesichtsoberfläche (die Modelle haben keinen Mund) */
  mouth: Vector3;
}

export interface RigAssets {
  bases: Map<RigBase, Group>;
  clips: Map<string, AnimationClip>;
  rest: RestInfo;
  /** natürliche Geschwindigkeit (m/s bei Originalgröße) der Geh- und Laufanimation */
  walkSpeed: number;
  runSpeed: number;
}

let assets: RigAssets | null = null;
let loading: Promise<RigAssets | null> | null = null;

export function rigAssets(): RigAssets | null {
  return assets;
}

/** Teil-Name aus dem Knotennamen (z. B. „Suit_Body_2“ → Body; Farmer_Pants → Legs) */
export function partOf(name: string): RigPart | null {
  if (/_Head/.test(name)) return 'Head';
  if (/_Body/.test(name)) return 'Body';
  if (/_Legs|_Pants/.test(name)) return 'Legs';
  if (/_Feet/.test(name)) return 'Feet';
  return null;
}

const smoothed = new WeakMap<BufferGeometry, BufferGeometry>();

/** Flächennormalen → weiche Normalen (gleiche Positionen zusammenführen, Skin-Daten bleiben erhalten) */
function smooth(geo: BufferGeometry): BufferGeometry {
  const hit = smoothed.get(geo);
  if (hit) return hit;
  const g = geo.clone();
  // quantisierte Attribute in Float32 umwandeln, sonst vergleicht mergeVertices ungenau
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name);
    if (name === 'skinIndex') continue;
    if (!(a.array instanceof Float32Array)) {
      const arr = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++)
        for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = a.getComponent(i, k);
      g.setAttribute(name, new BufferAttribute(arr, a.itemSize));
    }
  }
  g.deleteAttribute('normal');
  const merged = mergeVertices(g, 1e-4);
  merged.computeVertexNormals();
  smoothed.set(geo, merged);
  return merged;
}

/**
 * Stickerei-Koordinaten in Welt-Ruhepose: Rumpf als Zylinder um die Körperachse (u = 0 vorne, v = 0 an der
 * Taille), Ärmel als Zylinder um die Armachse (v = 0 am Handgelenk), Beine je Seite um die Beinachse.
 */
function addUv(geo: BufferGeometry, world: Matrix4, R: RestInfo, part: RigPart): void {
  const pos = geo.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  const v = new Vector3();
  const TAU = Math.PI * 2;
  const wrap = (a: number): number => (((a / TAU) % 1) + 1) % 1;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(world);
    let u: number;
    let w: number;
    const ax = Math.abs(v.x);
    if (part === 'Legs' || (part !== 'Body' && v.y < R.hipY)) {
      const cx = Math.sign(v.x || 1) * R.legX;
      u = wrap(Math.atan2(v.x - cx, v.z - R.chestZ));
      w = v.y / R.hipY;
    } else if (ax > R.shoulderX * 0.92) {
      u = 0.25 + 0.5 * wrap(Math.atan2(v.y - R.armY, v.z - R.chestZ));
      w = 1 - (ax - R.shoulderX * 0.92) / Math.max(0.1, R.wristX - R.shoulderX * 0.92);
    } else {
      u = wrap(Math.atan2(v.x, v.z - R.chestZ));
      w = (v.y - (R.waistY - 0.12)) / (R.neckY - R.waistY + 0.12);
    }
    uv[i * 2] = u;
    uv[i * 2 + 1] = Math.max(0, Math.min(1, w));
  }
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
}

function boneWorld(root: Object3D, name: string): Vector3 {
  const b = root.getObjectByName(name);
  return b ? b.getWorldPosition(new Vector3()) : new Vector3();
}

function measureRest(scene: Group): RestInfo {
  scene.updateMatrixWorld(true);
  const p = (n: string): Vector3 => boneWorld(scene, n);
  const hip = p('UpperLegL');
  const neck = p('Neck');
  const head = p('Head');
  const headEnd = p('Head_end');
  const arm = p('UpperArmL');
  const wrist = p('WristL');
  const knee = p('LowerLegL');
  const chest = p('Chest');
  // Kopfmitte/-maße aus den Hautvertices des Kopfteils
  const box = { min: new Vector3(1e9, 1e9, 1e9), max: new Vector3(-1e9, -1e9, -1e9) };
  const v = new Vector3();
  scene.traverse((o) => {
    const m = o as SkinnedMesh;
    if (!m.isSkinnedMesh || partOf(m.name) !== 'Head') return;
    if ((m.material as Material).name !== 'Skin') return;
    const pos = m.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (v.y < head.y - 0.02) continue; // Hals nicht mitzählen
      box.min.min(v);
      box.max.max(v);
    }
  });
  const c = box.min.clone().add(box.max).multiplyScalar(0.5);
  const r = box.max.clone().sub(box.min).multiplyScalar(0.5);
  // Mund: vorderster Hautpunkt in der Mitte, etwa auf 30 % der Kopfhöhe
  const mouthY = box.min.y + (box.max.y - box.min.y) * 0.3;
  let mouthZ = c.z;
  scene.traverse((o) => {
    const m = o as SkinnedMesh;
    if (!m.isSkinnedMesh || partOf(m.name) !== 'Head' || (m.material as Material).name !== 'Skin') return;
    const pos = m.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (Math.abs(v.x - c.x) < 0.02 && Math.abs(v.y - mouthY) < 0.015) mouthZ = Math.max(mouthZ, v.z);
    }
  });
  return {
    hipY: hip.y,
    waistY: hip.y + (neck.y - hip.y) * 0.22,
    neckY: neck.y,
    headY: head.y,
    headTopY: Math.max(headEnd.y, box.max.y),
    shoulderX: Math.abs(arm.x),
    armY: arm.y,
    wristX: Math.abs(wrist.x),
    legX: Math.abs(hip.x),
    kneeY: knee.y,
    chestZ: chest.z,
    head: { c, r },
    mouth: new Vector3(c.x, mouthY, mouthZ),
  };
}

/**
 * Nur Rotationen und wenige Positionen übernehmen: Position/Skalierung anderer Knochen würde die Körpertypen
 * (Schulterbreite, Beinlänge) überschreiben.
 */
function cleanClip(c: AnimationClip): AnimationClip {
  c.name = c.name.replace('CharacterArmature|', '');
  c.tracks = c.tracks.filter((t) => {
    if (t.name.endsWith('.quaternion')) return true;
    if (t.name.endsWith('.position')) return /^(Body|Foot[LR]|PT[LR])\./.test(t.name);
    return false;
  });
  return c;
}

/** Natürliche Bodengeschwindigkeit einer In-Place-Animation: wie schnell der Standfuß nach hinten gleitet */
function naturalSpeed(scene: Group, clip: AnimationClip): number {
  const mixer = new AnimationMixer(scene);
  const act = mixer.clipAction(clip);
  act.play();
  const foot = scene.getObjectByName('FootL')!;
  const steps = 60;
  const v = new Vector3();
  const ys: number[] = [];
  const zs: number[] = [];
  for (let i = 0; i <= steps; i++) {
    mixer.setTime((clip.duration * i) / steps);
    scene.updateMatrixWorld(true);
    foot.getWorldPosition(v);
    ys.push(v.y);
    zs.push(v.z);
  }
  act.stop();
  mixer.uncacheRoot(scene);
  // Standphase: Fuß nahe am tiefsten Punkt; dort gleitet er mit Bodengeschwindigkeit nach hinten
  const minY = Math.min(...ys);
  const dt = clip.duration / steps;
  const speeds: number[] = [];
  for (let i = 1; i <= steps; i++) {
    if (ys[i]! < minY + 0.02 && ys[i - 1]! < minY + 0.02) {
      const sp = (zs[i - 1]! - zs[i]!) / dt;
      if (sp > 0) speeds.push(sp);
    }
  }
  if (!speeds.length) return 0;
  // Mittelwert über die Standphase (der Median überschätzt bei kurzen Bodenkontakten im Laufen)
  return speeds.reduce((a, b) => a + b, 0) / speeds.length;
}

/** Lädt alle Figuren-Teile und Animationen einmal. Ohne Erfolg bleiben die gezeichneten Figuren. */
export function loadRig(base = new URL('charaktere/', document.baseURI).href): Promise<RigAssets | null> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const [anim, ...gltfs] = await Promise.all([
        loader.loadAsync(`${base}animationen.glb`),
        ...RIG_BASES.map((b) => loader.loadAsync(`${base}${b}.glb`)),
      ]);
      const bases = new Map<RigBase, Group>();
      gltfs.forEach((g, i) => bases.set(RIG_BASES[i]!, g.scene));
      const rest = measureRest(gltfs[0]!.scene);
      for (const scene of bases.values()) {
        scene.updateMatrixWorld(true);
        scene.traverse((o) => {
          const m = o as SkinnedMesh;
          if (!m.isSkinnedMesh) return;
          const part = partOf(m.name) ?? partOf(m.parent?.name ?? '') ?? 'Body';
          m.userData.part = part;
          const g = smooth(m.geometry);
          addUv(g, m.matrixWorld, rest, part);
          m.geometry = g;
          m.frustumCulled = false;
        });
      }
      const clips = new Map<string, AnimationClip>();
      for (const c of anim.animations) clips.set(cleanClip(c).name, c);
      const probe = gltfs[0]!.scene;
      const saved: [Bone, Vector3, Quaternion][] = [];
      probe.traverse((o) => {
        const b = o as Bone;
        if (b.isBone) saved.push([b, b.position.clone(), b.quaternion.clone()]);
      });
      const walk = clips.get('Walk');
      const run = clips.get('Run');
      const walkSpeed = walk ? naturalSpeed(probe, walk) || 1.4 : 1.4;
      const runSpeed = run ? naturalSpeed(probe, run) || 3.6 : 3.6;
      // Probe wieder in Ruhepose bringen
      for (const [b, p, q] of saved) {
        b.position.copy(p);
        b.quaternion.copy(q);
      }
      probe.updateMatrixWorld(true);
      assets = { bases, clips, rest, walkSpeed, runSpeed };
      (window as unknown as { __rig: unknown }).__rig = assets; // Test-Hilfe
      return assets;
    } catch (e) {
      console.warn('Rig-Figuren nicht geladen, nutze gezeichnete Figuren', e);
      return null;
    }
  })();
  return loading;
}

/** Hilfsfunktion: Objekt starr an einen Knochen hängen, sodass es in der Ruhepose bei `world` sitzt */
export function attachRigid(bone: Object3D, obj: Object3D, world: Matrix4): void {
  bone.updateWorldMatrix(true, false);
  const local = bone.matrixWorld.clone().invert().multiply(world);
  local.decompose(obj.position, obj.quaternion, obj.scale);
  bone.add(obj);
}

export type { Mesh };
