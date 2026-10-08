// Steinbogenbrücke (拱桥 gǒngqiáo) mit roten Geländern und Laternen.
import { Container, Graphics, Sprite } from 'pixi.js';
import type { SceneCtx } from './ctx';

export const WATERLINE = 705;
const X0 = 360;
const X1 = 1160;
const CX = 760;

export const deckY = (x: number): number => 690 - 78 * (1 - Math.pow((x - CX) / 400, 2));
const archY = (x: number): number => WATERLINE - 78 * Math.sqrt(Math.max(0, 1 - Math.pow((x - CX) / 230, 2)));

export interface BridgeResult {
  node: Container;
  lanterns: Container[];
}

export function buildBridge(ctx: SceneCtx): BridgeResult {
  const node = new Container();
  const body = new Container();
  ctx.tint(body, 'near');
  const g = new Graphics();
  body.addChild(g);

  const stone = 0xaaa59a;
  // Widerlager links / rechts + Bogenband
  const left: number[] = [];
  for (let x = X0; x <= CX - 230; x += 10) left.push(x, deckY(x));
  g.poly([...left, CX - 230, deckY(CX - 230), CX - 230, WATERLINE, X0, WATERLINE]).fill(stone);
  const right: number[] = [];
  for (let x = CX + 230; x <= X1; x += 10) right.push(x, deckY(x));
  g.poly([CX + 230, WATERLINE, CX + 230, deckY(CX + 230), ...right, X1, WATERLINE]).fill(stone);
  const band: number[] = [];
  for (let x = CX - 230; x <= CX + 230; x += 8) band.push(x, deckY(x));
  for (let x = CX + 230; x >= CX - 230; x -= 8) band.push(x, archY(x));
  g.poly(band).fill(0xb7b2a6);
  // Bogeninnenseite (dunkler)
  const inner: number[] = [];
  for (let x = CX - 230; x <= CX + 230; x += 8) inner.push(x, archY(x));
  g.moveTo(inner[0]!, inner[1]!);
  for (let i = 2; i < inner.length; i += 2) g.lineTo(inner[i]!, inner[i + 1]!);
  g.stroke({ width: 9, color: 0x6e695f, alpha: 0.9 });
  // Fugen
  for (let x = X0 + 12; x < X1; x += 34) {
    const y0 = deckY(x);
    const y1 = Math.min(WATERLINE, x > CX - 230 && x < CX + 230 ? archY(x) : WATERLINE);
    if (y1 - y0 > 6)
      g.moveTo(x, y0 + 14)
        .lineTo(x, Math.min(y1, y0 + 34))
        .stroke({ width: 1, color: 0x6e695f, alpha: 0.35 });
  }
  // Deckplatte
  const deck: number[] = [];
  for (let x = X0; x <= X1; x += 10) deck.push(x, deckY(x));
  g.moveTo(deck[0]!, deck[1]!);
  for (let i = 2; i < deck.length; i += 2) g.lineTo(deck[i]!, deck[i + 1]!);
  g.stroke({ width: 8, color: 0xd8d2c4, cap: 'round', join: 'round' });

  // Geländer
  const red = 0x8c2a1f;
  for (let x = X0 + 14; x <= X1 - 14; x += 48) {
    const y = deckY(x);
    g.rect(x - 4, y - 34, 8, 34).fill(red);
    g.circle(x, y - 36, 5).fill(0xb3392a);
  }
  const rail = (dy: number, w: number): void => {
    g.moveTo(X0 + 14, deckY(X0 + 14) - dy);
    for (let x = X0 + 24; x <= X1 - 14; x += 10) g.lineTo(x, deckY(x) - dy);
    g.stroke({ width: w, color: red, cap: 'round', join: 'round' });
  };
  rail(33, 6);
  rail(15, 3.5);
  node.addChild(body);

  // Laternen an drei Pfosten
  const lanterns: Container[] = [];
  for (const x of [X0 + 14, CX, X1 - 14]) {
    const y = deckY(x);
    const l = new Container();
    l.position.set(x, y - 34);
    const lg = new Graphics();
    lg.rect(-3, -34, 6, 34).fill(0x5a2b1e);
    lg.moveTo(0, -34).lineTo(14, -34).lineTo(14, -26).stroke({ width: 2, color: 0x5a2b1e });
    lg.ellipse(14, -10, 10, 13).fill(0xc9301f);
    lg.rect(9, -23, 10, 3).fill(0xd9a94a);
    lg.rect(10, 3, 8, 3).fill(0xd9a94a);
    l.addChild(lg);
    const glow = new Sprite(ctx.glow);
    glow.anchor.set(0.5);
    glow.position.set(14, -10);
    glow.scale.set(1.3);
    glow.tint = 0xffa23a;
    glow.blendMode = 'add';
    ctx.lit(glow, 0, 0.95);
    l.addChild(glow);
    node.addChild(l);
    lanterns.push(l);
  }
  return { node, lanterns };
}
