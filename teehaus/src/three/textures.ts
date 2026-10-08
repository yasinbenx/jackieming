// Prozedurale Texturen (Canvas), keine Bilddateien: Glühen, Nebel, Papier, Holz, Schrift.
import { CanvasTexture, SRGBColorSpace, RepeatWrapping } from 'three';
import type { Texture } from 'three';
import { rng } from './noise';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, srgb = true): CanvasTexture {
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

const cache = new Map<string, Texture>();
const once = <T extends Texture>(key: string, make: () => T): T => {
  let t = cache.get(key) as T | undefined;
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
};

/** Weicher runder Lichtfleck (für Laternen-Halos, Staub, Dampf) */
export const glowTexture = (): Texture =>
  once('glow', () => {
    const [c, g] = canvas(128, 128);
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return tex(c, false);
  });

/** Wolkiger Nebelfleck (unregelmäßig, für Bergnebel und Dampf) */
export const mistTexture = (): Texture =>
  once('mist', () => {
    const [c, g] = canvas(256, 128);
    const r = rng(5);
    // Blasen bleiben vollständig im Bild, sonst entstehen harte Kanten
    for (let i = 0; i < 30; i++) {
      const rad = 14 + r() * 26;
      const x = rad + 4 + r() * (248 - 2 * rad);
      const y = 64 + (r() - 0.5) * (120 - 2 * rad) * 0.6;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(255,255,255,0.22)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 128);
    }
    return tex(c, false);
  });

/** Holzmaserung (hell, wird über die Materialfarbe getönt) */
export const woodTexture = (): Texture =>
  once('wood', () => {
    const [c, g] = canvas(256, 256);
    const r = rng(9);
    g.fillStyle = '#d9c3a2';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      const y = r() * 256;
      g.strokeStyle = `rgba(90,60,30,${0.05 + r() * 0.12})`;
      g.lineWidth = 0.6 + r() * 2;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 2.5);
      g.stroke();
    }
    // Dielenfugen
    g.strokeStyle = 'rgba(60,35,15,0.55)';
    g.lineWidth = 2;
    for (let y = 0; y <= 256; y += 64) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(256, y);
      g.stroke();
    }
    const t = tex(c);
    t.wrapS = t.wrapT = RepeatWrapping;
    return t;
  });

/** Reispapier mit Fasern (für Fenster und Hängerolle) */
export const paperTexture = (): Texture =>
  once('paper', () => {
    const [c, g] = canvas(128, 128);
    const r = rng(3);
    g.fillStyle = '#f4ead6';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 180; i++) {
      g.strokeStyle = `rgba(150,120,80,${r() * 0.12})`;
      g.lineWidth = 0.5;
      const x = r() * 128;
      const y = r() * 128;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 14);
      g.stroke();
    }
    const t = tex(c);
    t.wrapS = t.wrapT = RepeatWrapping;
    return t;
  });

/** Senkrechte Hängerolle mit Pinselschrift */
export function scrollTexture(text: string, font: string): Texture {
  return once(`scroll:${text}`, () => {
    const [c, g] = canvas(128, 512);
    g.fillStyle = '#efe2c6';
    g.fillRect(0, 0, 128, 512);
    g.fillStyle = '#7a1f14';
    g.fillRect(0, 0, 128, 26);
    g.fillRect(0, 486, 128, 26);
    g.fillStyle = '#1c130e';
    g.font = `84px ${font}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const chars = Array.from(text);
    const step = 440 / chars.length;
    chars.forEach((ch, i) => g.fillText(ch, 64, 48 + step * (i + 0.5)));
    // kleiner roter Stempel
    g.fillStyle = '#b3261a';
    g.fillRect(84, 438, 24, 24);
    return tex(c);
  });
}

/** Messlatte mit Markierungen für die beiden Körpergrößen */
export const rulerTexture = (font: string): Texture =>
  once('ruler', () => {
    const [c, g] = canvas(64, 512);
    g.fillStyle = '#e8d6b0';
    g.fillRect(0, 0, 64, 512);
    g.fillStyle = '#3a2414';
    // 512 px = 2,40 m
    for (let cm = 0; cm <= 240; cm += 10) {
      const y = 512 - (cm / 240) * 512;
      g.fillRect(0, y - 1, cm % 50 === 0 ? 34 : 18, 2);
    }
    const mark = (cm: number, color: string, label: string): void => {
      const y = 512 - (cm / 240) * 512;
      g.fillStyle = color;
      g.fillRect(0, y - 3, 64, 6);
      g.font = `20px ${font}`;
      g.fillText(label, 34, y - 8);
    };
    mark(173, '#b3261a', '成龙');
    mark(229, '#1d4e89', '姚明');
    return tex(c);
  });

/** Kleines Namensschild (für die Silhouetten-Ersatzfigur) */
export function labelCanvas(zh: string, de: string, font: string): HTMLCanvasElement {
  const [c, g] = canvas(256, 96);
  g.fillStyle = '#f4ead6';
  g.fillRect(0, 0, 256, 96);
  g.strokeStyle = '#7a1f14';
  g.lineWidth = 4;
  g.strokeRect(4, 4, 248, 88);
  g.fillStyle = '#1c130e';
  g.textAlign = 'center';
  g.font = `44px ${font}`;
  g.fillText(zh, 128, 50);
  g.font = '20px serif';
  g.fillText(de, 128, 80);
  return c;
}

export const makeTexture = tex;
