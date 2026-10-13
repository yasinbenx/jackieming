// Die Welt ums Teehaus (Meter; x nach rechts/Osten, z nach vorne/Süden, das Teehaus bei 0,0, Blick ins Tal
// nach +z). Orte, Wege, Fluss und Bach als Linienzüge. Reine Daten und Geometrie-Helfer ohne three.js, damit
// Gelände, Laufraster, Bewuchs, Karte und Tests dieselbe Quelle haben.

export type P2 = [number, number];

export interface Place {
  id: string;
  zh: string;
  py: string;
  de: string;
  x: number;
  z: number;
  /** ebene Fläche um den Ort (Radius in m), 0 = keine */
  flat: number;
  /** feste Höhe der ebenen Fläche (sonst Geländehöhe in der Mitte) */
  h?: number;
}

/** Orte (Karte, Schnellreise, Ebnen des Geländes) */
export const PLACES: Place[] = [
  { id: 'teehaus', zh: '茶馆', py: 'chaguan', de: 'Teehaus', x: 0, z: 0, flat: 0 },
  { id: 'bambus', zh: '竹林', py: 'zhulin', de: 'Bambushain', x: -30, z: 24, flat: 0 },
  { id: 'aussicht', zh: '观景台', py: 'guanjingtai', de: 'Aussichtspunkt', x: -64, z: -42, flat: 7, h: 13 },
  { id: 'teefeld', zh: '茶园', py: 'chayuan', de: 'Teefeld', x: 52, z: -10, flat: 0 },
  { id: 'schrein', zh: '神社', py: 'shenshe', de: 'Schrein', x: 62, z: -60, flat: 9, h: 18 },
  { id: 'dorf', zh: '村子', py: 'cunzi', de: 'Dorfplatz', x: 40, z: 60, flat: 15 },
  { id: 'flussbruecke', zh: '石桥', py: 'shiqiao', de: 'Steinbrücke', x: 50, z: 82, flat: 0 },
  { id: 'reisfeld', zh: '梯田', py: 'titian', de: 'Reisterrassen', x: -24, z: 96, flat: 0 },
];

export const place = (id: string): Place => PLACES.find((p) => p.id === id)!;

/** Weiche Grenze: jenseits davon steigt das Gelände steil an (Berge), dahinter Nebel */
export const BOUNDARY = { rx: 112, rz: 118, cz: 18 };
/** 0 innen, 1 an der Grenze und darüber hinaus (Rand leicht unregelmäßig, damit er nicht wie ein Kreis wirkt) */
export function boundaryK(x: number, z: number): number {
  const nx = x / BOUNDARY.rx;
  const nz = (z - BOUNDARY.cz) / BOUNDARY.rz;
  const a = Math.atan2(nz, nx);
  const wob = Math.sin(a * 3 + 0.7) * 0.035 + Math.sin(a * 7 + 2.1) * 0.025 + Math.sin(a * 13 + 0.3) * 0.012;
  const d = Math.hypot(nx, nz) - wob;
  return Math.max(0, Math.min(1, (d - 0.84) / 0.2));
}

/** Fluss von West nach Ost südlich des Dorfes */
export const RIVER: P2[] = [
  [-150, 70],
  [-110, 76],
  [-70, 72],
  [-35, 80],
  [0, 84],
  [25, 80],
  [50, 82],
  [80, 90],
  [115, 86],
  [150, 92],
];
export const RIVER_HALF = 4.2;

/** Bach: aus den Bergen im Nordwesten in den Teich, aus dem Teich hinunter zum Fluss */
export const STREAM_IN: P2[] = [
  [-82, -100],
  [-62, -70],
  [-46, -36],
  [-30, -12],
  [-18, 4],
  [-8.5, 10.5],
];
export const STREAM_OUT: P2[] = [
  [-4.6, 14.0],
  [-6, 26],
  [-2.5, 44],
  [6, 62],
  [10, 82],
];
export const STREAM_HALF = 0.9;

/** Reisterrassen am Hang jenseits des Flusses (Ellipse) */
export const TERRACES = { x: -34, z: 114, rx: 26, rz: 17, step: 1.1 };

/** Wasserspiegel des Flusses (m) */
export const RIVER_LEVEL = -6.6;

export type PathKind = 'main' | 'side' | 'stairs';
export interface Path {
  id: string;
  kind: PathKind;
  half: number;
  pts: P2[];
}

