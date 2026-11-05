// Leben auf dem Dorfplatz (P1): Gespräche der Bewohner untereinander, Grüße und Marktrufe, kleine Zwischenfälle
// (Zusammenstoß mit 对不起, der Drachen reißt sich los, die Katze stiehlt einen Fisch), Tiere (Hunde, Vögel auf
// den Firsten, Katzen auf den Dächern), Dampf und Funken, Laternenketten, Wäsche im Wind und Ereignisse
// (fahrender Händler, Drachentanz, Laternenfest mit Lichtern auf dem Teich, Erhu am Abend).
// Alles instanziert und mit wenigen Draw-Calls; nur in der Nähe des Platzes wird gerechnet.
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { colored } from '../three/geo';
import { catGeo, CRITTER_MAT } from '../three/critters';
import { Sparks, Steam } from '../three/effects';
import { POND } from '../three/shared';
import { HOUSES, spec, STALLS, toWorld } from './village';
import { LANTERN_POLES, PLAZA_PROPS, WELL } from './scatter';
import { groundY } from './nav';
import type { World } from './world';
import type { Resident, Villagers } from './villagers';
import type { Speaker } from '../ui/bubbles';
import type { DayPhase } from '../content/villagers';
import { store } from '../state/store';
import { report } from '../core/guard';

export type PlazaSound = 'clang' | 'drum' | 'bark' | 'meow' | 'flock' | 'erhu';

export interface PlazaContext {
  world: World;
  villagers: Villagers;
  say: (sp: Speaker, text: string, hold?: number) => Promise<void>;
  icon: (sp: Speaker, symbol: string) => void;
  award: (wordId: string) => void;
  toast: (html: string) => void;
  /** Gespräch, Mini-Spiel, Laden o. Ä. offen */
  busy: () => boolean;
  /** Geräusch mit Lautstärke (0–1) nach Entfernung; midi für Töne (Erhu) */
  sound: (kind: PlazaSound, vol: number, midi?: number) => void;
}

const merge = (parts: BufferGeometry[]): BufferGeometry => mergeGeometries(parts)!;
const MAT = CRITTER_MAT;
const _m = new Matrix4();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _v = new Vector3();
const _v2 = new Vector3();
const _s = new Vector3(1, 1, 1);
const UP = new Vector3(0, 1, 0);
const SIDE = new Vector3(1, 0, 0);
const FWD = new Vector3(0, 0, 1);
const PLAZA = { x: WELL.x, z: WELL.z };
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;
const dist = (ax: number, az: number, bx: number, bz: number): number => Math.hypot(ax - bx, az - bz);

// ───────────────────────────────────────── Texte

/** Gespräche zweier Bewohner (A sagt, B antwortet), nach Tageszeit */
export const CHATS: Record<DayPhase, [string, string][]> = {
  morgen: [
    ['早上好！Schon beim Tai-Chi gewesen?', '当然！Jeden Morgen, seit vierzig Jahren.'],
    ['Riechst du das? Xu hat die ersten 馒头 fertig.', 'Dann nichts wie hin, bevor sie weg sind!'],
    ['Der Nebel hängt noch über dem Fluss.', 'Bis Mittag ist er weg. Wie immer.'],
    ['Gao hat heute Karpfen, ganz frisch.', '鲜鱼！Dann gibt es heute Abend Fisch.'],
  ],
  mittag: [
    ['Wie viel kostet die Schale bei Tang?', 'Zu viel! Aber sie ist hauchdünn.'],
    ['Hast du den Drachen der Kinder gesehen?', 'Ja, fast bis zu den Wolken!'],
    ['Heiß heute.', 'Dann trinken wir Tee. 喝茶 hē chá!'],
    ['Feng sagt, Rot bringt Glück.', '红色 – darum hängen überall Laternen.'],
    ['Im Teehaus sollen berühmte Gäste sitzen.', 'Ein Schauspieler und ein Basketballer, heißt es.'],
    ['Die Stoffe von Frau Lin sind so weich.', '布 aus dem Süden, sagt sie. Teuer, aber schön.'],
  ],
  abend: [
    ['晚上好！Gehst du zum Brunnen? Herr Hua spielt.', 'Die Erhu klingt abends am schönsten.'],
    ['Die Laternen sind an – wie schön.', 'Feng hat sie heute selbst angezündet.'],
    ['Was gibt es zu essen?', 'Nudeln mit Gemüse. Und Tee danach.'],
    ['Morgen kommt vielleicht wieder der Händler.', 'Hoffentlich bringt er wieder Gewürze mit.'],
  ],
  nacht: [
    ['Psst, alle schlafen schon.', '晚安 – gute Nacht.'],
    ['Siehst du die Sterne?', 'So klar sieht man sie nur hier im Tal.'],
  ],
};

/** Gruß an die Spielfigur, nach Tageszeit (Wort des Moments) */
const GREETS: Record<DayPhase, { text: string; word: string }[]> = {
  morgen: [
    { text: '早上好！Guten Morgen!', word: 'zaoshang' },
    { text: '你好！Schon gefrühstückt?', word: 'nihao' },
  ],
  mittag: [
    { text: '你好！', word: 'nihao' },
    { text: '你好！Schöner Tag heute.', word: 'nihao' },
  ],
  abend: [
    { text: '晚上好！Guten Abend!', word: 'wanshang' },
    { text: '晚上好！Schon gegessen?', word: 'wanshang' },
  ],
  nacht: [{ text: '晚安…', word: 'wanshang' }],
};

/** Marktrufe je Stand */
const CALLS: Record<string, string[]> = {
  gemuese: ['新鲜的菜！Frisches Gemüse!', 'Kohl, Rettich, Lauch – alles von heute früh!'],
  obst: ['苹果！Äpfel, süß wie Honig!', 'Pfirsiche! Pfirsiche aus dem Tal!'],
  tee: ['新茶！Neuer Tee, erste Ernte!', 'Grüner Tee, schwarzer Tee – probier mal!'],
  stoffe: ['布！Feiner Stoff aus dem Süden!', 'Seide! Fühl nur, wie weich!'],
  fisch: ['鲜鱼！Frischer Fisch!', 'Karpfen, heute Morgen gefangen!'],
  keramik: ['瓷器！Porzellan, hauchdünn!', 'Schalen und Becher, bemalt von Hand!'],
  suesses: ['糖葫芦！Süß und knackig!', 'Kandierte Früchte am Spieß!'],
  laternen: ['灯笼！Rote Laternen für Glück!', 'Laternen fürs Fest – nur heute so 便宜!'],
};

// ───────────────────────────────────────── Formen

function dogGeo(
  fur: string,
  dark: string,
): { body: BufferGeometry; leg: BufferGeometry; tail: BufferGeometry } {
  return {
    body: merge([
      colored(new SphereGeometry(0.17, 8, 6).scale(1, 0.85, 1.7).translate(0, 0.36, 0), fur, 0.06),
      colored(new SphereGeometry(0.12, 7, 5).translate(0, 0.52, 0.3), fur, 0.05),
      colored(new BoxGeometry(0.08, 0.07, 0.12).translate(0, 0.49, 0.42), fur, 0.03),
      colored(new SphereGeometry(0.025, 5, 4).translate(0, 0.51, 0.48), '#1a1614', 0),
      colored(new ConeGeometry(0.045, 0.1, 4).translate(-0.07, 0.65, 0.27), dark, 0),
      colored(new ConeGeometry(0.045, 0.1, 4).translate(0.07, 0.65, 0.27), dark, 0),
    ]),
    leg: colored(new CylinderGeometry(0.03, 0.025, 0.3, 5).translate(0, -0.15, 0), dark, 0.03),
    tail: colored(new CylinderGeometry(0.02, 0.035, 0.24, 5).translate(0, 0.12, 0), fur, 0.03),
  };
}

function walkCatGeo(fur: string): { body: BufferGeometry; leg: BufferGeometry; tail: BufferGeometry } {
  return {
    body: merge([
      colored(new SphereGeometry(0.11, 8, 6).scale(1, 0.9, 1.9).translate(0, 0.22, 0), fur, 0.06),
      colored(new SphereGeometry(0.085, 7, 5).translate(0, 0.32, 0.2), fur, 0.05),
      colored(new ConeGeometry(0.03, 0.06, 3).translate(-0.045, 0.4, 0.2), fur, 0),
      colored(new ConeGeometry(0.03, 0.06, 3).translate(0.045, 0.4, 0.2), fur, 0),
    ]),
    leg: colored(new CylinderGeometry(0.02, 0.018, 0.18, 4).translate(0, -0.09, 0), fur, 0.04),
    tail: colored(new CylinderGeometry(0.012, 0.022, 0.3, 4).translate(0, 0.15, 0), fur, 0.04),
  };
}

function birdGeo(flying: boolean): BufferGeometry {
  const c = '#5a4a3e';
  const parts = [
    colored(new SphereGeometry(0.06, 6, 4).scale(1, 0.9, 1.5), c, 0.08),
    colored(new SphereGeometry(0.04, 5, 4).translate(0, 0.045, 0.07), '#4a3a30', 0.05),
    colored(new ConeGeometry(0.012, 0.03, 3).rotateX(Math.PI / 2).translate(0, 0.045, 0.115), '#d8a040', 0),
    colored(new BoxGeometry(0.05, 0.01, 0.08).translate(0, 0.01, -0.1), c, 0),
  ];
  if (flying) {
    parts.push(colored(new BoxGeometry(0.14, 0.01, 0.06).translate(-0.09, 0.01, 0), c, 0.05));
    parts.push(colored(new BoxGeometry(0.14, 0.01, 0.06).translate(0.09, 0.01, 0), c, 0.05));
  }
  return merge(parts);
}

