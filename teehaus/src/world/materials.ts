// Materialien im weichen „Vinyl“-Look: sanfte Schattierung, warmes Randlicht (Fresnel), leichte Eigenwärme.
// Stickerei (Drachen, Wolken) wird als Canvas-Textur erzeugt – keine Bilddateien.
import { CanvasTexture, Color, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three';
import type { Texture } from 'three';

/** Gemeinsame Uniforms für das Randlicht (Farbe folgt der Tageszeit) */
export const RIM = {
  uRimColor: { value: new Color('#ffcf9a') },
  uRim: { value: 0.45 },
};

const cache = new Map<string, MeshStandardMaterial>();

export interface VinylOpts {
  rough?: number;
  metal?: number;
  map?: Texture | null;
  /** Eigenwärme (Haut wirkt dadurch weicher, „subsurface“-ähnlich) */
  warm?: number;
  rim?: number;
  transparent?: boolean;
  opacity?: number;
  key?: string;
}

/** Standardmaterial mit Fresnel-Randlicht */
export function vinyl(color: string, o: VinylOpts = {}): MeshStandardMaterial {
  const key =
    o.key ??
    `${color}|${o.rough ?? 0.6}|${o.metal ?? 0}|${o.map?.uuid ?? ''}|${o.warm ?? 0}|${o.rim ?? 1}|${o.opacity ?? 1}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = new MeshStandardMaterial({
    color: new Color(color),
    roughness: o.rough ?? 0.6,
    metalness: o.metal ?? 0,
    map: o.map ?? null,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
  });
  if (o.warm) m.emissive = new Color(color).multiplyScalar(o.warm);
  const rimK = (o.rim ?? 1).toFixed(2);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = RIM.uRimColor;
    shader.uniforms.uRim = RIM.uRim;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRim;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
        totalEmissiveRadiance += uRimColor * rimF * uRim * ${rimK};`,
      );
  };
  m.customProgramCacheKey = () => `vinyl-${rimK}`;
  cache.set(key, m);
  return m;
}

// ───────────────────────────────────────── Stickerei

const texCache = new Map<string, Texture>();

