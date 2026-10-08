// Die 3D-Bühne: Renderer, Kamera (Kamerafahrt, freie Drehung, Presets), Licht, Tageszeit, Qualität,
// Postprocessing, Picking. Alles Weitere (Dialog, Ton, UI) hängt über game.ts daran.
import {
  Color,
  DirectionalLight,
  FogExp2,
  HalfFloatType,
  HemisphereLight,
  Mesh,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  CatmullRomCurve3,
} from 'three';
import type { Object3D, Texture, WebGLRenderTarget } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  BloomEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import type { Effect } from 'postprocessing';
import { buildLandscape, heightAt, makeSky, makeWater, updateSky } from './landscape';
import type { Landscape } from './landscape';
import { buildTeahouse } from './teahouse';
import type { Lantern, Teahouse } from './teahouse';
import { Fireflies, LightShafts, Petals, Steam } from './effects';
import { PaperFigure, STYLES } from './paperFigure';
import { palette, PRESET_T } from './palette';
import type { Palette, TimePreset } from './palette';
import { FLOOR, HX, HZ, POND, SHARED } from './shared';
import { clamp, lerp } from './noise';
import { bus } from '../core/bus';
import { store } from '../state/store';
import type { FigureId } from '../content/types';

export type Quality = 0 | 1 | 2;
export type CameraPreset = 'overview' | 'table' | 'outside';

interface QualitySpec {
  dpr: number;
  shadow: number;
  bloom: boolean;
  dof: boolean;
  msaa: number;
  petals: number;
  lights: boolean;
  steam: number;
}

const QUALITY: Record<Quality, QualitySpec> = {
  2: { dpr: 2, shadow: 2048, bloom: true, dof: true, msaa: 4, petals: 1, lights: true, steam: 1 },
  1: { dpr: 1.5, shadow: 1024, bloom: true, dof: false, msaa: 0, petals: 0.55, lights: true, steam: 0.8 },
  0: { dpr: 1, shadow: 0, bloom: false, dof: false, msaa: 0, petals: 0.25, lights: false, steam: 0.5 },
};

interface View {
  pos: Vector3;
  target: Vector3;
}

/** Kamera-Presets: deutlich mehr Abstand als früher, damit Haus und Landschaft sichtbar sind */
const PRESETS: Record<CameraPreset, View> = {
  table: { pos: new Vector3(0.3, 2.3, 3.9), target: new Vector3(0, 1.65, -0.35) },
  overview: { pos: new Vector3(6.8, 5.6, 13.5), target: new Vector3(0, 1.8, 0.2) },
  outside: { pos: new Vector3(-7.5, 2.6, 20.5), target: new Vector3(-0.6, 2.0, 3) },
};

export const PRESET_LABELS: Record<CameraPreset, string> = {
  overview: 'Überblick',
  table: 'Am Tisch',
  outside: 'Draußen',
};

type Pick = { obj: Object3D; onTap: () => void };

