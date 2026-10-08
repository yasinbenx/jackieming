// Die Bühne: PixiJS-Anwendung, Kamera, Parallax, Tageszeit, Übergänge.
import { Application, Container } from 'pixi.js';
import { clamp, easeInOutCubic, lerp } from '../core/util';
import { DESIGN_H, DESIGN_W, TEAHOUSE_POS, World } from './world';
import type { CamState } from './world';
import { Room } from './room';
import { Petals, Motes } from './particles';
import { TimeOfDay } from './timeOfDay';
import type { Palette, TimePreset } from './timeOfDay';

export type StageMode = 'outside' | 'inside';

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
  fireflies!: Motes;
  mode: StageMode = 'outside';
  cam: CamState = { ...CAM_WIDE };
  time = 0;
  /** Zusatz-Hooks, die jeden Frame laufen (Figuren, Audio …) */
  readonly tickers: ((dt: number, time: number) => void)[] = [];
  /** Horizontaler Fokus auf Hochkant-Geräten (Designkoordinate) */
  focusX = 800;
  private pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  private palette!: Palette;
  private zoomBoost = 1;

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

    this.petals = new Petals(this.app, this.world.blossomSpots, { x0: -300, x1: 1900, y0: -100, y1: 1000 });
    this.world.fgLayer.addChild(this.petals.node);
    this.fireflies = new Motes(
      this.world.ctx.glow,
      { x0: 0, x1: 1600, y0: 380, y1: 860 },
      46,
      { tint: 0xd8ff7a, size: [0.07, 0.14], speed: 14, twinkle: 2.2 },
      17,
    );
    this.world.midLayer.addChild(this.fireflies.node);

    this.tod = new TimeOfDay((p) => this.applyPalette(p));
    this.room.root.visible = false;

    window.addEventListener('pointermove', (e) => {
      this.pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
      this.pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
    });
    this.app.renderer.on('resize', () => this.layout());
    this.layout();
    this.app.ticker.add((t) => this.tick(Math.min(t.deltaMS / 1000, 0.05)));
  }

  private applyPalette(p: Palette): void {
    this.palette = p;
    this.world.applyPalette(p);
    this.room.applyPalette(p);
    this.fireflies.level = clamp((p.lamp - 0.35) / 0.65);
  }

  /** Skaliert die 1600×900-Designfläche auf den Bildschirm (cover). */
  layout(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const s = Math.max(w / DESIGN_W, h / DESIGN_H);
    this.view.scale.set(s);
    const visW = w / s;
    const fx = visW >= DESIGN_W ? DESIGN_W / 2 : clamp(this.focusX, visW / 2, DESIGN_W - visW / 2);
    this.view.x = w / 2 - fx * s;
    this.view.y = (h - DESIGN_H * s) / 2;
  }

  /** Auf schmalen Bildschirmen auf eine Designkoordinate schwenken. */
  setFocusX(x: number): void {
    this.focusX = x;
    this.layout();
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
    if (this.mode === 'inside') this.room.update(dt, this.time, this.pointer.sx, this.pointer.sy);
    for (const t of [...this.tickers]) t(dt, this.time);
    this.zoomBoost += (1 - this.zoomBoost) * (1 - Math.exp(-dt * 4));
    this.world.applyCamera(this.cam, this.pointer.sx, this.pointer.sy);
    this.view.pivot.set(0, 0);
  }
}
