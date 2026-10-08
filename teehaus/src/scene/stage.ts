// Die Bühne: PixiJS-Anwendung, Kamera, Parallax, Tageszeit, Übergänge.
import { Application, Container } from 'pixi.js';
import { clamp, easeInOutCubic, lerp } from '../core/util';
import { DESIGN_H, DESIGN_W, TEAHOUSE_POS, World } from './world';
import type { CamState } from './world';
import { Room } from './room';
import { Petals, Motes } from './particles';
import { TimeOfDay } from './timeOfDay';
import { bus } from '../core/bus';
import { createCast } from '../figures/characters';
import type { Cast } from '../figures/characters';
import type { Palette, TimePreset } from './timeOfDay';

export type StageMode = 'outside' | 'inside';

/** Hochformat: so viel Designbreite ist sichtbar, und so liegt der Kopf von Yao unter der Leiste */
const PORTRAIT_VISIBLE_W = 720;
const PORTRAIT_CENTER_X = 810;
const PORTRAIT_ANCHOR_Y = 120;
const PORTRAIT_TOP_INSET = 124;

const CAM_WIDE: CamState = {
  p: 0,
  zoom: 1,
  uniform: null,
  fx: TEAHOUSE_POS.x,
  fy: TEAHOUSE_POS.y - 70,
  cx: 800,
  cy: 450,
};
const CAM_ROOM: CamState = { p: 1, zoom: 1, uniform: 0.85, fx: 800, fy: 720, cx: 800, cy: 500 };

