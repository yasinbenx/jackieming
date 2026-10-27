// Ein entferntes Objekt freigeben: Geometrien, Materialien und Texturen, die sonst niemand in der Szene mehr
// benutzt. Geteilte Teile bleiben (deren Freigabe würde andere Figuren zum erneuten Hochladen oder Übersetzen
// zwingen – das wäre ein Ruckler).
import type { BufferGeometry, Material, Object3D, Skeleton, Texture } from 'three';

interface Res {
  geometry?: BufferGeometry;
  material?: Material | Material[];
}

function collect(root: Object3D, geos: Set<BufferGeometry>, mats: Set<Material>): void {
  root.traverse((o) => {
    const r = o as Object3D & Res;
    if (r.geometry) geos.add(r.geometry);
    const m = r.material;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) mats.add(x);
  });
}

function textures(m: Material): Texture[] {
  return Object.values(m as unknown as Record<string, unknown>).filter(
    (v): v is Texture => !!(v as Texture | null)?.isTexture,
  );
}

/** Objekt (bereits aus der Szene genommen) freigeben, soweit nichts davon in `scene` noch gebraucht wird */
export function disposeUnshared(root: Object3D, scene: Object3D): { geometries: number; materials: number } {
  const geos = new Set<BufferGeometry>();
  const mats = new Set<Material>();
  collect(root, geos, mats);
  const usedGeos = new Set<BufferGeometry>();
  const usedMats = new Set<Material>();
  collect(scene, usedGeos, usedMats);
  const usedTex = new Set<Texture>();
  for (const m of usedMats) for (const t of textures(m)) usedTex.add(t);
  // Skelette animierter Teile (je eine Knochen-Textur auf der Grafikkarte), sofern nicht anderswo benutzt
  const usedSkel = new Set<Skeleton>();
  scene.traverse((o) => {
    const sk = (o as Object3D & { skeleton?: Skeleton }).skeleton;
    if (sk) usedSkel.add(sk);
  });
  root.traverse((o) => {
    const sk = (o as Object3D & { skeleton?: Skeleton }).skeleton;
    if (sk && !usedSkel.has(sk)) sk.dispose();
  });
  let g = 0;
  let n = 0;
  for (const geo of geos)
    if (!usedGeos.has(geo)) {
      geo.dispose();
      g++;
    }
  for (const m of mats)
    if (!usedMats.has(m)) {
      for (const t of textures(m)) if (!usedTex.has(t)) t.dispose();
      m.dispose();
      n++;
    }
  return { geometries: g, materials: n };
}
