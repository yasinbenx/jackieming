// Fluss, Bäche und die Wasserflächen der Reisterrassen. Bänder entlang der Linienzüge mit einem leichten
// Fließmuster im Shader (keine Spiegelung: die bleibt dem Teich vorbehalten).
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { SHARED } from './shared';
import {
  polyAt,
  polyLength,
  RIVER,
  RIVER_HALF,
  RIVER_LEVEL,
  STREAM_HALF,
  STREAM_IN,
  STREAM_OUT,
  TERRACES,
} from '../world/map';
import type { P2 } from '../world/map';
import { field, streamLevel, terraceK } from '../world/terrain';

function waterMat(color: string, speed: number, opacity: number): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color,
    roughness: 0.12,
    metalness: 0.15,
    transparent: true,
    opacity,
    depthWrite: false,
    side: DoubleSide,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aFlow;\nvarying vec2 vFlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlow = aFlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vFlow;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float across = vFlow.x;
        float s1 = sin(vFlow.y * 0.9 - uTime * ${(1.6 * speed).toFixed(2)} + sin(across * 5.0 + vFlow.y * 0.13) * 1.4);
        float s2 = sin(vFlow.y * 2.3 - uTime * ${(2.7 * speed).toFixed(2)} + across * 9.0);
        float streak = smoothstep(0.82, 1.0, s1) * 0.10 + smoothstep(0.9, 1.0, s2) * 0.07;
        float edge = smoothstep(0.62, 1.0, abs(across));
        diffuseColor.rgb += vec3(streak) * (1.0 - edge * 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.25 + vec3(0.04, 0.05, 0.03), edge);
        diffuseColor.a *= 1.0 - smoothstep(0.9, 1.0, abs(across)) * 0.6;`,
      );
  };
  m.customProgramCacheKey = () => `flow-${speed}`;
  return m;
}

/** Band entlang eines Linienzugs; y(t) liefert den Wasserspiegel */
function ribbon(pts: readonly P2[], half: number, y: (t: number) => number, step = 1.5): BufferGeometry {
  const len = polyLength(pts);
  const n = Math.max(2, Math.ceil(len / step));
  const pos: number[] = [];
  const flow: number[] = [];
  const idx: number[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const q = polyAt(pts, t);
    // Richtung geglättet (Mittel aus Nachbarn), damit an Knicken keine Falten entstehen
    const a = polyAt(pts, Math.max(0, t - 1.5 / len));
    const b = polyAt(pts, Math.min(1, t + 1.5 / len));
    let dx = b.x - a.x;
    let dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    const yy = y(t);
    pos.push(q.x + dz * half, yy, q.z - dx * half, q.x - dz * half, yy, q.z + dx * half);
    flow.push(-1, t * len, 1, t * len);
    if (k < n) {
      const i = k * 2;
      idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new Float32BufferAttribute(flow, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Normalen fest nach oben (Wasser ist flach, auch beim Gefälle der Bäche)
  const nrm = g.attributes.normal!;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  return g;
}

/** Wasserflächen der Reisterrassen: 1-m-Zellen, deren Ecken auf derselben Stufe liegen */
function paddies(): BufferGeometry {
  const f = field();
  const T = TERRACES;
  const pos: number[] = [];
  const flow: number[] = [];
  const s = T.step;
  for (let z = Math.floor(T.z - T.rz); z < T.z + T.rz; z++) {
    for (let x = Math.floor(T.x - T.rx); x < T.x + T.rx; x++) {
      if (terraceK(x + 0.5, z + 0.5) < 0.85) continue;
      const hs = [f.at(x, z), f.at(x + 1, z), f.at(x, z + 1), f.at(x + 1, z + 1)];
      const lv = Math.floor(hs[0]! / s);
      if (hs.some((h) => Math.floor(h / s) !== lv || h / s - lv > 0.8)) continue;
      const y = Math.max(...hs) + 0.06;
      pos.push(x, y, z, x, y, z + 1, x + 1, y, z, x + 1, y, z, x, y, z + 1, x + 1, y, z + 1);
      for (let k = 0; k < 6; k++) flow.push(0, 0);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new Float32BufferAttribute(flow, 2));
  g.setAttribute(
    'normal',
    new Float32BufferAttribute(
      pos.map((_, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  );
  return g;
}

export function buildWaterways(): Group {
  const g = new Group();
  g.name = 'waterways';
  const river = new Mesh(
    ribbon(RIVER, RIVER_HALF + 0.9, () => RIVER_LEVEL, 2),
    waterMat('#3d6f70', 1, 0.9),
  );
  river.name = 'river';
  river.receiveShadow = true;
  const streamMat = waterMat('#4a7e78', 1.8, 0.85);
  const s1 = new Mesh(
    ribbon(STREAM_IN, STREAM_HALF + 0.35, (t) => streamLevel(0, t) + 0.02, 0.8),
    streamMat,
  );
  const s2 = new Mesh(
    ribbon(STREAM_OUT, STREAM_HALF + 0.35, (t) => streamLevel(1, t) + 0.02, 0.8),
    streamMat,
  );
  s1.receiveShadow = s2.receiveShadow = true;
  const pad = new Mesh(paddies(), waterMat('#7c9c86', 0.2, 0.75));
  (pad.material as MeshStandardMaterial).emissive = new Color('#1a2a26');
  pad.name = 'paddies';
  g.add(river, s1, s2, pad);
  return g;
}
