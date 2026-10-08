// Papierfiguren: freigestellte, frei lizenzierte Fotos auf leicht gebogenem „Karton“ mit hellem Papierrand.
// Die Fotos werden nicht verändert (nur Zuschnitt, Skalierung, leichte Tönung durch das Szenenlicht).
// Ohne Foto erscheint eine schlichte Silhouette mit Namensschild.
import {
  BackSide,
  BoxGeometry,
  Color,
  CylinderGeometry,
  FrontSide,
  Group,
  Mesh,
  MeshDepthMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RGBADepthPacking,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three';
import type { BufferAttribute, Camera, Raycaster, Texture } from 'three';
import type { FigureId } from '../content/types';
import { makeTexture } from './textures';
import { FONT_BRUSH } from './shared';

export type Reaction = 'hello' | 'nod' | 'laugh' | 'think' | 'surprise' | 'duck';

export interface FigureStyle {
  id: FigureId;
  zh: string;
  nameDe: string;
  /** Pfad der Papierfigur-Textur (public/) */
  src: string;
  /** Anteil der Bildhöhe von oben bis zum Kinn */
  chin: number;
  /** Horizontale Kopfmitte (0..1) */
  centerX: number;
  /** Breite / Höhe der Textur */
  aspect: number;
  /** Scheitelhöhe über dem Boden im Sitzen (Meter, aus der Körpergröße abgeleitet) */
  seatedHeadTop: number;
  /** Grundausrichtung (rad), leicht zum Tisch gedreht */
  yaw: number;
}

/**
 * Kopfhöhe (Scheitel bis Kinn) in Metern, für beide gleich, damit der Größenunterschied aus der Sitzhöhe kommt.
 * Etwas größer als echt (Papierfiguren-Maßstab), damit die Gesichter auch aus der Distanz lesbar sind.
 */
const HEAD_M = 0.34;
const PAPER = new Color('#f1e6d0');

export const STYLES: Record<FigureId, FigureStyle> = {
  // Jackie Chan: ca. 1,73 m → Sitzhöhe (Scheitel) etwa 0,52 · Größe + Hocker 0,45 m
  jackie: {
    id: 'jackie',
    zh: '成龙',
    nameDe: 'Jackie Chan',
    src: 'avatars/jackie.webp',
    chin: 0.56,
    centerX: 0.5,
    aspect: 757 / 1024,
    seatedHeadTop: 0.45 + 1.73 * 0.52,
    yaw: 0.28,
  },
  // Yao Ming: 2,29 m
  yao: {
    id: 'yao',
    zh: '姚明',
    nameDe: 'Yao Ming',
    src: 'avatars/yao.webp',
    chin: 0.42,
    centerX: 0.405,
    aspect: 1019 / 1024,
    seatedHeadTop: 0.45 + 2.29 * 0.52,
    yaw: -0.3,
  },
};

/** Ersatzfigur: Tusche-Silhouette (Kopf und Schultern) mit Namensschild */
function silhouette(style: FigureStyle): {
  canvas: HTMLCanvasElement;
  chin: number;
  centerX: number;
  aspect: number;
} {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 640;
  const g = c.getContext('2d')!;
  const ink = style.id === 'jackie' ? '#3a2a22' : '#22283a';
  const draw = (pad: number, color: string): void => {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(256, 170, 92 + pad, 118 + pad, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(40 - pad, 640);
    g.bezierCurveTo(40 - pad, 400 - pad, 140, 330 - pad, 256, 330 - pad);
    g.bezierCurveTo(372, 330 - pad, 472 + pad, 400 - pad, 472 + pad, 640);
    g.closePath();
    g.fill();
    g.fillRect(206 - pad, 260, 100 + pad * 2, 90);
  };
  draw(10, '#f1e6d0');
  draw(0, ink);
  // Namensschild
  g.fillStyle = '#f4ead6';
  g.fillRect(126, 470, 260, 110);
  g.strokeStyle = '#7a1f14';
  g.lineWidth = 5;
  g.strokeRect(130, 474, 252, 102);
  g.fillStyle = '#1c130e';
  g.textAlign = 'center';
  g.font = `56px ${FONT_BRUSH}`;
  g.fillText(style.zh, 256, 530);
  g.font = '24px serif';
  g.fillText(style.nameDe, 256, 564);
  return { canvas: c, chin: 288 / 640, centerX: 0.5, aspect: 512 / 640 };
}

export class PaperFigure {
  readonly group = new Group();
  /** Drehpunkt an der Unterkante der Karte (für Wiegen, Nicken, Hüpfen) */
  private pivot = new Group();
  private card: Mesh;
  private back: Mesh;
  private stick: Mesh;
  private frontMat: MeshStandardMaterial;
  private backMat: MeshStandardMaterial;
  private depthMat: MeshDepthMaterial;
  private mask: { data: Uint8ClampedArray; w: number; h: number } | null = null;
  private w = 0.4;
  private h = 0.6;
  private reaction: { kind: Reaction | 'sip'; t: number; dur: number } | null = null;
  private energy = 0;
  private lean = 0;
  private leanTarget = 0;
  private phase = Math.random() * 10;
  private yaw = 0;
  private glow = 0;
  speaking = false;
  selected = false;
  hovered = false;
  photo = false;
  onTap?: () => void;

  constructor(
    readonly style: FigureStyle,
    seat: Vector3,
  ) {
    this.group.name = `figure-${style.id}`;
    this.group.position.copy(seat);
    this.yaw = style.yaw;
    this.frontMat = new MeshStandardMaterial({
      roughness: 0.82,
      metalness: 0,
      side: FrontSide,
      alphaTest: 0.5,
    });
    this.backMat = new MeshStandardMaterial({ color: PAPER, roughness: 0.9, side: BackSide, alphaTest: 0.5 });
    // Rückseite: nur das Alpha der Textur, Farbe ist Papier
    this.backMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        '#ifdef USE_MAP\n diffuseColor.a *= texture2D( map, vMapUv ).a;\n#endif',
      );
    };
    this.depthMat = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, alphaTest: 0.5 });
    this.card = new Mesh(new PlaneGeometry(1, 1), this.frontMat);
    this.back = new Mesh(new PlaneGeometry(1, 1), this.backMat);
    this.card.castShadow = true;
    this.card.receiveShadow = true;
    this.card.customDepthMaterial = this.depthMat;
    this.card.name = `card-${style.id}`;
    this.back.raycast = () => undefined;
    this.pivot.add(this.card, this.back);
    // Holzstab und Fuß: so steht die Papierfigur auf dem Hocker
    const wood = new MeshStandardMaterial({ color: '#5a3a22', roughness: 0.7 });
    this.stick = new Mesh(new CylinderGeometry(0.012, 0.012, 1, 6), wood);
    this.stick.castShadow = true;
    const foot = new Mesh(new BoxGeometry(0.16, 0.04, 0.12), wood);
    foot.position.y = 0.47;
    foot.castShadow = true;
    this.group.add(this.stick, foot, this.pivot);
    const s = silhouette(style);
    this.applyTexture(makeTexture(s.canvas), s.canvas, s.chin, s.aspect);
  }

  /** Lädt das Foto; bei Fehler bleibt die Silhouette. */
  async load(base: string): Promise<boolean> {
    try {
      const tex = await new TextureLoader().loadAsync(base + this.style.src);
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = 4;
      const img = tex.image as HTMLImageElement;
      this.applyTexture(tex, img, this.style.chin, this.style.aspect);
      this.photo = true;
      return true;
    } catch {
      return false;
    }
  }

  private applyTexture(
    tex: Texture,
    src: CanvasImageSource & { width: number; height: number },
    chin: number,
    aspect: number,
  ): void {
    this.frontMat.map = tex;
    this.frontMat.emissiveMap = tex;
    this.backMat.map = tex;
    this.depthMat.map = tex;
    this.frontMat.needsUpdate = this.backMat.needsUpdate = this.depthMat.needsUpdate = true;
    // Größe: Kopf (Scheitel bis Kinn) = HEAD_M
    this.h = HEAD_M / chin;
    this.w = this.h * aspect;
    const geo = new PlaneGeometry(this.w, this.h, 18, 1).translate(0, this.h / 2, 0);
    const p = geo.attributes.position as BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / (this.w / 2);
      p.setZ(i, -x * x * 0.035 * (this.w / 0.5));
    }
    geo.computeVertexNormals();
    this.card.geometry.dispose();
    this.card.geometry = geo;
    this.back.geometry = geo;
    // Unterkante der Karte so, dass der Scheitel auf Sitzhöhe liegt
    const bottom = this.style.seatedHeadTop - this.h;
    this.pivot.position.y = bottom;
    this.stick.position.y = (0.47 + bottom + 0.05) / 2;
    this.stick.scale.y = bottom + 0.05 - 0.47;
    // Alpha-Maske für genaues Antippen (nur die Figur, nicht der leere Rand)
    const mw = 64;
    const mh = Math.round(64 / aspect);
    const c = document.createElement('canvas');
    c.width = mw;
    c.height = mh;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    try {
      g.drawImage(src, 0, 0, mw, mh);
      this.mask = { data: g.getImageData(0, 0, mw, mh).data, w: mw, h: mh };
    } catch {
      this.mask = null;
    }
  }

  /** Weltposition knapp über dem Scheitel (für Sprechblasen) */
  get headTop(): Vector3 {
    return new Vector3(0, this.h + 0.06, 0).applyMatrix4(this.pivot.matrixWorld);
  }

  /** Mitte des Gesichts (für Kamera-Fokus) */
  get face(): Vector3 {
    return new Vector3(0, this.h - HEAD_M * 0.5, 0).applyMatrix4(this.pivot.matrixWorld);
  }

  /** Trifft der Strahl die sichtbare Figur (nicht den transparenten Rand)? */
  hit(ray: Raycaster): number | null {
    const hits = ray.intersectObject(this.card, false);
    const h = hits[0];
    if (!h) return null;
    if (!this.mask || !h.uv) return h.distance;
    const x = Math.min(this.mask.w - 1, Math.floor(h.uv.x * this.mask.w));
    const y = Math.min(this.mask.h - 1, Math.floor((1 - h.uv.y) * this.mask.h));
    return this.mask.data[(y * this.mask.w + x) * 4 + 3]! > 60 ? h.distance : null;
  }

  react(kind: Reaction): void {
    const dur = { hello: 0.7, nod: 0.8, laugh: 1.3, think: 1.6, surprise: 0.55, duck: 1.1 }[kind];
    this.reaction = { kind, t: 0, dur };
  }

  sip(): void {
    this.reaction = { kind: 'sip', t: 0, dur: 1.4 };
  }

  /** Beim Sprechen: kleiner Impuls */
  pulse(k = 1): void {
    this.energy = Math.min(1.5, this.energy + 0.35 * k);
  }

  /** Zur Tischmitte neigen (Anstoßen) */
  setLean(on: boolean): void {
    this.leanTarget = on ? 1 : 0;
  }

  update(dt: number, t: number, camera: Camera, tint: Color, motion: number): void {
    // sanft zur Kamera drehen, aber nur in engen Grenzen
    const to = new Vector3().subVectors(camera.position, this.group.position);
    const want = Math.atan2(to.x, to.z);
    const limit = 0.42;
    const target = this.style.yaw + Math.max(-limit, Math.min(limit, want - this.style.yaw));
    this.yaw += (target - this.yaw) * Math.min(1, dt * 1.6);
    this.group.rotation.y = this.yaw;

    this.energy = Math.max(0, this.energy - dt * 3);
    this.lean += (this.leanTarget - this.lean) * Math.min(1, dt * 3);
    let y = 0;
    let roll = Math.sin(t * 0.8 + this.phase) * 0.014 * motion;
    let pitch = -this.lean * 0.12;
    let sx = 1;
    let sy = 1 + Math.sin(t * 1.5 + this.phase) * 0.006 * motion;
    sy += this.energy * 0.012;
    roll += Math.sin(t * 9) * this.energy * 0.008;
    if (this.reaction) {
      const r = this.reaction;
      r.t += dt;
      const u = Math.min(1, r.t / r.dur);
      const s = Math.sin(u * Math.PI);
      switch (r.kind) {
        case 'hello':
          y += s * 0.05;
          roll += Math.sin(u * Math.PI * 2) * 0.05;
          break;
        case 'nod':
          pitch += Math.pow(Math.sin(u * Math.PI * 2), 2) * 0.12;
          break;
        case 'laugh':
          y += Math.abs(Math.sin(u * Math.PI * 6)) * 0.03 * (1 - u);
          roll += Math.sin(u * Math.PI * 8) * 0.035 * (1 - u);
          break;
        case 'think':
          roll += s * 0.08;
          break;
        case 'surprise':
          y += s * 0.09;
          sy += s * 0.04;
          break;
        case 'duck':
          y -= s * 0.13;
          sy -= s * 0.05;
          sx += s * 0.03;
          break;
        case 'sip':
          pitch += s * 0.16;
          break;
      }
      if (u >= 1) this.reaction = null;
    }
    this.pivot.rotation.set(pitch, 0, roll);
    this.pivot.scale.set(sx, sy, 1);
    this.pivot.position.y = this.style.seatedHeadTop - this.h + y;
    // Licht der Szene leicht übernehmen (nur Tönung, keine Veränderung des Fotos)
    this.frontMat.color.copy(tint);
    const g = this.selected ? 0.16 : this.hovered ? 0.09 : 0;
    this.glow += (g - this.glow) * Math.min(1, dt * 6);
    this.frontMat.emissive.setRGB(this.glow, this.glow * 0.8, this.glow * 0.55);
  }
}
