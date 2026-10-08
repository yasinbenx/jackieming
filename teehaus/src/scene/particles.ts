// Partikel: Dampf, fallende Blütenblätter, Glühwürmchen, Staubkörner im Lichtstrahl.
import { Application, Container, Graphics, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { clamp, mulberry32, rand, TAU } from '../core/util';

interface Puff {
  s: Sprite;
  life: number;
  max: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  alive: boolean;
  a0: number;
}

export interface SteamSource {
  x: number;
  y: number;
  /** Partikel pro Sekunde */
  rate: number;
  rise: number;
  spread: number;
  size: number;
  life: number;
  alpha: number;
  tint: number;
  acc: number;
}

/** Weicher, aufsteigender Dampf aus einem Pool von Sprites. */
export class Steam {
  readonly node = new Container();
  private pool: Puff[] = [];
  private sources: SteamSource[] = [];
  private rng = mulberry32(1234);

  constructor(glow: Texture, capacity = 90) {
    for (let i = 0; i < capacity; i++) {
      const s = new Sprite(glow);
      s.anchor.set(0.5);
      s.visible = false;
      this.node.addChild(s);
      this.pool.push({ s, life: 0, max: 1, vx: 0, vy: 0, size: 1, phase: 0, alive: false, a0: 0.3 });
    }
  }

  add(src: Partial<SteamSource> & { x: number; y: number }): SteamSource {
    const s: SteamSource = {
      rate: 6,
      rise: 34,
      spread: 6,
      size: 0.5,
      life: 2.6,
      alpha: 0.32,
      tint: 0xffffff,
      acc: 0,
      ...src,
    };
    this.sources.push(s);
    return s;
  }

  /** Einmaliger Dampfstoß (z. B. beim Klick auf die Teekanne) */
  burst(x: number, y: number, n = 14): void {
    for (let i = 0; i < n; i++)
      this.spawn({
        x,
        y,
        rate: 0,
        rise: 52,
        spread: 22,
        size: 0.62,
        life: 2.2,
        alpha: 0.42,
        tint: 0xffffff,
        acc: 0,
      });
  }

  private spawn(src: SteamSource): void {
    const p = this.pool.find((q) => !q.alive);
    if (!p) return;
    p.alive = true;
    p.life = 0;
    p.max = src.life * rand(this.rng, 0.8, 1.2);
    p.vx = rand(this.rng, -src.spread, src.spread) * 0.4;
    p.vy = -src.rise * rand(this.rng, 0.75, 1.15);
    p.size = src.size * rand(this.rng, 0.7, 1.2);
    p.phase = this.rng() * TAU;
    p.s.visible = true;
    p.s.tint = src.tint;
    p.s.position.set(src.x + rand(this.rng, -src.spread, src.spread) * 0.5, src.y);
    p.s.scale.set(p.size * 0.5);
    p.s.alpha = 0;
    p.a0 = src.alpha;
  }

  update(dt: number, time: number): void {
    for (const s of this.sources) {
      s.acc += s.rate * dt;
      while (s.acc >= 1) {
        s.acc -= 1;
        this.spawn(s);
      }
    }
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life += dt;
      const t = p.life / p.max;
      if (t >= 1) {
        p.alive = false;
        p.s.visible = false;
        continue;
      }
      p.s.x += (p.vx + Math.sin(time * 1.4 + p.phase) * 9) * dt;
      p.s.y += p.vy * dt;
      p.vy *= 1 - dt * 0.25;
      p.s.scale.set(p.size * (0.5 + t * 1.4));
      p.s.alpha = p.a0 * Math.sin(Math.min(1, t * 4) * Math.PI * 0.5) * (1 - t) * (1 - t * 0.2);
    }
  }
}

interface Petal {
  s: Sprite;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  phase: number;
  alive: boolean;
  scale: number;
}

/** Fallende Pflaumenblütenblätter – starten an den Blüten und taumeln im Wind. */
export class Petals {
  readonly node = new Container();
  private petals: Petal[] = [];
  private rng = mulberry32(555);
  private acc = 0;
  /** Blütenblätter pro Sekunde */
  rate = 1.6;
  /** Höchstzahl gleichzeitig sichtbarer Blütenblätter */
  maxActive = 46;