function kiteGeo(): BufferGeometry {
  // Raute mit Querstab, nach +y oben, Fläche in der xy-Ebene
  const g = new BufferGeometry();
  const p = [0, 0.55, 0, -0.42, 0, 0, 0, -0.65, 0, 0.42, 0, 0];
  const col = new Color('#d23a2a');
  const col2 = new Color('#f2c84a');
  const pos: number[] = [];
  const cols: number[] = [];
  const tri = (a: number, b: number, c: number, k: Color): void => {
    for (const i of [a, b, c]) {
      pos.push(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!);
      cols.push(k.r, k.g, k.b);
    }
  };
  tri(0, 1, 2, col);
  tri(0, 2, 3, col2);
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(cols), 3));
  g.computeVertexNormals();
  return g;
}

function dragonHeadGeo(): BufferGeometry {
  const red = '#c8281e';
  const gold = '#f0c040';
  return merge([
    colored(new BoxGeometry(0.62, 0.5, 0.8).translate(0, 0, 0.1), red, 0.05),
    colored(new BoxGeometry(0.5, 0.16, 0.5).translate(0, -0.22, 0.45), gold, 0.03),
    colored(new SphereGeometry(0.1, 6, 5).translate(-0.2, 0.18, 0.42), '#f8f0e0', 0),
    colored(new SphereGeometry(0.1, 6, 5).translate(0.2, 0.18, 0.42), '#f8f0e0', 0),
    colored(new SphereGeometry(0.05, 5, 4).translate(-0.22, 0.2, 0.5), '#101010', 0),
    colored(new SphereGeometry(0.05, 5, 4).translate(0.22, 0.2, 0.5), '#101010', 0),
    colored(new ConeGeometry(0.06, 0.45, 4).rotateX(-0.7).translate(-0.2, 0.42, -0.1), gold, 0),
    colored(new ConeGeometry(0.06, 0.45, 4).rotateX(-0.7).translate(0.2, 0.42, -0.1), gold, 0),
    colored(new BoxGeometry(0.7, 0.08, 0.3).translate(0, 0.28, 0.05), gold, 0.03),
    colored(new ConeGeometry(0.04, 0.5, 3).rotateZ(1.2).translate(-0.45, -0.1, 0.5), gold, 0),
    colored(new ConeGeometry(0.04, 0.5, 3).rotateZ(-1.2).translate(0.45, -0.1, 0.5), gold, 0),
  ]);
}

function dragonSegGeo(): BufferGeometry {
  return merge([
    colored(new SphereGeometry(0.34, 8, 6).scale(1, 0.95, 2.1), '#c8281e', 0.06),
    colored(new TorusGeometry(0.33, 0.045, 4, 10).translate(0, 0, 0.42), '#f0c040', 0),
    colored(new TorusGeometry(0.33, 0.045, 4, 10).translate(0, 0, -0.42), '#f0c040', 0),
    colored(new ConeGeometry(0.08, 0.24, 4).translate(0, 0.36, 0), '#f0c040', 0),
    colored(new SphereGeometry(0.3, 6, 4).scale(1, 0.4, 1.9).translate(0, -0.2, 0), '#f2d27a', 0.04),
  ]);
}

function bearerGeo(): BufferGeometry {
  return merge([
    colored(new CylinderGeometry(0.16, 0.2, 0.75, 7).translate(0, 1.05, 0), '#d8b030', 0.06),
    colored(new SphereGeometry(0.12, 7, 5).translate(0, 1.55, 0), '#e0b48e', 0.03),
    colored(new BoxGeometry(0.26, 0.06, 0.26).translate(0, 1.66, 0), '#c8281e', 0),
    colored(new CylinderGeometry(0.07, 0.07, 0.68, 5).translate(-0.08, 0.34, 0), '#2a2420', 0),
    colored(new CylinderGeometry(0.07, 0.07, 0.68, 5).translate(0.08, 0.34, 0), '#2a2420', 0),
  ]);
}

function cartGeo(): BufferGeometry {
  const wood = '#7a5636';
  const dark = '#4a3424';
  const parts = [
    colored(new BoxGeometry(1.5, 0.12, 0.9).translate(0, 0.62, 0), wood, 0.05),
    colored(new BoxGeometry(1.5, 0.3, 0.05).translate(0, 0.8, 0.43), wood, 0.05),
    colored(new BoxGeometry(1.5, 0.3, 0.05).translate(0, 0.8, -0.43), wood, 0.05),
    colored(new BoxGeometry(0.05, 0.3, 0.9).translate(-0.73, 0.8, 0), wood, 0.05),
    colored(new TorusGeometry(0.36, 0.05, 5, 12).rotateY(Math.PI / 2).translate(0.2, 0.42, 0.52), dark, 0),
    colored(new TorusGeometry(0.36, 0.05, 5, 12).rotateY(Math.PI / 2).translate(0.2, 0.42, -0.52), dark, 0),
    colored(new CylinderGeometry(0.03, 0.03, 1.2, 5).rotateX(Math.PI / 2).translate(0.2, 0.42, 0), dark, 0),
    colored(new CylinderGeometry(0.035, 0.035, 1.4, 5).rotateZ(1.35).translate(-1.35, 0.5, 0.3), wood, 0),
    colored(new CylinderGeometry(0.035, 0.035, 1.4, 5).rotateZ(1.35).translate(-1.35, 0.5, -0.3), wood, 0),
    // Plane über Bögen
    colored(
      new CylinderGeometry(0.5, 0.5, 1.4, 10, 1, true, 0, Math.PI)
        .rotateZ(Math.PI / 2)
        .rotateX(-Math.PI / 2)
        .rotateY(0)
        .translate(0, 1.0, 0),
      '#c8b48a',
      0.08,
    ),
    // Waren: Säcke, Kisten, Gewürzkrüge
    colored(new SphereGeometry(0.2, 6, 5).scale(1, 0.8, 1).translate(-0.4, 0.82, 0.15), '#b8925a', 0.08),
    colored(new SphereGeometry(0.2, 6, 5).scale(1, 0.8, 1).translate(-0.4, 0.82, -0.2), '#a8402a', 0.08),
    colored(new BoxGeometry(0.34, 0.26, 0.34).translate(0.15, 0.81, 0.15), '#8a6a3a', 0.05),
    colored(new CylinderGeometry(0.1, 0.12, 0.26, 8).translate(0.5, 0.81, -0.2), '#c8762a', 0.05),
    colored(new CylinderGeometry(0.1, 0.12, 0.22, 8).translate(0.5, 0.79, 0.2), '#2e6a5a', 0.05),
    // Fähnchen
    colored(new CylinderGeometry(0.02, 0.02, 1.4, 4).translate(0.7, 1.4, 0.4), dark, 0),
    colored(new BoxGeometry(0.02, 0.4, 0.3).translate(0.7, 1.9, 0.25), '#c8281e', 0),
  ];
  return merge(parts);
}

/** Durchhängende Kette zwischen zwei Punkten (Parabel) */
function sagPoint(a: Vector3, b: Vector3, u: number, sag: number, out: Vector3): Vector3 {
  out.lerpVectors(a, b, u);
  out.y -= sag * 4 * u * (1 - u);
  return out;
}

// ───────────────────────────────────────── Teilstücke

interface Walker {
  x: number;
  z: number;
  yaw: number;
  path: [number, number][];
  speed: number;
  gait: number;
  wait: number;
  sit: number;
  wag: number;
  barkT: number;
}

interface Bird {
  /** Sitzplatz */
  px: number;
  py: number;
  pz: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** 0 sitzt, 1 fliegt weg, 2 kehrt zurück */
  mode: 0 | 1 | 2;
  t: number;
  a: number;
  hop: number;
}

type FishCat = 'idle' | 'sneak' | 'grab' | 'flee';
type KiteState = 'off' | 'fly' | 'lost' | 'down' | 'carried';

export class PlazaLife {
  readonly group = new Group();
  /** Lichter auf dem Teich (am Teehaus, eigene Zone) */
  readonly pondGroup = new Group();
  private readonly w: World;
  private readonly vs: Villagers;
  private day: number;
  private lastPhase: DayPhase;
  private festivalAnnounced = -1;
  private dragonDone = -1;
  /** Zeitgeber */
  private chatT = 6;
  private greetT = 0;
  private callT = 4;
  private bumpT = 10;
  private greeted = new Map<string, number>();
  private called = new Map<string, number>();
  private chatting = new Set<string>();
  private clock = 0;
  // Tiere
  private dogs: Walker[] = [];
  private dogBody: InstancedMesh;
  private dogLeg: InstancedMesh;
  private dogTail: InstancedMesh;
  private birds: Bird[] = [];
  private birdSit: InstancedMesh;
  private birdFly: InstancedMesh;
  private roofCats: InstancedMesh;
  private roofCatPos: [number, number, number, number][] = [];
  // Katze und Fisch
  private cat: Walker;
  private catBody: InstancedMesh;
  private catLeg: InstancedMesh;
  private catTail: InstancedMesh;
  private fish: Mesh;
  private fishCat: FishCat = 'idle';
  private fishT = rnd(100, 160);
  private catExit: [number, number] = [24.5, 74.5];
  // Drachen
  private kite: Mesh;
  private kiteLine: Line;
  private kiteTail: Line;
  private kiteState: KiteState = 'off';
  private kitePos = new Vector3();
  private kiteVel = new Vector3();
  private kiteLoseT = rnd(120, 240);
  private kiteDownAt: [number, number] = [21.5, 71];
  // Reifen
  private hoop: Mesh;
  private hoopA = 0;
  // Effekte
  private steam: Steam;
  private sparks: Sparks;
  private forgeGlow: MeshBasicMaterial;
  private strikeT = 0;
  // Laternen
  private chainMat: MeshBasicMaterial;
  private chainLanterns: InstancedMesh;
  private pondLanterns: InstancedMesh;
  private pondMat: MeshBasicMaterial;
  private pondN = 0;
  // Wäsche
  private cloth: InstancedMesh;
  private clothPts: { x: number; y: number; z: number; yaw: number; ph: number }[] = [];
  // Händler
  private cart: Mesh;
  // Drachentanz
  private dragon: Group;
  private dHead: Mesh;
  private dSegs: InstancedMesh;
  private dBear: InstancedMesh;
  private dPoles: LineSegments;
  private dragonT = -1;
  private drumT = 0;
  // Erhu
  private erhuT = 0;
  private erhuNote = 0;
  /** Ereignis für die Anzeige */
  private event = '';
  // P2: Schornsteinrauch, Pfützen, Fahnen
  private chimneySmoke: Steam;
  private puddles: InstancedMesh;
  private puddleMat: MeshStandardMaterial;
  private wet = 0;
  private flags: InstancedMesh;
  private flagPts: { x: number; y: number; z: number; ph: number }[] = [];

