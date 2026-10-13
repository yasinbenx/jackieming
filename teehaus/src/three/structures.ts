// Bauwerke draußen: Brücken über Fluss und Bach, Steinlaternen, Tore, Schrein, Pavillon am Aussichtspunkt,
// Dorfplatz mit Brunnen, Bänke, Trittplatten und Stufen. Jedes Bauwerk wird zu einem Mesh verschmolzen.
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { Baker, colored } from './geo';
import { rand, rng } from './noise';
import { glowTexture } from './textures';
import { PATHS, place, polyAt, polyLength } from '../world/map';
import type { Crossing } from '../world/map';
import { deckAt, deckY, PAVILION, scatter, SHRINE, WELL } from '../world/scatter';
import type { Item } from '../world/scatter';
import { field, waterAt } from '../world/terrain';

const STONE = '#9c968a';
const STONE_D = '#857f74';
const RED = '#8f2a1c';
const WOOD = '#7a5636';
const TILE = '#3a3c40';

/** Teil in lokalen Koordinaten (x quer, z längs) drehen und an (x, y, z) setzen */
const place3 = (g: BufferGeometry, yaw: number, x: number, y: number, z: number): BufferGeometry =>
  g.rotateY(yaw).translate(x, y, z);

// ───────────────────────────────────────── Dach (geschwungen, mit hochgezogenen Ecken)

function curvedRoof(W: number, D: number, H: number, seg = 14): BufferGeometry {
  const g = new PlaneGeometry(W * 2, D * 2, seg, Math.max(4, Math.round((seg * D) / W))).rotateX(
    -Math.PI / 2,
  );
  const p = g.attributes.position as BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const ax = Math.abs(x);
    const az = Math.abs(z);
    const s = Math.max(0, Math.min((D - az) / D, (W - ax) / D));
    let y = H * Math.pow(s, 1.4);
    const m = Math.min(ax / W, az / D);
    y += 0.5 * Math.pow(m > 0.6 ? (m - 0.6) / 0.4 : 0, 2.2) * (H / 1.6);
    p.setY(i, y);
  }
  g.computeVertexNormals();
  return g;
}

/** Sechseckiges Zeltdach für den Pavillon */
function hexRoof(R: number, H: number): BufferGeometry {
  const g = new ConeGeometry(R, H, 6, 3, true);
  const p = g.attributes.position as BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = (H / 2 - y) / H; // 0 oben, 1 unten
    // durchhängende Flächen, hochgezogene Traufe
    p.setY(i, y - Math.sin(t * Math.PI) * H * 0.18 + Math.pow(t, 6) * H * 0.15);
  }
  g.computeVertexNormals();
  return g;
}

// ───────────────────────────────────────── Brücken

function stoneBridge(c: Crossing, b: Baker): void {
  const N = 14;
  const w = c.half * 2 + 0.3;
  for (let k = 0; k < N; k++) {
    const u0 = k / N;
    const u1 = (k + 1) / N;
    const y0 = deckY(c, u0);
    const y1 = deckY(c, u1);
    const seg = c.len / N;
    const pitch = Math.atan2(y1 - y0, seg);
    const along = ((u0 + u1) / 2 - 0.5) * c.len;
    const ym = (y0 + y1) / 2;
    const L = seg / Math.cos(pitch) + 0.04;
    b.add(
      place3(new BoxGeometry(w, 0.4, L).rotateX(-pitch).translate(0, ym - 0.24, along), c.yaw, c.x, 0, c.z),
      '#aaa496',
      0.04,
    );
    // Brüstung
    for (const s of [-1, 1]) {
      b.add(
        place3(
          new BoxGeometry(0.26, 0.6, L).rotateX(-pitch).translate(s * (c.half + 0.02), ym + 0.26, along),
          c.yaw,
          c.x,
          0,
          c.z,
        ),
        STONE,
        0.05,
      );
    }
    // Bogen: Mauerwerk unter dem Deck bis zur Bogenlinie
    const archTop = ym - 0.44;
    const archBot = Math.min(archTop - 0.3, ym - 0.44 - (1 - Math.sin(((u0 + u1) / 2) * Math.PI)) * 2.6);
    const hgt = archTop - archBot;
    b.add(
      place3(
        new BoxGeometry(w - 0.1, hgt, seg + 0.02).translate(0, archBot + hgt / 2, along),
        c.yaw,
        c.x,
        0,
        c.z,
      ),
      STONE_D,
      0.06,
    );
  }
  // Pfosten mit Löwenkugeln an den Enden
  for (const u of [0, 1])
    for (const s of [-1, 1]) {
      const along = (u - 0.5) * c.len;
      const y = deckY(c, u);
      b.add(
        place3(
          new BoxGeometry(0.34, 0.95, 0.34).translate(s * (c.half + 0.02), y + 0.4, along),
          c.yaw,
          c.x,
          0,
          c.z,
        ),
        STONE,
      );
      b.add(
        place3(
          new SphereGeometry(0.17, 7, 5).translate(s * (c.half + 0.02), y + 0.98, along),
          c.yaw,
          c.x,
          0,
          c.z,
        ),
        '#b0aa9c',
      );
    }
}