  constructor(
    app: Application,
    private spots: [number, number][],
    private area: { x0: number; x1: number; y0: number; y1: number },
    count = 46,
  ) {
    const g = new Graphics();
    g.ellipse(0, 0, 7, 4.5).fill(0xf6c1cc);
    g.ellipse(-1, -0.5, 4, 2.4).fill({ color: 0xffffff, alpha: 0.35 });
    g.poly([5.5, -1.5, 8.5, 0, 5.5, 1.5]).fill(0xf6c1cc);
    const tex = app.renderer.generateTexture(g);
    for (let i = 0; i < count; i++) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.visible = false;
      this.node.addChild(s);
      this.petals.push({ s, vx: 0, vy: 0, rot: 0, vr: 0, phase: 0, alive: false, scale: 1 });
    }
  }

  private spawn(x?: number, y?: number): void {
    if (this.petals.filter((q) => q.alive).length >= this.maxActive && x === undefined) return;
    const p = this.petals.find((q) => !q.alive);
    if (!p) return;
    const spot = this.spots.length ? this.spots[Math.floor(this.rng() * this.spots.length)]! : [1400, 120];
    p.alive = true;
    p.s.visible = true;
    p.s.position.set(x ?? spot[0]! + rand(this.rng, -10, 10), y ?? spot[1]! + rand(this.rng, -6, 6));
    p.vx = rand(this.rng, -40, -10);
    p.vy = rand(this.rng, 18, 36);
    p.rot = this.rng() * TAU;
    p.vr = rand(this.rng, -2.2, 2.2);
    p.phase = this.rng() * TAU;
    p.scale = rand(this.rng, 0.6, 1.25);
    p.s.scale.set(p.scale);
    p.s.alpha = 0.95;
  }

  /** Mehrere Blütenblätter auf einmal (Finale, Klick auf Zweig) */
  burst(n: number, x?: number, y?: number): void {
    for (let i = 0; i < n; i++) this.spawn(x, y);
  }

  update(dt: number, time: number, wind: number): void {
    this.acc += this.rate * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.spawn();
    }
    for (const p of this.petals) {
      if (!p.alive) continue;
      p.s.x += (p.vx - wind * 24 + Math.sin(time * 1.7 + p.phase) * 30) * dt;
      p.s.y += (p.vy + Math.sin(time * 2.3 + p.phase) * 8) * dt;
      p.rot += p.vr * dt;
      p.s.rotation = p.rot;
      p.s.scale.x = p.scale * (0.55 + 0.45 * Math.abs(Math.cos(time * 2 + p.phase)));
      if (p.s.y > this.area.y1 || p.s.x < this.area.x0 || p.s.x > this.area.x1) {
        p.alive = false;
        p.s.visible = false;
      }
    }
  }
}

interface Mote {
  s: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
}

/** Schwebende Punkte (Staub im Lichtstrahl bzw. Glühwürmchen). */
export class Motes {
  readonly node = new Container();
  private motes: Mote[] = [];
  /** Gesamt-Sichtbarkeit (0..1) */
  level = 1;
  /** Anteil sichtbarer Partikel (Qualitätsstufe) */
  density = 1;
  /** Bewegungsfaktor (Ruhe-Modus) */
  motion = 1;

  constructor(
    glow: Texture,
    private area: { x0: number; x1: number; y0: number; y1: number },
    count: number,
    private opts: { tint: number; size: [number, number]; speed: number; twinkle: number },
    seed = 5,
  ) {
    const rng = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      const s = new Sprite(glow);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = opts.tint;
      const size = rand(rng, opts.size[0], opts.size[1]);
      s.scale.set(size);
      this.node.addChild(s);
      this.motes.push({
        s,
        x: rand(rng, area.x0, area.x1),
        y: rand(rng, area.y0, area.y1),
        vx: rand(rng, -1, 1) * opts.speed,
        vy: rand(rng, -1, 0.3) * opts.speed,
        phase: rng() * TAU,
        size,
      });
    }
  }

  setTint(c: number): void {
    for (const m of this.motes) m.s.tint = c;
  }

  update(dt: number, time: number): void {
    const a = this.area;
    const shown = Math.ceil(this.motes.length * this.density);
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i]!;
      m.s.visible = i < shown;
      if (i >= shown) continue;
      m.x += (m.vx + Math.sin(time * 0.5 + m.phase) * this.opts.speed * 0.6) * dt * this.motion;
      m.y += (m.vy + Math.cos(time * 0.4 + m.phase * 1.3) * this.opts.speed * 0.5) * dt * this.motion;
      if (m.x < a.x0) m.x = a.x1;
      if (m.x > a.x1) m.x = a.x0;
      if (m.y < a.y0) m.y = a.y1;
      if (m.y > a.y1) m.y = a.y0;
      m.s.position.set(m.x, m.y);
      const tw = 0.5 + 0.5 * Math.sin(time * this.opts.twinkle + m.phase * 3);
      m.s.alpha = clamp(this.level * (0.25 + 0.75 * tw));
    }
  }
}
