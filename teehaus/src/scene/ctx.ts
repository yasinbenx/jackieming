// Gemeinsamer Kontext aller Szenen-Bauteile: Tönung nach Tiefe, leuchtende Elemente, Texturen.
import type { Container, Texture } from 'pixi.js';
import type { Palette } from './timeOfDay';
import { glowTexture, mistTexture } from './gfx';

export type TintKind = 'far' | 'mid' | 'near' | 'room';

interface Tintable {
  node: Container;
  kind: TintKind;
}
interface Emissive {
  node: Container;
  base: number;
  gain: number;
}

export const FONT_ZH = '"Noto Serif SC", "Songti SC", "STSong", "SimSun", "WenQuanYi Zen Hei", serif';
export const FONT_BRUSH = '"Ma Shan Zheng", "STKaiti", "KaiTi", "Noto Serif SC", "Songti SC", serif';

export class SceneCtx {
  readonly glow: Texture = glowTexture(128);
  readonly mist: Texture = mistTexture();
  private tintables: Tintable[] = [];
  private emissives: Emissive[] = [];

  /** Knoten wird von der Tageszeit mit der Tönung der jeweiligen Tiefe multipliziert. */
  tint<T extends Container>(node: T, kind: TintKind): T {
    this.tintables.push({ node, kind });
    return node;
  }

  /** Leuchtendes Element (Fenster, Laternen): Alpha = base + gain * Lampenstärke. */
  lit<T extends Container>(node: T, base: number, gain: number): T {
    this.emissives.push({ node, base, gain });
    return node;
  }

  apply(p: Palette): void {
    for (const t of this.tintables) {
      t.node.tint =
        t.kind === 'far'
          ? p.tintFar
          : t.kind === 'mid'
            ? p.tintMid
            : t.kind === 'near'
              ? p.tintNear
              : p.tintRoom;
    }
    for (const e of this.emissives) e.node.alpha = Math.min(1, e.base + e.gain * p.lamp);
  }
}