function plankBridge(c: Crossing, b: Baker): void {
  const n = Math.round(c.len / 0.32);
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) / n;
    const along = (u - 0.5) * c.len;
    const y = deckY(c, u);
    b.add(
      place3(new BoxGeometry(c.half * 2 + 0.1, 0.07, 0.28).translate(0, y - 0.03, along), c.yaw, c.x, 0, c.z),
      k % 3 ? WOOD : '#6d4c30',
      0.08,
    );
  }
  // Längsbalken und Geländer
  for (const s of [-1, 1]) {
    const y0 = deckY(c, 0);
    const y1 = deckY(c, 1);
    const pitch = Math.atan2(y1 - y0, c.len);
    b.add(
      place3(
        new BoxGeometry(0.14, 0.18, c.len)
          .rotateX(-pitch)
          .translate(s * (c.half - 0.1), (y0 + y1) / 2 - 0.15, 0),
        c.yaw,
        c.x,
        0,
        c.z,
      ),
      '#5e4128',
    );
    for (const u of [0, 0.5, 1]) {
      const y = deckY(c, u);
      b.add(
        place3(
          new CylinderGeometry(0.05, 0.06, 0.85, 5).translate(s * c.half, y + 0.4, (u - 0.5) * c.len),
          c.yaw,
          c.x,
          0,
          c.z,
        ),
        '#5e4128',
      );
    }
    b.add(
      place3(
        new CylinderGeometry(0.035, 0.035, c.len, 5)
          .rotateX(Math.PI / 2)
          .rotateX(-pitch)
          .translate(s * c.half, (y0 + y1) / 2 + 0.8, 0),
        c.yaw,
        c.x,
        0,
        c.z,
      ),
      '#6d4c30',
    );
  }
}

// ───────────────────────────────────────── Laternen, Tore, Bänke

function lantern(it: Item, stone: Baker, light: Baker): void {
  const s = it.s;
  const at = (g: BufferGeometry): BufferGeometry =>
    g.scale(s, s, s).rotateY(it.rot).translate(it.x, it.y, it.z);
  stone.add(at(new BoxGeometry(0.55, 0.16, 0.55).translate(0, 0.08, 0)), STONE_D);
  stone.add(at(new CylinderGeometry(0.11, 0.14, 0.8, 6).translate(0, 0.56, 0)), STONE);
  stone.add(at(new BoxGeometry(0.5, 0.1, 0.5).translate(0, 1.0, 0)), STONE);
  // Feuerkammer: vier Ecksäulen, innen leuchtend
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    stone.add(at(new BoxGeometry(0.07, 0.3, 0.07).translate(dx * 0.17, 1.2, dz * 0.17)), STONE);
  light.add(at(new BoxGeometry(0.27, 0.24, 0.27).translate(0, 1.2, 0)), '#ffd28a', 0);
  stone.add(at(new ConeGeometry(0.46, 0.32, 4).rotateY(Math.PI / 4).translate(0, 1.5, 0)), STONE_D);
  stone.add(at(new SphereGeometry(0.07, 6, 4).translate(0, 1.7, 0)), STONE);
}