function drawCloud(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  // Ruyi-Wolke: drei Spiralen
  g.beginPath();
  for (const [dx, dy, r] of [
    [0, 0, 1],
    [-1.1, 0.35, 0.7],
    [1.1, 0.35, 0.7],
  ] as const) {
    const cx = x + dx * s;
    const cy = y + dy * s;
    for (let a = 0; a < Math.PI * 3.2; a += 0.2) {
      const rr = (r * s * (1 - a / (Math.PI * 3.6))) as number;
      const px = cx + Math.cos(a + Math.PI) * rr;
      const py = cy + Math.sin(a + Math.PI) * rr * 0.8;
      if (a === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
  }
  g.stroke();
}

function drawDragon(g: CanvasRenderingContext2D, w: number, h: number, gold: string): void {
  // Schlangenförmiger Körper als Kurve, Schuppen als Bögen, Kopf mit Hörnern und Barteln, Krallen, Perle
  const body: [number, number][] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    body.push([w * (0.08 + t * 0.84), h * (0.5 + Math.sin(t * Math.PI * 2.2 + 0.4) * 0.26)]);
  }
  g.strokeStyle = gold;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = h * 0.085;
  g.beginPath();
  body.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  // Rückenkamm
  g.lineWidth = h * 0.012;
  for (let i = 4; i < 56; i += 3) {
    const [x, y] = body[i]!;
    const [nx, ny] = body[i + 1]!;
    const ang = Math.atan2(ny - y, nx - x) - Math.PI / 2;
    g.beginPath();
    g.moveTo(x + Math.cos(ang) * h * 0.04, y + Math.sin(ang) * h * 0.04);
    g.lineTo(x + Math.cos(ang) * h * 0.085, y + Math.sin(ang) * h * 0.085);
    g.stroke();
  }
  // Schuppen (dunkle Bögen auf dem Gold)
  g.strokeStyle = 'rgba(80,40,10,0.55)';
  g.lineWidth = h * 0.008;
  for (let i = 2; i < 58; i += 1) {
    const [x, y] = body[i]!;
    g.beginPath();
    g.arc(x, y, h * 0.022, 0.2, Math.PI - 0.2);
    g.stroke();
  }
  g.strokeStyle = gold;
  // Krallen
  g.lineWidth = h * 0.016;
  for (const i of [14, 30, 46]) {
    const [x, y] = body[i]!;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + h * 0.05, y + h * 0.1);
    for (const k of [-1, 0, 1]) {
      g.moveTo(x + h * 0.05, y + h * 0.1);
      g.lineTo(x + h * 0.05 + k * h * 0.03, y + h * 0.14);
    }
    g.stroke();
  }
  // Kopf
  const [hx, hy] = body[60]!;
  g.fillStyle = gold;
  g.beginPath();
  g.ellipse(hx, hy, h * 0.075, h * 0.055, -0.3, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = h * 0.014;
  g.beginPath();
  g.moveTo(hx - h * 0.02, hy - h * 0.04);
  g.lineTo(hx - h * 0.07, hy - h * 0.13);
  g.moveTo(hx + h * 0.02, hy - h * 0.045);
  g.lineTo(hx + h * 0.0, hy - h * 0.14);
  // Barteln
  g.moveTo(hx + h * 0.06, hy + h * 0.01);
  g.quadraticCurveTo(hx + h * 0.16, hy - h * 0.06, hx + h * 0.2, hy + h * 0.04);
  g.moveTo(hx + h * 0.05, hy + h * 0.03);
  g.quadraticCurveTo(hx + h * 0.12, hy + h * 0.12, hx + h * 0.18, hy + h * 0.1);
  g.stroke();
  g.fillStyle = 'rgba(120,20,10,0.9)';
  g.beginPath();
  g.arc(hx + h * 0.02, hy - h * 0.01, h * 0.012, 0, Math.PI * 2);
  g.fill();
  // Flammenperle
  g.fillStyle = gold;
  g.beginPath();
  g.arc(w * 0.04, h * 0.2, h * 0.04, 0, Math.PI * 2);
  g.fill();
}

/**
 * Stoff mit Stickerei. motif: 'dragon' (großer Drache), 'cloud' (Wolkenband), 'hem' (nur Bordüre), 'plain' (Stoffstruktur).
 * Die Textur wiederholt sich horizontal (rund um Arme, Mantel und Hosenbeine).
 */
export interface Front {
  /**
   * open: offener Mantel mit Innenhemd · closed: Mittelleiste · tang: Tang-Anzug, Mittelleiste mit Knotenknöpfen
   * (Pankou) · cross: Hanfu-Überlappkragen (rechts über links, 右衽) · side: Changshan, Verschluss vom Kragen
   * schräg zur rechten Achsel und an der rechten Seite hinunter
   */
  kind: 'open' | 'closed' | 'none' | 'tang' | 'cross' | 'side';
  inner?: string;
  knots?: boolean;
  trim?: string;
}

export function embroidery(
  base: string,
  gold: string,
  motif: 'dragon' | 'cloud' | 'hem' | 'plain',
  repeat = 1,
  front: Front = { kind: 'none' },
): Texture {
  const key = `${base}|${gold}|${motif}|${repeat}|${JSON.stringify(front)}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const W = 512;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const drawFront = (): void => {
    // Die Vorderseite liegt an der Textur-Naht (u = 0 und u = 1): links und rechts je eine Hälfte zeichnen
    if (front.kind === 'open') {
      const wt = W * 0.1;
      const wb = W * 0.035;
      g.fillStyle = front.inner ?? '#f4eee4';
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(wt, 0);
      g.lineTo(wb, H);
      g.lineTo(0, H);
      g.fill();
      g.beginPath();
      g.moveTo(W, 0);
      g.lineTo(W - wt, 0);
      g.lineTo(W - wb, H);
      g.lineTo(W, H);
      g.fill();
      g.strokeStyle = gold;
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(wt, 0);
      g.lineTo(wb, H);
      g.moveTo(W - wt, 0);
      g.lineTo(W - wb, H);
      g.stroke();
      if (front.knots) {
        g.fillStyle = gold;
        for (let i = 0; i < 4; i++) {
          const y = H * (0.28 + i * 0.16);
          for (const x of [0, W]) {
            g.beginPath();
            g.arc(x, y, 9, 0, Math.PI * 2);
            g.fill();
            g.fillRect(x - 20, y - 2.5, 40, 5);
          }
        }
      }
    }
    // u = 0/1 ist vorne Mitte, u = 0,25 die linke, u = 0,75 die rechte Seite der Figur; y = 0 ist oben (Kragen)
    const knot = (x: number, y: number, w = 26): void => {
      // Pankou: zwei Schlaufen und ein Knötchen
      g.fillStyle = front.trim ?? gold;
      g.beginPath();
      g.ellipse(x - w * 0.55, y, w * 0.55, 6, 0, 0, Math.PI * 2);
      g.ellipse(x + w * 0.55, y, w * 0.55, 6, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();
    };
    if (front.kind === 'tang') {
      g.fillStyle = front.trim ?? gold;
      g.fillRect(0, 0, 7, H);
      g.fillRect(W - 7, 0, 7, H);
      // Stehkragen-Kante
      g.fillRect(0, 0, W * 0.09, 14);
      g.fillRect(W * 0.91, 0, W * 0.09, 14);
      for (let i = 0; i < 5; i++) {
        const y = H * (0.12 + i * 0.15);
        knot(0, y);
        knot(W, y);
      }
    }
    if (front.kind === 'cross') {
      // Kragenband: vom Hals (vorne, leicht links der Mitte) schräg hinüber zur rechten Achsel (u ≈ 0,78)
      const band = front.trim ?? gold;
      g.strokeStyle = band;
      g.lineCap = 'round';
      g.lineWidth = 24;
      g.beginPath();
      g.moveTo(W * 0.06, -12);
      g.quadraticCurveTo(W * 0.02, H * 0.1, -W * 0.02, H * 0.16);
      g.moveTo(W * 1.06, -12);
      g.quadraticCurveTo(W * 1.02, H * 0.1, W * 0.98, H * 0.16);
      g.quadraticCurveTo(W * 0.86, H * 0.32, W * 0.77, H * 0.46);
      g.stroke();
      // darunterliegender Kragen links, als helle Kante sichtbar
      g.strokeStyle = front.inner ?? '#f4eee4';
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(W * 0.1, -6);
      g.quadraticCurveTo(W * 0.11, H * 0.12, W * 0.07, H * 0.2);
      g.stroke();
      g.strokeStyle = gold;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(W * 1.0, H * 0.18);
      g.quadraticCurveTo(W * 0.88, H * 0.34, W * 0.79, H * 0.48);
      g.stroke();
    }
    if (front.kind === 'side') {
      // Changshan: Stehkragen, Bogen zur rechten Achsel, dann seitlich hinunter; Knoten entlang der Linie
      const band = front.trim ?? gold;
      g.strokeStyle = band;
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(W * 1.0, H * 0.02);
      g.quadraticCurveTo(W * 0.98, H * 0.16, W * 0.84, H * 0.22);
      g.lineTo(W * 0.8, H);
      g.stroke();
      g.fillStyle = band;
      g.fillRect(0, 0, W * 0.1, 12);
      g.fillRect(W * 0.9, 0, W * 0.1, 12);
      knot(W * 0.99, H * 0.08, 20);
      knot(W * 0.9, H * 0.19, 20);
      for (let i = 0; i < 3; i++) knot(W * 0.82, H * (0.34 + i * 0.13), 20);
    }
    if (front.kind === 'closed') {
      g.fillStyle = front.trim ?? gold;
      g.fillRect(0, 0, 9, H);
      g.fillRect(W - 9, 0, 9, H);
      for (let i = 0; i < 4; i++) {
        const y = H * (0.25 + i * 0.17);
        for (const x of [0, W]) {
          g.fillRect(x - 26, y - 4, 52, 8);
          g.beginPath();
          g.arc(x, y, 8, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  };
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  // Webstruktur
  const col = new Color(base);
  for (let i = 0; i < 2200; i++) {
    const v = Math.random() * 0.12 - 0.06;
    g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 240 : 0},${v > 0 ? 220 : 0},${Math.abs(v) * 0.6})`;
    g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 6, 1);
  }
  void col;
  g.strokeStyle = gold;
  g.lineWidth = 6;
  if (motif === 'dragon') {
    drawDragon(g, W, H * 0.8, gold);
    g.lineWidth = 5;
    for (let x = 30; x < W; x += 130) drawCloud(g, x, H * 0.88, 16);
  }
  if (motif === 'cloud') {
    g.lineWidth = 5;
    for (let row = 0; row < 3; row++)
      for (let x = 40 + (row % 2) * 60; x < W; x += 120) drawCloud(g, x, 90 + row * 160, 22);
  }
  if (motif !== 'plain') {
    // Bordüre unten (Saum): doppelte Linie mit Mäander
    g.fillStyle = gold;
    g.fillRect(0, H - 34, W, 6);
    g.fillRect(0, H - 10, W, 6);
    g.lineWidth = 4;
    g.beginPath();
    for (let x = 0; x < W; x += 24) {
      g.moveTo(x, H - 14);
      g.lineTo(x, H - 26);
      g.lineTo(x + 14, H - 26);
      g.lineTo(x + 14, H - 18);
    }
    g.stroke();
  }
  drawFront();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.repeat.set(repeat, 1);
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** Basketball-Textur (Orange mit schwarzen Nähten) */
export function ballTexture(): Texture {
  const key = 'ball';
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d9682a';
  g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = 'rgba(90,30,0,0.18)';
    g.fillRect(Math.random() * 256, Math.random() * 128, 1.5, 1.5);
  }
  g.strokeStyle = '#1c1210';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 64);
  g.lineTo(256, 64);
  for (const x of [0, 64, 128, 192, 256]) {
    g.moveTo(x, 0);
    g.lineTo(x, 128);
  }
  g.stroke();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

