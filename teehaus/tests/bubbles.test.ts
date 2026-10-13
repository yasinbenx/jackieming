// Sprechblasen: keine Überlappung, im Bild, nicht unter dem Gesprächsfenster
import { describe, expect, it } from 'vitest';
import { layoutBubbles } from '../src/ui/bubblelayout';
import type { BubbleGroup } from '../src/ui/bubblelayout';

const view = { width: 1280, height: 720, right: 880 };
type Box = { l: number; r: number; t: number; b: number };
const boxes = (groups: BubbleGroup[]): Box[] =>
  layoutBubbles(groups, view).flatMap((g, gi) =>
    g
      .map((s, i) => ({ s, size: groups[gi]!.sizes[i]! }))
      .filter(({ s }) => !s.hidden)
      .map(({ s, size }) => ({
        l: s.x - size.w / 2,
        r: s.x + size.w / 2,
        t: s.bottom - size.h,
        b: s.bottom,
      })),
  );
const overlap = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

describe('layoutBubbles', () => {
  it('zwei Sprecher nebeneinander überlappen nicht', () => {
    const bx = boxes([
      { x: 400, y: 300, visible: true, sizes: [{ w: 420, h: 140 }] },
      { x: 480, y: 320, visible: true, sizes: [{ w: 300, h: 60 }] },
    ]);
    expect(bx.length).toBeGreaterThan(0);
    for (let i = 0; i < bx.length; i++)
      for (let j = i + 1; j < bx.length; j++) expect(overlap(bx[i]!, bx[j]!)).toBe(false);
  });

  it('kein Platz: ältere Blase tritt zurück statt zu überdecken', () => {
    const bx = boxes([
      { x: 400, y: 160, visible: true, sizes: [{ w: 420, h: 140 }] },
      { x: 420, y: 160, visible: true, sizes: [{ w: 420, h: 140 }] },
    ]);
    for (let i = 0; i < bx.length; i++)
      for (let j = i + 1; j < bx.length; j++) expect(overlap(bx[i]!, bx[j]!)).toBe(false);
  });

  it('bleibt links der Gesprächsleiste und im Bild', () => {
    const [g] = layoutBubbles([{ x: 1000, y: 400, visible: true, sizes: [{ w: 300, h: 80 }] }], view);
    expect(g![0]!.x + 150).toBeLessThanOrEqual(view.right);
    expect(g![0]!.bottom - 80).toBeGreaterThanOrEqual(0);
  });

  it('unsichtbarer Kopf: Blase ausgeblendet', () => {
    const [g] = layoutBubbles([{ x: 300, y: 400, visible: false, sizes: [{ w: 300, h: 80 }] }], view);
    expect(g![0]!.hidden).toBe(true);
  });
});
