// Gemeinsame Konstanten und Helfer der 3D-Szene.
import { Color, Mesh, MeshStandardMaterial } from 'three';
import type { BufferGeometry, Material, Object3D } from 'three';

export const FONT_ZH = '"Noto Serif SC", "Songti SC", "SimSun", serif';
export const FONT_BRUSH = '"Ma Shan Zheng", "Noto Serif SC", "Kaiti SC", serif';

/** Oberkante des Teehausbodens (Meter) */
export const FLOOR = 0.5;
/** Teehaus-Grundriss: Pfosten bei x = ±HX, z = ±HZ */
export const HX = 3.4;
export const HZ = 2.7;
/** Teich (Ellipse) */
export const POND = { x: -1.2, z: 11, rx: 6.6, rz: 3.3 };

/** Geteilte Uniforms für Wind und Zeit in allen Shadern */
export const SHARED = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  /** Pixel pro Meter in 1 m Abstand (für Partikelgrößen), wird bei Größenänderung gesetzt */
  uPx: { value: 800 },
};

const matCache = new Map<string, MeshStandardMaterial>();
/** Low-Poly-Standardmaterial (flach schattiert), nach Farbe zwischengespeichert */
export function flat(
  color: string,
  opts: { rough?: number; metal?: number; emissive?: string } = {},
): MeshStandardMaterial {
  const key = `${color}|${opts.rough ?? 0.85}|${opts.metal ?? 0}|${opts.emissive ?? ''}`;
  let m = matCache.get(key);
  if (!m) {
    m = new MeshStandardMaterial({
      color: new Color(color),
      roughness: opts.rough ?? 0.85,
      metalness: opts.metal ?? 0,
      flatShading: true,
    });
    if (opts.emissive) m.emissive = new Color(opts.emissive);
    matCache.set(key, m);
  }
  return m;
}

export function mesh(
  geo: BufferGeometry,
  mat: Material,
  shadow: 'cast' | 'receive' | 'both' | 'none' = 'both',
): Mesh {
  const m = new Mesh(geo, mat);
  m.castShadow = shadow === 'cast' || shadow === 'both';
  m.receiveShadow = shadow === 'receive' || shadow === 'both';
  return m;
}

export function at<T extends Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

/**
 * Wind im Vertex-Shader: verschiebt Punkte abhängig von ihrer Höhe im Objekt (oben stärker).
 * Funktioniert auch mit InstancedMesh (Phase aus der Instanzposition).
 */
export function addWind(mat: Material, strength: number, heightScale: number): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED.uTime;
    shader.uniforms.uWind = SHARED.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 wPhase = vec3(0.0);
        #ifdef USE_INSTANCING
          wPhase = instanceMatrix[3].xyz;
        #endif
        float hk = max(0.0, transformed.y) / ${heightScale.toFixed(3)};
        hk = hk * hk;
        float sway = sin(uTime * 1.3 + wPhase.x * 0.7 + wPhase.z * 0.5) * 0.6 + sin(uTime * 2.7 + wPhase.x * 1.9) * 0.25;
        transformed.x += sway * hk * ${strength.toFixed(3)} * uWind;
        transformed.z += cos(uTime * 1.1 + wPhase.z) * hk * ${(strength * 0.4).toFixed(3)} * uWind;`,
      );
  };
  mat.customProgramCacheKey = () => `wind-${strength}-${heightScale}`;
}
