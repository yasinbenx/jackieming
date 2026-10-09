// Stilisierte Figur (alle Personen im Spiel): Gelenkhierarchie aus weichen Grundformen, Gesicht aus Parametern
// (Kopfform, Augen, Nase, Mund, Ohren), Kleidung mit Stickerei und prozedurale Animationen. Frisuren entweder
// gezeichnet oder aus den CC0-Haarmodellen (hairkit.ts).
import {
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import type { Material, Object3D } from 'three';
import { ballTexture, embroidery, vinyl } from './materials';
import { hairKit } from './hairkit';
import type { HairPiece } from './hairkit';
import type { RigSpec } from './rigchar';
import type { Front } from './materials';

export type HairStyle =
  'fringe' | 'crop' | 'elder' | 'bun' | 'kidBuns' | 'cap' | 'straw' | 'ponytail' | 'side' | 'sweep' | 'none';
export type Motif = 'dragon' | 'cloud' | 'hem' | 'plain';
export type Prop = 'ball' | 'fan' | 'brush' | 'teapot' | 'cup' | 'bowl' | null;

/** Gesichtsform. Alle Werte relativ; die Vorgaben ergeben das bisherige freundliche Standardgesicht. */
export interface Face {
  /** Schädel-Skalierung (Breite, Höhe, Tiefe) */
  skull: [number, number, number];
  /** Untere Gesichtshälfte: Masse (0 = keine), Breite, Höhe */
  jaw: number;
  jawW: number;
  jawH: number;
  /** Kinn: Größe (0 = keins), Breite */
  chin: number;
  chinW: number;
  /** Wangenknochen (seitlich, auf Augenhöhe) und volle Wangen (unter den Augen) */
  cheekbones: number;
  cheeks: number;
  eyeW: number;
  eyeH: number;
  /** Abstand der Augenmitten (in Kopfradien) und Höhe */
  eyeGap: number;
  eyeY: number;
  iris: string;
  /** Augen werden beim Lächeln schmaler (0..1); wirkt auch leicht in Ruhe */
  smileEyes: number;
  /** Lachfältchen an den äußeren Augenwinkeln (0..1) */
  laughLines: number;
  browThick: number;
  browLen: number;
  /** Neigung (positiv = außen tiefer), Höhe, Schwung */
  browTilt: number;
  browY: number;
  browArch: number;
  noseW: number;
  noseH: number;
  noseTip: number;
  /** Nasenrücken (0 = keiner) und Nasenflügel (0 = keine) */
  noseBridge: number;
  noseWings: number;
  mouthW: number;
  /** schiefes Lächeln: ein Mundwinkel höher (−1..1) */
  smirk: number;
  /** Unterlippe (0 = keine) */
  lip: number;
  mouthY: number;
  earSize: number;
  /** Abstehen der Ohren (Radiant) */
  earOut: number;
  /** Stirnfalten (0..1) */
  foreheadLines: number;
  blush: number;
}

const FACE: Face = {
  skull: [1, 1.04, 0.97],
  jaw: 0,
  jawW: 0.8,
  jawH: 0.6,
  chin: 0,
  chinW: 1,
  cheekbones: 0,
  cheeks: 0,
  eyeW: 1,
  eyeH: 1,
  eyeGap: 0.36,
  eyeY: 0.06,
  iris: '#2a1a12',
  smileEyes: 0,
  laughLines: 0,
  browThick: 1,
  browLen: 1,
  browTilt: 0.12,
  browY: 0.33,
  browArch: 0,
  noseW: 1,
  noseH: 1,
  noseTip: 1,
  noseBridge: 0,
  noseWings: 0,
  mouthW: 1,
  smirk: 0,
  lip: 0,
  mouthY: -0.36,
  earSize: 1,
  earOut: 0,
  foreheadLines: 0,
  blush: 0.35,
};

/** Ein Haarmodell aus haare.glb, auf den Kopf eingepasst */
export interface HairFit {
  piece: HairPiece;
  /** Zusatz-Skalierung (relativ zum Kopf) */
  scale?: [number, number, number];
  /** Verschiebung in Kopfradien */
  offset?: [number, number, number];
  /** Kippen um die x-Achse */
  tilt?: number;
  /** eigene Farbe (sonst Haarfarbe) */
  color?: string;
}

export interface Look {
  id: string;
  /** Körpergröße in Metern */
  height: number;
  /** Kopfhöhe relativ zur Körpergröße (stilisiert größer als in echt) */
  headRatio: number;
  /** Breite (Schultern, Glieder) */
  build: number;
  /** Beinlänge relativ zur Größe */
  legRatio?: number;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  beard?: boolean;
  brows?: string;
  /** Gesichtsform (nur abweichende Werte) */
  face?: Partial<Face>;
  /** Aufbau als Rig-Figur (Quaternius-Teile); ohne Angabe wird die Figur gezeichnet */
  rig?: RigSpec;
  /** Haarmodelle; ersetzen die gezeichnete Frisur, sobald haare.glb geladen ist */
  hairModel?: HairFit[];
  /** gezeichnete Frisur trotz Haarmodell behalten (als Ergänzung, z. B. Pony) */
  keepDrawnHair?: boolean;
  /** Schulterbreite zusätzlich zu build */
  shoulders?: number;
  /** Armlänge relativ */
  armRatio?: number;
  handScale?: number;
  footScale?: number;
  top: {
    color: string;
    gold?: string;
    motif?: Motif;
    /** Saum unterhalb der Hüfte, als Anteil der Beinlänge (0 = Jacke bis zur Hüfte, 0.9 = langer Mantel) */
    skirt: number;
    /** offen getragen (Hemd sichtbar) */
    open?: boolean;
    trim?: string;
    sleeveMotif?: Motif;
  };
  inner?: { color: string; knots?: boolean };
  cuff?: string;
  pants: { color: string; wide?: boolean; motif?: Motif; gold?: string };
  belt?: { color: string; tassels?: boolean };
  shoes: { color: string; sole?: string; stripe?: string };
  apron?: string;
  prop?: Prop;
}

export type Action =
  | 'wave'
  | 'bow'
  | 'nod'
  | 'laugh'
  | 'drink'
  | 'pour'
  | 'polish'
  | 'write'
  | 'fan'
  | 'play'
  | 'think'
  | 'point'
  | 'shrug'
  | 'kungfu'
  | 'spin'
  | 'duck'
  | 'pet'
  | 'hop'
  | 'clap';

interface ActionState {
  t: number;
  dur: number;
  /** true: läuft, bis stop() gerufen wird */
  loop: boolean;
  w: number;
  stopping: boolean;
}

/** Sich zum Ziel hin verjüngende Kapsel, hängt vom Ursprung nach unten bis -len */
function limbGeo(r0: number, r1: number, len: number, seg = 12): BufferGeometry {
  const pts: Vector2[] = [];
  const cap = 5;
  for (let i = cap; i >= 0; i--) {
    const a = (i / cap) * (Math.PI / 2);
    pts.push(new Vector2(Math.cos(a) * r1, -len - Math.sin(a) * r1));
  }
  for (let i = 0; i <= cap; i++) {
    const a = (i / cap) * (Math.PI / 2);
    pts.push(new Vector2(Math.cos(a) * r0, Math.sin(a) * r0));
  }
  pts[0]!.x = 0.0001;
  pts[pts.length - 1]!.x = 0.0001;
  return new LatheGeometry(pts, seg);
}

/** Rumpf: Taille → Brust → Schultern, Höhe 1, Radius 1 (wird skaliert) */
function torsoGeo(belly: number): BufferGeometry {
  const prof: [number, number][] = [
    [0.0001, -0.04],
    [0.74 + belly, 0],
    [0.8 + belly * 1.2, 0.12],
    [0.9 + belly * 0.9, 0.35],
    [0.98 + belly * 0.3, 0.58],
    [1.0, 0.72],
    [0.94, 0.86],
    [0.72, 0.95],
    [0.42, 1.0],
    [0.0001, 1.02],
  ];
  return new LatheGeometry(
    prof.map(([r, y]) => new Vector2(r, y)),
    18,
  );
}

/** Rock/Mantelschoß: von unten (Saum) nach oben (Taille), damit die Bordüre der Textur unten liegt */
function skirtGeo(rTop: number, rBot: number, len: number): BufferGeometry {
  const pts: Vector2[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const r = rBot + (rTop - rBot) * Math.pow(t, 0.8);
    pts.push(new Vector2(r, -len + t * len));
  }
  return new LatheGeometry(pts, 20);
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Kopfform als glatte Verformung einer Einheitskugel: Schädelmaße, breiterer/eckigerer Kiefer, Wangen,
 * Wangenknochen und Kinn als weiche Ausbuchtungen. Liefert den Oberflächenpunkt (in Kopfradien) zu einer Richtung.
 */
function headShape(F: Face): (n: Vector3) => Vector3 {
  const [kx, ky, kz] = F.skull;
  const bump = (n: Vector3, cx: number, cy: number, cz: number, sxy: number, sy: number): number => {
    const dx = (n.x - cx) / sxy;
    const dy = (n.y - cy) / sy;
    const dz = (n.z - cz) / sxy;
    return Math.exp(-(dx * dx + dy * dy + dz * dz));
  };
  return (n: Vector3): Vector3 => {
    const lower = smooth(0.05, -0.85, n.y);
    const front = smooth(-0.5, 0.4, n.z);
    // Kiefer: untere Gesichtshälfte breiter und (bei jawH klein) eckiger
    const jawWide = 1 + F.jaw * (F.jawW - 0.7) * 0.55 * lower * (0.6 + 0.4 * front);
    const square = F.jaw * (1 - F.jawH) * 0.35 * smooth(-0.35, -0.8, n.y) * smooth(0.15, 0.6, Math.abs(n.x));
    let d = 0;
    for (const sx of [-1, 1]) {
      d += 0.075 * F.cheeks * bump(n, sx * 0.52, -0.32, 0.78, 0.36, 0.3);
      d += 0.05 * F.cheekbones * bump(n, sx * 0.8, -0.05, 0.58, 0.3, 0.22);
      d += 0.018 * bump(n, sx * 0.36, 0.3, 0.86, 0.24, 0.12);
    }
    d += 0.09 * F.chin * bump(n, 0, -0.84, 0.52, 0.3 * F.chinW, 0.22);
    const x = n.x * kx * jawWide * (1 + square);
    const y = n.y * ky;
    const z = n.z * kz;
    return new Vector3(x + n.x * d, y + n.y * d, z + n.z * d);
  };
}

/** Farbe abdunkeln (f < 1) */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = (v: number): string =>
    Math.round(Math.min(255, v * f))
      .toString(16)
      .padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

const mk = (geo: BufferGeometry, mat: Material, shadow = true): Mesh => {
  const m = new Mesh(geo, mat);
  m.castShadow = shadow;
  m.receiveShadow = false;
  return m;
};

export class Character {
  readonly root = new Group();
  readonly look: Look;
  // Gelenke
  private hips = new Group();
  private spine = new Group();
  private chest = new Group();
  readonly head = new Group();
  private neck = new Group();
  private armL = { sh: new Group(), up: new Group(), fo: new Group(), hand: new Group() };
  private armR = { sh: new Group(), up: new Group(), fo: new Group(), hand: new Group() };
  private legL = { th: new Group(), sh: new Group(), ft: new Group() };
  private legR = { th: new Group(), sh: new Group(), ft: new Group() };
  private skirt: Group | null = null;
  private face = new Group();
  private eyes: Group[] = [];
  private mouthSmile!: Mesh;
  private mouthOpen!: Mesh;
  private brows: Mesh[] = [];
  private modelHair = false;
  private faceShape: Face = FACE;
  private skull: [number, number, number] = FACE.skull;
  private detail: Object3D[] = [];
  private props: Partial<Record<Exclude<Prop, null>, Mesh | Group>> = {};
  private ball: Mesh | null = null;
  // Maße
  readonly H: number;
  private hd: number;
  private L: number;
  private thighLen: number;
  private shinLen: number;
  private upLen: number;
  private foLen: number;
  private shoulderW: number;
  private chestY = 0;
  // Zustand
  /** aktuelle Geschwindigkeit (m/s), vom Steuerungscode gesetzt */
  speed = 0;
  private phase = Math.random() * 6;
  private sit = 0;
  private sitTarget = 0;
  private seatH = 0.46;
  private actions = new Map<Action, ActionState>();
  private blink = 2 + Math.random() * 3;
  private lookTarget: Vector3 | null = null;
  private lookYaw = 0;
  private lookPitch = 0;
  /** Mundöffnung beim Sprechen 0..1 (von der Stimme gesetzt) */
  talk = 0;
  /** Dauerhaftes Bücken (z. B. Yao unter dem Türbalken), 0..1, wird weich angefahren */
  stoop = 0;
  private stoopSmooth = 0;
  private talkSmooth = 0;
  private time = Math.random() * 10;
  private idleSeed = Math.random() * 10;

  constructor(look: Look) {
    this.look = look;
    const h = look.height;
    this.H = h;
    this.hd = h * look.headRatio;
    this.L = h * (look.legRatio ?? 0.42);
    const neckLen = h * 0.022;
    const T = h - this.L - this.hd - neckLen;
    this.thighLen = this.L * 0.5;
    this.shinLen = this.L * 0.5 - h * 0.035;
    const arm = look.armRatio ?? 1;
    this.upLen = h * 0.18 * arm;
    this.foLen = h * 0.15 * arm;
    this.shoulderW = h * 0.23 * look.build * (look.shoulders ?? 1);
    const b = look.build;
    const s = h / 1.75; // Maßstab für Radien

    this.root.name = `char-${look.id}`;
    this.root.add(this.hips);
    this.hips.position.y = this.L;
    this.hips.add(this.spine);
    this.spine.add(this.chest);
    this.chest.position.y = T * 0.5;
    this.chestY = T * 0.5;
    this.chest.add(this.neck);
    this.neck.position.y = T * 0.5;
    this.neck.add(this.head);
    this.head.position.y = neckLen + this.hd * 0.48;

    // ── Materialien
    const skin = vinyl(look.skin, { rough: 0.55, warm: 0.12 });
    const front: Front = look.inner
      ? { kind: 'open', inner: look.inner.color, knots: look.inner.knots }
      : look.top.trim
        ? { kind: 'closed', trim: look.top.trim }
        : { kind: 'none' };
    const topTex = embroidery(
      look.top.color,
      look.top.gold ?? '#d9a94a',
      look.top.motif ?? 'plain',
      1,
      front,
    );
    const top = vinyl('#ffffff', { rough: 0.7, map: topTex });
    const sleeveTex = look.top.sleeveMotif
      ? embroidery(look.top.color, look.top.gold ?? '#d9a94a', look.top.sleeveMotif)
      : null;
    const sleeve = sleeveTex ? vinyl('#ffffff', { rough: 0.7, map: sleeveTex }) : top;
    const pantsTex = look.pants.motif
      ? embroidery(look.pants.color, look.pants.gold ?? '#d9a94a', look.pants.motif)
      : null;
    const pants = vinyl(pantsTex ? '#ffffff' : look.pants.color, { rough: 0.75, map: pantsTex });
    const hair = vinyl(look.hair, { rough: 0.5 });
    const shoe = vinyl(look.shoes.color, { rough: 0.45 });
    const sole = vinyl(look.shoes.sole ?? '#f2efe6', { rough: 0.6 });

    // ── Becken und Rumpf
    const pelvisR = 0.15 * s * b;
    const pelvis = mk(new SphereGeometry(1, 16, 10), pants);
    pelvis.scale.set(pelvisR * 1.15, pelvisR * 0.85, pelvisR);
    this.hips.add(pelvis);
    const torso = mk(torsoGeo(look.top.skirt < 0.2 && look.id === 'merchant' ? 0.12 : 0), top);
    torso.scale.set(this.shoulderW * 0.52, T, this.shoulderW * 0.46);
    torso.position.y = -0.02;
    this.spine.add(torso);
    // Stehkragen
    const collar = mk(
      new CylinderGeometry(0.06 * s * b, 0.075 * s * b, 0.05 * s, 14, 1, true),
      vinyl(look.inner?.color ?? look.top.trim ?? look.top.color, { rough: 0.7 }),
    );
    (collar.material as MeshStandardMaterial).side = DoubleSide;
    collar.position.y = T * 1.0;
    this.spine.add(collar);
    if (look.apron) {
      const ap = mk(
        new CylinderGeometry(1, 1.15, 1, 14, 1, true, -0.75, 1.5),
        vinyl(look.apron, { rough: 0.8 }),
      );
      ap.material = vinyl(look.apron, { rough: 0.8 });
      (ap.material as MeshStandardMaterial).side = DoubleSide;
      ap.scale.set(this.shoulderW * 0.4, this.L * 0.75, this.shoulderW * 0.4);
      ap.position.set(0, T * 0.35 - (this.L * 0.75) / 2 + 0.05, 0.01);
      this.hips.add(ap);
    }
    // Mantelschoß / Rock
    if (look.top.skirt > 0) {
      const len = this.L * look.top.skirt;
      const sk = new Group();
      const skirtTex = look.top.motif
        ? embroidery(
            look.top.color,
            look.top.gold ?? '#d9a94a',
            look.top.motif === 'dragon' ? 'cloud' : look.top.motif,
          )
        : null;
      const skMat = vinyl(skirtTex ? '#ffffff' : look.top.color, { rough: 0.7, map: skirtTex });
      skMat.side = DoubleSide;
      const m = mk(
        skirtGeo(this.shoulderW * 0.42, this.shoulderW * (0.5 + look.top.skirt * 0.2), len),
        skMat,
      );
      m.position.y = 0.04;
      sk.add(m);
      this.hips.add(sk);
      this.skirt = sk;
    }
    if (look.belt) {
      const belt = mk(
        new TorusGeometry(this.shoulderW * 0.4, 0.028 * s, 6, 20),
        vinyl(look.belt.color, { rough: 0.5 }),
      );
      belt.rotation.x = Math.PI / 2;
      belt.scale.set(1, 0.78, 1);
      belt.position.y = 0.02;
      this.spine.add(belt);
      if (look.belt.tassels) {
        const tm = vinyl(look.belt.color, { rough: 0.6 });
        const gold = vinyl('#d9a94a', { rough: 0.3, metal: 0.5 });
        for (const dx of [-0.05, 0.03]) {
          const knot = mk(new SphereGeometry(0.018 * s, 6, 5), gold, false);
          knot.position.set(this.shoulderW * 0.3 + dx, -0.03, this.shoulderW * 0.22);
          const tas = mk(new ConeGeometry(0.022 * s, 0.13 * s, 8), tm, false);
          tas.position.set(this.shoulderW * 0.3 + dx, -0.11 * s, this.shoulderW * 0.22);
          this.spine.add(knot, tas);
        }
      }
    }

    // ── Hals und Kopf
    const neckM = mk(limbGeo(0.045 * s * b, 0.05 * s * b, neckLen + 0.03), skin);
    neckM.position.y = neckLen + 0.02;
    this.neck.add(neckM);
    this.buildHead(skin, hair);

    // ── Arme
    for (const [arm, side] of [
      [this.armL, 1],
      [this.armR, -1],
    ] as const) {
      arm.sh.position.set(side * this.shoulderW * 0.45, T * 0.36, 0);
      this.chest.add(arm.sh);
      arm.sh.add(arm.up);
      const capM = mk(new SphereGeometry(0.07 * s * b, 14, 10), sleeve);
      capM.scale.set(1.05, 0.85, 1);
      capM.position.y = 0.01 * s;
      arm.sh.add(capM);
      const up = mk(limbGeo(0.068 * s * b, 0.056 * s * b, this.upLen), sleeve);
      arm.up.add(up);
      arm.fo.position.y = -this.upLen;
      arm.up.add(arm.fo);
      const fo = mk(limbGeo(0.056 * s * b, 0.048 * s * b, this.foLen), sleeve);
      arm.fo.add(fo);
      if (look.cuff) {
        const cuff = mk(
          new CylinderGeometry(0.062 * s * b, 0.06 * s * b, 0.07 * s, 12),
          vinyl(look.cuff, { rough: 0.7 }),
        );
        cuff.position.y = -this.foLen + 0.02;
        arm.fo.add(cuff);
      }
      arm.hand.position.y = -this.foLen - 0.03 * s;
      arm.fo.add(arm.hand);
      const hand = mk(new SphereGeometry(0.058 * s * b * (look.handScale ?? 1), 12, 10), skin);
      hand.scale.set(0.85, 1.15, 0.7);
      hand.position.y = -0.02 * s;
      arm.hand.add(hand);
      const thumb = mk(new SphereGeometry(0.018 * s * (look.handScale ?? 1), 6, 5), skin, false);
      thumb.position.set(-side * 0.02 * s, -0.005, 0.03 * s);
      arm.hand.add(thumb);
      this.detail.push(thumb);
      arm.up.rotation.z = side * 0.08;
    }

    // ── Beine
    for (const [leg, side] of [
      [this.legL, 1],
      [this.legR, -1],
    ] as const) {
      leg.th.position.set(side * pelvisR * 0.62, 0, 0);
      this.hips.add(leg.th);
      const wide = look.pants.wide ? 1.25 : 1;
      leg.th.add(mk(limbGeo(0.088 * s * b, 0.066 * s * b * wide, this.thighLen), pants));
      leg.sh.position.y = -this.thighLen;
      leg.th.add(leg.sh);
      leg.sh.add(
        mk(limbGeo(0.066 * s * b * wide, 0.058 * s * b * (wide > 1 ? 1.35 : 1), this.shinLen), pants),
      );
      leg.ft.position.y = -this.shinLen;
      leg.sh.add(leg.ft);
      const fs = look.footScale ?? 1;
      const shoeM = mk(new SphereGeometry(1, 12, 8), shoe);
      shoeM.scale.set(0.062 * s * fs, 0.052 * s, 0.125 * s * fs);
      shoeM.position.set(0, -0.025 * s, 0.035 * s * fs);
      leg.ft.add(shoeM);
      const soleM = mk(new CylinderGeometry(1, 1, 1, 12), sole, false);
      soleM.scale.set(0.066 * s * fs, 0.024 * s, 0.132 * s * fs);
      soleM.position.set(0, -0.062 * s, 0.035 * s * fs);
      leg.ft.add(soleM);
      if (look.shoes.stripe) {
        const st = mk(
          new TorusGeometry(0.052 * s, 0.006 * s, 4, 14, Math.PI),
          vinyl(look.shoes.stripe, { rough: 0.4 }),
          false,
        );
        st.rotation.y = Math.PI / 2;
        st.scale.set(1, 0.7, 2);
        st.position.set(side * 0.002, -0.03 * s, 0.03 * s);
        leg.ft.add(st);
        this.detail.push(st);
      }
    }

    // ── Requisiten
    if (look.prop) this.addProp(look.prop, true);
    this.root.traverse((o) => {
      o.matrixAutoUpdate = true;
    });
  }

  // ───────────────────────────────────────── Kopf und Gesicht

  private buildHead(skin: Material, hair: Material): void {
    const r = this.hd * 0.5;
    const L = this.look;
    const F: Face = { ...FACE, ...L.face };
    this.faceShape = F;
    const [kx, ky] = F.skull;
    this.skull = F.skull;
    const shape = headShape(F);
    const geo = new SphereGeometry(1, 40, 30);
    const pos = geo.getAttribute('position');
    const v = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const p = shape(v.normalize());
      pos.setXYZ(i, p.x * r, p.y * r, p.z * r);
    }
    geo.computeVertexNormals();
    const headM = mk(geo, skin);
    this.head.add(headM);
    // Punkt auf der Gesichtsoberfläche zu (x, y): z-Wert, iterativ über die Verformung gelöst
    const surf = (x: number, y: number): number => {
      let ux = x / (r * kx);
      let uy = y / (r * ky);
      let p = new Vector3();
      for (let k = 0; k < 5; k++) {
        const uz = Math.sqrt(Math.max(0.02, 1 - ux * ux - uy * uy));
        p = shape(new Vector3(ux, uy, uz).normalize());
        if (Math.abs(p.x) > 1e-4) ux *= x / r / p.x;
        if (Math.abs(p.y) > 1e-4) uy *= y / r / p.y;
        ux = Math.max(-0.99, Math.min(0.99, ux));
        uy = Math.max(-0.99, Math.min(0.99, uy));
      }
      return p.z * r;
    };
    for (const sx of [-1, 1]) {
      const side = shape(new Vector3(sx, -0.05, -0.05).normalize());
      const ear = mk(new SphereGeometry(r * 0.17 * F.earSize, 10, 8), skin, false);
      ear.scale.set(0.55, 1.1, 0.8);
      ear.position.set(side.x * r * 0.97, -r * 0.05, -r * 0.04);
      ear.rotation.y = sx * F.earOut;
      ear.rotation.z = -sx * F.earOut * 0.3;
      this.head.add(ear);
    }
    this.head.add(this.face);
    const white = vinyl('#fbf7f0', { rough: 0.3, rim: 0 });
    const iris = vinyl(F.iris, { rough: 0.2, rim: 0 });
    const shine = new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1 });
    const crease = vinyl(shade(L.skin, 0.72), { rough: 0.7, rim: 0 });
    const browMat = vinyl(L.brows ?? L.hair, { rough: 0.6 });
    const lash = vinyl('#1c120c', { rough: 0.5, rim: 0 });
    for (const sx of [-1, 1]) {
      const eye = new Group();
      const ex = sx * r * F.eyeGap * kx;
      const ey = r * F.eyeY;
      eye.position.set(ex, ey, surf(ex, ey) - r * 0.08);
      const shape = new Group();
      shape.scale.set(F.eyeW, F.eyeH, 1);
      // mandelförmig: außen leicht höher
      shape.rotation.z = sx * 0.08 * (1 - F.eyeH);
      const ew = mk(new SphereGeometry(r * 0.2, 14, 10), white, false);
      ew.scale.set(0.85, 1.05, 0.55);
      const ir = mk(new SphereGeometry(r * 0.13, 12, 8), iris, false);
      ir.scale.set(0.9, 1.05, 0.5);
      ir.position.z = r * 0.08;
      const sh = mk(new SphereGeometry(r * 0.04, 6, 5), shine, false);
      sh.position.set(r * 0.04, r * 0.05, r * 0.15);
      shape.add(ew, ir, sh);
      eye.add(shape);
      // Oberlid-Linie: macht schmale Augen mandelförmig
      if (F.eyeH < 0.9) {
        const lid = mk(new TorusGeometry(r * 0.19, r * 0.022, 5, 12, Math.PI * 0.8), lash, false);
        lid.scale.set(F.eyeW * 0.95, F.eyeH * 1.05, 0.6);
        lid.rotation.z = Math.PI * 0.1 + sx * 0.06;
        lid.position.set(0, r * 0.012, r * 0.055);
        eye.add(lid);
      }
      this.face.add(eye);
      this.eyes.push(eye);
      // Lachfältchen: zwei, drei feine Bögen am äußeren Augenwinkel
      if (F.laughLines > 0) {
        const n = F.laughLines > 0.6 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          // kurze, leicht gebogene Linien, fächerförmig vom Augenwinkel nach außen
          const len = r * (0.11 + F.laughLines * 0.04);
          const ln = mk(limbGeo(r * 0.01, r * 0.006, len, 5), crease, false);
          const x = ex + sx * r * (0.2 * F.eyeW + 0.03);
          const y = ey + r * (0.03 - i * 0.05);
          ln.position.set(x, y, surf(x, y) - r * 0.004);
          ln.rotation.order = 'YZX';
          ln.rotation.set(0, sx * 0.8, sx * (Math.PI / 2 + 0.35 - i * 0.35));
          this.face.add(ln);
          this.detail.push(ln);
        }
      }
      // Augenbrauen
      const bl = r * 0.26 * F.browLen;
      const brow = mk(limbGeo(r * 0.045 * F.browThick, r * 0.035 * F.browThick, bl, 6), browMat, false);
      const bx = ex + sx * r * 0.05;
      const by = r * F.browY;
      brow.rotation.order = 'YZX';
      brow.rotation.z = (sx * Math.PI) / 2 + sx * F.browTilt * (L.beard ? -2 : 1);
      brow.rotation.y = sx * 0.35;
      brow.position.set(bx - sx * bl * 0.5, by, surf(bx, by) + r * 0.03 * F.browThick);
      brow.scale.set(1, 1, 0.7);
      if (F.browArch > 0) brow.rotation.x = -F.browArch * 0.3;
      this.face.add(brow);
      this.brows.push(brow);
      // Wangenröte
      if (F.blush > 0) {
        const blush = mk(
          new SphereGeometry(r * 0.13, 8, 6),
          vinyl('#f08a7a', { transparent: true, opacity: F.blush, rim: 0 }),
          false,
        );
        blush.scale.set(1, 0.6, 0.3);
        const x = sx * r * 0.55 * kx;
        const y = -r * 0.2;
        blush.position.set(x, y, surf(x, y) + r * (F.cheeks > 0 ? 0.03 : -0.04));
        this.face.add(blush);
      }
    }
    // Stirnfalten
    if (F.foreheadLines > 0) {
      const fl = vinyl(shade(L.skin, 0.8), {
        transparent: true,
        opacity: 0.35 + F.foreheadLines * 0.4,
        rim: 0,
      });
      for (let i = 0; i < 2; i++) {
        const y = r * (0.52 + i * 0.12);
        const line = mk(new TorusGeometry(surf(0, y) * 0.99, r * 0.008, 3, 16, 0.7), fl, false);
        line.rotation.set(Math.PI / 2 - (y / (r * ky)) * 0.9, 0, Math.PI / 2 - 0.35);
        line.position.y = y;
        this.face.add(line);
        this.detail.push(line);
      }
    }
    // Nase: Rücken, Spitze, Flügel
    const ny = -r * 0.12 * F.noseH;
    const nz = surf(0, ny);
    if (F.noseBridge > 0) {
      // Nasenrücken: flaches, längliches Polster zwischen den Augen bis zur Spitze
      const by = ny + r * 0.2 * F.noseH;
      const bridge = mk(new SphereGeometry(r * 0.1, 12, 10), skin, false);
      bridge.scale.set(0.6 * F.noseW * F.noseBridge, 1.9 * F.noseH, 0.5);
      bridge.position.set(0, by, surf(0, by) - r * 0.02);
      bridge.rotation.x = -0.25;
      this.face.add(bridge);
    }
    const nose = mk(new SphereGeometry(r * 0.11 * F.noseTip, 12, 10), skin, false);
    nose.scale.set(F.noseW, 0.85, 0.8);
    nose.position.set(0, ny, nz - r * 0.005);
    this.face.add(nose);
    if (F.noseWings > 0) {
      for (const sx of [-1, 1]) {
        const wing = mk(new SphereGeometry(r * 0.07 * F.noseWings, 8, 6), skin, false);
        wing.scale.set(1, 0.8, 0.8);
        const x = sx * r * 0.1 * F.noseW;
        wing.position.set(x, ny - r * 0.03, surf(x, ny) - r * 0.02);
        this.face.add(wing);
      }
    }
    // Mund (schiefes Lächeln: Bogen gedreht, ein Winkel höher)
    const lipMat = vinyl('#8a2a24', { rough: 0.4, rim: 0 });
    const my = r * F.mouthY;
    const mz = surf(0, my) - r * 0.06;
    this.mouthSmile = mk(new TorusGeometry(r * 0.17 * F.mouthW, r * 0.03, 6, 14, Math.PI), lipMat, false);
    this.mouthSmile.rotation.z = Math.PI + F.smirk * 0.16;
    this.mouthSmile.scale.set(1, 0.8, 1);
    this.mouthSmile.position.set(F.smirk * r * 0.02, my, mz);
    this.mouthOpen = mk(new SphereGeometry(r * 0.15, 12, 8), vinyl('#5a1a16', { rough: 0.4, rim: 0 }), false);
    this.mouthOpen.scale.set(F.mouthW, 0.2, 0.4);
    this.mouthOpen.position.set(0, my - r * 0.06, mz);
    this.face.add(this.mouthSmile, this.mouthOpen);
    if (F.lip > 0) {
      const lower = mk(new SphereGeometry(r * 0.1, 10, 6), vinyl(shade(L.skin, 0.88), { rough: 0.5 }), false);
      lower.scale.set(1.3 * F.mouthW, 0.35 * F.lip, 0.5);
      lower.position.set(0, my - r * 0.17, surf(0, my - r * 0.17) - r * 0.03);
      this.face.add(lower);
    }
    this.detail.push(this.face);
    const kit = L.hairModel ? hairKit() : null;
    if (kit && L.hairModel) {
      this.modelHair = true;
      for (const fit of L.hairModel) this.addHairModel(fit, r);
      if (L.keepDrawnHair) this.buildHair(r, hair);
      else if (L.beard && !L.hairModel.some((f) => f.piece === 'Hair_Beard')) this.buildBeard(r);
      if (L.hairModel.some((f) => f.piece.startsWith('Eyebrows')))
        for (const b of this.brows) b.visible = false;
    } else this.buildHair(r, hair);
  }

  /** Haarmodell auf den Kopf setzen: Einheitsschädel → Kopfradius × Schädelform */
  private addHairModel(fit: HairFit, r: number): void {
    const part = hairKit()?.get(fit.piece);
    if (!part) return;
    const mat = vinyl(fit.color ?? this.look.hair, { rough: 0.55 });
    mat.map = part.map;
    mat.normalMap = part.normalMap;
    mat.side = DoubleSide;
    // Die Grundtextur ist grau (~0.55); aufhellen, damit die Haarfarbe stimmt
    const hsl = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(hsl);
    mat.color.multiplyScalar(hsl.l > 0.5 ? 1.75 : 1.35);
    const m = mk(part.geo, mat);
    const [kx, ky, kz] = this.skull;
    const [sx, sy, sz] = fit.scale ?? [1, 1, 1];
    m.scale.set(r * kx * sx, r * ky * sy, r * kz * sz);
    const [ox, oy, oz] = fit.offset ?? [0, 0, 0];
    m.position.set(ox * r, oy * r, oz * r);
    m.rotation.x = fit.tilt ?? 0;
    this.head.add(m);
  }

  private buildHair(r: number, hair: Material): void {
    const st = this.look.hairStyle;
    const cap = (cover: number, scale = 1.06, tilt = -0.25): Mesh => {
      const m = mk(new SphereGeometry(r * scale, 22, 14, 0, Math.PI * 2, 0, Math.PI * cover), hair);
      m.rotation.x = tilt;
      this.head.add(m);
      return m;
    };
    if (st === 'crop') {
      // kurz, dunkel, eng anliegend
      cap(0.46, 1.05, -0.5);
      const back = mk(
        new SphereGeometry(r * 1.03, 18, 10, Math.PI, Math.PI, Math.PI * 0.2, Math.PI * 0.42),
        hair,
      );
      this.head.add(back);
    }
    if (st === 'fringe' || st === 'kidBuns' || st === 'ponytail' || st === 'side') {
      cap(0.48, 1.07, -0.5);
      const back = mk(
        new SphereGeometry(r * 1.05, 18, 10, Math.PI, Math.PI, Math.PI * 0.2, Math.PI * 0.5),
        hair,
      );
      this.head.add(back);
      // Ponyfransen
      const n = st === 'side' ? 4 : 7;
      for (let i = 0; i < n; i++) {
        const a = -0.75 + (i / (n - 1)) * 1.5;
        const tuft = mk(new ConeGeometry(r * 0.13, r * 0.42, 6), hair, false);
        tuft.position.set(Math.sin(a) * r * 0.85, r * 0.5, Math.cos(a) * r * 0.78);
        tuft.rotation.set(Math.PI + 0.55, 0, -a * 0.6 + (st === 'side' ? 0.4 : 0));
        this.head.add(tuft);
      }
    }
    if (st === 'sweep') {
      // dichter, seitlich fallender Pony: flache Strähnen vom Scheitel schräg über die Stirn
      const [kx, ky, kz] = this.skull;
      if (!this.modelHair) {
        cap(0.5, 1.08, -0.45);
        const back = mk(
          new SphereGeometry(r * 1.07, 18, 10, Math.PI, Math.PI, Math.PI * 0.15, Math.PI * 0.55),
          hair,
        );
        this.head.add(back);
      }
      const locks = 6;
      for (let i = 0; i < locks; i++) {
        const t = i / (locks - 1);
        const x = r * kx * (0.42 - t * 0.78);
        const y = r * ky * (0.66 - t * 0.12 - Math.abs(t - 0.4) * 0.1);
        const nx = x / (r * kx);
        const ny = y / (r * ky);
        const z = r * kz * Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny)) + r * 0.03;
        const lock = mk(new SphereGeometry(r * 0.24, 10, 8), hair, false);
        lock.scale.set(0.5, 1.25, 0.32);
        lock.position.set(x, y, z);
        lock.rotation.set(-0.55 + ny * 0.3, nx * 0.6, 0.9 - t * 0.3);
        this.head.add(lock);
      }
    }
    if (st === 'kidBuns') {
      for (const sx of [-1, 1]) {
        const bun = mk(new SphereGeometry(r * 0.28, 12, 8), hair);
        bun.position.set(sx * r * 0.62, r * 0.78, -r * 0.1);
        this.head.add(bun);
      }
    }
    if (st === 'ponytail') {
      const tail = mk(limbGeo(r * 0.2, r * 0.08, r * 1.0), hair);
      tail.position.set(0, r * 0.55, -r * 0.85);
      tail.rotation.x = 0.4;
      this.head.add(tail);
    }
    if (st === 'bun') {
      cap(0.48, 1.06, -0.45);
      const bun = mk(new SphereGeometry(r * 0.38, 14, 10), hair);
      bun.position.set(0, r * 0.75, -r * 0.6);
      this.head.add(bun);
      const pin = mk(
        new CylinderGeometry(r * 0.025, r * 0.025, r * 1.3, 5),
        vinyl('#c99a3a', { rough: 0.3, metal: 0.5 }),
        false,
      );
      pin.rotation.z = 1.1;
      pin.position.set(0, r * 0.8, -r * 0.62);
      this.head.add(pin);
    }
    if (st === 'cap') {
      const c = mk(
        new SphereGeometry(r * 1.08, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
        vinyl('#2b2a33', { rough: 0.6 }),
      );
      c.rotation.x = -0.15;
      this.head.add(c);
      const knot = mk(new SphereGeometry(r * 0.12, 8, 6), vinyl('#b3261a', { rough: 0.5 }));
      knot.position.y = r * 1.06;
      this.head.add(knot);
      const back = mk(
        new SphereGeometry(r * 1.03, 16, 8, Math.PI, Math.PI, Math.PI * 0.3, Math.PI * 0.35),
        hair,
      );
      this.head.add(back);
    }
    if (st === 'straw') {
      cap(0.45, 1.05, -0.5);
      const hat = mk(new ConeGeometry(r * 2.1, r * 0.95, 20, 1, true), vinyl('#d9b56a', { rough: 0.9 }));
      (hat.material as MeshStandardMaterial).side = DoubleSide;
      hat.position.y = r * 1.05;
      this.head.add(hat);
    }
    if (st === 'elder') {
      // Glatze, weißer Haarkranz, langer Bart und Schnurrbart
      const ring = mk(new TorusGeometry(r * 0.88, r * 0.16, 8, 20, Math.PI * 1.25), hair);
      ring.rotation.set(Math.PI / 2 - 0.35, 0, Math.PI * 0.12 + Math.PI);
      ring.position.set(0, r * 0.05, -r * 0.08);
      this.head.add(ring);
      const top = mk(new SphereGeometry(r * 0.25, 10, 8), hair);
      top.position.set(0, r * 0.98, -r * 0.35);
      top.scale.set(1, 0.6, 1);
      this.head.add(top);
    }
    if (this.look.beard && !this.look.hairModel?.some((f) => f.piece === 'Hair_Beard' && hairKit()))
      this.buildBeard(r);
  }

  private buildBeard(r: number): void {
    {
      const beard = mk(new ConeGeometry(r * 0.42, r * 1.5, 12), vinyl(this.look.hair, { rough: 0.6 }));
      beard.rotation.x = Math.PI + 0.25;
      beard.position.set(0, -r * 1.05, r * 0.6);
      this.head.add(beard);
      for (const sx of [-1, 1]) {
        const mus = mk(
          limbGeo(r * 0.07, r * 0.03, r * 0.55, 6),
          vinyl(this.look.hair, { rough: 0.6 }),
          false,
        );
        mus.position.set(sx * r * 0.08, -r * 0.24, r * 0.95);
        mus.rotation.z = sx * 1.0;
        this.head.add(mus);
        this.detail.push(mus);
      }
    }
  }

  // ───────────────────────────────────────── Requisiten

  private addProp(p: Exclude<Prop, null>, visible: boolean): Mesh | Group {
    const s = this.H / 1.75;
    let m: Mesh | Group;
    switch (p) {
      case 'ball': {
        m = mk(new SphereGeometry(0.12, 18, 12), vinyl('#ffffff', { rough: 0.6, map: ballTexture() }));
        this.ball = m as Mesh;
        this.chest.add(m);
        break;
      }
      case 'fan': {
        const g = new Group();
        const leaf = mk(
          new CircleGeometry(0.16 * s, 16, 0, Math.PI),
          vinyl('#e9d9b0', { rough: 0.8 }),
          false,
        );
        (leaf.material as MeshStandardMaterial).side = DoubleSide;
        leaf.rotation.set(0, Math.PI / 2, Math.PI / 2);
        g.add(leaf);
        const red = mk(new CircleGeometry(0.07 * s, 12, 0, Math.PI), vinyl('#b3261a', { rough: 0.8 }), false);
        (red.material as MeshStandardMaterial).side = DoubleSide;
        red.rotation.copy(leaf.rotation);
        red.position.x = 0.002;
        g.add(red);
        g.position.y = -0.05;
        m = g;
        this.armR.hand.add(m);
        break;
      }
      case 'brush': {
        const g = new Group();
        g.add(mk(new CylinderGeometry(0.008, 0.008, 0.2 * s, 6), vinyl('#6a3a1a'), false));
        const tip = mk(new ConeGeometry(0.014, 0.05, 6), vinyl('#1c130e'), false);
        tip.rotation.x = Math.PI;
        tip.position.y = -0.12 * s;
        g.add(tip);
        g.rotation.x = 0.5;
        g.position.set(0, -0.04, 0.03);
        m = g;
        this.armR.hand.add(m);
        break;
      }
      case 'teapot': {
        const pts = [0, 0.2, 0.45, 0.7, 0.9, 1].map(
          (t) => new Vector2(0.02 + Math.sin(t * Math.PI * 0.95) * 0.07, t * 0.11),
        );
        m = mk(new LatheGeometry(pts, 14), vinyl('#7a3a22', { rough: 0.4 }), false);
        m.position.set(0, -0.11, 0.04);
        this.armR.hand.add(m);
        break;
      }
      case 'cup': {
        const pts = [
          new Vector2(0.0001, 0),
          new Vector2(0.025, 0),
          new Vector2(0.036, 0.045),
          new Vector2(0.032, 0.045),
        ];
        m = mk(new LatheGeometry(pts, 12), vinyl('#ece6d6', { rough: 0.25 }), false);
        m.position.set(0, -0.06, 0.03);
        this.armR.hand.add(m);
        break;
      }
      case 'bowl': {
        const pts = [
          new Vector2(0.0001, 0),
          new Vector2(0.03, 0),
          new Vector2(0.05, 0.035),
          new Vector2(0.047, 0.036),
        ];
        m = mk(new LatheGeometry(pts, 12), vinyl('#dfe6e2', { rough: 0.25 }), false);
        m.position.set(0, -0.06, 0.03);
        this.armL.hand.add(m);
        break;
      }
    }
    m.visible = visible;
    this.props[p] = m;
    return m;
  }

  /** Requisit zeigen/verstecken (wird bei Bedarf erzeugt) */
  showProp(p: Exclude<Prop, null>, on: boolean): void {
    const m = this.props[p] ?? (on ? this.addProp(p, on) : null);
    if (m) m.visible = on;
  }

  // ───────────────────────────────────────── Steuerung

  get position(): Vector3 {
    return this.root.position;
  }

  get yaw(): number {
    return this.root.rotation.y;
  }

  set yaw(v: number) {
    this.root.rotation.y = v;
  }

  /** Höhe des Kopfes (Weltkoordinaten), z. B. für Sprechblasen und Kamera */
  headWorld(out = new Vector3()): Vector3 {
    return this.head.getWorldPosition(out);
  }

  get headTopY(): number {
    return this.H;
  }

  sitDown(seatH: number): void {
    this.seatH = seatH;
    this.sitTarget = 1;
  }

  standUp(): void {
    this.sitTarget = 0;
  }

  get sitting(): boolean {
    return this.sitTarget > 0.5;
  }

  get sitAmount(): number {
    return this.sit;
  }

  /** Einmalige Geste (mit Ein- und Ausblenden) */
  play(a: Action, dur = 1.4): void {
    this.actions.set(a, { t: 0, dur, loop: false, w: this.actions.get(a)?.w ?? 0, stopping: false });
    if (a === 'drink') this.showProp('cup', true);
  }

  /** Dauerhafte Tätigkeit (z. B. Schreiben, Fächeln, Polieren) */
  hold(a: Action): void {
    const cur = this.actions.get(a);
    if (cur && cur.loop && !cur.stopping) return;
    this.actions.set(a, { t: 0, dur: 1, loop: true, w: cur?.w ?? 0, stopping: false });
  }

  stop(a: Action): void {
    const cur = this.actions.get(a);
    if (cur) cur.stopping = true;
  }

  isPlaying(a: Action): boolean {
    const c = this.actions.get(a);
    return !!c && !c.stopping && (c.loop || c.t < c.dur);
  }

  lookAt(p: Vector3 | null): void {
    this.lookTarget = p ? p.clone() : null;
  }

  /** Feinheiten (Gesicht, Finger) nur in der Nähe zeigen */
  setDetail(on: boolean): void {
    for (const d of this.detail) d.visible = on;
  }

  // ───────────────────────────────────────── Animation

  private w(a: Action): number {
    return this.actions.get(a)?.w ?? 0;
  }

  /** Normierter Verlauf einer einmaligen Geste (0..1) */
  private u(a: Action): number {
    const s = this.actions.get(a);
    return s ? Math.min(1, s.t / s.dur) : 0;
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    // Gesten ein-/ausblenden
    for (const [a, s] of this.actions) {
      s.t += dt;
      const ending = s.stopping || (!s.loop && s.t > s.dur - 0.25);
      s.w = Math.max(0, Math.min(1, s.w + (ending ? -dt : dt) * 5));
      if (ending && s.w <= 0) {
        this.actions.delete(a);
        if (a === 'drink') this.showProp('cup', false);
      }
    }
    this.sit += (this.sitTarget - this.sit) * Math.min(1, dt * 4);
    const sitK = this.sit;
    const speed = this.speed * (1 - sitK);
    const walk = Math.min(1, speed / 1.4);
    const run = Math.max(0, Math.min(1, (speed - 2.0) / 1.6));
    const stride = 0.9 * (this.H / 1.75) * (1 + run * 0.5);
    this.phase += (speed / stride) * Math.PI * dt;
    const p = this.phase;

    // ── Grundhaltung zurücksetzen
    const legs = [
      [this.legL, 0],
      [this.legR, Math.PI],
    ] as const;
    const arms = [
      [this.armL, 1, Math.PI],
      [this.armR, -1, 0],
    ] as const;
    const breathe = Math.sin(t * 1.6 + this.idleSeed) * 0.012;
    let hipY = this.L;
    let spineX = 0.02 + run * 0.22;
    let spineY = Math.sin(p) * 0.08 * walk;
    const spineZ = 0;
    let headX = 0;
    let headY = 0;
    let headZ = 0;
    this.chest.scale.set(1, 1 + breathe, 1);
    let bounce = 0;
    this.hips.rotation.set(0, -Math.sin(p) * 0.06 * walk, Math.sin(p) * 0.03 * walk);

    // ── Beine: Gehen/Laufen und Sitzen
    for (const [leg, off] of legs) {
      const ph = p + off;
      const swing = Math.sin(ph) * (0.42 * walk + 0.3 * run);
      const knee = Math.max(0, Math.sin(ph + 1.3)) * (0.75 * walk + 0.7 * run) + 0.04 * walk;
      leg.th.rotation.set(-swing * (1 - sitK) - 1.5 * sitK, 0, 0);
      leg.sh.rotation.set(knee * (1 - sitK) + 1.5 * sitK, 0, 0);
      leg.ft.rotation.set(Math.sin(ph - 0.5) * 0.2 * walk * (1 - sitK), 0, 0);
    }
    hipY -= Math.abs(Math.cos(p)) * 0.025 * walk * (this.H / 1.75);
    hipY = hipY * (1 - sitK) + (this.seatH + 0.08 * (this.H / 1.75)) * sitK;
    spineX += 0.04 * sitK;

    // ── Arme: Pendeln
    for (const [arm, side, off] of arms) {
      const swing = Math.sin(p + off) * (0.4 * walk + 0.3 * run);
      arm.up.rotation.set(swing, 0, side * (0.13 + run * 0.1) + side * 0.06 * sitK);
      arm.fo.rotation.set(-0.15 - run * 1.1 - 0.5 * sitK, 0, 0);
      arm.hand.rotation.set(0, 0, 0);
    }
    // Ball unterm linken Arm: Arm leicht abgespreizt
    if (this.ball && this.look.prop === 'ball') {
      this.armL.up.rotation.z += 0.32;
      this.armL.up.rotation.x = this.armL.up.rotation.x * 0.3 - 0.1;
      this.armL.fo.rotation.x = -0.9;
    }

    // ── Gesten
    const R = this.armR;
    const Lm = this.armL;
    const k = (a: Action): number => this.w(a);
    let e: number;
    if ((e = k('wave'))) {
      R.up.rotation.z = R.up.rotation.z * (1 - e) - 2.5 * e;
      R.up.rotation.x *= 1 - e;
      R.fo.rotation.z = Math.sin(t * 11) * 0.45 * e;
      R.fo.rotation.x = R.fo.rotation.x * (1 - e) - 0.25 * e;
      headZ += 0.1 * e;
    }
    if ((e = k('bow'))) {
      const s = Math.sin(this.u('bow') * Math.PI);
      spineX += 0.6 * e * s;
      headX += 0.25 * e * s;
      for (const arm of [R, Lm]) arm.up.rotation.x = arm.up.rotation.x * (1 - e) + 0.15 * e;
    }
    if ((e = k('nod'))) headX += Math.sin(this.u('nod') * Math.PI * 4) * 0.2 * e;
    let laughOpen = 0;
    if ((e = k('laugh'))) {
      spineX -= 0.14 * e;
      headX -= 0.2 * e;
      bounce += Math.abs(Math.sin(t * 16)) * 0.012 * e;
      laughOpen = e;
      for (const [arm, side] of [
        [R, -1],
        [Lm, 1],
      ] as const)
        arm.up.rotation.z += side * 0.18 * e;
    }
    if ((e = k('drink'))) {
      const s = Math.sin(Math.min(1, this.u('drink') * 1.15) * Math.PI);
      R.up.rotation.x = R.up.rotation.x * (1 - e) - 1.0 * e * (0.4 + 0.6 * s);
      R.up.rotation.z = R.up.rotation.z * (1 - e) + 0.35 * e;
      R.fo.rotation.x = R.fo.rotation.x * (1 - e) - 1.9 * e * (0.3 + 0.7 * s);
      headX -= 0.18 * e * s;
    }
    if ((e = k('pour'))) {
      R.up.rotation.x = R.up.rotation.x * (1 - e) - 0.85 * e;
      R.fo.rotation.x = R.fo.rotation.x * (1 - e) - 0.5 * e;
      R.hand.rotation.z = -Math.sin(Math.min(1, this.u('pour') * 1.3) * Math.PI) * 0.8 * e;
      Lm.up.rotation.x = Lm.up.rotation.x * (1 - e) - 0.5 * e;
      Lm.fo.rotation.x = Lm.fo.rotation.x * (1 - e) - 0.9 * e;
      headX += 0.25 * e;
    }
    if ((e = k('polish'))) {
      R.up.rotation.x = R.up.rotation.x * (1 - e) + (-0.75 + Math.sin(t * 5) * 0.12) * e;
      R.up.rotation.z = R.up.rotation.z * (1 - e) + (0.35 + Math.cos(t * 5) * 0.12) * e;
      R.fo.rotation.x = R.fo.rotation.x * (1 - e) - 1.2 * e;
      Lm.up.rotation.x = Lm.up.rotation.x * (1 - e) - 0.6 * e;
      Lm.up.rotation.z = Lm.up.rotation.z * (1 - e) - 0.25 * e;
      Lm.fo.rotation.x = Lm.fo.rotation.x * (1 - e) - 1.2 * e;
      headX += 0.3 * e;
    }
    if ((e = k('write'))) {
      R.up.rotation.x = R.up.rotation.x * (1 - e) - 0.7 * e;
      R.up.rotation.z = R.up.rotation.z * (1 - e) + 0.2 * e;
      R.fo.rotation.x = R.fo.rotation.x * (1 - e) + (-0.95 + Math.sin(t * 5) * 0.08) * e;
      R.hand.rotation.z = Math.sin(t * 7) * 0.15 * e;
      headX += 0.32 * e;
      spineX += 0.12 * e;
    }
    if ((e = k('fan'))) {
      R.up.rotation.x = R.up.rotation.x * (1 - e) - 0.5 * e;
      R.up.rotation.z = R.up.rotation.z * (1 - e) + 0.45 * e;
      R.fo.rotation.x = R.fo.rotation.x * (1 - e) - 1.85 * e;
      R.hand.rotation.y = Math.sin(t * 9) * 0.6 * e;
    }
    if ((e = k('play'))) {
      const s = Math.max(0, Math.sin(this.u('play') * Math.PI));
      R.up.rotation.x = R.up.rotation.x * (1 - e) - (0.5 + 0.55 * s) * e;
      R.fo.rotation.x = R.fo.rotation.x * (1 - e) - (0.9 - 0.6 * s) * e;
      spineX += 0.15 * e * s;
      headX += 0.3 * e;
    }
    if ((e = k('think'))) {
      R.up.rotation.x = R.up.rotation.x * (1 - e) - 0.55 * e;
      R.up.rotation.z = R.up.rotation.z * (1 - e) + 0.55 * e;
      R.fo.rotation.x = R.fo.rotation.x * (1 - e) - 2.15 * e;
      headZ += 0.12 * e;
      headX -= 0.08 * e;
    }
    if ((e = k('point'))) {
      R.up.rotation.x = R.up.rotation.x * (1 - e) - 1.35 * e;
      R.fo.rotation.x = R.fo.rotation.x * (1 - e) - 0.1 * e;
    }
    if ((e = k('shrug'))) {
      for (const [arm, side] of [
        [R, -1],
        [Lm, 1],
      ] as const) {
        arm.up.rotation.z = arm.up.rotation.z * (1 - e) + side * 0.35 * e;
        arm.fo.rotation.x = arm.fo.rotation.x * (1 - e) - 1.1 * e;
        arm.fo.rotation.z = -side * 0.5 * e;
      }
      headZ += 0.15 * e;
    }
    if ((e = k('kungfu'))) {
      const s = Math.sin(Math.min(1, this.u('kungfu') * 1.2) * Math.PI);
      Lm.up.rotation.x = Lm.up.rotation.x * (1 - e) - 1.3 * e * s;
      Lm.fo.rotation.x = Lm.fo.rotation.x * (1 - e) - 0.25 * e;
      Lm.hand.rotation.x = -0.9 * e * s;
      R.up.rotation.x = R.up.rotation.x * (1 - e) + 0.3 * e;
      R.fo.rotation.x = R.fo.rotation.x * (1 - e) - 1.9 * e;
      hipY -= 0.07 * e * s * (1 - sitK);
      for (const [leg, side] of legs.map(([l], i) => [l, i ? -1 : 1] as const)) {
        leg.th.rotation.x -= 0.35 * e * s * (1 - sitK);
        leg.th.rotation.z = side * 0.18 * e * s * (1 - sitK);
        leg.sh.rotation.x += 0.6 * e * s * (1 - sitK);
      }
      spineY += 0.35 * e * s;
    }
    let spinBall = 0;
    if ((e = k('spin'))) {
      const s = Math.sin(Math.min(1, this.u('spin') * 1.1) * Math.PI);
      R.up.rotation.x = R.up.rotation.x * (1 - e) - 2.7 * e * s;
      R.up.rotation.z = R.up.rotation.z * (1 - e) + 0.2 * e;
      R.fo.rotation.x = R.fo.rotation.x * (1 - e) - 0.2 * e;
      headX -= 0.35 * e * s;
      spinBall = e * s;
    }
    if ((e = k('duck'))) {
      const s = Math.sin(this.u('duck') * Math.PI);
      spineX += 0.42 * e * s;
      headX += 0.3 * e * s;
      hipY -= 0.12 * e * s * (this.H / 1.75);
      for (const [leg] of legs) {
        leg.th.rotation.x -= 0.4 * e * s;
        leg.sh.rotation.x += 0.75 * e * s;
      }
    }
    this.stoopSmooth += (this.stoop - this.stoopSmooth) * Math.min(1, dt * 6);
    if (this.stoopSmooth > 0.01) {
      const st = this.stoopSmooth;
      spineX += 0.5 * st;
      headX += 0.25 * st;
      hipY -= 0.1 * st * (this.H / 1.75);
      for (const [leg] of legs) {
        leg.th.rotation.x -= 0.3 * st;
        leg.sh.rotation.x += 0.55 * st;
      }
    }
    if ((e = k('pet'))) {
      const s = Math.sin(Math.min(1, this.u('pet') * 1.1) * Math.PI);
      spineX += 0.75 * e * s;
      hipY -= 0.25 * e * s * (this.H / 1.75);
      for (const [leg] of legs) {
        leg.th.rotation.x -= 0.9 * e * s;
        leg.sh.rotation.x += 1.5 * e * s;
      }
      R.up.rotation.x = R.up.rotation.x * (1 - e) - 0.9 * e * s;
      R.fo.rotation.x = R.fo.rotation.x * (1 - e) - 0.2 * e;
      R.hand.rotation.x = Math.sin(t * 6) * 0.3 * e;
      headX += 0.2 * e;
    }
    if ((e = k('hop'))) {
      hipY += Math.abs(Math.sin(this.u('hop') * Math.PI * 3)) * 0.1 * e;
      for (const arm of [R, Lm]) arm.up.rotation.x -= 0.4 * e;
    }
    if ((e = k('clap'))) {
      const c = Math.abs(Math.sin(t * 10));
      for (const [arm, side] of [
        [R, -1],
        [Lm, 1],
      ] as const) {
        arm.up.rotation.x = arm.up.rotation.x * (1 - e) - 0.9 * e;
        arm.up.rotation.z = arm.up.rotation.z * (1 - e) - side * (0.25 + c * 0.25) * e;
        arm.fo.rotation.x = arm.fo.rotation.x * (1 - e) - 0.9 * e;
      }
    }

    // ── Kopf zum Blickziel drehen (begrenzt), Rest über den Oberkörper
    let wantYaw: number;
    let wantPitch = 0;
    if (this.lookTarget) {
      const local = this.root.worldToLocal(this.lookTarget.clone());
      const headPos = new Vector3(0, this.H - this.hd * 0.5, 0);
      const d = local.sub(headPos);
      wantYaw = Math.atan2(d.x, d.z);
      wantPitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
      if (Math.abs(wantYaw) > 1.9) {
        wantYaw = 0;
        wantPitch = 0;
      }
      wantYaw = Math.max(-1.25, Math.min(1.25, wantYaw));
      wantPitch = Math.max(-0.5, Math.min(0.45, wantPitch));
    } else {
      wantYaw = Math.sin(t * 0.23 + this.idleSeed) * 0.15 * (1 - walk);
    }
    this.lookYaw += (wantYaw - this.lookYaw) * Math.min(1, dt * 4);
    this.lookPitch += (wantPitch - this.lookPitch) * Math.min(1, dt * 4);
    spineY += this.lookYaw * 0.3;
    headY += this.lookYaw * 0.7;
    headX += this.lookPitch * 0.8;

    // ── Anwenden
    this.hips.position.y = hipY;
    this.spine.rotation.set(spineX, spineY, spineZ);
    this.chest.position.y = this.chestY + bounce;
    this.head.rotation.set(headX, headY, headZ);
    if (this.skirt) {
      // Mantel schwingt mit den Beinen
      this.skirt.rotation.set(Math.sin(p) * 0.05 * walk + 0.25 * sitK * 0, 0, Math.sin(p) * 0.04 * walk);
      this.skirt.scale.set(1, 1 - sitK * 0.45, 1 + sitK * 0.6);
    }
    // Ball: unterm Arm oder auf dem Finger drehen
    if (this.ball) {
      if (spinBall > 0.4) {
        const hp = new Vector3();
        R.hand.getWorldPosition(hp);
        this.chest.worldToLocal(hp);
        this.ball.position.copy(hp).add(new Vector3(0, 0.14, 0));
        this.ball.rotation.y += dt * 18;
      } else {
        this.ball.position.set(this.shoulderW * 0.62, (this.H - this.L - this.hd) * 0.12, 0.02);
      }
    }

    // ── Gesicht: Blinzeln, Mund
    this.blink -= dt;
    let lid = 1;
    if (this.blink < 0.12) lid = Math.abs(this.blink - 0.06) / 0.06;
    if (this.blink < 0) this.blink = 2.5 + Math.random() * 3.5;
    // Augen werden beim Lächeln/Lachen schmaler; bei manchen Gesichtern auch leicht beim Sprechen
    const se = this.faceShape.smileEyes;
    lid = Math.min(lid, 1 - se * (0.18 + this.talkSmooth * 0.25));
    if (laughOpen > 0.3) lid = Math.min(lid, 0.35 - se * 0.12);
    for (const eye of this.eyes) eye.scale.y = Math.max(0.08, lid);
    this.talkSmooth += (this.talk - this.talkSmooth) * Math.min(1, dt * 18);
    const open = Math.max(this.talkSmooth, laughOpen * (0.6 + Math.abs(Math.sin(t * 16)) * 0.4));
    this.mouthOpen.scale.y = 0.15 + open * 0.75;
    this.mouthSmile.visible = open < 0.35;
  }
}