export class Stage {
  readonly app = new Application();
  readonly view = new Container();
  world!: World;
  room!: Room;
  tod!: TimeOfDay;
  petals!: Petals;
  /** Blütenblätter im Raum (für das Finale) */
  roomPetals!: Petals;
  /** Wenn gesetzt, schauen beide Gäste dorthin (Finale, Quiz) */
  attentionOverride: { x: number; y: number } | null = null;
  fireflies!: Motes;
  cast!: Cast;
  mode: StageMode = 'outside';
  cam: CamState = { ...CAM_WIDE };
  time = 0;
  /** Zusatz-Hooks, die jeden Frame laufen (Figuren, Audio …) */
  readonly tickers: ((dt: number, time: number) => void)[] = [];
  /** Horizontaler Fokus auf Hochkant-Geräten (Designkoordinate) */
  focusX = 800;
  private pointer = { x: 0, y: 0, sx: 0, sy: 0, cx: 0, cy: 0 };
  private palette!: Palette;
  /** Maximale Zeit pro Frame (Sekunden); Tests auf langsamen Rechnern erhöhen sie. */
  dtCap = 0.05;
  private target = { x: 0, y: 0 };
  private shift = 0;
  private lastBusT = -1;
  private lastMove = 0;
  private glanceT = 0;
  private zoomBoost = 1;
  private cupSteam: ReturnType<Room['steam']['add']>[] = [];

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      background: 0x0b0806,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: 'webgl',
    });
    host.appendChild(this.app.canvas);
    this.app.canvas.setAttribute('aria-hidden', 'true');
    this.app.stage.addChild(this.view);

    this.world = new World(this.app);
    this.world.build();
    this.room = new Room();
    this.view.addChild(this.world.root, this.room.root);
    this.cast = createCast(this.room, this.world.ctx.glow);
    const cupSteam = this.cast.all.map((f) =>
      this.room.steam.add({
        x: f.cup.x,
        y: f.cup.y,
        rate: 2.2,
        rise: 24,
        spread: 4,
        size: 0.38,
        life: 2.2,
        alpha: 0.22,
      }),
    );
    this.cupSteam = cupSteam;

    this.petals = new Petals(this.app, this.world.blossomSpots, { x0: -300, x1: 1900, y0: -100, y1: 1000 });
    this.world.fgLayer.addChild(this.petals.node);
    this.roomPetals = new Petals(this.app, [], { x0: -200, x1: 1800, y0: -200, y1: 1000 }, 70);
    this.roomPetals.rate = 0;
    this.room.front.addChild(this.roomPetals.node);
    this.fireflies = new Motes(
      this.world.ctx.glow,
      { x0: 0, x1: 1600, y0: 380, y1: 860 },
      46,
      { tint: 0xd8ff7a, size: [0.07, 0.14], speed: 14, twinkle: 2.2 },
      17,
    );
    this.world.midLayer.addChild(this.fireflies.node);

    this.tod = new TimeOfDay((p, t) => {
      this.applyPalette(p);
      if (Math.abs(t - this.lastBusT) > 0.01) {
        this.lastBusT = t;
        bus.emit('time:changed', { t });
      }
    });
    this.cast.all.forEach((f) => (f.onSip = () => bus.emit('scene:sip', { who: f.style.id })));
    this.room.root.visible = false;

    window.addEventListener('pointermove', (e) => {
      this.lastMove = performance.now();
      this.pointer.cx = e.clientX;
      this.pointer.cy = e.clientY;
      this.pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
      this.pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
    });
    this.app.renderer.on('resize', () => this.layout());
    this.layout();
    this.app.ticker.add((t) => this.tick(Math.min(t.deltaMS / 1000, this.dtCap)));
  }

  private applyPalette(p: Palette): void {
    this.palette = p;
    this.world.applyPalette(p);
    this.room.applyPalette(p);
    this.fireflies.level = clamp((p.lamp - 0.35) / 0.65);
  }

  /** Skaliert die 1600×900-Designfläche auf den Bildschirm (cover). */
  layout(immediate = true): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    if (w / h < 1) {
      // Hochformat (Smartphone): nach Breite skalieren, beide Gäste sichtbar; Raum ist oben/unten verlängert.
      const s = w / PORTRAIT_VISIBLE_W;
      this.view.scale.set(s);
      this.target.x = w / 2 - PORTRAIT_CENTER_X * s;
      this.target.y = PORTRAIT_TOP_INSET - PORTRAIT_ANCHOR_Y * s - this.shift * s;
    } else {
      const s = Math.max(w / DESIGN_W, h / DESIGN_H);
      this.view.scale.set(s);
      const visW = w / s;
      const fx = visW >= DESIGN_W ? DESIGN_W / 2 : clamp(this.focusX, visW / 2, DESIGN_W - visW / 2);
      this.target.x = w / 2 - fx * s;
      this.target.y = (h - DESIGN_H * s) / 2 - this.shift * s;
    }
    if (immediate) {
      this.view.x = this.target.x;
      this.view.y = this.target.y;
    }
  }

  /** Bild nach oben schieben (z. B. wenn unten ein Dialog offen ist), in Designpixeln. */
  setShift(designPx: number): void {
    this.shift = designPx;
    this.layout(false);
  }

  /** Auf schmalen Bildschirmen auf eine Designkoordinate schwenken. */
  setFocusX(x: number): void {
    this.focusX = x;
    this.layout(false);
  }

  /** Designkoordinate → Bildschirmkoordinate (z. B. für Sprechblasen) */
  designToScreen(x: number, y: number): { x: number; y: number } {
    const s = this.view.scale.x;
    return { x: this.view.x + x * s, y: this.view.y + y * s };
  }

  /** Bildschirmkoordinaten → Designkoordinaten (1600×900) */
  toDesign(cx: number, cy: number): { x: number; y: number } {
    const s = this.view.scale.x;
    return { x: (cx - this.view.x) / s, y: (cy - this.view.y) / s };
  }

  get ready(): boolean {
    return !!this.world;
  }

  setTime(p: TimePreset | 'auto'): void {
    if (p === 'auto') this.tod.setAuto();
    else this.tod.setPreset(p);
  }

  /** Außenansicht oder Innenraum-Ausblick. */
  setMode(m: StageMode): void {
    this.mode = m;
    if (m === 'inside') {
      this.cam = { ...CAM_ROOM };
      this.world.setOutdoor(false);
      this.world.placeMagpieForRoom();
      this.room.root.visible = true;
    } else {
      this.cam = { ...CAM_WIDE };
      this.world.setOutdoor(true);
      this.room.root.visible = false;
    }
  }

  /** Kamerafahrt durch die Landschaft bis zur Tür des Teehauses. */
  approach(seconds: number, skip: { requested: boolean }, onProgress?: (u: number) => void): Promise<void> {
    this.setMode('outside');
    return new Promise((resolve) => {
      let u = 0;
      const hook = (dt: number): void => {
        u += (dt / seconds) * (skip.requested ? 6 : 1);
        const e = easeInOutCubic(clamp(u));
        this.cam.p = e;
        this.cam.zoom = 1 + 2.85 * e;
        this.tod.jump(lerp(0.3, 0.5, easeInOutCubic(clamp(u * 1.1))));
        onProgress?.(clamp(u));
        if (u >= 1) {
          const i = this.tickers.indexOf(hook);
          if (i >= 0) this.tickers.splice(i, 1);
          this.tod.setAuto();
          resolve();
        }
      };
      this.tickers.push(hook);
    });
  }

  /** Leichter Zoom-Impuls (z. B. beim Anstoßen). */
  pulseZoom(amount = 0.03): void {
    this.zoomBoost = 1 + amount;
  }

  private tick(dt: number): void {
    this.time += dt;
    this.pointer.sx += (this.pointer.x - this.pointer.sx) * (1 - Math.exp(-dt * 3));
    this.pointer.sy += (this.pointer.y - this.pointer.sy) * (1 - Math.exp(-dt * 3));
    this.tod.update(dt);
    this.world.update(dt, this.time, this.palette);
    const wind = 0.3 + Math.max(0, Math.sin(this.time * 0.13)) * 0.9;
    this.petals.update(dt, this.time, wind);
    this.fireflies.update(dt, this.time);
    if (this.mode === 'inside') {
      this.room.update(dt, this.time, this.pointer.sx, this.pointer.sy);
      const pd = this.toDesign(this.pointer.cx, this.pointer.cy);
      // Blickverhalten: Mauszeiger folgen, solange er sich bewegt; sonst einander oder dem Tisch zuwenden.
      const pointerActive = performance.now() - this.lastMove < 4500;
      this.glanceT += dt;
      const phase = Math.floor(this.glanceT / 4.5) % 3;
      this.roomPetals.update(dt, this.time, wind);
      this.cast.all.forEach((f, i) => {
        const other = this.cast.all[1 - i]!;
        f.attention = pointerActive
          ? null
          : phase === 2
            ? { x: 800, y: 620 }
            : { x: other.style.cx, y: other.style.headY };
        f.setPointer(pd);
        f.update(dt, this.time);
        const src = this.cupSteam[i]!;
        src.x = f.cup.x;
        src.y = f.cup.y - 4;
      });
    }
    for (const t of [...this.tickers]) t(dt, this.time);
    this.zoomBoost += (1 - this.zoomBoost) * (1 - Math.exp(-dt * 4));
    this.world.applyCamera(this.cam, this.pointer.sx, this.pointer.sy);
    // sanfte Kamera-Bewegung zum Ziel
    const k = 1 - Math.exp(-dt * 4);
    this.view.x += (this.target.x - this.view.x) * k;
    this.view.y += (this.target.y - this.view.y) * k;
  }
}
