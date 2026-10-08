// Eine sitzende Figur als Vektor-Rig: Torso, Kopf mit parametrischer Mimik, zwei IK-Arme, Tasse.
// Alles wird per Code gezeichnet; die Animation (Atmen, Blinzeln, Blick, Schluck, Sprechen,
// Reaktionen) läuft über eine kleine Feder-Mechanik pro Parameter.
import { Container, Graphics, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { clamp, lerp, mulberry32 } from '../core/util';
import { solveArm } from './ik';
import type { Pt } from './ik';
import type { SceneCtx } from '../scene/ctx';

export type FigureId = 'jackie' | 'yao';
export type Reaction = 'hello' | 'surprise' | 'laugh' | 'nod' | 'duck' | 'think';

export interface FigureStyle {
  id: FigureId;
  cx: number;
  shoulderY: number;
  shoulderHalf: number;
  headY: number;
  headRx: number;
  headRy: number;
  neckW: number;
  skin: number;
  skinShade: number;
  hair: number;
  cloth: number;
  clothDark: number;
  trim: number;
  l1: number;
  l2: number;
  sleeveW: number;
  handR: number;
  /** Welcher Arm (vom Betrachter aus) hält die Tasse */
  cupArm: 'left' | 'right';
  cupRest: Pt;
  freeRest: Pt;
  baseSmile: number;
  eyeSpacing: number;
  eyeY: number;
  mouthY: number;
  mouthHalf: number;
  browY: number;
}

interface Params {
  smile: number;
  mouthOpen: number;
  brow: number;
  browAsym: number;
  eyeOpen: number;
  laugh: number;
  blush: number;
  lookX: number;
  lookY: number;
  headRot: number;
  headDy: number;
  lean: number;
}

const OUTLINE = 0x2a170f;

export class Figure {
  readonly style: FigureStyle;
  /** Wird in room.figBody eingehängt (Torso + Kopf) */
  readonly body = new Container();
  /** Wird in room.figArms eingehängt (Arme + Tasse) */
  readonly arms = new Container();
  /** Unsichtbare Klickfläche */
  readonly hit = new Graphics();
  /** Weicher Heiligenschein bei Hover/Auswahl */
  readonly halo: Sprite;

  private torso = new Container();
  private head = new Container();
  private faceDyn = new Graphics();
  private armL = new Graphics();
  private armR = new Graphics();
  private cupG = new Graphics();
  private params: Params;
  private target: Params;
  private vel: Record<keyof Params, number>;
  private rng: () => number;
  private t = 0;
  private nextBlink = 2;
  private blink = 0;
  private nextSip = 7;
  private sipT = -1;
  private reactT = -1;
  private reactKind: Reaction = 'hello';
  private talkEnergy = 0;
  private freeGesture = 0;
  private cupPos: Pt;
  private lastPointer: Pt = { x: 0, y: 0 };

  speaking = false;
  hovered = false;
  selected = false;
  /** Zielposition für den Blick (Designkoordinaten), null = Mauszeiger folgen */
  attention: Pt | null = null;
  /** Klick/Tippen auf die Figur */
  onTap?: () => void;
  /** Wird aufgerufen, wenn die Tasse am Mund ist (für Dampf / Schluck-Sound) */
  onSip?: () => void;
  /** Aktuelle Weltposition der Tasse (für Dampf) */
  get cup(): Pt {
    return this.cupPos;
  }
  get mouth(): Pt {
    return { x: this.style.cx, y: this.style.headY + this.style.mouthY };
  }
  /** Oberkante des Kopfes (für Sprechblasen / Namensschild) */
  get headTop(): Pt {
    return { x: this.style.cx, y: this.style.headY - this.style.headRy - 14 };
  }

  constructor(
    style: FigureStyle,
    private ctx: SceneCtx,
    glow: Texture,
    seed: number,
  ) {
    this.style = style;
    this.rng = mulberry32(seed);
    this.params = this.base();
    this.target = this.base();
    this.vel = Object.fromEntries(Object.keys(this.params).map((k) => [k, 0])) as Record<
      keyof Params,
      number
    >;
    this.cupPos = { ...style.cupRest };
    this.nextBlink = 1 + this.rng() * 3;
    this.nextSip = 5 + this.rng() * 8;

    this.halo = new Sprite(glow);
    this.halo.anchor.set(0.5);
    this.halo.position.set(style.cx, style.headY + 60);
    this.halo.scale.set(style.id === 'yao' ? 5.6 : 4.2, style.id === 'yao' ? 7 : 4.6);
    this.halo.blendMode = 'add';
    this.halo.tint = 0xffd9a0;
    this.halo.alpha = 0;

    this.buildBody();
    this.buildArms();
    this.body.eventMode = 'passive';
    this.hit.on('pointerover', () => (this.hovered = true));
    this.hit.on('pointerout', () => (this.hovered = false));
    this.hit.on('pointertap', () => {
      this.react('hello');
      this.onTap?.();
    });
  }

  private base(): Params {
    return {
      smile: this.style.baseSmile,
      mouthOpen: 0,
      brow: 0,
      browAsym: 0,
      eyeOpen: 1,
      laugh: 0,
      blush: 0.1,
      lookX: 0,
      lookY: 0,
      headRot: 0,
      headDy: 0,
      lean: 0,
    };
  }

  // ───────────────────────────────────────── Aufbau
  private buildBody(): void {
    const s = this.style;
    const c = this.ctx;
    const bodyRoot = new Container();
    bodyRoot.position.set(s.cx, 0);

    // Torso
    this.torso.position.set(0, s.shoulderY);
    const tg = new Graphics();
    const w = s.shoulderHalf;
    const h = 330;
    tg.moveTo(-w, 18)
      .quadraticCurveTo(-w, -4, -w * 0.45, -12)
      .lineTo(-s.neckW, -16)
      .lineTo(s.neckW, -16)
      .lineTo(w * 0.45, -12)
      .quadraticCurveTo(w, -4, w, 18)
      .lineTo(w + 10, h)
      .lineTo(-w - 10, h)
      .closePath()
      .fill(s.cloth);
    tg.moveTo(-w, 18)
      .quadraticCurveTo(-w, -4, -w * 0.45, -12)
      .lineTo(-s.neckW, -16)
      .stroke({ width: 2.4, color: OUTLINE, alpha: 0.75, join: 'round' });
    tg.moveTo(w, 18)
      .quadraticCurveTo(w, -4, w * 0.45, -12)
      .lineTo(s.neckW, -16)
      .stroke({ width: 2.4, color: OUTLINE, alpha: 0.75, join: 'round' });
    // Licht und Schatten
    tg.poly([-w, 18, -w * 0.45, -12, -w * 0.3, h, -w - 10, h]).fill({ color: 0xffffff, alpha: 0.07 });
    tg.poly([w, 18, w * 0.45, -12, w * 0.3, h, w + 10, h]).fill({ color: 0x000000, alpha: 0.14 });
    // Mittelnaht + Knöpfe (盘扣 pánkòu)
    tg.moveTo(0, -12).lineTo(0, h).stroke({ width: 2, color: s.clothDark, alpha: 0.8 });
    const nb = s.id === 'jackie' ? 4 : 3;
    for (let i = 0; i < nb; i++) {
      const y = 14 + i * 28;
      if (s.id === 'jackie') {
        tg.moveTo(-10, y)
          .quadraticCurveTo(-4, y - 7, 0, y)
          .quadraticCurveTo(4, y + 7, 10, y)
          .stroke({ width: 3, color: s.trim, cap: 'round' });
        tg.circle(0, y, 3.4).fill(s.trim);
      } else {
        tg.circle(0, y, 3.6).fill(s.clothDark).stroke({ width: 1.2, color: OUTLINE, alpha: 0.5 });
      }
    }
    // Stehkragen (立领 lìlǐng)
    tg.poly([-s.neckW - 7, -10, -s.neckW + 2, -30, s.neckW - 2, -30, s.neckW + 7, -10, 0, 0]).fill(
      s.clothDark,
    );
    tg.moveTo(-s.neckW - 7, -10)
      .lineTo(-s.neckW + 2, -30)
      .lineTo(s.neckW - 2, -30)
      .lineTo(s.neckW + 7, -10)
      .stroke({
        width: 2,
        color: s.trim,
        alpha: s.id === 'jackie' ? 0.9 : 0.35,
      });
    this.torso.addChild(tg);
    this.torso.pivot.set(0, h);
    this.torso.position.set(0, s.shoulderY + h);
    bodyRoot.addChild(c.tint(this.torso, 'room'));

    // Hals + Kopf (Drehpunkt = Halsansatz)
    const neckY = s.shoulderY - 14;
    this.head.position.set(0, neckY);
    const neck = new Graphics();
    neck.rect(-s.neckW + 3, -34, (s.neckW - 3) * 2, 40).fill(s.skinShade);
    neck.rect(-s.neckW + 3, -34, (s.neckW - 3) * 2, 12).fill({ color: 0x000000, alpha: 0.15 });
    this.head.addChild(neck);
    const face = new Container();
    face.position.set(0, s.headY - neckY);
    this.drawStaticHead(face);
    face.addChild(this.faceDyn);
    this.head.addChild(face);
    bodyRoot.addChild(c.tint(this.head, 'room'));

    // Klickfläche über Kopf + Oberkörper
    const hw = s.shoulderHalf + 10;
    this.hit
      .rect(-hw, s.headY - s.headRy - 20, hw * 2, s.shoulderY - s.headY + s.headRy + 190)
      .fill({ color: 0xffffff, alpha: 0.001 });
    this.hit.eventMode = 'static';
    this.hit.cursor = 'pointer';
    bodyRoot.addChild(this.hit);
    this.body.addChild(bodyRoot);
  }

  /** Statische Teile des Kopfes (Schädel, Ohren, Haare, Nase). Gesicht dynamisch: faceDyn. */
  private drawStaticHead(parent: Container): void {
    const s = this.style;
    const g = new Graphics();
    const rx = s.headRx;
    const ry = s.headRy;
    const jackie = s.id === 'jackie';
    // Ohren
    for (const d of [-1, 1]) {
      g.ellipse(d * (rx + 2), 6, 9, 15)
        .fill(s.skin)
        .stroke({ width: 2, color: OUTLINE, alpha: 0.5 });
      g.ellipse(d * (rx + 2), 7, 4, 8).fill({ color: s.skinShade, alpha: 0.8 });
    }
    // Schädel
    if (jackie) {
      g.ellipse(0, -2, rx, ry * 0.95).fill(s.skin);
      g.ellipse(0, 26, rx * 0.8, ry * 0.58).fill(s.skin);
      g.ellipse(0, 8, rx + 2, ry * 0.7).fill(s.skin);
    } else {
      g.ellipse(0, -4, rx, ry * 0.95).fill(s.skin);
      g.poly([-rx + 3, 8, -rx * 0.62, ry * 0.86, 0, ry, rx * 0.62, ry * 0.86, rx - 3, 8]).fill(s.skin);
      g.ellipse(0, ry * 0.82, rx * 0.5, ry * 0.18).fill({ color: s.skin });
    }
    g.ellipse(0, 6, rx, ry * 0.9).stroke({ width: 2.2, color: OUTLINE, alpha: 0.35 });
    // Schatten unter dem Kinn / an den Wangen
    g.ellipse(-rx * 0.62, 14, rx * 0.35, ry * 0.4).fill({ color: s.skinShade, alpha: 0.25 });
    // Haare
    if (jackie) {
      g.moveTo(-rx - 4, 4)
        .bezierCurveTo(-rx - 14, -ry * 1.55, rx + 14, -ry * 1.55, rx + 4, 4)
        .lineTo(rx - 2, -ry * 0.44)
        .quadraticCurveTo(rx * 0.72, -ry * 0.3, rx * 0.4, -ry * 0.52)
        .quadraticCurveTo(rx * 0.12, -ry * 0.66, -rx * 0.14, -ry * 0.46)
        .quadraticCurveTo(-rx * 0.42, -ry * 0.62, -rx * 0.64, -ry * 0.36)
        .lineTo(-rx + 2, -ry * 0.5)
        .closePath()
        .fill(s.hair);
      g.moveTo(-rx * 0.5, -ry * 0.88)
        .quadraticCurveTo(0, -ry * 1.08, rx * 0.5, -ry * 0.9)
        .stroke({ width: 3.2, color: 0xffffff, alpha: 0.13 });
    } else {
      g.moveTo(-rx - 3, 6)
        .bezierCurveTo(-rx - 12, -ry * 1.55, rx + 12, -ry * 1.55, rx + 3, 6)
        .lineTo(rx - 4, -ry * 0.58)
        .quadraticCurveTo(rx * 0.5, -ry * 0.5, 0, -ry * 0.62)
        .quadraticCurveTo(-rx * 0.5, -ry * 0.5, -rx + 4, -ry * 0.58)
        .closePath()
        .fill(s.hair);
      g.moveTo(-rx * 0.55, -ry * 0.92)
        .quadraticCurveTo(0, -ry * 1.1, rx * 0.5, -ry * 0.94)
        .stroke({ width: 3.2, color: 0xffffff, alpha: 0.11 });
    }
    // Nase
    if (jackie) {
      g.ellipse(0, 15, 9, 7).fill({ color: s.skinShade, alpha: 0.85 });
      g.ellipse(-2.5, 12.5, 4, 2.8).fill({ color: 0xffffff, alpha: 0.3 });
      g.moveTo(-9, 18)
        .quadraticCurveTo(0, 24, 9, 18)
        .stroke({ width: 2, color: OUTLINE, alpha: 0.5, cap: 'round' });
      g.moveTo(-3, -4)
        .quadraticCurveTo(-5, 8, -7, 13)
        .stroke({ width: 1.8, color: OUTLINE, alpha: 0.25, cap: 'round' });
    } else {
      g.moveTo(-3, -10)
        .quadraticCurveTo(-5, 8, -5, 17)
        .stroke({ width: 2, color: OUTLINE, alpha: 0.26, cap: 'round' });
      g.ellipse(0, 19, 7.5, 5).fill({ color: s.skinShade, alpha: 0.8 });
      g.moveTo(-8, 22)
        .quadraticCurveTo(0, 27, 8, 22)
        .stroke({ width: 2, color: OUTLINE, alpha: 0.5, cap: 'round' });
    }
    parent.addChild(g);
  }

  private buildArms(): void {
    const c = this.ctx;
    const holder = new Container();
    holder.addChild(this.armL, this.armR, this.cupG);
    this.arms.addChild(c.tint(holder, 'room'));
  }

  // ───────────────────────────────────────── Steuerung
  /** Mauszeiger-Position in Designkoordinaten */
  setPointer(p: Pt): void {
    this.lastPointer = p;
  }

  pulse(energy = 1): void {
    this.talkEnergy = Math.max(this.talkEnergy, energy);
  }

  react(kind: Reaction): void {
    this.reactKind = kind;
    this.reactT = 0;
  }

  /** Einen Schluck Tee nehmen (nach kurzer Zeit zurück). */
  sip(): void {
    if (this.sipT < 0) this.sipT = 0;
  }

  // ───────────────────────────────────────── Update
  update(dt: number, time: number): void {
    this.t = time;
    const s = this.style;
    const P = this.target;

    // --- Zielparameter aus Zustand ableiten
    Object.assign(P, this.base());
    // Blinzeln
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink = 0.14;
      this.nextBlink = 2 + this.rng() * 4;
    }
    if (this.blink > 0) {
      this.blink -= dt;
      P.eyeOpen = 0.05;
    }
    // Atmen / leichte Kopfbewegung
    const breath = Math.sin(time * 1.5 + s.cx);
    P.headDy = breath * 1.4;
    P.headRot = Math.sin(time * 0.4 + s.cx * 0.01) * 0.012;
    // Blickziel
    const pt = this.attention ?? this.lastPointer;
    const dx = pt.x - s.cx;
    const dy = pt.y - s.headY;
    P.lookX = clamp(dx / 300, -1, 1);
    P.lookY = clamp(dy / 300, -1, 1);
    P.headRot += clamp(dx / 900, -1, 1) * 0.05;
    if (this.hovered || this.selected) {
      P.brow = 0.35;
      P.smile = Math.max(P.smile, 0.55);
      P.blush = 0.25;
    }
    if (this.selected) P.lean = 1;

    // Sprechen
    this.talkEnergy *= Math.exp(-dt * 6);
    if (this.speaking) {
      const m = 0.25 + 0.55 * Math.abs(Math.sin(time * 13 + s.cx)) * (0.45 + this.talkEnergy * 0.55);
      P.mouthOpen = m;
      P.smile = Math.max(P.smile, 0.2);
      P.headDy += Math.sin(time * 7) * 0.9 * this.talkEnergy;
      P.headRot += Math.sin(time * 3.1) * 0.012;
      P.brow = Math.max(P.brow, Math.sin(time * 2.2) * 0.25 + 0.15);
    }

    // Schluck Tee
    let sipK = 0;
    this.nextSip -= dt;
    if (this.nextSip <= 0 && !this.speaking && this.sipT < 0 && this.reactT < 0) {
      this.sipT = 0;
      this.nextSip = 9 + this.rng() * 10;
    }
    if (this.sipT >= 0) {
      this.sipT += dt;
      const T = this.sipT;
      // 1.2 s hoch, 1.0 s halten, 1.1 s runter
      sipK = T < 1.2 ? smooth(T / 1.2) : T < 2.2 ? 1 : T < 3.3 ? 1 - smooth((T - 2.2) / 1.1) : 0;
      if (T > 1.15 && T - dt <= 1.15) this.onSip?.();
      if (T > 3.3) this.sipT = -1;
    }
    if (sipK > 0) {
      P.eyeOpen = Math.min(P.eyeOpen, lerp(1, 0.35, sipK));
      P.headRot += -0.04 * sipK;
      P.smile = Math.max(P.smile, 0.3 * sipK);
      P.mouthOpen = Math.max(P.mouthOpen, 0.12 * sipK);
    }

    // Reaktionen
    let hop = 0;
    if (this.reactT >= 0) {
      this.reactT += dt;
      const T = this.reactT;
      const k = Math.exp(-T * 1.6);
      switch (this.reactKind) {
        case 'hello':
          P.brow = 0.7 * k;
          P.smile = 0.9;
          P.headRot += Math.sin(T * 9) * 0.05 * k;
          hop = Math.sin(clamp(T * 5, 0, Math.PI)) * 6;
          if (T > 1.6) this.reactT = -1;
          break;
        case 'surprise':
          P.brow = 1 * k;
          P.eyeOpen = 1;
          P.mouthOpen = 0.55 * k;
          P.smile = -0.1;
          hop = Math.sin(clamp(T * 8, 0, Math.PI)) * 10;
          if (T > 1.4) this.reactT = -1;
          break;
        case 'laugh':
          P.laugh = clamp(1.4 - T * 0.4);
          P.smile = 1;
          P.mouthOpen = 0.6 + Math.sin(T * 22) * 0.25;
          P.headDy += Math.sin(T * 22) * 2.4;
          P.headRot += Math.sin(T * 11) * 0.03;
          if (T > 2.4) this.reactT = -1;
          break;
        case 'nod':
          P.headDy += Math.sin(T * 8) * 4 * k;
          P.smile = 0.7;
          if (T > 1.2) this.reactT = -1;
          break;
        case 'duck':
          P.headDy += 16 * Math.sin(clamp(T * 3.2, 0, Math.PI));
          P.eyeOpen = 0.3;
          P.brow = -0.6;
          P.mouthOpen = 0.35;
          P.smile = -0.3;
          if (T > 1.1) this.reactT = -1;
          break;
        case 'think':
          P.brow = 0.5;
          P.browAsym = 0.7;
          P.lookY = -0.8;
          P.lookX = 0.3;
          P.smile = 0.1;
          if (T > 1.8) this.reactT = -1;
          break;
      }
    }

    // --- Federn: Parameter folgen ihren Zielen weich
    const cur = this.params;
    for (const k of Object.keys(cur) as (keyof Params)[]) {
      const stiff = k === 'eyeOpen' ? 38 : k === 'mouthOpen' ? 26 : 16;
      const damp = 2 * Math.sqrt(stiff) * 0.82;
      const a = (P[k] - cur[k]) * stiff - this.vel[k] * damp;
      this.vel[k] += a * dt;
      cur[k] += this.vel[k] * dt;
    }

    // --- Transformationen anwenden
    const lean = cur.lean;
    this.torso.scale.set(1 + breath * 0.006 + lean * 0.015, 1 + breath * 0.011);
    const baseHeadY = s.shoulderY - 14;
    this.head.position.set(0, baseHeadY + cur.headDy - hop * 0.6 - lean * 2);
    this.head.rotation = cur.headRot;
    this.torso.y = s.shoulderY + 330 - hop * 0.5;
    this.halo.alpha = lerp(
      this.halo.alpha,
      this.selected ? 0.34 : this.hovered ? 0.22 : 0,
      1 - Math.exp(-dt * 5),
    );

    this.drawFace();
    this.updateArms(dt, sipK);
  }

  private drawFace(): void {
    const s = this.style;
    const p = this.params;
    const g = this.faceDyn;
    g.clear();
    const jackie = s.id === 'jackie';
    const ex = s.eyeSpacing;
    const ey = s.eyeY;
    const lookX = clamp(p.lookX, -1, 1) * 3.2;
    const lookY = clamp(p.lookY, -1, 1) * 2.2;
    const laugh = clamp(p.laugh);

    // Wangenröte
    g.ellipse(-ex - 8, ey + 22, 13, 8).fill({
      color: 0xe0624a,
      alpha: clamp(p.blush + p.smile * 0.1, 0, 0.5),
    });
    g.ellipse(ex + 8, ey + 22, 13, 8).fill({
      color: 0xe0624a,
      alpha: clamp(p.blush + p.smile * 0.1, 0, 0.5),
    });

    // Augen
    for (const d of [-1, 1]) {
      const x = d * ex;
      const open = clamp(p.eyeOpen * (1 - laugh * 0.9), 0, 1);
      if (laugh > 0.35) {
        // Lach-Bögen ^ ^
        g.moveTo(x - 10, ey + 3)
          .quadraticCurveTo(x, ey - 9, x + 10, ey + 3)
          .stroke({ width: 3.2, color: OUTLINE, cap: 'round' });
      } else if (open < 0.12) {
        g.moveTo(x - 9.5, ey + 1)
          .quadraticCurveTo(x, ey + 4, x + 9.5, ey + 1)
          .stroke({ width: 2.8, color: OUTLINE, cap: 'round' });
      } else {
        const h = (jackie ? 7.4 : 7.2) * open;
        g.ellipse(x, ey, 10.5, h).fill(0xfbf4e6);
        g.ellipse(x, ey, 10.5, h).stroke({ width: 1.6, color: OUTLINE, alpha: 0.7 });
        const pr = jackie ? 5.2 : 5;
        g.circle(x + lookX, ey + lookY, Math.min(pr, h)).fill(jackie ? 0x2a1a10 : 0x1f1612);
        g.circle(x + lookX - 1.2, ey + lookY - 1.4, 1.2).fill({ color: 0xffffff, alpha: 0.9 });
        // Oberlid
        g.moveTo(x - 10.5, ey - h * 0.3)
          .quadraticCurveTo(x, ey - h - 2.5, x + 10.5, ey - h * 0.3)
          .stroke({ width: 2.6, color: OUTLINE, cap: 'round' });
      }
    }

    // Augenbrauen
    const browLift = p.brow * 9;
    for (const d of [-1, 1]) {
      const x = d * ex;
      const asym = d > 0 ? p.browAsym * 7 : 0;
      const y = s.browY - browLift - asym;
      const inner = d * (ex - 12);
      const outer = d * (ex + 13);
      if (jackie) {
        g.moveTo(inner, y + 3)
          .quadraticCurveTo(x, y - 5.5, outer, y + 2 - p.brow * 2)
          .stroke({ width: 5.6, color: 0x1c1612, cap: 'round' });
      } else {
        g.moveTo(inner, y + 1 - p.brow * 1.5)
          .quadraticCurveTo(x, y - 3, outer, y + 2)
          .stroke({ width: 4.4, color: 0x14100e, cap: 'round' });
      }
    }

    // Mund
    const my = s.mouthY;
    const mw = s.mouthHalf * (1 + Math.max(0, p.smile) * 0.18 + laugh * 0.2);
    const curve = p.smile * (jackie ? 11 : 8);
    const open = clamp(p.mouthOpen, 0, 1) * (jackie ? 15 : 12);
    if (open > 1.2) {
      g.moveTo(-mw, my - curve * 0.35)
        .quadraticCurveTo(0, my - curve * 0.5 - 2, mw, my - curve * 0.35)
        .quadraticCurveTo(mw * 0.7, my + open + curve * 0.4, 0, my + open + curve * 0.6)
        .quadraticCurveTo(-mw * 0.7, my + open + curve * 0.4, -mw, my - curve * 0.35)
        .closePath()
        .fill(0x5a1a1a);
      g.moveTo(-mw * 0.78, my - curve * 0.3 + 1)
        .quadraticCurveTo(0, my - curve * 0.45, mw * 0.78, my - curve * 0.3 + 1)
        .lineTo(mw * 0.7, my + Math.min(open * 0.35, 5))
        .quadraticCurveTo(0, my + Math.min(open * 0.35, 5) + 1, -mw * 0.7, my + Math.min(open * 0.35, 5))
        .closePath()
        .fill({ color: 0xfdf8ee, alpha: 0.95 });
      g.ellipse(0, my + open * 0.8, mw * 0.4, open * 0.22).fill({ color: 0xc4574b, alpha: 0.9 });
      g.moveTo(-mw, my - curve * 0.35)
        .quadraticCurveTo(0, my - curve * 0.5 - 2, mw, my - curve * 0.35)
        .stroke({ width: 2.4, color: OUTLINE, cap: 'round', alpha: 0.9 });
    } else {
      g.moveTo(-mw, my - curve * 0.5)
        .quadraticCurveTo(0, my + curve * 0.9 + 2, mw, my - curve * 0.5)
        .stroke({ width: 3, color: 0x6a2a22, cap: 'round' });
    }
    // Lachfalten
    if (p.smile > 0.3) {
      const a = clamp((p.smile - 0.3) * 1.2, 0, 0.6);
      for (const d of [-1, 1]) {
        g.moveTo(d * (mw + 4), my - curve * 0.4 - 4)
          .quadraticCurveTo(d * (mw + 11), my - curve * 0.2 - 12, d * (mw + 6), my - curve * 0.6 - 20)
          .stroke({ width: 1.8, color: OUTLINE, alpha: a * 0.6, cap: 'round' });
      }
    }
  }

  private updateArms(dt: number, sipK: number): void {
    const s = this.style;
    const t = this.t;
    const half = s.shoulderHalf * 0.78;
    const sy = s.shoulderY + 22;
    const sL: Pt = { x: s.cx - half, y: sy };
    const sR: Pt = { x: s.cx + half, y: sy };
    const cupIsLeft = s.cupArm === 'left';

    // Tassen-Ziel: Ruhe → Mund
    const mouthT: Pt = {
      x: s.cx + (cupIsLeft ? -10 : 10),
      y: s.headY + s.mouthY + 22 + this.head.y - (s.shoulderY - 14),
    };
    const rest = s.cupRest;
    const kk = sipK;
    const cupT: Pt = {
      x: lerp(rest.x, mouthT.x, kk) + Math.sin(t * 1.3) * 0.6,
      y: lerp(rest.y, mouthT.y, kk) + Math.sin(t * 1.7) * 0.8 * (1 - kk),
    };
    // Freie Hand: Ruheposition + Gestik beim Sprechen
    this.freeGesture += ((this.speaking ? 1 : 0) - this.freeGesture) * (1 - Math.exp(-dt * 4));
    const g = this.freeGesture;
    const fr = s.freeRest;
    const freeT: Pt = {
      x: fr.x + Math.sin(t * 2.3) * 14 * g * (cupIsLeft ? 1 : -1),
      y: fr.y - g * (46 + Math.sin(t * 3.1) * 16) + Math.sin(t * 1.2) * 0.6,
    };

    const leftT = cupIsLeft ? cupT : freeT;
    const rightT = cupIsLeft ? freeT : cupT;
    // Beim Trinken zeigt der Oberarm nach vorn: in der Frontalansicht wirkt er verkürzt.
    const l1Cup = s.l1 * lerp(1, 0.55, kk);
    const l = solveArm(sL, leftT, cupIsLeft ? l1Cup : s.l1, s.l2, 1);
    const r = solveArm(sR, rightT, cupIsLeft ? s.l1 : l1Cup, s.l2, -1);
    this.drawArm(this.armL, sL, l.elbow, l.wrist, cupIsLeft);
    this.drawArm(this.armR, sR, r.elbow, r.wrist, !cupIsLeft);
    this.cupPos = { x: cupT.x, y: cupT.y };
    this.drawCup(cupIsLeft ? l.wrist : r.wrist, cupIsLeft);
  }

  private drawArm(g: Graphics, sh: Pt, el: Pt, wr: Pt, holding: boolean): void {
    const s = this.style;
    g.clear();
    const w = s.sleeveW;
    // Außenkontur, dann Stoff
    for (const [width, color, alpha] of [
      [w + 5, OUTLINE, 0.8],
      [w, s.cloth, 1],
    ] as const) {
      g.moveTo(sh.x, sh.y).lineTo(el.x, el.y).stroke({ width, color, alpha, cap: 'round', join: 'round' });
      g.moveTo(el.x, el.y)
        .lineTo(wr.x, wr.y)
        .stroke({ width: width * 0.88, color, alpha, cap: 'round', join: 'round' });
    }
    // Falten und Licht
    g.moveTo(sh.x, sh.y)
      .lineTo(el.x, el.y)
      .stroke({ width: w * 0.3, color: 0xffffff, alpha: 0.07, cap: 'round' });
    // Manschette
    const ang = Math.atan2(wr.y - el.y, wr.x - el.x);
    const cx = wr.x - Math.cos(ang) * 6;
    const cy = wr.y - Math.sin(ang) * 6;
    g.moveTo(cx - Math.cos(ang) * 6, cy - Math.sin(ang) * 6)
      .lineTo(cx + Math.cos(ang) * 6, cy + Math.sin(ang) * 6)
      .stroke({ width: w * 0.9, color: s.clothDark, cap: 'butt' });
    // Hand
    if (!holding) {
      g.ellipse(wr.x + Math.cos(ang) * 8, wr.y + Math.sin(ang) * 8, s.handR * 1.1, s.handR * 0.85)
        .fill(s.skin)
        .stroke({ width: 1.8, color: OUTLINE, alpha: 0.55 });
      for (let i = 0; i < 3; i++) {
        g.moveTo(wr.x + Math.cos(ang) * (s.handR + 4) + (i - 1) * 4, wr.y + Math.sin(ang) * (s.handR + 4))
          .lineTo(
            wr.x + Math.cos(ang) * (s.handR * 1.7) + (i - 1) * 4,
            wr.y + Math.sin(ang) * (s.handR * 1.7),
          )
          .stroke({ width: 1.2, color: OUTLINE, alpha: 0.4 });
      }
    }
  }

  private drawCup(wr: Pt, left: boolean): void {
    const s = this.style;
    const g = this.cupG;
    g.clear();
    const x = wr.x + (left ? 6 : -6);
    const y = wr.y - 8;
    const k = s.id === 'yao' ? 1.12 : 1.05;
    // Tasse (青花 qīnghuā)
    g.ellipse(x, y, 22 * k, 8 * k).fill(0xf6f2ea);
    g.poly([x - 22 * k, y, x + 22 * k, y, x + 15 * k, y + 20 * k, x - 15 * k, y + 20 * k]).fill(0xf6f2ea);
    g.ellipse(x, y + 20 * k, 15 * k, 5 * k).fill(0xe3ddd0);
    g.poly([
      x - 20 * k,
      y + 7 * k,
      x + 20 * k,
      y + 7 * k,
      x + 17 * k,
      y + 11 * k,
      x - 17 * k,
      y + 11 * k,
    ]).fill(0x2f5f9a);
    g.ellipse(x, y, 17 * k, 5.5 * k).fill(0xb3722e);
    // Hand um die Tasse: drei Finger als weiche Bögen vor dem Becher, Daumen am Rand
    for (let i = 0; i < 3; i++) {
      const fx = x + (i - 1) * 9 * k;
      g.moveTo(fx - 3 * k, y + 6 * k)
        .quadraticCurveTo(fx + 4 * k, y + 14 * k, fx - 1 * k, y + 21 * k)
        .stroke({ width: 8 * k, color: s.skin, cap: 'round' });
      g.moveTo(fx - 3 * k, y + 6 * k)
        .quadraticCurveTo(fx + 4 * k, y + 14 * k, fx - 1 * k, y + 21 * k)
        .stroke({ width: 1, color: OUTLINE, alpha: 0.18, cap: 'round' });
    }
    g.ellipse(x + (left ? 19 : -19) * k, y + 4 * k, 5.5 * k, 4.2 * k).fill(s.skin);
  }
}

const smooth = (t: number): number => {
  const k = clamp(t);
  return k * k * (3 - 2 * k);
};
