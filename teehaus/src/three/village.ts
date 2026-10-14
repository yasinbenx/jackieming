// Das Dorf in der Welt: alle Häuser, Marktstände, Mäuerchen und Zäune, pro Material zu wenigen Meshes
// verschmolzen (wenige Draw-Calls). Aus der Ferne ein einziges einfaches Mesh. Unsichtbare Quader halten die
// Kamera vor Wänden an.
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Batcher, M } from '../world/cafe';
import { BOARD_TABLE, FENCES, footprint, HOUSES, LOW_WALLS, spec, STALLS, toWorld } from '../world/village';
import { field } from '../world/terrain';
import { BAKED } from './geo';
import { addFence, addLowWall, buildHouse, buildStall, HOUSE_PAPER, LANTERN_MAT } from './houses';

export interface Village {
  group: Group;
  /** volle Häuser (nah) */
  hi: Group;
  /** einfache Formen (fern) */
  lo: Mesh;
  /** unsichtbare Kamera-Blocker */
  blockers: Mesh[];
  /** Detailstufe nach Kameraabstand; Papierfenster und Laternen nach Tageszeit */
  update(cam: Vector3, windowGlow: number, lantern: number): void;
  /** Abstand, bis zu dem die vollen Häuser gezeigt werden */
  range: number;
}

export const VILLAGE_CENTER = new Vector3(38, 0, 57);

export function buildVillage(range: number): Village {
  const f = field();
  const B = new Batcher();
  B.shadowless(HOUSE_PAPER);
  B.shadowless(LANTERN_MAT);
  const loParts: BufferGeometry[] = [];
  const blockers: Mesh[] = [];
  const blockMat = new MeshBasicMaterial({ visible: false });
  const group = new Group();
  group.name = 'village';

  const put = (g: Group, x: number, y: number, z: number, rot: number): void => {
    g.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      B.add(m.geometry, m.material as never, [x, y, z], [0, rot, 0]);
    });
  };

  for (const h of HOUSES) {
    const y = f.at(h.x, h.z);
    const model = buildHouse(spec(h.kind), h.seed);
    put(model.hi, h.x, y, h.z, h.rot);
    const lo = model.lo.geometry.clone();
    lo.applyMatrix4(
      new Matrix4().compose(
        new Vector3(h.x, y, h.z),
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), h.rot),
        new Vector3(1, 1, 1),
      ),
    );
    loParts.push(lo);
    // Kamera hält vor den Wänden an
    const eave = h.kind === 'gasthaus' ? 6.2 : h.kind === 'schreinchen' ? 3 : 3.6;
    for (const fp of footprint(h.kind)) {
      const [x, z] = toWorld(h, fp.x, fp.z);
      const m = new Mesh(new BoxGeometry(fp.hw * 2, eave, fp.hd * 2), blockMat);
      m.position.set(x, y + eave / 2, z);
      m.rotation.y = h.rot;
      m.updateMatrixWorld();
      blockers.push(m);
      group.add(m);
    }
  }
  STALLS.forEach((s, i) => put(buildStall(s.goods, i), s.x, f.at(s.x, s.z), s.z, s.rot));
  const ground = (x: number, z: number): number => f.at(x, z);
  for (const [x0, z0, x1, z1] of LOW_WALLS) addLowWall(B, x0, z0, x1, z1, ground);
  for (const [x0, z0, x1, z1] of FENCES) addFence(B, x0, z0, x1, z1, ground);

  // Steintisch mit Spielbrett und zwei Hockern für die Brettspieler
  {
    const t = BOARD_TABLE;
    const y = f.at(t.x, t.z);
    const stone = M.stone();
    B.add(new CylinderGeometry(0.42, 0.5, 0.7, 10), stone, [t.x, y + 0.35, t.z]);
    B.add(new CylinderGeometry(0.55, 0.55, 0.08, 12), stone, [t.x, y + 0.72, t.z]);
    B.add(new BoxGeometry(0.62, 0.03, 0.7), M.midWood(), [t.x, y + 0.775, t.z]);
    for (let i = 0; i < 10; i++) {
      const red = i % 2 === 0;
      B.add(new CylinderGeometry(0.035, 0.035, 0.025, 8), red ? M.lacquer() : M.darkWood(), [
        t.x - 0.22 + (i % 5) * 0.11,
        y + 0.8,
        t.z + (red ? -0.22 : 0.22) + (i % 3) * 0.02,
      ]);
    }
    for (const sx of [-0.85, 0.85])
      B.add(new CylinderGeometry(0.2, 0.24, 0.42, 9), stone, [t.x + sx, y + 0.21, t.z]);
  }

  const hi = B.build('village-hi');
  const lo = new Mesh(mergeGeometries(loParts)!, BAKED);
  lo.name = 'village-lo';
  lo.receiveShadow = true;
  lo.visible = false;
  group.add(hi, lo);

  let near = true;
  const v: Village = {
    group,
    hi,
    lo,
    blockers,
    range,
    update(cam, windowGlow, lantern) {
      const d = Math.hypot(cam.x - VILLAGE_CENTER.x, cam.z - VILLAGE_CENTER.z);
      // kleine Hysterese, damit es an der Grenze nicht flackert
      const want = near ? d < v.range + 8 : d < v.range;
      if (want !== near) {
        near = want;
        hi.visible = near;
        lo.visible = !near;
      }
      HOUSE_PAPER.emissiveIntensity = windowGlow;
      LANTERN_MAT.emissiveIntensity = lantern;
    },
  };
  return v;
}
