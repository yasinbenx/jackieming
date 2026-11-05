// Weiches Licht und Kontaktschatten:
//  • Kontaktschatten: ein weicher, runder Fleck unter jeder Figur, jedem Tier und großen Möbeln (ein Draw-Call,
//    instanziert). Er bleibt auch, wenn die Sonnenschatten schwach oder aus sind, und verankert die Figuren am Boden.
//  • Laternenlicht: nur die nächsten Laternen (Hoch 3, Mittel 2, Niedrig keine) bekommen ein echtes, warmes
//    Punktlicht ohne Schatten, mit weichem Abfall und kaum merklichem Flackern. Die Lichter werden weich
//    überblendet, wenn die Spielfigur weitergeht. Alle anderen Laternen leuchten nur (Material + Lichthof + Bloom).
import {
  CanvasTexture,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Vector3,
} from 'three';
import type { World } from './world';

export interface BlobSource {
  x: number;
  y: number;
  z: number;
  /** Radius des Flecks (m) */
  r: number;
}

const MAX_BLOBS = 96;
/** Zahl der Punktlichter: fest, damit sich die Zahl der Lichter (und damit die Shader) nie ändert */
const POOL = 3;
const ACTIVE: Record<number, number> = { 2: 3, 1: 2, 0: 0 };

function blobTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(0.45, 'rgba(0,0,0,0.6)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

const _m = new Matrix4();
const _q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const _v = new Vector3();
const _s = new Vector3();

export class SoftLight {
  /** Lieferanten für Kontaktschatten (Figuren, Tiere …) */
  readonly sources: (() => BlobSource[])[] = [];
  /** Laternen, die echtes Licht bekommen können (Weltposition der Leuchtkammer) */
  readonly lanterns: Vector3[] = [];
  private blobs: InstancedMesh;
  private blobMat: MeshBasicMaterial;
  private lights: { light: PointLight; at: Vector3 | null; k: number }[] = [];
  private pickT = 0;
  private time = 0;

  constructor(private w: World) {
    this.blobMat = new MeshBasicMaterial({
      map: blobTexture(),
      color: new Color('#1a1420'),
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.blobs = new InstancedMesh(new PlaneGeometry(1, 1), this.blobMat, MAX_BLOBS);
    this.blobs.count = 0;
    this.blobs.frustumCulled = false;
    this.blobs.renderOrder = 1;
    this.blobs.name = 'kontaktschatten';
    w.scene.add(this.blobs);
    // Niedrig: gar keine zusätzlichen Lichter (sie kosten im Shader auch mit Stärke 0)
    const pool = w.quality === 0 ? 0 : POOL;
    for (let i = 0; i < pool; i++) {
      const light = new PointLight('#ffa457', 0, 9, 2);
      light.castShadow = false;
      w.scene.add(light);
      this.lights.push({ light, at: null, k: 0 });
    }
    w.tickers.push((dt) => this.update(dt));
    w.noReflect.push(() => [this.blobs]);
  }

  private update(dt: number): void {
    this.time += dt;
    this.updateBlobs();
    this.updateLights(dt);
  }

  private updateBlobs(): void {
    const cam = this.w.camera.position;
    const p = this.w.pal;
    // Tagsüber zeichnen die Sonnenschatten schon den Fuß nach: Fleck leichter; nachts und bei Wolken kräftiger
    const sun = this.w.sunShadowStrength;
    this.blobMat.opacity = 0.5 - sun * 0.3 + p.stars * 0.05;
    let n = 0;
    for (const f of this.sources)
      for (const b of f()) {
        if (n >= MAX_BLOBS) break;
        const dx = b.x - cam.x;
        const dz = b.z - cam.z;
        if (dx * dx + dz * dz > 45 * 45) continue;
        const d = b.r * 2;
        this.blobs.setMatrixAt(n++, _m.compose(_v.set(b.x, b.y + 0.02, b.z), _q, _s.set(d, d, 1)));
      }
    this.blobs.count = n;
    this.blobs.instanceMatrix.needsUpdate = true;
  }

  private updateLights(dt: number): void {
    const w = this.w;
    const glow = Math.max(0, Math.min(1, (w.pal.lantern - 0.5) / 1.2));
    const active = glow > 0.02 && !w.isInside ? (ACTIVE[w.quality] ?? 0) : 0;
    // alle 0,5 s die nächsten Laternen wählen
    this.pickT -= dt;
    if (this.pickT <= 0) {
      this.pickT = 0.5;
      const pl = w.player;
      const near = this.lanterns
        .map((v) => ({ v, d: (v.x - pl.x) ** 2 + (v.z - pl.z) ** 2 }))
        .filter((o) => o.d < 22 * 22)
        .sort((a, b) => a.d - b.d)
        .slice(0, active)
        .map((o) => o.v);
      // bereits leuchtende behalten, freie Lichter neuen Laternen geben (erst wenn sie ausgeblendet sind)
      const want = new Set(near);
      for (const l of this.lights) if (l.at && !want.has(l.at)) l.at = l.k > 0.02 ? l.at : null;
      for (const v of near) {
        if (this.lights.some((l) => l.at === v)) continue;
        const free = this.lights.find((l) => !l.at);
        if (free) {
          free.at = v;
          free.k = 0;
          free.light.position.copy(v);
        }
      }
      for (const l of this.lights) (l as { want?: boolean }).want = !!l.at && want.has(l.at);
    }
    const t = this.time;
    this.lights.forEach((l, i) => {
      const target = (l as { want?: boolean }).want ? 1 : 0;
      l.k += (target - l.k) * Math.min(1, dt * 1.5);
      if (l.k < 0.01 && !target) l.at = null;
      // sehr dezentes Flackern (keine Schatten → kein Zittern)
      const flicker = 1 + Math.sin(t * 7.3 + i * 2.1) * 0.025 + Math.sin(t * 13.1 + i) * 0.015;
      l.light.intensity = 2.6 * glow * l.k * flicker;
    });
  }
}