function gate(it: Item, b: Baker): void {
  const s = it.s;
  const at = (g: BufferGeometry): BufferGeometry =>
    g.scale(s, s, s).rotateY(it.rot).translate(it.x, it.y, it.z);
  for (const sd of [-1, 1]) {
    b.add(at(new BoxGeometry(0.6, 0.35, 0.6).translate(sd * 1.9, 0.12, 0)), STONE);
    b.add(at(new CylinderGeometry(0.16, 0.18, 3.6, 8).translate(sd * 1.9, 1.85, 0)), RED);
  }
  b.add(at(new BoxGeometry(4.5, 0.24, 0.3).translate(0, 2.85, 0)), RED);
  b.add(at(new BoxGeometry(4.9, 0.28, 0.34).translate(0, 3.4, 0)), RED);
  b.add(at(new BoxGeometry(0.9, 0.42, 0.1).translate(0, 3.12, 0.05)), '#2b2622');
  b.add(at(new BoxGeometry(0.72, 0.28, 0.04).translate(0, 3.12, 0.11)), '#c9a24a');
  // kleines Ziegeldach
  b.add(at(curvedRoof(2.9, 0.6, 0.35, 10).translate(0, 3.58, 0)), TILE, 0.05);
  b.add(at(new BoxGeometry(4.2, 0.12, 0.14).translate(0, 3.95, 0)), '#2f3338');
}

function bench(it: Item, b: Baker): void {
  const at = (g: BufferGeometry): BufferGeometry => g.rotateY(it.rot).translate(it.x, it.y, it.z);
  b.add(at(new BoxGeometry(1.6, 0.08, 0.42).translate(0, 0.45, 0)), WOOD, 0.08);
  b.add(at(new BoxGeometry(1.6, 0.3, 0.06).translate(0, 0.72, -0.2)), '#6d4c30', 0.08);
  for (const sx of [-0.65, 0.65]) b.add(at(new BoxGeometry(0.12, 0.45, 0.38).translate(sx, 0.22, 0)), STONE);
}

// ───────────────────────────────────────── Schrein, Pavillon, Dorfplatz

function shrine(b: Baker): void {
  const S = SHRINE;
  const y = field().at(S.x, S.z + 2);
  const at = (g: BufferGeometry): BufferGeometry => g.translate(S.x, y, S.z);
  b.add(at(new BoxGeometry(S.w + 2.4, 0.5, S.d + 2.2).translate(0, 0.2, 0)), STONE);
  // Stufen vorn
  for (let k = 0; k < 2; k++)
    b.add(at(new BoxGeometry(2.6, 0.2, 0.4).translate(0, 0.08 + k * 0.2, S.d / 2 + 1.5 - k * 0.4)), STONE_D);
  // Säulen
  const px = [-S.w / 2 + 0.3, -1.1, 1.1, S.w / 2 - 0.3];
  for (const x of px)
    for (const z of [-S.d / 2 + 0.3, S.d / 2 - 0.3])
      b.add(at(new CylinderGeometry(0.15, 0.17, 2.9, 8).translate(x, 1.9, z)), RED);
  // Wände: hinten und Seiten verputzt, vorn Gitterfenster und offene Mitte
  b.add(at(new BoxGeometry(S.w - 0.5, 2.6, 0.16).translate(0, 1.75, -S.d / 2 + 0.3)), '#e6d8bf');
  for (const s of [-1, 1])
    b.add(at(new BoxGeometry(0.16, 2.6, S.d - 0.7).translate(s * (S.w / 2 - 0.3), 1.75, 0)), '#e6d8bf');
  for (const s of [-1, 1]) {
    b.add(at(new BoxGeometry(1.6, 1.8, 0.1).translate(s * 2.0, 1.85, S.d / 2 - 0.3)), '#7a2a1e');
    for (let i = 0; i < 5; i++)
      b.add(
        at(new BoxGeometry(0.04, 1.5, 0.12).translate(s * 2.0 - 0.6 + i * 0.3, 1.85, S.d / 2 - 0.24)),
        '#c9a24a',
        0,
      );
  }
  b.add(at(new BoxGeometry(S.w + 0.4, 0.3, S.d + 0.4).translate(0, 3.45, 0)), '#6b2418');
  b.add(at(curvedRoof(S.w / 2 + 1.3, S.d / 2 + 1.1, 1.7, 16).translate(0, 3.6, 0)), TILE, 0.05);
  b.add(at(new BoxGeometry(S.w - 1.4, 0.24, 0.3).translate(0, 5.3, 0)), '#2f3338');
  for (const s of [-1, 1])
    b.add(
      at(
        new TorusGeometry(0.26, 0.07, 5, 8, Math.PI * 1.2)
          .rotateZ(s > 0 ? -0.4 : Math.PI + 0.4)
          .translate((s * (S.w - 1.4)) / 2, 5.6, 0),
      ),
      '#2f3338',
    );
  // Altar und Weihrauchbecken davor
  b.add(at(new BoxGeometry(1.6, 0.9, 0.7).translate(0, 0.9, -S.d / 2 + 1.0)), '#5a2a1c');
  b.add(at(new SphereGeometry(0.28, 8, 6).translate(0, 1.6, -S.d / 2 + 1.0)), '#c9a24a');
  const iz = S.d / 2 + 3.4;
  b.add(
    at(
      new CylinderGeometry(0.5, 0.38, 0.55, 8)
        .translate(0, 0.62 - 0.2, iz)
        .translate(0, field().at(S.x, S.z + iz) - y, 0),
    ),
    '#5d5240',
  );
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    b.add(
      at(
        new CylinderGeometry(0.05, 0.05, 0.4, 4)
          .translate(Math.cos(a) * 0.32, 0.12, iz + Math.sin(a) * 0.32)
          .translate(0, field().at(S.x, S.z + iz) - y, 0),
      ),
      '#4a4033',
    );
  }
}