let foldTex: Texture | null = null;

/**
 * Stofffalten als Normal Map: weiche senkrechte Falten (am Saum stärker) und feines Gewebe. Wird auf Jacken,
 * Hosen und Gewänder gelegt (u läuft um den Körper, v von unten nach oben).
 */
export function fabricNormals(): Texture {
  if (foldTex) return foldTex;
  const W = 256;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  // Höhenfeld: Falten = Summe von Sinuswellen mit leicht schwankender Phase, unten tiefer
  const hgt = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    const depth = 0.35 + 0.65 * Math.pow(1 - v, 1.5);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const wob = Math.sin(v * 9 + u * 31) * 0.04;
      let h = 0;
      h += Math.sin((u + wob) * Math.PI * 2 * 7) * 0.6;
      h += Math.sin((u - wob * 2) * Math.PI * 2 * 13 + 1.3) * 0.3;
      h *= depth;
      h += Math.sin(x * 1.9) * Math.sin(y * 2.1) * 0.03;
      hgt[y * W + x] = h;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const l = hgt[y * W + ((x - 1 + W) % W)]!;
      const r = hgt[y * W + ((x + 1) % W)]!;
      const d = hgt[((y - 1 + H) % H) * W + x]!;
      const u = hgt[((y + 1) % H) * W + x]!;
      let nx = (l - r) * 2.5;
      let ny = (d - u) * 2.5;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * W + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  foldTex = t;
  return t;
}