/** Wege; alle beginnen am Südende der Teehausbrücke (0, 15.5) */
export const PATHS: Path[] = [
  {
    id: 'dorfweg',
    kind: 'main',
    half: 1.3,
    pts: [
      [0, 15.5],
      [0.6, 22],
      [2.4, 30],
      [8, 38],
      [18, 45],
      [28, 50],
      [36, 56],
      [40, 60],
    ],
  },
  {
    id: 'brueckenweg',
    kind: 'main',
    half: 1.3,
    pts: [
      [40, 60],
      [44, 66],
      [47.5, 73],
      [52.5, 91],
      [46, 97],
      [30, 99],
      [8, 102],
      [-12, 99],
      [-24, 96],
    ],
  },
  {
    id: 'ostweg',
    kind: 'side',
    half: 1.0,
    pts: [
      [0.6, 22],
      [9, 20],
      [18, 14],
      [30, 6],
      [42, -2],
      [52, -10],
    ],
  },
  {
    id: 'schreinweg',
    kind: 'stairs',
    half: 1.1,
    pts: [
      [52, -10],
      [56, -24],
      [58, -38],
      [61, -50],
      [62, -60],
    ],
  },
  {
    id: 'westweg',
    kind: 'side',
    half: 1.0,
    pts: [
      [0.6, 22],
      [-10, 22],
      [-20, 23],
      [-30, 24],
      [-40, 14],
      [-50, -4],
      [-58, -24],
      [-64, -42],
    ],
  },
  {
    id: 'dorfrunde',
    kind: 'side',
    half: 0.9,
    pts: [
      [28, 50],
      [22, 62],
      [30, 72],
      [46, 70],
    ],
  },
];

/** Stellen, an denen Wege Wasser kreuzen (begehbare Brücken) */
export interface Crossing {
  x: number;
  z: number;
  /** Richtung des Wegs (rad, 0 = +z) */
  yaw: number;
  len: number;
  half: number;
  kind: 'stone' | 'plank';
}

// ───────────────────────────────────────── Geometrie

/** Abstand zu einem Linienzug, dazu Position entlang (0..1) und Segment-Index */
export function polyDist(pts: readonly P2[], x: number, z: number): { d: number; t: number; i: number } {
  let best = Infinity;
  let bt = 0;
  let bi = 0;
  let acc = 0;
  let total = 0;
  for (let i = 1; i < pts.length; i++)
    total += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]!;
    const [bx, bz] = pts[i]!;
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const u = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
    const d = Math.hypot(x - (ax + dx * u), z - (az + dz * u));
    const segLen = Math.sqrt(len2);
    if (d < best) {
      best = d;
      bt = total > 0 ? (acc + u * segLen) / total : 0;
      bi = i - 1;
    }
    acc += segLen;
  }
  return { d: best, t: bt, i: bi };
}

/** Punkt an Stelle t (0..1) entlang eines Linienzugs, dazu die Richtung */
export function polyAt(pts: readonly P2[], t: number): { x: number; z: number; dx: number; dz: number } {
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
    lens.push(l);
    total += l;
  }
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i]! || i === lens.length - 1) {
      const u = lens[i]! > 0 ? d / lens[i]! : 0;
      const [ax, az] = pts[i]!;
      const [bx, bz] = pts[i + 1]!;
      const l = lens[i]! || 1;
      return { x: ax + (bx - ax) * u, z: az + (bz - az) * u, dx: (bx - ax) / l, dz: (bz - az) / l };
    }
    d -= lens[i]!;
  }
  const [x, z] = pts[pts.length - 1]!;
  return { x, z, dx: 0, dz: 1 };
}

export function polyLength(pts: readonly P2[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++)
    total += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  return total;
}

/** Schnittpunkte der Wege mit Fluss und Bach → Brücken */
export function crossings(): Crossing[] {
  const out: Crossing[] = [];
  const waters: [readonly P2[], number, Crossing['kind']][] = [
    [RIVER, RIVER_HALF, 'stone'],
    [STREAM_IN, STREAM_HALF, 'plank'],
    [STREAM_OUT, STREAM_HALF, 'plank'],
  ];
  for (const p of PATHS) {
    const n = Math.ceil(polyLength(p.pts) / 0.5);
    for (const [w, half, kind] of waters) {
      let inside = false;
      for (let k = 0; k <= n; k++) {
        const q = polyAt(p.pts, k / n);
        const wet = polyDist(w, q.x, q.z).d < half + 0.4;
        if (wet && !inside) {
          // Mitte der Kreuzung: weiter laufen, bis wieder trocken
          let k2 = k;
          while (k2 <= n && polyDist(w, polyAt(p.pts, k2 / n).x, polyAt(p.pts, k2 / n).z).d < half + 0.4)
            k2++;
          const m = polyAt(p.pts, (k + k2) / 2 / n);
          if (!out.some((c) => Math.hypot(c.x - m.x, c.z - m.z) < 4))
            out.push({
              x: m.x,
              z: m.z,
              yaw: Math.atan2(m.dx, m.dz),
              len: (k2 - k) * 0.5 + 3,
              half: Math.max(1.1, p.half),
              kind,
            });
        }
        inside = wet;
      }
    }
  }
  return out;
}
