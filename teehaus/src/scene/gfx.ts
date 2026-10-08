// Prozedural erzeugte Texturen (Verläufe, Glow, Rauschen) – keine externen Bilddateien.
import { Texture } from 'pixi.js';
import type { Container } from 'pixi.js';
import { TAU, cssColor } from '../core/util';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Weicher Kreis-Glow (weiß, innen deckend, außen transparent). Wird per tint eingefärbt. */
export function glowTexture(size = 128, hardness = 0.0): Texture {
  const [c, ctx] = canvas(size, size);
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, r * hardness, r, r, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

/** Vertikaler Verlauf aus Farbstopps (offset 0..1, CSS-Farbe). */
export function gradientCanvas(
  w: number,
  h: number,
  stops: [number, string][],
  horizontal = false,
): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const g = horizontal ? ctx.createLinearGradient(0, 0, w, 0) : ctx.createLinearGradient(0, 0, 0, h);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

export function gradientTexture(
  w: number,
  h: number,
  stops: [number, string][],
  horizontal = false,
): Texture {
  return Texture.from(gradientCanvas(w, h, stops, horizontal));
}

/** Weiße Nebelbahn: oben/unten transparent, in der Mitte deckend. */
export function mistTexture(): Texture {
  return gradientTexture(4, 128, [
    [0, 'rgba(255,255,255,0)'],
    [0.5, 'rgba(255,255,255,1)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
}

/**
 * Nahtlos kachelnde Verschiebungs-Karte für die Teich-Spiegelung.
 * Rot = horizontale, Grün = vertikale Auslenkung (128 = neutral).
 */
export function rippleTexture(size = 256): Texture {
  const [c, ctx] = canvas(size, size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * TAU;
      const v = (y / size) * TAU;
      const a =
        Math.sin(u * 3 + Math.sin(v * 2) * 1.4) + Math.sin(v * 5 + u) * 0.5 + Math.sin((u + v) * 2) * 0.5;
      const b = Math.sin(v * 3 + Math.sin(u * 2) * 1.2) + Math.sin(u * 4 - v) * 0.5;
      const i = (y * size + x) * 4;
      img.data[i] = 128 + a * 42;
      img.data[i + 1] = 128 + b * 42;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = Texture.from(c);
  tex.source.addressMode = 'repeat';
  return tex;
}

/** Feines Papierkorn als Overlay (sehr dezent). */
export function grainTexture(size = 256): Texture {
  const [c, ctx] = canvas(size, size);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (Math.random() - 0.5) * 90;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = Texture.from(c);
  tex.source.addressMode = 'repeat';
  return tex;
}

/** Vignette: Mitte transparent, Rand dunkel. */
export function vignetteTexture(color: number): Texture {
  const size = 256;
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size * 0.72);
  const col = cssColor(color);
  g.addColorStop(0, col + '00');
  g.addColorStop(1, col + 'cc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

/**
 * Statische Ebene einmal in eine Textur „einbacken“: spart pro Frame tausende Dreiecke.
 * Tönung, Transparenz und Verschiebung des Containers wirken weiterhin.
 */
export function bake<T extends Container>(node: T, resolution = 1): T {
  node.cacheAsTexture({ resolution, antialias: true });
  return node;
}
