// Anordnung der Sprechblasen (reine Logik, ohne DOM – wird von Bubbles und Tests genutzt)

export interface BubbleGroup {
  /** Kopfpunkt auf dem Bildschirm */
  x: number;
  y: number;
  visible: boolean;
  /** Blasen dieses Sprechers, neueste zuerst (Breite, Höhe in px) */
  sizes: { w: number; h: number }[];
}

export interface BubbleSpot {
  /** Mitte unten (die Spitze zeigt auf den Kopf) */
  x: number;
  bottom: number;
  hidden: boolean;
}

export interface BubbleView {
  width: number;
  height: number;
  /** rechte Grenze (Gesprächsleiste am Desktop) */
  right?: number;
  /** untere Grenze (Gesprächsblatt am Telefon) */
  bottom?: number;
}

/**
 * Gruppen in Vorrang-Reihenfolge (wer zuletzt zu sprechen begann, zuerst). Spätere Blasen weichen früheren nach
 * oben aus; passt eine nicht mehr ins Bild, wird sie ausgeblendet statt überlagert.
 */
export function layoutBubbles(groups: readonly BubbleGroup[], view: BubbleView): BubbleSpot[][] {
  const side = view.right ?? view.width;
  const bottomLimit = view.bottom ?? view.height;
  const placed: { l: number; r: number; t: number; b: number }[] = [];
  const hit = (x: number, w: number, top: number, h: number, pad: number) =>
    placed.find(
      (r) => x - w / 2 < r.r + pad && x + w / 2 > r.l - pad && top - h < r.b + pad && top > r.t - pad,
    );
  return groups.map((g) => {
    let y = Math.min(g.y - 8, bottomLimit);
    return g.sizes.map(({ w, h }, i) => {
      const x = Math.min(side - w / 2 - 10, Math.max(w / 2 + 10, g.x));
      let top = Math.max(h + 64, y);
      for (let k = 0; k < 6; k++) {
        const r = hit(x, w, top, h, 6);
        if (!r) break;
        top = r.t - 8;
      }
      const clipped = top < h + 8;
      top = Math.max(h + 8, top);
      const still = !!hit(x, w, top, h, 0);
      const hidden = !g.visible || still || (i > 0 && (y < h + 64 || clipped));
      if (!hidden) placed.push({ l: x - w / 2, r: x + w / 2, t: top - h, b: top });
      y = top - h - 10;
      return { x, bottom: top, hidden };
    });
  });
}