const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export class Stage {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(46, 16 / 9, 0.1, 1000);
  renderer!: WebGLRenderer;
  controls!: OrbitControls;
  private composer!: EffectComposer;
  private effectPass: EffectPass | null = null;
  private dof: DepthOfFieldEffect | null = null;
  private sun = new DirectionalLight('#ffffff', 3);
  private hemi = new HemisphereLight('#ffffff', '#444444', 1);
  /** Warmes Fülllicht von vorn auf die Figuren (wie Kerzenschein vom Tisch), nachts stärker */
  private fill = new PointLight('#ffc48a', 1, 6, 1.5);
  private sky = makeSky();
  private pmrem!: PMREMGenerator;
  private envTarget: WebGLRenderTarget | null = null;
  private envT = -1;
  land!: Landscape;
  house!: Teahouse;
  shafts!: LightShafts;
  steam!: Steam;
  petals!: Petals;
  private fireflies!: Fireflies;
  private simpleWater: Mesh | null = null;
  cast!: Record<FigureId, PaperFigure>;
  /** Zusätzliche Animationen (z. B. Easter Eggs); geben true zurück, wenn sie fertig sind */
  readonly tickers: ((dt: number) => boolean | void)[] = [];
  private picks: Pick[] = [];
  private ray = new Raycaster();
  private pointer = new Vector2();
  private down: { x: number; y: number; t: number } | null = null;
  private hoverDirty = false;
  private hoverX = 0;
  private hoverY = 0;
  private time = 0;
  private last = performance.now();
  private t = 0.5;
  private tTarget = 0.5;
  private auto = true;
  private autoPhase = 0;
  pal: Palette = palette(0.5);
  quality: Quality = 2;
  private qualityForced = false;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fpsWindows = 0;
  calm = false;
  free = false;
  private fly: { from: View; to: View; t: number; dur: number; done: () => void } | null = null;
  preset: CameraPreset | null = null;
  onInsideChange?: (inside: boolean) => void;
  private inside = false;
  onPreset?: (p: CameraPreset | null) => void;
  private base = import.meta.env.BASE_URL;

  async init(host: HTMLElement, progress: (f: number) => Promise<void>): Promise<void> {
    const q = new URLSearchParams(location.search).get('q');
    if (q === '0' || q === '1' || q === '2') {
      this.quality = Number(q) as Quality;
      this.qualityForced = true;
    } else if (store.settings.quality !== 'auto') {
      this.quality = store.settings.quality;
      this.qualityForced = true;
    } else {
      const small = Math.max(screen.width, screen.height) < 1100;
      const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      this.quality = small || coarse ? 1 : 2;
    }
    this.calm = store.settings.calm || reducedMotion();
    const spec = QUALITY[this.quality];

    this.renderer = new WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, spec.dpr));
    this.renderer.shadowMap.enabled = spec.shadow > 0;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.toneMapping = NoToneMapping;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.pmrem = new PMREMGenerator(this.renderer);
    await progress(0.4);

    // Licht
    this.scene.fog = new FogExp2('#e8b88a', 0.005);
    this.scene.add(this.sky, this.hemi, this.sun, this.sun.target, this.fill);
    this.fill.position.set(0, FLOOR + 1.9, 1.3);
    this.sun.castShadow = spec.shadow > 0;
    this.sun.shadow.mapSize.set(Math.max(512, spec.shadow), Math.max(512, spec.shadow));
    const sc = this.sun.shadow.camera;
    sc.left = -11;
    sc.right = 11;
    sc.top = 11;
    sc.bottom = -11;
    sc.near = 1;
    sc.far = 80;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.target.position.set(0, 0, 1);

    // Welt
    this.land = buildLandscape({
      reflect: this.quality > 0,
      reflectRes: this.quality === 2 ? 1024 : 512,
      bamboo: this.quality === 2 ? 240 : this.quality === 1 ? 160 : 90,
      mist: this.quality === 0 ? 14 : 26,
    });
    this.scene.add(this.land.group);
    if (this.quality > 0) {
      // einfache Wasserfläche als Ersatz, falls die Qualität später sinkt
      this.simpleWater = makeWater(false, 0);
      this.simpleWater.visible = false;
      this.scene.add(this.simpleWater);
    }
    await progress(0.6);
    this.house = buildTeahouse(this.quality === 2 ? 4 : this.quality === 1 ? 2 : 1);
    this.scene.add(this.house.group);
    this.shafts = new LightShafts(
      this.house.sunWindows,
      this.quality === 2 ? 420 : this.quality === 1 ? 220 : 90,
    );
    this.scene.add(this.shafts.group);
    this.steam = new Steam(this.quality === 0 ? 140 : 260);
    this.steam.addEmitter(this.house.spout, 3.2, 0.01, 0.8);
    for (const c of this.house.cups.slice(0, 2))
      this.steam.addEmitter(c.position.clone().setY(c.position.y + 0.05), 1.0, 0.02, 0.6);
    this.steam.addEmitter(this.house.kettle, 2.2, 0.03, 1.1);
    this.steam.addEmitter(this.house.incenseTip, 1.4, 0.005, 0.45);
    this.scene.add(this.steam.points);
    this.petals = new Petals(240, this.land.blossomCanopy, heightAt);
    this.petals.setActive(Math.round(240 * QUALITY[this.quality].petals * (this.calm ? 0.4 : 1)));
    this.scene.add(this.petals.mesh);
    this.fireflies = new Fireflies(40, new Vector3(POND.x, 0, POND.z), POND.rx, POND.rz);
    this.scene.add(this.fireflies.points);

    // Figuren
    this.cast = {
      jackie: new PaperFigure(STYLES.jackie, this.house.seats.jackie),
      yao: new PaperFigure(STYLES.yao, this.house.seats.yao),
    };
    this.scene.add(this.cast.jackie.group, this.cast.yao.group);
    await Promise.all([this.cast.jackie.load(this.base), this.cast.yao.load(this.base)]);
    await progress(0.8);

    // Postprocessing
    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: HalfFloatType,
      multisampling: spec.msaa,
    });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.buildEffects();

    // Kamera und Steuerung
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 2.2;
    this.controls.maxDistance = 26;
    this.controls.minPolarAngle = 0.18 * Math.PI;
    this.controls.maxPolarAngle = 0.47 * Math.PI;
    this.controls.minAzimuthAngle = -0.62 * Math.PI;
    this.controls.maxAzimuthAngle = 0.62 * Math.PI;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.7;
    this.controls.addEventListener('start', () => {
      this.fly = null;
      if (this.preset) {
        this.preset = null;
        this.onPreset?.(null);
      }
    });
    const start = this.approachPath();
    this.camera.position.copy(start.getPoint(0));
    this.camera.lookAt(new Vector3(0, 2, 0));

    this.applyTime(true);
    this.bindPointer();
    this.bindKeys();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.compile(this.scene, this.camera);
    this.renderer.setAnimationLoop(() => this.frame());
    await progress(1);
  }

  // ───────────────────────────────────────── Effekte

  private buildEffects(): void {
    const spec = QUALITY[this.quality];
    if (this.effectPass) {
      this.composer.removePass(this.effectPass);
      this.effectPass.dispose();
    }
    const effects: Effect[] = [];
    if (spec.bloom) {
      effects.push(
        new BloomEffect({
          intensity: 0.85,
          luminanceThreshold: 0.72,
          luminanceSmoothing: 0.25,
          mipmapBlur: true,
          radius: 0.72,
        }),
      );
    }
    this.dof = null;
    if (spec.dof && !this.calm) {
      this.dof = new DepthOfFieldEffect(this.camera, {
        focusDistance: 5,
        focusRange: 7,
        bokehScale: 1.2,
        resolutionScale: 0.5,
      });
      effects.push(this.dof);
    }
    effects.push(new VignetteEffect({ offset: 0.28, darkness: 0.52 }));
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
    if (spec.msaa === 0) effects.push(new FXAAEffect());
    this.effectPass = new EffectPass(this.camera, ...effects);
    this.composer.addPass(this.effectPass);
    this.composer.multisampling = spec.msaa;
  }

  setQuality(q: Quality, forced = true): void {
    if (q === this.quality) return;
    this.quality = q;
    this.qualityForced = forced;
    const spec = QUALITY[q];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, spec.dpr));
    this.renderer.shadowMap.enabled = spec.shadow > 0;
    this.sun.castShadow = spec.shadow > 0;
    if (spec.shadow > 0 && this.sun.shadow.map && this.sun.shadow.mapSize.x !== spec.shadow) {
      this.sun.shadow.mapSize.set(spec.shadow, spec.shadow);
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null as unknown as typeof this.sun.shadow.map;
    }
    this.scene.traverse((o) => {
      const m = (o as Mesh).material as { needsUpdate?: boolean } | undefined;
      if (m) m.needsUpdate = true;
    });
    for (const l of this.house.lanterns)
      if (l.light) l.light.visible = spec.lights || l === this.house.bigLantern;
    if (this.simpleWater) {
      this.simpleWater.visible = q === 0;
      this.land.water.visible = q > 0;
    }
    this.petals.setActive(Math.round(240 * spec.petals * (this.calm ? 0.4 : 1)));
    this.buildEffects();
    this.resize();
  }

  setCalm(on: boolean): void {
    this.calm = on || reducedMotion();
    this.petals.setActive(Math.round(240 * QUALITY[this.quality].petals * (this.calm ? 0.4 : 1)));
    this.buildEffects();
  }

  /** Leistungsüberwachung: bei dauerhaft wenig Bildern pro Sekunde eine Stufe herunter. */
  private governor(rawDt: number): void {
    if (this.qualityForced || !this.free || rawDt > 0.5 || document.hidden) return;
    this.fpsAcc += rawDt;
    this.fpsFrames++;
    if (this.fpsAcc < 4) return;
    const fps = this.fpsFrames / this.fpsAcc;
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    this.fpsWindows++;
    if (this.fpsWindows < 2) return; // erstes Fenster ignorieren (Shader-Kompilierung)
    if (fps < 40 && this.quality > 0) this.setQuality((this.quality - 1) as Quality, false);
  }

  // ───────────────────────────────────────── Tageszeit

  setTime(id: TimePreset | 'auto', instant = false): void {
    if (id === 'auto') {
      this.auto = true;
      this.autoPhase = Math.asin(clamp((this.t - 0.5) * 2, -1, 1));
      return;
    }
    this.auto = false;
    this.tTarget = PRESET_T[id];
    if (instant) {
      this.t = this.tTarget;
      this.applyTime(true);
    }
  }

  private applyTime(force = false): void {
    const p = palette(this.t);
    this.pal = p;
    updateSky(this.sky, p);
    const fog = this.scene.fog as FogExp2;
    fog.color.copy(p.fog);
    fog.density = p.fogDensity * 0.55;
    this.sun.color.copy(p.sun);
    this.sun.intensity = p.sunIntensity;
    this.sun.position.copy(p.sunDir).multiplyScalar(40).add(this.sun.target.position);
    this.hemi.color.copy(p.hemiSky);
    this.hemi.groundColor.copy(p.hemiGround);
    this.hemi.intensity = p.hemi;
    this.renderer.toneMappingExposure = p.exposure;
    this.fill.intensity = 1.2 + p.lantern * 1.6;
    for (const m of this.house.windowMats) m.emissiveIntensity = 0.12 + p.window * 0.28;
    // Umgebungslicht (Spiegelungen) nur bei merklicher Änderung neu berechnen
    if (force || Math.abs(this.t - this.envT) > 0.06) {
      this.envT = this.t;
      const envScene = new Scene();
      envScene.add(this.sky.clone());
      const old = this.envTarget;
      this.envTarget = this.pmrem.fromScene(envScene, 0.04);
      this.scene.environment = this.envTarget.texture as Texture;
      this.scene.environmentIntensity = 0.45 - p.stars * 0.25;
      old?.dispose();
      bus.emit('time:changed', { t: this.t });
    }
  }

  // ───────────────────────────────────────── Kamera

  private approachPath(): CatmullRomCurve3 {
    return new CatmullRomCurve3([
      new Vector3(3.5, 3.6, 40),
      new Vector3(1.5, 2.8, 26),
      new Vector3(-1.2, 2.5, 17.5),
      new Vector3(-1.2, 2.7, 11),
      new Vector3(-0.6, 2.4, 6.5),
      PRESETS.table.pos.clone(),
    ]);
  }

  /** Kamerafahrt von außen (Weg, Brücke, Teich) ins Teehaus. Überspringbar. */
  approach(secs: number, skip: { requested: boolean }, onProgress: (u: number) => void): Promise<void> {
    const path = this.approachPath();
    const look = new CatmullRomCurve3([
      new Vector3(0, 2.2, 0),
      new Vector3(-0.8, 1.6, 8),
      new Vector3(-0.4, 1.8, 2),
      PRESETS.table.target.clone(),
    ]);
    const dur = this.calm ? 0.01 : secs;
    return new Promise((resolve) => {
      let u = 0;
      const tick = (dt: number): boolean => {
        u = skip.requested ? 1 : Math.min(1, u + dt / dur);
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        this.camera.position.copy(path.getPoint(e));
        this.camera.lookAt(look.getPoint(Math.min(1, e * 1.05)));
        onProgress(u);
        if (u >= 1) {
          resolve();
          return true;
        }
        return false;
      };
      this.tickers.push(tick);
    });
  }

  /** Nach der Fahrt: freie Drehung mit Grenzen */
  enterFree(): void {
    this.free = true;
    this.camera.position.copy(PRESETS.table.pos);
    this.controls.target.copy(PRESETS.table.target);
    this.controls.enabled = true;
    this.controls.update();
    this.preset = 'table';
    this.onPreset?.('table');
  }

  /** Sanfte Fahrt zu einem Preset */
  goTo(p: CameraPreset): void {
    if (!this.free) return;
    const to = this.view(p);
    this.preset = p;
    this.onPreset?.(p);
    this.flyTo(to, this.calm ? 0.01 : 1.8);
  }

  /** Preset-Ansicht, im Hochformat etwas weiter weg */
  private view(p: CameraPreset): View {
    const v = PRESETS[p];
    const aspect = this.camera.aspect;
    const k = aspect < 1 ? 1 + (1 - aspect) * (p === 'table' ? 0.35 : 0.6) : 1;
    const pos = v.target.clone().add(v.pos.clone().sub(v.target).multiplyScalar(k));
    return { pos, target: v.target.clone() };
  }

  /** Kamera auf eine Figur ausrichten (beim Öffnen des Dialogs), ohne die Freiheit zu nehmen */
  focusFigure(id: FigureId | null): void {
    if (!this.free) return;
    if (!id) return;
    const f = this.cast[id].face;
    const t = new Vector3(
      f.x * 0.6,
      lerp(PRESETS.table.target.y, f.y, 0.45),
      lerp(PRESETS.table.target.z, f.z, 0.5),
    );
    const cur = this.camera.position.clone();
    const dist = cur.distanceTo(this.controls.target);
    if (dist > 7) {
      this.flyTo(this.view('table'), this.calm ? 0.01 : 1.4);
      this.preset = 'table';
      this.onPreset?.('table');
      return;
    }
    this.flyTo({ pos: cur, target: t }, this.calm ? 0.01 : 0.9);
  }

  private flyTo(to: View, dur: number): void {
    const from = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
    this.fly = { from, to, t: 0, dur, done: () => undefined };
  }

  private updateFly(dt: number): void {
    const f = this.fly;
    if (!f) return;
    f.t = Math.min(1, f.t + dt / f.dur);
    const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - Math.pow(-2 * f.t + 2, 3) / 2;
    // Bogen über den Zielpunkt, damit die Fahrt nicht durch Wände schneidet
    const pos = f.from.pos.clone().lerp(f.to.pos, e);
    pos.y += Math.sin(e * Math.PI) * 0.15 * f.from.pos.distanceTo(f.to.pos) * 0.3;
    this.camera.position.copy(pos);
    this.controls.target.copy(f.from.target.clone().lerp(f.to.target, e));
    if (f.t >= 1) {
      this.fly = null;
      f.done();
    }
  }

  /** Projektion eines Weltpunkts in Bildschirm-Koordinaten (CSS-Pixel) */
  toScreen(v: Vector3): { x: number; y: number; visible: boolean } {
    const p = v.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return {
      x: r.left + ((p.x + 1) / 2) * r.width,
      y: r.top + ((1 - p.y) / 2) * r.height,
      visible: p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2,
    };
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    // Hochformat: größeres Sichtfeld, damit beide Figuren ins Bild passen
    this.camera.fov = this.camera.aspect < 1 ? 62 : this.camera.aspect < 1.4 ? 52 : 46;
    this.camera.updateProjectionMatrix();
    SHARED.uPx.value =
      (h * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.composer?.setSize(w, h);
  }

  // ───────────────────────────────────────── Eingabe

  /** Ein antippbares Objekt registrieren */
  addPickable(obj: Object3D, onTap: () => void): void {
    this.picks.push({ obj, onTap });
  }

  private pick(x: number, y: number): { onTap: () => void } | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    let best: { d: number; onTap: () => void } | null = null;
    for (const f of Object.values(this.cast)) {
      const d = f.hit(this.ray);
      if (d !== null && (!best || d < best.d)) best = { d, onTap: () => f.onTap?.() };
    }
    for (const p of this.picks) {
      if (!p.obj.visible) continue;
      const hits = this.ray.intersectObject(p.obj, true);
      if (hits[0] && (!best || hits[0].distance < best.d)) best = { d: hits[0].distance, onTap: p.onTap };
    }
    return best;
  }

  private bindPointer(): void {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    el.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!d || !this.free) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 600) return;
      this.pick(e.clientX, e.clientY)?.onTap();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.hoverX = e.clientX;
      this.hoverY = e.clientY;
      this.hoverDirty = true;
    });
  }

  private updateHover(): void {
    if (!this.hoverDirty || !this.free) return;
    this.hoverDirty = false;
    let any = false;
    for (const f of Object.values(this.cast)) f.hovered = false;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((this.hoverX - r.left) / r.width) * 2 - 1, -((this.hoverY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    for (const f of Object.values(this.cast)) {
      if (f.hit(this.ray) !== null) {
        f.hovered = true;
        any = true;
      }
    }
    if (!any) any = !!this.pick(this.hoverX, this.hoverY);
    this.renderer.domElement.style.cursor = any ? 'pointer' : '';
  }

  private bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      if (!this.free || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, .dialog, .modal, .quiz') || t.isContentEditable)) return;
      if (document.body.classList.contains('modal-open')) return;
      const step = 0.12;
      const off = this.camera.position.clone().sub(this.controls.target);
      let handled = true;
      switch (e.key) {
        case 'ArrowLeft':
          off.applyAxisAngle(new Vector3(0, 1, 0), -step);
          break;
        case 'ArrowRight':
          off.applyAxisAngle(new Vector3(0, 1, 0), step);
          break;
        case 'ArrowUp':
          off.multiplyScalar(0.9);
          break;
        case 'ArrowDown':
          off.multiplyScalar(1.1);
          break;
        case '1':
          this.goTo('overview');
          return;
        case '2':
          this.goTo('table');
          return;
        case '3':
          this.goTo('outside');
          return;
        default:
          handled = false;
      }
      if (!handled) return;
      e.preventDefault();
      this.fly = null;
      this.camera.position.copy(this.controls.target).add(off);
      this.controls.update();
    });
  }

  // ───────────────────────────────────────── Szene beleben

  nudgeLantern(l: Lantern, k: number): void {
    l.swing = Math.min(1.2, l.swing + 0.6 * k);
  }

  /** Anstoßen: Figuren neigen sich zur Tischmitte, Tassen heben sich */
  cheers(on: boolean): void {
    this.cast.jackie.setLean(on);
    this.cast.yao.setLean(on);
    const [a, b] = this.house.cups;
    if (!a || !b) return;
    const y0 = FLOOR + 0.72 + 0.023;
    const from = [a.position.clone(), b.position.clone()];
    const toA = on ? new Vector3(-0.05, y0 + 0.35, -0.15) : new Vector3(-0.3, y0, -0.12);
    const toB = on ? new Vector3(0.05, y0 + 0.36, -0.16) : new Vector3(0.32, y0, -0.16);
    let u = 0;
    this.tickers.push((dt) => {
      u = Math.min(1, u + dt / 1.2);
      const e = 1 - Math.pow(1 - u, 3);
      a.position.lerpVectors(from[0]!, toA, e);
      b.position.lerpVectors(from[1]!, toB, e);
      return u >= 1;
    });
  }

  private frame(): void {
    const now = performance.now();
    const rawDt = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(0.05, rawDt);
    this.governor(rawDt);
    this.time += dt;
    const motion = this.calm ? 0.25 : 1;
    SHARED.uTime.value = this.time;
    SHARED.uWind.value = motion;

    // Tageszeit
    if (this.auto) {
      this.autoPhase += (dt * Math.PI * 2) / 540;
      this.tTarget = 0.5 + 0.5 * Math.sin(this.autoPhase);
    }
    if (Math.abs(this.tTarget - this.t) > 0.0005) {
      this.t += (this.tTarget - this.t) * Math.min(1, dt * (this.auto ? 3 : 0.9));
      this.applyTime();
    }
    const p = this.pal;

    // Kamera
    for (let i = this.tickers.length - 1; i >= 0; i--)
      if (this.tickers[i]!(dt) === true) this.tickers.splice(i, 1);
    this.updateFly(dt);
    if (this.free) this.controls.update(dt);
    const c = this.camera.position;
    const inside = Math.abs(c.x) < HX + 0.4 && c.z < HZ + 1.5 && c.z > -HZ;
    if (inside !== this.inside) {
      this.inside = inside;
      this.onInsideChange?.(inside);
    }

    // Laternen flackern
    for (const l of this.house.lanterns) {
      l.phase += dt;
      const flick =
        0.88 +
        Math.sin(l.phase * 7.3) * 0.05 +
        Math.sin(l.phase * 13.1 + 1) * 0.04 +
        (Math.random() - 0.5) * 0.04;
      const k = p.lantern * flick;
      (l.body.material as unknown as { emissiveIntensity: number }).emissiveIntensity = 0.35 + k * 1.1;
      (l.glow.material as { opacity: number }).opacity = 0.18 + k * 0.32;
      if (l.light) l.light.intensity = k * 3.2;
      l.swing *= Math.pow(0.4, dt);
      l.group.rotation.z = Math.sin(this.time * 2.4 + l.phase * 0.1) * (0.02 * motion + l.swing * 0.35);
      l.group.rotation.x = Math.sin(this.time * 1.7 + l.phase) * 0.012 * motion;
    }

    // Figuren
    const tint = new Color('#ffffff').lerp(p.figureTint, 0.6);
    for (const f of Object.values(this.cast)) f.update(dt, this.time, this.camera, tint, motion);

    // Partikel und Tiere
    const sunUp = Math.max(0, p.sunDir.y);
    const shaftK = (1 - p.stars) * (0.12 + 0.33 * clamp(1 - sunUp * 1.6, 0, 1));
    this.shafts.update(p.sunDir.clone().negate(), shaftK, p.sun, this.time, motion);
    this.steam.update(dt, this.time, QUALITY[this.quality].steam);
    this.petals.update(dt, this.time, motion);
    this.fireflies.update(this.time, p.stars);
    this.land.koi.update(dt * motion + dt * (1 - motion) * 0.3, this.time);
    this.land.magpie.update(dt, this.time);
    this.land.flock.update(dt, this.time);
    this.land.atmosphere.update(this.time, p, motion);
    this.house.cat.getObjectByName('catBody')?.scale.set(1.3, 0.62 + Math.sin(this.time * 1.6) * 0.012, 1);

    if (this.dof) {
      this.dof.target = this.controls.enabled ? this.controls.target : null;
      if (!this.controls.enabled) this.dof.cocMaterial.focusDistance = 8;
    }
    this.updateHover();
    this.composer.render(dt);
  }
}
