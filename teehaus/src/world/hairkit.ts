// Haar- und Augenbrauen-Modelle aus public/charaktere/haare.glb (Quaternius, CC0, Meshopt-komprimiert).
// Die Teile sind für einen realistischen Kopf modelliert; hier werden sie auf die stilisierten Köpfe der Figuren
// eingepasst (Maßstab und Lage relativ zum Schädel) und in der Haarfarbe der Figur eingefärbt.
import { BufferAttribute, BufferGeometry, Mesh, MeshStandardMaterial, Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export type HairPiece =
  | 'Eyebrows_Female'
  | 'Eyebrows_Regular'
  | 'Hair_Beard'
  | 'Hair_Buns'
  | 'Hair_Buzzed'
  | 'Hair_BuzzedFemale'
  | 'Hair_Long'
  | 'Hair_SimpleParted';

export interface HairPart {
  geo: BufferGeometry;
  map: Texture | null;
  normalMap: Texture | null;
}

/**
 * Bezugsschädel der Modelle (Meter): Mitte und Halbachsen, aus Hair_Buzzed abgeleitet. Ein echter Schädel ist
 * tiefer als breit; geteilt durch die Halbachsen wird daraus ungefähr eine Einheitskugel wie bei unseren Köpfen.
 */
export const REF_HEAD = { y: 1.698, z: -0.0125, rx: 0.0775, ry: 0.116, rz: 0.0955 };

/** Quantisierte Attribute (int16/int8) in Float32 umwandeln, damit Transformationen nicht abgeschnitten werden */
function toFloat(src: BufferGeometry): BufferGeometry {
  const geo = new BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'tangent'] as const) {
    const a = src.getAttribute(name);
    if (!a) continue;
    const arr = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++)
      for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = a.getComponent(i, k);
    geo.setAttribute(name, new BufferAttribute(arr, a.itemSize));
  }
  if (src.index) geo.setIndex(src.index.clone());
  return geo;
}

const FEMALE = new Set(['Hair_Buns', 'Hair_Long', 'Hair_BuzzedFemale', 'Eyebrows_Female']);
const FEMALE_DY = -0.043;

let kit: Map<HairPiece, HairPart> | null = null;

export function hairKit(): Map<HairPiece, HairPart> | null {
  return kit;
}

/** Lädt die Teile einmal. Schlägt das fehl, bleiben die Figuren bei ihren gezeichneten Frisuren. */
export async function loadHairKit(url = `${import.meta.env.BASE_URL}charaktere/haare.glb`): Promise<void> {
  if (kit) return;
  try {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(url);
    const map = new Map<HairPiece, HairPart>();
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const geo = toFloat(m.geometry);
      geo.applyMatrix4(m.matrixWorld);
      // in den Bezugsschädel verschieben: Ursprung = Kopfmitte, Einheit = Schädelradius
      // Die Frauen-Teile sind für die kleinere Grundfigur gebaut (Kopf ~4,3 cm tiefer)
      const dy = FEMALE.has(o.name) ? FEMALE_DY : 0;
      geo.translate(0, -(REF_HEAD.y + dy), -REF_HEAD.z);
      geo.scale(1 / REF_HEAD.rx, 1 / REF_HEAD.ry, 1 / REF_HEAD.rz);
      geo.computeBoundingSphere();
      const mat = m.material as MeshStandardMaterial;
      map.set(o.name as HairPiece, { geo, map: mat.map, normalMap: mat.normalMap });
    });
    kit = map;
  } catch (e) {
    console.warn('Haarmodelle nicht geladen, nutze gezeichnete Frisuren', e);
  }
}