function pavilion(b: Baker, wall: Baker): void {
  const P = PAVILION;
  const y = field().at(P.x, P.z);
  const at = (g: BufferGeometry): BufferGeometry => g.translate(P.x, y, P.z);
  b.add(at(new CylinderGeometry(P.r + 0.7, P.r + 0.85, 0.3, 6).translate(0, 0.1, 0)), STONE);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.add(
      at(new CylinderGeometry(0.12, 0.14, 2.6, 7).translate(Math.cos(a) * P.r, 1.5, Math.sin(a) * P.r)),
      RED,
    );
    // Sitzbank zwischen den Säulen (außer am Eingang)
    if (i !== 1) {
      const a2 = a + Math.PI / 6;
      const r2 = P.r * Math.cos(Math.PI / 6);
      b.add(
        at(
          new BoxGeometry(P.r * 0.95, 0.07, 0.34)
            .rotateY(-a2 + Math.PI / 2)
            .translate(Math.cos(a2) * r2, 0.62, Math.sin(a2) * r2),
        ),
        WOOD,
        0.08,
      );
    }
  }
  b.add(at(new CylinderGeometry(P.r + 0.15, P.r + 0.15, 0.2, 6).translate(0, 2.85, 0)), '#6b2418');
  b.add(at(hexRoof(P.r + 1.1, 1.9).translate(0, 3.85, 0)), TILE, 0.05);
  b.add(at(new SphereGeometry(0.16, 7, 5).translate(0, 4.85, 0)), '#c9a24a');
  // niedrige Mauer am Rand des Aussichtspunkts
  const lk = place('aussicht');
  const gap = scatter().lookoutGap;
  const yy = field().at(lk.x, lk.z);
  for (let a = 0; a < Math.PI * 2; a += 0.12) {
    let d = a + 0.06 - gap.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) < gap.w) continue;
    const x = lk.x + Math.cos(a + 0.06) * 7.3;
    const z = lk.z + Math.sin(a + 0.06) * 7.3;
    wall.add(
      new BoxGeometry(0.4, 0.75, 0.92)
        .rotateY(-(a + 0.06))
        .translate(x, Math.min(yy, field().at(x, z)) + 0.3, z),
      STONE,
      0.06,
    );
  }
}

