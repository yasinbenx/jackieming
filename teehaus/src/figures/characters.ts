// Die beiden Gäste: Stil-Daten (Proportionen, Farben) und Platzierung im Teehaus.
// Die Figuren sind stilisiert (Kleidung, Haltung, Größe) – keine Gesichts-Karikaturen.
import type { Texture } from 'pixi.js';
import { Figure } from './figure';
import type { FigureStyle } from './figure';
import type { Room } from '../scene/room';

/** Yao Ming ist 2,29 m groß: er sitzt auf einem Hocker, sein Kopf reicht fast an den Balken. */
const YAO: FigureStyle = {
  id: 'yao',
  cx: 984,
  shoulderY: 304,
  shoulderHalf: 94,
  headY: 194,
  headRx: 54,
  headRy: 70,
  neckW: 23,
  skin: 0xe9bf94,
  skinShade: 0xd19f74,
  hair: 0x14100e,
  cloth: 0x4a6285,
  clothDark: 0x2f4060,
  trim: 0xd9a94a,
  l1: 168,
  l2: 160,
  sleeveW: 48,
  handR: 17,
  cupArm: 'left',
  cupRest: { x: 966, y: 590 },
  freeRest: { x: 1052, y: 600 },
  baseSmile: 0.12,
  eyeSpacing: 20,
  eyeY: -12,
  mouthY: 42,
  mouthHalf: 16,
  browY: -30,
};

const JACKIE: FigureStyle = {
  id: 'jackie',
  cx: 636,
  shoulderY: 462,
  shoulderHalf: 78,
  headY: 368,
  headRx: 58,
  headRy: 64,
  neckW: 21,
  skin: 0xf1cba2,
  skinShade: 0xdcab80,
  hair: 0x1c1612,
  cloth: 0xcf9440,
  clothDark: 0x8a5a22,
  trim: 0x5a3414,
  l1: 98,
  l2: 90,
  sleeveW: 44,
  handR: 15,
  cupArm: 'right',
  cupRest: { x: 676, y: 588 },
  freeRest: { x: 580, y: 598 },
  baseSmile: 0.45,
  eyeSpacing: 22,
  eyeY: -7,
  mouthY: 35,
  mouthHalf: 19,
  browY: -24,
};

export interface Cast {
  jackie: Figure;
  yao: Figure;
  all: Figure[];
}

export function createCast(room: Room, glow: Texture): Cast {
  const jackie = new Figure(JACKIE, room.ctx, glow, 1);
  const yao = new Figure(YAO, room.ctx, glow, 2);
  for (const f of [jackie, yao]) {
    room.figBody.addChild(f.halo);
  }
  room.figBody.addChild(jackie.body, yao.body);
  room.figArms.addChild(jackie.arms, yao.arms);
  // Die Tassen der Figuren ersetzen die abgestellten Tassen vor ihnen.
  room.cupJackie.visible = false;
  room.cupYao.visible = false;
  return { jackie, yao, all: [jackie, yao] };
}
