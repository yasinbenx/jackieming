// Schneiderei: baut Körper und Kleidung der Figuren als weiche Röhren entlang der Knochen und „näht“ sie direkt
// an das Skelett (Skinning mit fließenden Gewichten an den Gelenken). Weil Kleidung hier zugleich die Körperform
// ist, liegt nichts darunter, was durchschneiden könnte. Gebaut wird in einer natürlichen Standpose (erster Frame
// der Idle-Animation); die Figur schaut dabei nach +z, x zeigt nach links.
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import type { Bone } from 'three';

/** Querschnitt an einer Stelle der Röhre (t = 0 … 1 entlang der Kette) */
export interface Section {
  t: number;
  rx: number;
  rz: number;
  /** Verschiebung nach vorn (+) / hinten (−) gegenüber der Kettenlinie */
  dz?: number;
}

export interface TubeOpts {
  /** Gelenkkette (Knochen und deren Position in der Bindepose) */
  chain: { bone: number; p: Vector3 }[];
  /** Querschnitte, werden zwischen den Stützstellen weich interpoliert */
  sections: Section[];
  /** Ringe und Punkte je Ring */
  rings?: number;
  seg?: number;
  /** Breite der weichen Gewichtsübergänge an den Gelenken (Anteil der Segmentlänge) */
  blend?: number;
  /** Bezugsrichtung „vorne“ für die Ausrichtung der Ellipsen */
  front?: Vector3;
  /** v-Koordinate: 0 am Anfang der Kette, 1 am Ende (sonst umgekehrt) */
  vUp?: boolean;
  /** zusätzliche Gewichte je Vertex (z. B. Schultern), bekommt Weltposition und t */
  extra?: (p: Vector3, t: number) => { bone: number; w: number } | null;
  /** Stoffzugabe am Saum: letzte Ringe leicht aufweiten */
  capEnd?: boolean;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Querschnitt an Stelle t (Kosinus-Interpolation zwischen den Stützstellen) */
function sectionAt(secs: Section[], t: number): { rx: number; rz: number; dz: number } {
  if (t <= secs[0]!.t) return { rx: secs[0]!.rx, rz: secs[0]!.rz, dz: secs[0]!.dz ?? 0 };
  for (let i = 1; i < secs.length; i++) {
    const a = secs[i - 1]!;
    const b = secs[i]!;
    if (t <= b.t) {
      const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
      const k = (1 - Math.cos(u * Math.PI)) / 2;
      return {
        rx: a.rx + (b.rx - a.rx) * k,
        rz: a.rz + (b.rz - a.rz) * k,
        dz: (a.dz ?? 0) + ((b.dz ?? 0) - (a.dz ?? 0)) * k,
      };
    }
  }
  const l = secs[secs.length - 1]!;
  return { rx: l.rx, rz: l.rz, dz: l.dz ?? 0 };
}

/**
 * Röhre entlang einer Gelenkkette. Liefert Geometrie mit Position, Normalen, UV (u = 0 vorne, läuft über links
 * nach hinten) und Skin-Daten (bis zu 4 Knochen je Vertex).
 */
export function tube(o: TubeOpts): BufferGeometry {
  const R = o.rings ?? 24;
  const S = o.seg ?? 24;
  const blend = o.blend ?? 0.35;
  const front = (o.front ?? new Vector3(0, 0, 1)).clone();
  // Kettenlänge und Teilstrecken
  const pts = o.chain.map((c) => c.p);
  const lens: number[] = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1]! + pts[i]!.distanceTo(pts[i - 1]!));
  const total = lens[lens.length - 1]!;
  const pos: number[] = [];
  const uv: number[] = [];
  const si: number[] = [];
  const sw: number[] = [];
  const idx: number[] = [];
  const c = new Vector3();
  const tan = new Vector3();
  const side = new Vector3();
  const fwd = new Vector3();
  const v = new Vector3();
  for (let j = 0; j <= R; j++) {
    const t = j / R;
    const d = t * total;
    let k = 1;
    while (k < lens.length - 1 && lens[k]! < d) k++;
    const a = pts[k - 1]!;
    const b = pts[k]!;
    const segLen = lens[k]! - lens[k - 1]!;
    const f = segLen > 0 ? (d - lens[k - 1]!) / segLen : 0;
    c.copy(a).lerp(b, f);
    // Tangente weich über die Gelenke (Mittel aus angrenzenden Segmenten nahe am Gelenk)
    tan.copy(b).sub(a).normalize();
    if (f > 0.75 && k < pts.length - 1) {
      const n = pts[k + 1]!.clone().sub(b).normalize();
      tan.lerp(n, (f - 0.75) * 2).normalize();
    } else if (f < 0.25 && k > 1) {
      const p = a
        .clone()
        .sub(pts[k - 2]!)
        .normalize();
      tan.lerp(p, (0.25 - f) * 2).normalize();
    }
    // Ellipsen-Achsen: „vorne“ senkrecht zur Tangente
    fwd.copy(front).addScaledVector(tan, -front.dot(tan));
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 1, 0).addScaledVector(tan, -tan.y);
    fwd.normalize();
    side.crossVectors(fwd, tan).normalize();
    // side zeigt bei Röhren nach oben (Rumpf) in Figurenrichtung links (+x)
    if (side.x < 0 && Math.abs(side.x) > 0.3) side.negate();
    const sec = sectionAt(o.sections, t);
    // Gewichte: Knochen des Segments, weich in den nächsten/vorigen übergehen
    const bA = o.chain[k - 1]!.bone;
    let wB = 0;
    if (k < o.chain.length - 1 || f > 0)
      wB = smooth(1 - blend, 1 + blend * 0.4, f) * (k < o.chain.length - 1 ? 1 : 0);
    let wPrev = 0;
    const bP = k > 1 ? o.chain[k - 2]!.bone : bA;
    if (k > 1) wPrev = (1 - smooth(-blend * 0.4, blend, f)) * 0.5;
    // Segment k-1 → k gehört zum Knochen am Anfang des Segments (bA); am Ende fließt es in bB über
    const next = k < o.chain.length - 1 ? o.chain[k]!.bone : bA;
    for (let i = 0; i <= S; i++) {
      const ang = (i / S) * Math.PI * 2;
      const sx = Math.sin(ang);
      const cz = Math.cos(ang);
      v.copy(c)
        .addScaledVector(side, sx * sec.rx)
        .addScaledVector(fwd, cz * sec.rz + sec.dz);
      pos.push(v.x, v.y, v.z);
      uv.push(i / S, o.vUp === false ? 1 - t : t);
      const ws: [number, number][] = [
        [bA, 1 - wB - wPrev],
        [next, wB],
        [bP, wPrev],
      ];
      const ex = o.extra?.(v, t);
      if (ex && ex.w > 0) {
        for (const w of ws) w[1] *= 1 - ex.w;
        ws.push([ex.bone, ex.w]);
      }
      // gleiche Knochen zusammenfassen, auf 4 begrenzen, normieren
      const m = new Map<number, number>();
      for (const [bn, w] of ws) if (w > 1e-4) m.set(bn, (m.get(bn) ?? 0) + w);
      const list = [...m].sort((p, q) => q[1] - p[1]).slice(0, 4);
      const sum = list.reduce((s, [, w]) => s + w, 0) || 1;
      for (let q = 0; q < 4; q++) {
        si.push(list[q]?.[0] ?? 0);
        sw.push((list[q]?.[1] ?? 0) / sum);
      }
    }
  }
  // Wicklung so wählen, dass die Normalen nach außen zeigen (hängt von der Kettenrichtung ab)
  const P = (n: number): Vector3 => new Vector3(pos[n * 3]!, pos[n * 3 + 1]!, pos[n * 3 + 2]!);
  const p0 = P(0);
  const e1 = P(1).sub(p0);
  const e2 = P(S + 1).sub(p0);
  const ringC = new Vector3();
  for (let i = 0; i < S; i++) ringC.add(P(i));
  ringC.divideScalar(S);
  const outward = e1.clone().cross(e2).dot(p0.clone().sub(ringC)) > 0;
  for (let j = 0; j < R; j++)
    for (let i = 0; i < S; i++) {
      const a = j * (S + 1) + i;
      const b = a + S + 1;
      if (outward) idx.push(a, a + 1, b, b, a + 1, b + 1);
      else idx.push(a, b, a + 1, b, b + 1, a + 1);
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

/** Positionen der Knochen in der Bindepose (Welt, Figur bei Maßstab 1 im Ursprung) */
export function bonePos(b: Bone | undefined): Vector3 {
  return b ? b.getWorldPosition(new Vector3()) : new Vector3();
}