function plaza(b: Baker): void {
  const d = place('dorf');
  const y = field().at(d.x, d.z);
  b.add(new CylinderGeometry(13.5, 13.6, 0.16, 28).translate(d.x, y + 0.02, d.z), '#a59e8e', 0.05);
  const r = rng(71);
  // Pflaster: einige Platten heller/dunkler
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2;
    const rr = Math.sqrt(r()) * 12.5;
    b.add(
      new BoxGeometry(rand(r, 0.6, 1.1), 0.04, rand(r, 0.5, 0.9))
        .rotateY(r() * 3)
        .translate(d.x + Math.cos(a) * rr, y + 0.11, d.z + Math.sin(a) * rr),
      r() < 0.5 ? '#b3ac9b' : '#958e7f',
      0.05,
    );
  }
  // Brunnen: runde Steinfassung, Holzgestell mit Dach, Eimer
  const W = WELL;
  b.add(new CylinderGeometry(W.r, W.r + 0.05, 0.8, 12, 1, true).translate(W.x, y + 0.45, W.z), STONE, 0.06);
  b.add(new TorusGeometry(W.r, 0.1, 5, 14).rotateX(Math.PI / 2).translate(W.x, y + 0.85, W.z), STONE_D);
  b.add(new CylinderGeometry(W.r - 0.05, W.r - 0.05, 0.05, 12).translate(W.x, y + 0.3, W.z), '#20302e');
  for (const s of [-1, 1])
    b.add(new BoxGeometry(0.12, 2.0, 0.12).translate(W.x + s * (W.r + 0.05), y + 1.1, W.z), WOOD);
  b.add(
    new CylinderGeometry(0.07, 0.07, W.r * 2 + 0.3, 6).rotateZ(Math.PI / 2).translate(W.x, y + 1.7, W.z),
    '#6d4c30',
  );
  b.add(
    new ConeGeometry(1.45, 0.7, 4)
      .rotateY(Math.PI / 4)
      .scale(1, 1, 0.75)
      .translate(W.x, y + 2.35, W.z),
    TILE,
  );
  b.add(new CylinderGeometry(0.15, 0.12, 0.25, 7).translate(W.x + 0.2, y + 1.2, W.z), '#7a5636');
}

// ───────────────────────────────────────── Trittplatten und Stufen

function pathStones(): InstancedMesh {
  const f = field();
  const r = rng(21);
  const mats: Matrix4[] = [];
  const o = new Object3D();
  for (const p of PATHS) {
    const len = polyLength(p.pts);
    const main = p.kind === 'main';
    const every = main ? 0.95 : 2.2;
    const n = Math.floor(len / every);
    for (let k = 0; k <= n; k++) {
      const q = polyAt(p.pts, k / n);
      const slope = f.slope(q.x, q.z);
      if (p.kind === 'stairs' || slope > 0.3) continue;
      const cols = main ? [-0.42, 0.42] : [rand(r, -0.3, 0.3)];
      for (const c of cols) {
        if (!main && r() < 0.35) continue;
        const x = q.x - q.dz * c + rand(r, -0.1, 0.1);
        const z = q.z + q.dx * c + rand(r, -0.1, 0.1);
        if (waterAt(x, z, 0.2) || deckAt(x, z) !== null) continue;
        if (Math.hypot(x, z * 0.85) < 15.5 && z < 15.6) continue; // Teichbrücke und Haus
        o.position.set(x, f.at(x, z) + 0.02, z);
        o.rotation.set(rand(r, -0.04, 0.04), r() * Math.PI, rand(r, -0.04, 0.04));
        const s = rand(r, 0.8, 1.1) * (main ? 1 : 0.85);
        o.scale.set(s, 1, s * rand(r, 0.75, 1));
        o.updateMatrix();
        mats.push(o.matrix.clone());
      }
    }
  }
  const geo = colored(new CylinderGeometry(0.42, 0.46, 0.1, 7), '#a59c8c', 0.08, 5);
  const im = new InstancedMesh(
    geo,
    new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
    mats.length,
  );
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.receiveShadow = true;
  im.name = 'pathstones';
  return im;
}

/** Steinstufen auf steilen Wegstücken (Schreintreppe, Aufstieg zum Aussichtspunkt) */
function steps(): InstancedMesh {
  const f = field();
  const mats: Matrix4[] = [];
  const q4 = new Quaternion();
  for (const p of PATHS) {
    const len = polyLength(p.pts);
    const n = Math.ceil(len / 0.2);
    let lastLv = Infinity;
    for (let k = 0; k <= n; k++) {
      const q = polyAt(p.pts, k / n);
      const steep = p.kind === 'stairs' || f.slope(q.x, q.z) > 0.38;
      const h = f.at(q.x, q.z);
      const lv = Math.floor(h / 0.3);
      if (!steep) {
        lastLv = lv;
        continue;
      }
      if (lv === lastLv) continue;
      lastLv = lv;
      if (waterAt(q.x, q.z, 0.3)) continue;
      q4.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(q.dx, q.dz));
      // Oberkante etwas über dem Boden; die Stufe reicht tief hinunter, damit sie am Hang nicht schwebt
      mats.push(
        new Matrix4().compose(new Vector3(q.x, h + 0.06, q.z), q4, new Vector3(p.half * 2 + 0.3, 1, 1)),
      );
    }
  }
  const geo = colored(new BoxGeometry(1, 0.5, 0.62).translate(0, -0.25, 0), '#a39d90', 0.07, 9);
  const im = new InstancedMesh(
    geo,
    new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
    Math.max(1, mats.length),
  );
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.count = mats.length;
  im.castShadow = true;
  im.receiveShadow = true;
  im.name = 'steps';
  return im;
}

