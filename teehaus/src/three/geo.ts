// Kleine Helfer für Low-Poly-Geometrie mit Farbe je Dreieck; viele Teile werden zu einem Mesh verschmolzen
// (ein Draw-Call pro Bauwerk statt eines pro Balken).
import { BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './noise';

export function colored(g: BufferGeometry, color: string, jitter = 0.08, seed = 1): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  geo.deleteAttribute('uv');
  const n = geo.attributes.position!.count;
  const c = new Color(color);
  const r = rng(seed);
  const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) {
    const k = 1 + (r() - 0.5) * jitter * 2;
    for (let v = 0; v < 3; v++) cols.set([c.r * k, c.g * k, c.b * k], (i + v) * 3);
  }
  geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
  return geo;
}

export const T = (
  g: BufferGeometry,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  ry = 0,
): BufferGeometry => g.scale(sx, sy, sz).rotateY(ry).translate(x, y, z);

/** Sammelt farbige Teile und verschmilzt sie zu einem Mesh */
export class Baker {
  private parts: BufferGeometry[] = [];
  private seed = 1;
  add(g: BufferGeometry, color: string, jitter = 0.06): this {
    this.parts.push(colored(g, color, jitter, this.seed++));
    return this;
  }
  get empty(): boolean {
    return this.parts.length === 0;
  }
  mesh(mat?: MeshStandardMaterial): Mesh {
    const geo = mergeGeometries(this.parts)!;
    geo.computeBoundingSphere();
    const m = new Mesh(geo, mat ?? BAKED);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
}

/** Gemeinsames Material für verschmolzene Bauwerke */
export const BAKED = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