  constructor(private ctx: PlazaContext) {
    this.w = ctx.world;
    this.vs = ctx.villagers;
    this.group.name = 'plaza';
    this.pondGroup.name = 'plaza-pond';
    this.day = store.progress.games['plaza-tag'] ?? 0;
    this.lastPhase = this.w.dayPhase();

    // ── Hunde (zwei, instanziert: Körper, Beine, Schwanz)
    const dg = dogGeo('#c89a62', '#8a6038');
    this.dogBody = this.inst(dg.body, 2);
    this.dogLeg = this.inst(dg.leg, 8);
    this.dogTail = this.inst(dg.tail, 2);
    for (let i = 0; i < 2; i++) {
      const [x, z] = this.randomPlazaPoint(10);
      this.dogs.push({
        x,
        z,
        yaw: 0,
        path: [],
        speed: 0,
        gait: 0,
        wait: rnd(1, 5),
        sit: 0,
        wag: 0,
        barkT: 0,
      });
    }
    // Zweiter Hund dunkler: Farbe je Instanz
    this.dogBody.setColorAt(0, new Color(1, 1, 1));
    this.dogBody.setColorAt(1, new Color(0.45, 0.4, 0.38));
    this.dogTail.setColorAt(0, new Color(1, 1, 1));
    this.dogTail.setColorAt(1, new Color(0.45, 0.4, 0.38));

    // ── Katze, die Fisch stiehlt
    const cg = walkCatGeo('#d9893a');
    this.catBody = this.inst(cg.body, 1);
    this.catLeg = this.inst(cg.leg, 4);
    this.catTail = this.inst(cg.tail, 1);
    this.cat = { x: 0, z: 0, yaw: 0, path: [], speed: 0, gait: 0, wait: 0, sit: 0, wag: 0, barkT: 0 };
    this.setCatVisible(false);
    this.fish = new Mesh(
      merge([
        colored(new SphereGeometry(0.05, 6, 4).scale(1, 0.7, 2.6), '#9aa8b0', 0.08),
        colored(new ConeGeometry(0.05, 0.08, 3).rotateX(-Math.PI / 2).translate(0, 0, -0.17), '#8a98a0', 0),
      ]),
      MAT,
    );
    this.fish.visible = false;
    this.group.add(this.fish);

    // ── Vögel auf den Firsten, Katzen auf den Dächern
    this.birdSit = this.inst(birdGeo(false), 24);
    this.birdFly = this.inst(birdGeo(true), 24);
    this.roofCats = this.inst(catGeo('#3a3430'), 2);
    this.roofCats.setColorAt(0, new Color(1, 1, 1));
    this.roofCats.setColorAt(1, new Color(2.4, 2.1, 1.7));
    // Dachhöhen erst nach dem Laden (Strahl auf die Häuser), damit der Start nicht wartet
    window.setTimeout(() => this.perchOnRoofs(), 1500);

    // ── Drachen und Reifen der Kinder
    this.kite = new Mesh(
      kiteGeo(),
      new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.7 }),
    );
    this.kite.visible = false;
    this.kiteLine = new Line(
      new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]),
      new LineBasicMaterial({ color: '#e8e0d0', transparent: true, opacity: 0.7 }),
    );
    this.kiteTail = new Line(
      new BufferGeometry().setFromPoints(Array.from({ length: 6 }, () => new Vector3())),
      new LineBasicMaterial({ color: '#f2c84a' }),
    );
    for (const o of [this.kiteLine, this.kiteTail]) {
      o.frustumCulled = false;
      o.visible = false;
    }
    this.group.add(this.kite, this.kiteLine, this.kiteTail);
    this.hoop = new Mesh(colored(new TorusGeometry(0.32, 0.02, 4, 18), '#c8762a', 0), MAT);
    this.hoop.visible = false;
    this.group.add(this.hoop);

    // ── Dampfgarer der Bäckerei, Esse und Amboss der Schmiede
    const st = PLAZA_PROPS.steamer;
    const sy = groundY(st.x, st.z);
    const stove = new Mesh(
      merge([
        colored(new CylinderGeometry(0.36, 0.4, 0.6, 10).translate(0, 0.3, 0), '#6a5a50', 0.08),
        colored(new CylinderGeometry(0.3, 0.3, 0.16, 12).translate(0, 0.68, 0), '#c8a46a', 0.05),
        colored(new CylinderGeometry(0.3, 0.3, 0.16, 12).translate(0, 0.85, 0), '#b8945a', 0.05),
        colored(new CylinderGeometry(0.3, 0.3, 0.16, 12).translate(0, 1.02, 0), '#c8a46a', 0.05),
        colored(new ConeGeometry(0.32, 0.12, 12).translate(0, 1.16, 0), '#a88450', 0.05),
      ]),
      MAT,
    );
    stove.position.set(st.x, sy, st.z);
    stove.castShadow = true;
    this.group.add(stove);
    this.steam = new Steam(this.w.quality === 0 ? 60 : 120);
    this.steam.addEmitter(new Vector3(st.x, sy + 1.2, st.z), 3, 0.2, 1.4);
    this.group.add(this.steam.points);

    const an = PLAZA_PROPS.anvil;
    const fo = PLAZA_PROPS.forge;
    const ay = groundY(an.x, an.z);
    const fy = groundY(fo.x, fo.z);
    const smithy = new Mesh(
      merge([
        colored(new CylinderGeometry(0.16, 0.2, 0.5, 8).translate(an.x, ay + 0.25, an.z), '#5a4434', 0.05),
        colored(new BoxGeometry(0.5, 0.14, 0.2).translate(an.x, ay + 0.57, an.z), '#3a3a3e', 0.04),
        colored(new BoxGeometry(0.9, 0.7, 0.8).translate(fo.x, fy + 0.35, fo.z), '#7a6a5e', 0.1),
        colored(new BoxGeometry(0.3, 1.2, 0.3).translate(fo.x - 0.2, fy + 1.3, fo.z + 0.15), '#6a5a50', 0.08),
      ]),
      MAT,
    );
    smithy.castShadow = true;
    this.group.add(smithy);
    this.forgeGlow = new MeshBasicMaterial({ color: new Color(2.2, 0.8, 0.25), toneMapped: false });
    const coal = new Mesh(new BoxGeometry(0.6, 0.04, 0.5), this.forgeGlow);
    coal.position.set(fo.x, fy + 0.72, fo.z);
    this.group.add(coal);
    this.sparks = new Sparks(48);
    this.group.add(this.sparks.points);
    const smoke = new Steam(30, '#8a8682', 2.2);
    smoke.addEmitter(new Vector3(fo.x - 0.2, fy + 1.95, fo.z + 0.15), 1.6, 0.1, 2);
    this.smoke = smoke;
    this.group.add(smoke.points);

    // ── Laternenketten über dem Platz: zwischen den Masten im Ring und von jedem Mast zum Brunnendach
    const wy = groundY(WELL.x, WELL.z);
    const tops = LANTERN_POLES.map(([x, z]) => new Vector3(x, groundY(x, z) + 4.2, z));
    const apex = new Vector3(WELL.x, wy + 2.75, WELL.z);
    const chains: [Vector3, Vector3, number][] = [];
    for (let i = 0; i < 4; i++) {
      chains.push([tops[i]!, tops[(i + 1) % 4]!, 0.9]);
      chains.push([tops[i]!, apex, 0.35]);
    }
    const poleGeo = merge(
      LANTERN_POLES.map(([x, z]) =>
        merge([
          colored(
            new CylinderGeometry(0.06, 0.08, 4.3, 6).translate(x, groundY(x, z) + 2.15, z),
            '#8a2a1e',
            0.05,
          ),
          colored(new SphereGeometry(0.09, 6, 4).translate(x, groundY(x, z) + 4.32, z), '#e3b450', 0),
        ]),
      ),
    );
    const poles = new Mesh(poleGeo, MAT);
    poles.castShadow = true;
    this.group.add(poles);
    const rope: number[] = [];
    const lpos: Vector3[] = [];
    for (const [a, b, sag] of chains) {
      const n = 14;
      for (let k = 0; k < n; k++) {
        const p0 = sagPoint(a, b, k / n, sag, new Vector3());
        const p1 = sagPoint(a, b, (k + 1) / n, sag, new Vector3());
        rope.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      }
      const m = Math.round(a.distanceTo(b) / 1.1);
      for (let k = 1; k < m; k++)
        lpos.push(sagPoint(a, b, k / m, sag, new Vector3()).add(_v.set(0, -0.2, 0)));
    }
    const ropeGeo = new BufferGeometry();
    ropeGeo.setAttribute('position', new BufferAttribute(new Float32Array(rope), 3));
    this.group.add(new LineSegments(ropeGeo, new LineBasicMaterial({ color: '#3a2a20' })));
    this.chainMat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.chainLanterns = new InstancedMesh(
      merge([
        colored(new SphereGeometry(0.15, 8, 6).scale(1, 1.2, 1), '#ffffff', 0),
        colored(new CylinderGeometry(0.06, 0.06, 0.04, 6).translate(0, 0.19, 0), '#e3b450', 0),
        colored(new CylinderGeometry(0.06, 0.06, 0.04, 6).translate(0, -0.19, 0), '#e3b450', 0),
      ]),
      this.chainMat,
      lpos.length,
    );
    lpos.forEach((p, i) => this.chainLanterns.setMatrixAt(i, _m.makeTranslation(p.x, p.y, p.z)));
    this.chainLanterns.frustumCulled = false;
    this.group.add(this.chainLanterns);

    // ── Laternenfest: schwimmende Lichter auf dem Teich
    this.pondMat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.pondLanterns = new InstancedMesh(
      merge([
        colored(new CylinderGeometry(0.16, 0.12, 0.05, 8), '#e88aa0', 0),
        colored(new ConeGeometry(0.1, 0.18, 6).translate(0, 0.12, 0), '#ffd890', 0),
      ]),
      this.pondMat,
      28,
    );
    this.pondLanterns.count = 0;
    this.pondLanterns.frustumCulled = false;
    this.pondGroup.add(this.pondLanterns);

    // ── Wäscheleine am Waschplatz
    const [l0, l1] = PLAZA_PROPS.laundry as [[number, number], [number, number]];
    const a0 = new Vector3(l0[0], groundY(l0[0], l0[1]) + 1.75, l0[1]);
    const a1 = new Vector3(l1[0], groundY(l1[0], l1[1]) + 1.75, l1[1]);
    const lineYaw = Math.atan2(a1.x - a0.x, a1.z - a0.z) - Math.PI / 2;
    const frame = new Mesh(
      merge([
        colored(
          new CylinderGeometry(0.04, 0.05, 1.85, 5).translate(a0.x, a0.y - 0.85, a0.z),
          '#6a4a30',
          0.05,
        ),
        colored(
          new CylinderGeometry(0.04, 0.05, 1.85, 5).translate(a1.x, a1.y - 0.85, a1.z),
          '#6a4a30',
          0.05,
        ),
      ]),
      MAT,
    );
    frame.castShadow = true;
    const ropeL = new Line(
      new BufferGeometry().setFromPoints(
        Array.from({ length: 9 }, (_, k) => sagPoint(a0, a1, k / 8, 0.12, new Vector3())),
      ),
      new LineBasicMaterial({ color: '#d8d0c0' }),
    );
    this.group.add(frame, ropeL);
    const clothColors = ['#e8e2d6', '#4a6a9a', '#c8584a', '#e8e2d6', '#6a8a5a', '#d8b860'];
    this.cloth = new InstancedMesh(
      new PlaneGeometry(0.42, 0.62).translate(0, -0.31, 0),
      new MeshStandardMaterial({ side: DoubleSide, roughness: 0.9 }),
      clothColors.length,
    );
    clothColors.forEach((c, i) => {
      const u = (i + 0.7) / (clothColors.length + 0.4);
      const p = sagPoint(a0, a1, u, 0.12, new Vector3());
      this.clothPts.push({ x: p.x, y: p.y, z: p.z, yaw: lineYaw, ph: i * 1.3 });
      this.cloth.setColorAt(i, new Color(c));
    });
    this.cloth.castShadow = true;
    this.cloth.frustumCulled = false;
    this.group.add(this.cloth);

    // ── Karren des fahrenden Händlers (an Händlertagen mit Waren, sonst abgedeckt leer)
    const ct = PLAZA_PROPS.cart;
    this.cart = new Mesh(cartGeo(), MAT);
    this.cart.position.set(ct.x, groundY(ct.x, ct.z), ct.z);
    this.cart.rotation.y = ct.rot + Math.PI / 2;
    this.cart.castShadow = true;
    this.group.add(this.cart);

    // ── Drachentanz
    this.dragon = new Group();
    this.dHead = new Mesh(dragonHeadGeo(), MAT);
    this.dSegs = this.inst(dragonSegGeo(), 10, this.dragon);
    this.dBear = this.inst(bearerGeo(), 11, this.dragon);
    this.dPoles = new LineSegments(
      new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(11 * 6), 3)),
      new LineBasicMaterial({ color: '#5a3a20' }),
    );
    this.dPoles.frustumCulled = false;
    this.dHead.castShadow = true;
    this.dragon.add(this.dHead, this.dPoles);
    this.dragon.visible = false;
    this.group.add(this.dragon);

    // ── Schornsteinrauch (Emitter kommen mit den Dachhöhen dazu)
    this.chimneySmoke = new Steam(this.w.quality === 0 ? 50 : 110, '#9a9690', 2.6);
    this.group.add(this.chimneySmoke.points);

    // ── Pfützen: erscheinen bei Regen und trocknen danach langsam
    this.puddleMat = new MeshStandardMaterial({
      color: '#7a8590',
      roughness: 0.02,
      metalness: 0.65,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const pud = new CylinderGeometry(1, 1, 0.01, 14);
    this.puddles = new InstancedMesh(pud, this.puddleMat, 14);
    let n = 0;
    for (let k = 0; k < 80 && n < 14; k++) {
      const [x, z] = this.randomPlazaPoint(12);
      if (STALLS.some((st) => dist(st.x, st.z, x, z) < 2.2) || dist(x, z, WELL.x, WELL.z) < 2) continue;
      const r = rnd(0.35, 0.9);
      _q.setFromAxisAngle(UP, rnd(0, 3));
      this.puddles.setMatrixAt(
        n++,
        _m.compose(_v.set(x, groundY(x, z) + 0.025, z), _q, _s.set(r * 1.4, 1, r)),
      );
    }
    this.puddles.count = n;
    this.puddles.visible = false;
    this.puddles.renderOrder = 2;
    this.group.add(this.puddles);

    // ── Fahnen an den Laternenmasten (wehen im Wind)
    this.flags = new InstancedMesh(
      merge([
        colored(new PlaneGeometry(0.5, 1.3).translate(0.25, -0.65, 0), '#b8281e', 0),
        colored(new PlaneGeometry(0.5, 0.12).translate(0.25, -1.36, 0.001), '#e3b450', 0),
      ]),
      new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.85 }),
      LANTERN_POLES.length,
    );
    LANTERN_POLES.forEach(([x, z], i) => this.flagPts.push({ x, y: groundY(x, z) + 3.9, z, ph: i * 1.7 }));
    this.flags.castShadow = true;
    this.flags.frustumCulled = false;
    this.group.add(this.flags);

    this.w.tickers.push((dt) => this.update(dt));
    this.w.debug?.lines.push(
      () =>
        `Platz      Tag ${this.day}${this.festival ? ' · Fest' : ''}${this.merchantDay ? ' · Händler' : ''} · ${this.event || 'ruhig'}`,
    );
    this.addInteractions();
  }

  private smoke: Steam;

  /** Leuchtstärke der Laternen 0 (Tag) … 1 (Nacht) */
  private glow(): number {
    return Math.max(0, Math.min(1, (this.w.pal.lantern - 0.35) / 1.4));
  }

  private inst(geo: BufferGeometry, n: number, parent: Object3D = this.group): InstancedMesh {
    const im = new InstancedMesh(geo, MAT, n);
    im.castShadow = true;
    im.frustumCulled = false;
    im.count = 0;
    parent.add(im);
    return im;
  }

  get festival(): boolean {
    return this.day % 3 === 0;
  }

  get merchantDay(): boolean {
    return this.day % 2 === 0;
  }

  /** Tagesplan-Hilfe für die Bewohner: ist der fahrende Händler heute da? */
  visiting(): boolean {
    return this.merchantDay;
  }

  private randomPlazaPoint(r: number): [number, number] {
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * Math.PI * 2;
      const d = 2 + Math.random() * r;
      const x = PLAZA.x + Math.cos(a) * d;
      const z = PLAZA.z + Math.sin(a) * d;
      if (this.w.nav.walkable(x, z)) return [x, z];
    }
    return [PLAZA.x + 3, PLAZA.z + 3];
  }

  private get player(): { x: number; z: number } {
    return this.w.player;
  }

  // ───────────────────────────────────────── Dächer

  /** Firsthöhe per Strahl von oben auf die Häuser: Sitzplätze für Vögel und Katzen */
  private perchOnRoofs(): void {
    try {
      const ray = new Raycaster();
      const hi = this.w.village.hi;
      hi.updateMatrixWorld(true);
      const targets = hi.children;
      const down = new Vector3(0, -1, 0);
      const top = (x: number, z: number): number | null => {
        ray.set(_v.set(x, 40, z), down);
        ray.far = 60;
        const hit = ray.intersectObjects(targets, false)[0];
        return hit ? hit.point.y : null;
      };
      const roofs = HOUSES.filter((h) => h.kind !== 'schreinchen');
      let catN = 0;
      for (const h of roofs) {
        const sp = spec(h.kind);
        const n = h.kind === 'hofhaus' ? 2 : 3;
        for (let i = 0; i < n; i++) {
          const lx = (i - (n - 1) / 2) * sp.w * 0.22 + rnd(-0.2, 0.2);
          const [x, z] = toWorld(h, lx, h.kind === 'hofhaus' ? -sp.d * 0.3 : 0);
          const y = top(x, z);
          if (y === null || this.birds.length >= 24) continue;
          this.birds.push({
            px: x,
            py: y,
            pz: z,
            x,
            y,
            z,
            yaw: h.rot + rnd(-1, 1),
            mode: 0,
            t: 0,
            a: 0,
            hop: rnd(0, 5),
          });
        }
        if (catN < 2 && (h.seed === 2 || h.seed === 9)) {
          const [x, z] = toWorld(h, sp.w * 0.28, 0);
          const y = top(x, z);
          if (y !== null) {
            this.roofCatPos.push([x, y - 0.06, z, h.rot + Math.PI / 2]);
            catN++;
          }
        }
      }
      // Schornsteine auf Wohnhäusern und Gasthaus, Rauch daraus
      const stacks: BufferGeometry[] = [];
      for (const h of HOUSES) {
        if (h.kind !== 'wohnhaus' && h.kind !== 'gasthaus') continue;
        const sp = spec(h.kind);
        const [x, z] = toWorld(h, sp.w * 0.3, -sp.d * 0.18);
        const y = top(x, z);
        if (y === null) continue;
        stacks.push(
          colored(new BoxGeometry(0.4, 1.1, 0.4).translate(x, y + 0.25, z), '#8a7a6a', 0.1),
          colored(new BoxGeometry(0.5, 0.08, 0.5).translate(x, y + 0.82, z), '#5a4a40', 0),
        );
        this.chimneySmoke.addEmitter(new Vector3(x, y + 0.9, z), 1.3, 0.12, 2.2);
      }
      if (stacks.length) {
        const chim = new Mesh(merge(stacks), MAT);
        chim.castShadow = true;
        this.group.add(chim);
      }
      this.roofCatPos.forEach(([x, y, z, rot], i) =>
        this.roofCats.setMatrixAt(
          i,
          _m.compose(_v.set(x, y, z), _q.setFromAxisAngle(UP, rot), _s.set(1, 1, 1)),
        ),
      );
      this.roofCats.count = this.roofCatPos.length;
      this.roofCats.instanceMatrix.needsUpdate = true;
    } catch (e) {
      report('Platz: Dächer', e, 'warn');
    }
  }

  // ───────────────────────────────────────── Interaktionen

  private addInteractions(): void {
    const w = this.w;
    // Hund streicheln
    this.dogs.forEach((d, i) =>
      w.addInteractable({
        id: `hund-${i}`,
        pos: () => new Vector3(d.x, groundY(d.x, d.z), d.z),
        radius: 1.4,
        label: () => 'Hund streicheln',
        enabled: () => this.group.visible && !w.player.seated && !this.ctx.busy(),
        use: () => {
          w.player.ch.play('pet', 1.8);
          d.wag = 3;
          d.sit = 3;
          d.path = [];
          d.yaw = Math.atan2(w.player.x - d.x, w.player.z - d.z);
          this.ctx.sound('bark', 0.6);
          this.ctx.award('gou');
        },
      }),
    );
    // Drachen aufheben
    w.addInteractable({
      id: 'drachen-aufheben',
      pos: () => this.kitePos.clone(),
      radius: 1.6,
      label: () => 'Drachen aufheben',
      enabled: () => this.kiteState === 'down' && !w.player.seated,
      use: () => {
        this.kiteState = 'carried';
        this.kite.visible = false;
        this.kiteTail.visible = false;
        this.ctx.toast('Bring den Drachen zu <b>Xiaohu</b> zurück – er steht auf der Drachenwiese.');
      },
    });
  }

  // ───────────────────────────────────────── Takt

  private update(dt: number): void {
    if (dt <= 0) return;
    this.clock += dt;
    this.dayCount();
    // Teichlichter: unabhängig vom Dorf
    this.updatePond(dt);
    const p = this.player;
    const near = dist(p.x, p.z, PLAZA.x, PLAZA.z) < 60;
    if (!near || !this.group.visible) {
      this.dragon.visible = false;
      return;
    }
    // Laternen: tagsüber rotes Papier, abends rot-orange leuchtend (Fest: heller). Palette: Tag 0.35 … Nacht 1.9
    const glow = this.glow();
    const fest = this.festival ? 1.25 : 1;
    // lineare Farbwerte (werden für den Bildschirm nach sRGB umgerechnet): kräftiges Rot-Orange
    this.chainMat.color.setRGB(0.35 + glow * 1.5 * fest, 0.03 + glow * 0.16 * fest, 0.01 + glow * 0.03);
    this.forgeGlow.color.setRGB(
      1.6 + Math.sin(this.clock * 7) * 0.25 + Math.sin(this.clock * 2.3) * 0.2,
      0.62,
      0.2,
    );
    this.cart.visible = true;

    const vis = this.vs.list.filter((r) => r.visible && r.state !== 'home');
    this.updateDogs(dt);
    this.updateBirds(dt);
    this.updateFishCat(dt, vis);
    this.updateKite(dt);
    this.updateHoop(dt);
    this.updateLaundry();
    this.updateSmith(dt, vis);
    this.updateErhu(dt);
    this.updateDragon(dt, vis);
    this.steam.update(dt, this.clock, 1);
    this.smoke.update(dt, this.clock, 1);
    // Kochzeiten: morgens und abends raucht es mehr
    const ph = this.w.dayPhase();
    this.chimneySmoke.update(dt, this.clock, ph === 'mittag' ? 0.35 : ph === 'nacht' ? 0.15 : 1);
    this.updateWeatherBits(dt);
    this.sparks.update(dt);
    if (!this.ctx.busy()) {
      this.updateTalk(dt, vis);
      this.updateGreet(dt, vis);
      this.updateCalls(dt, vis);
      this.updateBumps(dt, vis);
    }
  }

  /** Tageszähler: jeder neue Morgen ist ein neuer Tag (Fest jeden dritten, Händler jeden zweiten Tag) */
  private dayCount(): void {
    const ph = this.w.dayPhase();
    if (ph === this.lastPhase) return;
    if (ph === 'morgen' && this.lastPhase !== 'morgen') {
      this.day++;
      store.setGame('plaza-tag', this.day);
    }
    this.lastPhase = ph;
    // Laternenfest am Abend eines Festtags ankündigen
    if (this.festival && (ph === 'abend' || ph === 'nacht') && this.festivalAnnounced !== this.day) {
      this.festivalAnnounced = this.day;
      this.ctx.toast('<b>元宵节 Laternenfest</b> – auf dem Teich schwimmen heute Abend Lichter.');
      this.ctx.award('yuanxiao');
    }
  }

  // ── Gespräche, Grüße, Rufe

  private updateTalk(dt: number, vis: Resident[]): void {
    this.chatT -= dt;
    if (this.chatT > 0) return;
    const q = this.w.quality;
    this.chatT = rnd(9, 15) * (q === 2 ? 1 : q === 1 ? 1.4 : 2.2);
    const cam = this.w.camera.position;
    const cand = vis.filter(
      (r) =>
        r.full &&
        r.rig &&
        (r.state === 'act' || r.state === 'seated') &&
        !this.chatting.has(r.v.id) &&
        dist(r.x, r.z, cam.x, cam.z) < 24,
    );
    for (let i = 0; i < cand.length; i++)
      for (let j = i + 1; j < cand.length; j++) {
        const a = cand[i]!;
        const b = cand[j]!;
        if (dist(a.x, a.z, b.x, b.z) > 3.4) continue;
        this.chat(a, b);
        return;
      }
  }

  private chat(a: Resident, b: Resident): void {
    const [la, lb] = pick(CHATS[this.w.dayPhase()]);
    this.chatting.add(a.v.id);
    this.chatting.add(b.v.id);
    const head = (r: Resident): Vector3 => new Vector3(r.x, r.y + 1.5, r.z);
    a.rig?.lookAt(head(b));
    b.rig?.lookAt(head(a));
    this.event = `Gespräch ${a.v.name} – ${b.v.name}`;
    const end = (): void => {
      a.rig?.lookAt(null);
      b.rig?.lookAt(null);
      this.chatting.delete(a.v.id);
      this.chatting.delete(b.v.id);
      this.event = '';
    };
    void this.ctx
      .say(a.speaker, la, 2.2)
      .then(() => new Promise((res) => window.setTimeout(res, 500)))
      .then(() => this.ctx.say(b.speaker, lb, 2.4))
      .then(() => window.setTimeout(end, 2500))
      .catch(end);
  }

  private updateGreet(dt: number, vis: Resident[]): void {
    this.greetT -= dt;
    if (this.greetT > 0 || this.w.player.seated) return;
    const p = this.player;
    for (const r of vis) {
      if (!r.v.greets || !r.full || r.state === 'talk' || this.chatting.has(r.v.id)) continue;
      if (dist(r.x, r.z, p.x, p.z) > 2.8) continue;
      const last = this.greeted.get(r.v.id) ?? -1e9;
      if (this.clock - last < 120) continue;
      this.greeted.set(r.v.id, this.clock);
      this.greetT = 7;
      const g = pick(GREETS[this.w.dayPhase()]);
      r.rig?.lookAt(new Vector3(p.x, r.y + 1.5, p.z));
      if (r.state === 'walk' || r.state === 'act') r.rig?.play('wave', 1.2);
      void this.ctx.say(r.speaker, g.text, 1.8).then(() => r.rig?.lookAt(null));
      this.ctx.award(g.word);
      return;
    }
  }

  private updateCalls(dt: number, vis: Resident[]): void {
    this.callT -= dt;
    if (this.callT > 0) return;
    this.callT = rnd(6, 10);
    const p = this.player;
    const vendors = vis.filter((r) => {
      if (!r.full || r.state !== 'act' || this.chatting.has(r.v.id)) return false;
      const s = r.v.schedule[r.step];
      if (!s?.spot.startsWith('stand-')) return false;
      const d = dist(r.x, r.z, p.x, p.z);
      return d > 3 && d < 15 && this.clock - (this.called.get(r.v.id) ?? -1e9) > 30;
    });
    if (!vendors.length) return;
    const r = pick(vendors);
    const goods = r.v.schedule[r.step]!.spot.slice(6);
    const lines = CALLS[goods];
    if (!lines) return;
    this.called.set(r.v.id, this.clock);
    r.rig?.play('wave', 1.2);
    void this.ctx.say(r.speaker, pick(lines), 1.6);
  }

  /** Zwei Bewohner laufen ineinander → 对不起 / 没关系; auch wenn jemand in die Spielfigur läuft */
  private updateBumps(dt: number, vis: Resident[]): void {
    this.bumpT -= dt;
    if (this.bumpT > 0) return;
    const p = this.player;
    const walkers = vis.filter((r) => r.full && r.state === 'walk' && !this.chatting.has(r.v.id));
    for (const a of walkers) {
      if (dist(a.x, a.z, p.x, p.z) < 0.75) {
        this.bumpT = 30;
        a.rig?.play('bow', 1.2);
        void this.ctx.say(a.speaker, '哎呀，对不起！Verzeihung!', 1.6);
        this.ctx.award('duibuqi');
        return;
      }
      for (const b of walkers) {
        if (a === b || dist(a.x, a.z, b.x, b.z) > 0.62) continue;
        this.bumpT = 45;
        this.event = 'Zusammenstoß';
        a.rig?.play('bow', 1.2);
        const pd = dist(a.x, a.z, p.x, p.z);
        void this.ctx
          .say(a.speaker, '对不起！', 1.4)
          .then(() => this.ctx.say(b.speaker, '没关系！Macht nichts.', 1.6))
          .then(() => (this.event = ''));
        if (pd < 10) {
          this.ctx.award('duibuqi');
          this.ctx.award('meiguanxi');
        }
        return;
      }
    }
  }

  // ── Tiere

  private updateDogs(dt: number): void {
    const p = this.player;
    let li = 0;
    this.dogs.forEach((d, i) => {
      const pd = dist(d.x, d.z, p.x, p.z);
      d.barkT -= dt;
      d.wag = Math.max(0, d.wag - dt);
      if (d.sit > 0) d.sit -= dt;
      else if (pd < 3.2 && pd > 1.3) {
        // neugierig zur Spielfigur, Schwanz wedelt
        d.path = [[p.x + (d.x - p.x) * (1.2 / pd), p.z + (d.z - p.z) * (1.2 / pd)]];
        d.wag = 1;
        if (d.barkT <= 0) {
          d.barkT = rnd(12, 25);
          this.ctx.sound('bark', Math.max(0, 1 - pd / 18));
        }
      } else if (!d.path.length) {
        d.wait -= dt;
        if (d.wait <= 0) {
          d.wait = rnd(2, 7);
          if (Math.random() < 0.3) d.sit = rnd(4, 9);
          else {
            const [tx, tz] = this.randomPlazaPoint(11);
            d.path = this.w.nav.path(d.x, d.z, tx, tz) ?? [];
          }
        }
      }
      const tgt = d.path[0];
      let sp = 0;
      if (tgt && d.sit <= 0) {
        const dx = tgt[0] - d.x;
        const dz = tgt[1] - d.z;
        const l = Math.hypot(dx, dz);
        if (l < 0.25) d.path.shift();
        else {
          sp = pd < 3.2 ? 1.6 : 1.1;
          d.x += (dx / l) * Math.min(l, sp * dt);
          d.z += (dz / l) * Math.min(l, sp * dt);
          let dy = Math.atan2(dx, dz) - d.yaw;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          d.yaw += dy * Math.min(1, dt * 6);
        }
      }
      d.gait += dt * sp * 9;
      const y = groundY(d.x, d.z);
      const sitK = d.sit > 0 ? 1 : 0;
      _q.setFromAxisAngle(UP, d.yaw).multiply(_q2.setFromAxisAngle(SIDE, -0.35 * sitK));
      _v.set(d.x, y + Math.abs(Math.sin(d.gait)) * 0.03 * (sp > 0 ? 1 : 0) - sitK * 0.08, d.z);
      this.dogBody.setMatrixAt(i, _m.compose(_v, _q, _s.set(1, 1, 1)));
      // Beine: vorne/hinten, links/rechts, im Kreuzgang schwingen
      for (const [fx, fz, ph] of [
        [-0.08, 0.2, 0],
        [0.08, 0.2, Math.PI],
        [-0.08, -0.2, Math.PI],
        [0.08, -0.2, 0],
      ] as const) {
        const swing = sp > 0 ? Math.sin(d.gait + ph) * 0.5 : fz < 0 ? -1.3 * sitK : 0;
        _v2
          .set(fx, 0.32, fz)
          .applyQuaternion(_q2.setFromAxisAngle(UP, d.yaw))
          .add(_v.set(d.x, y, d.z));
        _q.setFromAxisAngle(UP, d.yaw).multiply(_q2.setFromAxisAngle(SIDE, swing));
        this.dogLeg.setMatrixAt(li++, _m.compose(_v2, _q, _s.set(1, 1, 1)));
      }
      const wag = Math.sin(this.clock * (d.wag > 0 ? 18 : 4)) * (d.wag > 0 ? 0.8 : 0.25);
      _v2
        .set(0, 0.42 - sitK * 0.1, -0.27)
        .applyQuaternion(_q2.setFromAxisAngle(UP, d.yaw))
        .add(_v.set(d.x, y, d.z));
      _q.setFromAxisAngle(UP, d.yaw)
        .multiply(_q2.setFromAxisAngle(SIDE, -0.9))
        .multiply(new Quaternion().setFromAxisAngle(FWD, wag));
      this.dogTail.setMatrixAt(i, _m.compose(_v2, _q, _s.set(1, 1, 1)));
    });
    this.dogBody.count = 2;
    this.dogLeg.count = 8;
    this.dogTail.count = 2;
    for (const m of [this.dogBody, this.dogLeg, this.dogTail]) m.instanceMatrix.needsUpdate = true;
  }

  private updateBirds(dt: number): void {
    const p = this.player;
    let sit = 0;
    let fly = 0;
    let scared = false;
    for (const b of this.birds) {
      if (b.mode === 0) {
        if (dist(b.px, b.pz, p.x, p.z) < 4.5) {
          b.mode = 1;
          b.t = 0;
          b.a = Math.atan2(b.px - p.x, b.pz - p.z) + rnd(-0.6, 0.6);
          scared = true;
        } else {
          b.hop -= dt;
          if (b.hop < 0) {
            b.hop = rnd(2, 7);
            b.yaw += rnd(-1.5, 1.5);
          }
          const peck = Math.max(0, Math.sin(this.clock * 5 + b.px)) ** 8 * 0.6;
          _q.setFromAxisAngle(UP, b.yaw).multiply(_q2.setFromAxisAngle(SIDE, peck));
          this.birdSit.setMatrixAt(sit++, _m.compose(_v.set(b.px, b.py + 0.05, b.pz), _q, _s.set(1, 1, 1)));
          continue;
        }
      }
      b.t += dt;
      if (b.mode === 1) {
        // auffliegen, eine Runde kreisen, nach 14–20 s zurück
        const up = Math.min(1, b.t / 2);
        b.a += dt * 0.6;
        const r = 6 + up * 6;
        b.x = b.px + Math.sin(b.a) * r * up;
        b.z = b.pz + Math.cos(b.a) * r * up;
        b.y = b.py + up * 7 + Math.sin(b.t * 1.3) * 0.5;
        b.yaw = b.a + Math.PI / 2;
        if (b.t > 16 && dist(b.px, b.pz, p.x, p.z) > 6) {
          b.mode = 2;
          b.t = 0;
        }
      } else {
        const k = Math.min(1, b.t / 3);
        b.x += (b.px - b.x) * k * dt * 2;
        b.y += (b.py - b.y) * k * dt * 2;
        b.z += (b.pz - b.z) * k * dt * 2;
        if (dist(b.x, b.z, b.px, b.pz) < 0.1 && Math.abs(b.y - b.py) < 0.1) b.mode = 0;
      }
      const flap = 0.3 + Math.abs(Math.sin(this.clock * 18 + b.px)) * 0.9;
      _q.setFromAxisAngle(UP, b.yaw);
      this.birdFly.setMatrixAt(fly++, _m.compose(_v.set(b.x, b.y, b.z), _q, _s.set(flap, 1, 1)));
    }
    if (scared) this.ctx.sound('flock', 0.8);
    this.birdSit.count = sit;
    this.birdFly.count = fly;
    this.birdSit.instanceMatrix.needsUpdate = true;
    this.birdFly.instanceMatrix.needsUpdate = true;
    // Dachkatzen atmen
    this.roofCatPos.forEach(([x, y, z, rot], i) => {
      const br = 1 + Math.sin(this.clock * 1.5 + i * 2) * 0.03;
      this.roofCats.setMatrixAt(
        i,
        _m.compose(_v.set(x, y, z), _q.setFromAxisAngle(UP, rot), _s.set(1, br, 1)),
      );
    });
    if (this.roofCatPos.length) this.roofCats.instanceMatrix.needsUpdate = true;
  }

  // ── Katze klaut Fisch

  private setCatVisible(on: boolean): void {
    this.catBody.count = on ? 1 : 0;
    this.catLeg.count = on ? 4 : 0;
    this.catTail.count = on ? 1 : 0;
  }

  /** Test-Hilfe und Ereignis: die Katze schleicht zum Fischstand */
  startFishCat(): boolean {
    const st = STALLS.find((s) => s.goods === 'fisch');
    if (!st || this.fishCat !== 'idle') return false;
    const spots = [
      [24.5, 74.5],
      [27, 64],
      [29.5, 72.5],
    ] as [number, number][];
    const [sx, sz] = spots.find(([x, z]) => this.w.nav.walkable(x, z)) ?? [st.x - 4, st.z + 3];
    // Ziel: Ecke vor dem Stand (Kundenseite)
    const fx = st.x + Math.sin(st.rot) * 1.1 + Math.cos(st.rot) * 0.6;
    const fz = st.z + Math.cos(st.rot) * 1.1 - Math.sin(st.rot) * 0.6;
    const path = this.w.nav.path(sx, sz, fx, fz);
    if (!path?.length) return false;
    this.cat.x = sx;
    this.cat.z = sz;
    this.cat.path = path;
    this.catExit = [sx, sz];
    this.fishCat = 'sneak';
    this.setCatVisible(true);
    this.event = 'Katze schleicht zum Fischstand';
    return true;
  }

  private updateFishCat(dt: number, vis: Resident[]): void {
    const c = this.cat;
    const p = this.player;
    const gao = vis.find((r) => r.v.id === 'gao');
    if (this.fishCat === 'idle') {
      this.fishT -= dt;
      const ph = this.w.dayPhase();
      if (this.fishT <= 0) {
        this.fishT = rnd(200, 360);
        const st = STALLS.find((s) => s.goods === 'fisch')!;
        if ((ph === 'morgen' || ph === 'mittag') && gao && dist(p.x, p.z, st.x, st.z) < 26)
          this.startFishCat();
      }
      return;
    }
    let sp = this.fishCat === 'sneak' ? 0.7 : this.fishCat === 'flee' ? 3.2 : 0;
    // Spieler verscheucht die schleichende Katze → Fisch gerettet
    if (this.fishCat === 'sneak' && dist(c.x, c.z, p.x, p.z) < 1.6) {
      this.fishCat = 'flee';
      c.path = this.w.nav.path(c.x, c.z, this.catExit[0], this.catExit[1]) ?? [];
      this.ctx.sound('meow', 0.8);
      if (gao) void this.ctx.say(gao.speaker, '谢谢！Du hast meinen Fisch gerettet!', 2);
      store.addCoins(2);
      this.ctx.toast('Fisch gerettet! <b>+2 Münzen</b> · 猫 māo – Katze');
      this.ctx.award('mao');
      this.event = 'Katze verscheucht';
    }
    if (this.fishCat === 'grab') {
      c.wait -= dt;
      if (c.wait <= 0) {
        this.fishCat = 'flee';
        this.fish.visible = true;
        c.path = this.w.nav.path(c.x, c.z, this.catExit[0], this.catExit[1]) ?? [];
        this.ctx.sound('meow', Math.max(0, 1 - dist(c.x, c.z, p.x, p.z) / 20));
        if (gao) {
          gao.rig?.play('shrug', 1.6);
          void this.ctx.say(gao.speaker, '喂！我的鱼！He, mein Fisch!', 2);
        }
        this.event = 'Katze flieht mit dem Fisch';
      }
    }
    const tgt = c.path[0];
    if (tgt && sp > 0) {
      const dx = tgt[0] - c.x;
      const dz = tgt[1] - c.z;
      const l = Math.hypot(dx, dz);
      if (l < 0.2) c.path.shift();
      else {
        c.x += (dx / l) * Math.min(l, sp * dt);
        c.z += (dz / l) * Math.min(l, sp * dt);
        c.yaw = Math.atan2(dx, dz);
      }
    } else if (!tgt) {
      if (this.fishCat === 'sneak') {
        this.fishCat = 'grab';
        c.wait = 1.4;
        sp = 0;
      } else if (this.fishCat === 'flee') {
        this.fishCat = 'idle';
        this.fish.visible = false;
        this.setCatVisible(false);
        this.event = '';
        return;
      }
    }
    c.gait += dt * sp * 12;
    const y = groundY(c.x, c.z);
    const crouch = this.fishCat === 'sneak' ? -0.04 : 0;
    _q.setFromAxisAngle(UP, c.yaw);
    this.catBody.setMatrixAt(0, _m.compose(_v.set(c.x, y + crouch, c.z), _q, _s.set(1, 1, 1)));
    let k = 0;
    for (const [fx, fz, ph] of [
      [-0.05, 0.13, 0],
      [0.05, 0.13, Math.PI],
      [-0.05, -0.13, Math.PI],
      [0.05, -0.13, 0],
    ] as const) {
      const swing = sp > 0 ? Math.sin(c.gait + ph) * 0.6 : 0;
      _v2
        .set(fx, 0.18 + crouch, fz)
        .applyQuaternion(_q)
        .add(_v.set(c.x, y, c.z));
      _q2.copy(_q).multiply(new Quaternion().setFromAxisAngle(SIDE, swing));
      this.catLeg.setMatrixAt(k++, _m.compose(_v2, _q2, _s.set(1, 1, 1)));
    }
    _v2
      .set(0, 0.24 + crouch, -0.18)
      .applyQuaternion(_q)
      .add(_v.set(c.x, y, c.z));
    _q2.copy(_q).multiply(new Quaternion().setFromAxisAngle(SIDE, -0.5 + Math.sin(this.clock * 3) * 0.2));
    this.catTail.setMatrixAt(0, _m.compose(_v2, _q2, _s.set(1, 1, 1)));
    for (const m of [this.catBody, this.catLeg, this.catTail]) m.instanceMatrix.needsUpdate = true;
    if (this.fish.visible) {
      this.fish.position
        .set(0.1, 0.3, 0.3)
        .applyQuaternion(_q)
        .add(_v.set(c.x, y, c.z));
      this.fish.quaternion.copy(_q).multiply(new Quaternion().setFromAxisAngle(UP, Math.PI / 2));
    }
  }

  // ── Drachen

  /** Test-Hilfe und Ereignis: Schnur reißt */
  loseKite(): boolean {
    if (this.kiteState !== 'fly') return false;
    this.kiteState = 'lost';
    this.kiteVel.set(1.4, 0.8, 0.6);
    const kid = this.vs.list.find((r) => r.v.id === 'xiaohu');
    if (kid) {
      void this.ctx.say(kid.speaker, '我的风筝！Mein Drachen!', 2);
      this.ctx.icon(kid.speaker, '!');
    }
    this.event = 'Drachen hat sich losgerissen';
    return true;
  }

  private kiteKid(): Resident | undefined {
    const kid = this.vs.list.find((r) => r.v.id === 'xiaohu');
    if (!kid || !kid.visible || kid.state !== 'act') return undefined;
    return kid.v.schedule[kid.step]?.act === 'kite' ? kid : undefined;
  }

  private updateKite(dt: number): void {
    const kid = this.kiteKid();
    const p = this.player;
    const wind = 0.5 + 0.5 * Math.sin(this.clock * 0.13);
    switch (this.kiteState) {
      case 'off':
        if (kid) this.kiteState = 'fly';
        this.kite.visible = this.kiteLine.visible = this.kiteTail.visible = false;
        return;
      case 'fly': {
        if (!kid) {
          this.kiteState = 'off';
          return;
        }
        const t = this.clock;
        const hx = kid.x + 0.2;
        const hy = kid.y + 1.55;
        const hz = kid.z;
        this.kitePos.set(
          hx - 5 - wind * 2 + Math.sin(t * 0.7) * 1.2,
          hy + 7 + wind * 2 + Math.sin(t * 1.1) * 0.8,
          hz + 4 + Math.cos(t * 0.5) * 1.5,
        );
        this.kiteLoseT -= dt;
        if (this.kiteLoseT <= 0 && dist(p.x, p.z, kid.x, kid.z) < 25) {
          this.kiteLoseT = rnd(260, 420);
          this.loseKite();
        }
        this.drawKite(hx, hy, hz, true);
        return;
      }
      case 'lost': {
        // treibt mit dem Wind davon und sinkt zur Wiese
        const [tx, tz] = this.kiteDownAt;
        const gy = groundY(tx, tz);
        this.kiteVel.y -= dt * 0.35;
        this.kiteVel.x += (tx - this.kitePos.x) * dt * 0.05;
        this.kiteVel.z += (tz - this.kitePos.z) * dt * 0.05;
        this.kiteVel.multiplyScalar(1 - dt * 0.3);
        this.kitePos.addScaledVector(this.kiteVel, dt);
        if (this.kitePos.y <= gy + 0.15) {
          this.kitePos.set(this.kitePos.x, 0, this.kitePos.z);
          if (!this.w.nav.walkable(this.kitePos.x, this.kitePos.z)) this.kitePos.set(tx, 0, tz);
          this.kitePos.y = groundY(this.kitePos.x, this.kitePos.z) + 0.1;
          this.kiteState = 'down';
          this.event = 'Drachen liegt auf der Wiese';
        }
        this.drawKite(0, 0, 0, false);
        return;
      }
      case 'down':
        this.kite.visible = true;
        this.kiteTail.visible = false;
        this.kiteLine.visible = false;
        this.kite.position.copy(this.kitePos);
        this.kite.quaternion.setFromAxisAngle(SIDE, -Math.PI / 2);
        return;
      case 'carried': {
        this.kite.visible = false;
        const k = this.vs.list.find((r) => r.v.id === 'xiaohu');
        if (k && k.visible && dist(k.x, k.z, p.x, p.z) < 2.4) {
          this.kiteState = 'off';
          void this.ctx.say(k.speaker, '谢谢！Danke! Jetzt fliegt er wieder!', 2.2);
          k.rig?.play('hop', 1.2);
          store.addCoins(3);
          this.ctx.toast('Drachen zurückgebracht! <b>+3 Münzen</b> · 风筝 fēngzheng');
          this.ctx.award('fengzheng');
          this.event = '';
        }
        return;
      }
    }
  }

  private drawKite(hx: number, hy: number, hz: number, line: boolean): void {
    const k = this.kite;
    k.visible = true;
    k.position.copy(this.kitePos);
    // Fläche zum Halter (oder gegen die Flugrichtung), leicht schaukelnd
    const sway = Math.sin(this.clock * 2.3) * 0.25;
    k.lookAt(line ? _v.set(hx, hy, hz) : _v.copy(this.kitePos).sub(this.kiteVel));
    k.rotateZ(sway);
    k.rotateX(-0.4);
    const lp = this.kiteLine.geometry.attributes.position as BufferAttribute;
    this.kiteLine.visible = line;
    if (line) {
      lp.setXYZ(0, hx, hy, hz);
      lp.setXYZ(1, this.kitePos.x, this.kitePos.y - 0.1, this.kitePos.z);
      lp.needsUpdate = true;
    }
    // Schwanz: hängt nach unten und weht
    const tp = this.kiteTail.geometry.attributes.position as BufferAttribute;
    _v.set(0, -0.65, 0).applyQuaternion(k.quaternion).add(this.kitePos);
    for (let i = 0; i < 6; i++) {
      const s = Math.sin(this.clock * 4 - i * 0.8) * 0.15 * i;
      tp.setXYZ(i, _v.x + s + i * 0.12, _v.y - i * 0.28, _v.z + s * 0.5);
    }
    tp.needsUpdate = true;
    this.kiteTail.visible = true;
  }

  private updateHoop(dt: number): void {
    const kid = this.vs.list.find((r) => r.v.id === 'niuniu');
    const on =
      !!kid && kid.visible && kid.state === 'act' && kid.v.schedule[kid.step]?.spot === 'kinderplatz';
    this.hoop.visible = on;
    if (!on) return;
    // Reifen rollt im Kreis um das Mädchen, sie schaut ihm nach
    this.hoopA += dt * 1.6;
    const r = 1.5;
    const x = kid.x + Math.cos(this.hoopA) * r;
    const z = kid.z + Math.sin(this.hoopA) * r;
    this.hoop.position.set(x, groundY(x, z) + 0.33, z);
    this.hoop.rotation.set(0, -this.hoopA, 0);
    this.hoop.rotateZ(0.12);
    this.hoop.rotateX(0);
    if (kid.full && Math.floor(this.clock * 2) % 6 === 0) kid.rig?.lookAt(this.hoop.position);
  }

  private updateLaundry(): void {
    const wind = 0.25 + 0.2 * Math.sin(this.clock * 0.4);
    this.clothPts.forEach((c, i) => {
      const flap = wind + Math.sin(this.clock * 2.6 + c.ph) * 0.18 + Math.sin(this.clock * 6.1 + c.ph) * 0.05;
      _q.setFromAxisAngle(UP, c.yaw).multiply(_q2.setFromAxisAngle(SIDE, flap));
      this.cloth.setMatrixAt(i, _m.compose(_v.set(c.x, c.y, c.z), _q, _s.set(1, 1, 1)));
    });
    this.cloth.instanceMatrix.needsUpdate = true;
  }

  /** Schmied hämmert: Funken und Klang im Takt des Hammers */
  private updateSmith(dt: number, vis: Resident[]): void {
    const smith = vis.find((r) => r.v.id === 'laotie');
    const at = smith && smith.state === 'act' && smith.v.schedule[smith.step]?.act === 'hammer' && smith.full;
    if (!at) return;
    this.strikeT -= dt;
    if (this.strikeT > 0) return;
    this.strikeT = (Math.PI * 2) / 6;
    const an = PLAZA_PROPS.anvil;
    const n = this.w.quality === 0 ? 4 : 9;
    this.sparks.burst(an.x, groundY(an.x, an.z) + 0.66, an.z, n);
    const p = this.player;
    this.ctx.sound('clang', Math.max(0, 1 - dist(an.x, an.z, p.x, p.z) / 22));
  }

  /** Erhu am Abend: Herr Hua spielt eine pentatonische Melodie, hörbar in der Nähe */
  private updateErhu(dt: number): void {
    const hua = this.vs.list.find((r) => r.v.id === 'ahua');
    if (!hua || !hua.visible || hua.state !== 'act' || hua.v.schedule[hua.step]?.act !== 'fiddle') return;
    const p = this.player;
    const d = dist(hua.x, hua.z, p.x, p.z);
    if (d > 16) return;
    this.erhuT -= dt;
    if (this.erhuT > 0) return;
    // Pentatonik in D (D E F# A B), kleine Phrasen mit Schritten
    const scale = [62, 64, 66, 69, 71, 74, 76, 78];
    this.erhuNote = Math.max(0, Math.min(scale.length - 1, this.erhuNote + pick([-2, -1, -1, 1, 1, 2, 0])));
    const long = Math.random() < 0.25;
    this.erhuT = long ? 1.3 : 0.65;
    this.ctx.sound('erhu', Math.max(0, 1 - d / 16) * 0.9, scale[this.erhuNote]);
    if (this.event === '') this.event = 'Erhu am Brunnen';
  }

  // ── Drachentanz

  /** Test-Hilfe und Ereignis: Drachentanz um den Brunnen (80 s) */
  startDragon(): void {
    this.dragonT = 0;
    this.dragonDone = this.day;
    this.dragon.visible = true;
    this.ctx.toast('<b>舞龙 Drachentanz</b> auf dem Dorfplatz! Hörst du die Trommeln?');
    this.ctx.award('wulong');
    this.event = 'Drachentanz';
  }

  private updateDragon(dt: number, vis: Resident[]): void {
    const p = this.player;
    if (this.dragonT < 0) {
      // an Festtagen mittags, wenn die Spielfigur in der Nähe ist
      if (
        this.festival &&
        this.dragonDone !== this.day &&
        this.w.dayPhase() === 'mittag' &&
        dist(p.x, p.z, PLAZA.x, PLAZA.z) < 40
      )
        this.startDragon();
      this.dragon.visible = false;
      return;
    }
    this.dragonT += dt;
    const T = 80;
    if (this.dragonT > T) {
      this.dragonT = -1;
      this.dragon.visible = false;
      this.event = '';
      return;
    }
    this.dragon.visible = true;
    // ein- und ausziehen: Radius wächst am Anfang aus dem Rand, schrumpft am Ende zurück
    const R = 4.4;
    const t = this.dragonT;
    const speed = 0.42;
    const head = -t * speed;
    const wy = groundY(WELL.x, WELL.z);
    const pos = (i: number, out: Vector3): Vector3 => {
      const a = head + i * 0.24;
      const wob = Math.sin(t * 2.4 - i * 0.7);
      const r = R + wob * 0.35;
      out.set(
        WELL.x + Math.cos(a) * r,
        wy + 1.6 + Math.sin(t * 3.2 - i * 0.65) * 0.32,
        WELL.z + Math.sin(a) * r,
      );
      return out;
    };
    const poles = this.dPoles.geometry.attributes.position as BufferAttribute;
    for (let i = 0; i <= 10; i++) {
      const c = pos(i, _v);
      const nx = pos(i + 0.5, _v2);
      const yaw = Math.atan2(c.x - nx.x, c.z - nx.z);
      if (i === 0) {
        this.dHead.position.copy(c);
        this.dHead.rotation.set(Math.sin(t * 3.2) * 0.2, yaw, Math.sin(t * 2) * 0.15);
      } else {
        _q.setFromAxisAngle(UP, yaw);
        this.dSegs.setMatrixAt(i - 1, _m.compose(c, _q, _s.set(1, 1, 1)));
      }
      // Träger darunter, leicht nach außen versetzt, hüpfender Schritt
      const bx = c.x;
      const bz = c.z;
      const by = groundY(bx, bz) + Math.abs(Math.sin(t * 6 + i)) * 0.08;
      _q.setFromAxisAngle(UP, yaw);
      this.dBear.setMatrixAt(i, _m.compose(_v2.set(bx, by - 0.2, bz), _q, _s.set(1, 1, 1)));
      poles.setXYZ(i * 2, bx, by + 1.25, bz);
      poles.setXYZ(i * 2 + 1, c.x, c.y - 0.2, c.z);
    }
    poles.needsUpdate = true;
    this.dSegs.count = 10;
    this.dBear.count = 11;
    this.dSegs.instanceMatrix.needsUpdate = true;
    this.dBear.instanceMatrix.needsUpdate = true;
    // Trommeln
    this.drumT -= dt;
    if (this.drumT <= 0) {
      const beat = Math.floor(t * 2) % 8;
      this.drumT = beat === 3 || beat === 7 ? 0.25 : 0.5;
      this.ctx.sound('drum', Math.max(0, 1 - dist(p.x, p.z, PLAZA.x, PLAZA.z) / 35));
    }
    // Zuschauer in der Nähe klatschen ab und zu
    if (Math.random() < dt * 0.6)
      for (const r of vis)
        if (r.full && r.state === 'act' && dist(r.x, r.z, WELL.x, WELL.z) < 11 && Math.random() < 0.3)
          r.rig?.play('clap', 1.6);
  }

  // ── Wetter: Pfützen, Fahnen

  private updateWeatherBits(dt: number): void {
    const rain = this.w.weather.rain;
    // nass werden geht schnell, trocknen dauert (etwa zwei Minuten)
    this.wet = rain > this.wet ? Math.min(1, this.wet + dt * 0.12 * Math.max(rain, 0.3)) : Math.max(0, this.wet - dt / 120);
    this.puddleMat.opacity = this.wet * 0.85;
    this.puddles.visible = this.wet > 0.02;
    const wind = 0.35 + rain * 0.4 + 0.2 * Math.sin(this.clock * 0.3);
    this.flagPts.forEach((f, i) => {
      const flap = Math.sin(this.clock * 3.1 + f.ph) * 0.25 * wind + Math.sin(this.clock * 7 + f.ph) * 0.06;
      _q.setFromAxisAngle(UP, 0.9 + wind * 0.6 + flap);
      this.flags.setMatrixAt(i, _m.compose(_v.set(f.x, f.y, f.z), _q, _s.set(1, 1, 1)));
    });
    this.flags.instanceMatrix.needsUpdate = true;
  }

  // ── Teich

  private updatePond(dt: number): void {
    const ph = this.w.dayPhase();
    const want = this.festival && (ph === 'abend' || ph === 'nacht') ? (this.w.quality === 0 ? 14 : 28) : 0;
    // Lichter tauchen nach und nach auf
    if (this.pondN < want) this.pondN = Math.min(want, this.pondN + dt * 2);
    else if (this.pondN > want) this.pondN = Math.max(want, this.pondN - dt * 3);
    const n = Math.floor(this.pondN);
    this.pondLanterns.count = n;
    if (!n) return;
    const t = this.clock;
    for (let i = 0; i < n; i++) {
      const a = i * 2.399 + t * (0.02 + (i % 5) * 0.004);
      const rr = 0.15 + ((i * 0.618) % 1) * 0.78;
      const x = POND.x + Math.cos(a) * POND.rx * rr;
      const z = POND.z + Math.sin(a) * POND.rz * rr;
      this.pondLanterns.setMatrixAt(
        i,
        _m.compose(
          _v.set(x, 0.06 + Math.sin(t * 1.5 + i) * 0.01, z),
          _q.setFromAxisAngle(UP, a),
          _s.set(1, 1, 1),
        ),
      );
    }
    this.pondLanterns.instanceMatrix.needsUpdate = true;
    const g = 0.45 + this.glow() * 0.6;
    this.pondMat.color.setRGB(g * 1.6, g * 0.5, g * 0.16);
  }
}