// ───────────────────────────────────────── Zusammenbau

export interface Structures {
  group: Group;
  /** leuchtende Laternenkammern (Helligkeit je nach Tageszeit) */
  lanternMat: MeshStandardMaterial;
  /** begehbare Brückenflächen (für Klick-zum-Laufen) */
  walkables: Group;
  /** feste Bauwerke, vor denen die Kamera anhält */
  solid: Mesh[];
  /** Leuchtpunkte der Laternen (Größe/Helligkeit je nach Tageszeit) */
  glow: Points;
}

export function buildStructures(): Structures {
  const sc = scatter();
  const group = new Group();
  group.name = 'structures';
  const walkables = new Group();
  walkables.name = 'bridges';
  for (const c of sc.crossings) {
    const b = new Baker();
    if (c.kind === 'stone') stoneBridge(c, b);
    else plankBridge(c, b);
    walkables.add(b.mesh());
  }
  group.add(walkables);
  const stone = new Baker();
  const lanternMat = new MeshStandardMaterial({
    vertexColors: true,
    emissive: '#ffb347',
    emissiveIntensity: 0.4,
    roughness: 0.6,
  });
  const light = new Baker();
  for (const l of sc.lanterns) lantern(l, stone, light);
  for (const g of sc.gates) gate(g, stone);
  for (const bn of sc.benches) bench(bn, stone);
  const stoneMesh = stone.mesh();
  group.add(stoneMesh);
  if (!light.empty) {
    const lm = light.mesh(lanternMat);
    lm.castShadow = false;
    group.add(lm);
  }
  const sh = new Baker();
  shrine(sh);
  const shrineMesh = sh.mesh();
  group.add(shrineMesh);
  const pv = new Baker();
  const wall = new Baker();
  pavilion(pv, wall);
  const pvMesh = pv.mesh();
  const wallMesh = wall.mesh();
  group.add(pvMesh, wallMesh);
  const pl = new Baker();
  plaza(pl);
  const plm = pl.mesh();
  plm.castShadow = false;
  group.add(plm);
  group.add(pathStones(), steps());
  // ein paar Findlinge am Aussichtspunkt
  const fb = new Baker();
  const lk = place('aussicht');
  const r = rng(4);
  for (let i = 0; i < 3; i++) {
    const a = 2.2 + i * 0.6;
    fb.add(
      new DodecahedronGeometry(rand(r, 0.6, 0.9), 0)
        .scale(1.3, 0.8, 1)
        .translate(lk.x + Math.cos(a) * 5.6, field().at(lk.x, lk.z) + 0.2, lk.z + Math.sin(a) * 5.6),
      '#8a8578',
      0.08,
    );
  }
  group.add(fb.mesh());
  // Lichthof um jede Laterne (nachts sichtbar)
  const pos = new Float32Array(sc.lanterns.length * 3);
  sc.lanterns.forEach((l, i) => pos.set([l.x, l.y + 1.2 * l.s, l.z], i * 3));
  const gg = new BufferGeometry();
  gg.setAttribute('position', new BufferAttribute(pos, 3));
  const glow = new Points(
    gg,
    new PointsMaterial({
      size: 2.2,
      map: glowTexture(),
      color: '#ffc06a',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  glow.name = 'lantern-glow';
  group.add(glow);
  return {
    group,
    lanternMat,
    walkables,
    solid: [stoneMesh, shrineMesh, pvMesh, wallMesh, ...(walkables.children as Mesh[])],
    glow,
  };
}
