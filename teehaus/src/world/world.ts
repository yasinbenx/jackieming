// Die Spielwelt: Renderer und Postprocessing, Licht und Tageszeit, Landschaft und Café, Spielfigur mit
// Steuerung und Kamera, Interaktionen und Qualitätsregelung. NPCs und Dialog hängen sich über Hooks an.
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
} from 'three';
import type { Object3D, Texture, WebGLRenderTarget } from 'three';
import {
  BloomEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
import type { Effect } from 'postprocessing';
import { buildLandscape, heightAt, makeSky, makeWater, updateSky } from '../three/landscape';
import type { Landscape } from '../three/landscape';
import { Fireflies, LightShafts, Petals, Steam } from '../three/effects';
import { palette, PRESET_T } from '../three/palette';
import type { Palette, TimePreset } from '../three/palette';
import { POND, SHARED } from '../three/shared';
import { clamp } from '../three/noise';
import { bus } from '../core/bus';
import { store } from '../state/store';
import { buildCafe } from './cafe';
import type { Cafe } from './cafe';
import { NavGrid } from './nav';
import { Agent, WALK } from './agent';
import { FollowCam } from './camera';
import { Input } from './input';
import { PLAYER_LOOKS } from './looks';
import { RIM } from './materials';
import type { Speaker } from '../ui/bubbles';
import type { Egg } from '../content/extras';
import { FLOOR, HALL, START, TERRACE } from './layout';

export type Quality = 0 | 1 | 2;
export type Mode = 'intro' | 'free' | 'dialog' | 'cutscene';

interface QualitySpec {
  dpr: number;
  shadow: number;
  bloom: boolean;
  dof: boolean;
  msaa: number;
  petals: number;
  steam: number;
}

const QUALITY: Record<Quality, QualitySpec> = {
  2: { dpr: 2, shadow: 2048, bloom: true, dof: true, msaa: 4, petals: 1, steam: 1 },
  1: { dpr: 1.5, shadow: 1024, bloom: true, dof: false, msaa: 0, petals: 0.55, steam: 0.8 },
  0: { dpr: 1, shadow: 0, bloom: false, dof: false, msaa: 0, petals: 0.25, steam: 0.5 },
};

/** Etwas, womit der Spieler interagieren kann (E-Taste, Antippen, Knopf) */
export interface Interactable {
  id: string;
  /** Position zum Messen der Entfernung */
  pos: () => Vector3;
  radius: number;
  label: () => string;
  /** Objekte, die man antippen kann */
  hit?: Object3D[];
  enabled?: () => boolean;
  use: () => void;
  /** Höhere Priorität gewinnt bei gleicher Entfernung */
  priority?: number;
}

const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export class World {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(52, 16 / 9, 0.08, 1000);
  renderer!: WebGLRenderer;
  private composer!: EffectComposer;
  private effectPass: EffectPass | null = null;
  private dof: DepthOfFieldEffect | null = null;
  private sun = new DirectionalLight('#ffffff', 3);
  private hemi = new HemisphereLight('#ffffff', '#444444', 1);
  private fill = new PointLight('#ffc48a', 1, 9, 1.4);
  private sky = makeSky();
  private pmrem!: PMREMGenerator;
  private envTarget: WebGLRenderTarget | null = null;
  private envT = -1;
  land!: Landscape;
  cafe!: Cafe;
  nav!: NavGrid;
  shafts!: LightShafts;
  steam!: Steam;
  petals!: Petals;
  private fireflies!: Fireflies;
  private simpleWater: Mesh | null = null;
  player!: Agent;
  cam!: FollowCam;
  input!: Input;
  /** Alle Figuren (für Detailstufe und gegenseitiges Ausweichen) */
  readonly agents: Agent[] = [];
  readonly interactables: Interactable[] = [];
  /** Zusätzliche Abläufe pro Frame (NPCs, Skripte). true = fertig, wird entfernt */
  readonly tickers: ((dt: number) => boolean | void)[] = [];
  private ray = new Raycaster();
  private time = 0;
  private last = performance.now();
  private t = 0.5;
  private tTarget = 0.5;
  private auto = true;
  private autoPhase = 0;
  pal: Palette = palette(0.5);
  quality: Quality = 2;
  private qualityForced = false;
  private fps = { acc: 0, frames: 0, windows: 0 };
  calm = false;
  mode: Mode = 'intro';
  private focus: Interactable | null = null;
  private promptEl!: HTMLButtonElement;
  private pendingUse: Interactable | null = null;
  private outfit = 0;
  private inside = false;
  onInsideChange?: (inside: boolean) => void;
  onFocusChange?: (i: Interactable | null) => void;
  /** Ein Fundstück wurde benutzt */
  onEgg?: (id: Egg['id']) => void;
  /** Spieler hat gewinkt */
  onWave?: () => void;
  /** Sprecher für kleine Symbol-Blasen über der Spielfigur */
  readonly playerSpeaker: Speaker = {
    id: 'player',
    name: '我',
    anchor: () => this.player.ch.headWorld().add(new Vector3(0, this.player.ch.H * 0.12 + 0.12, 0)),
  };

  /** Laufzeit in Sekunden (für Abklingzeiten) */
  get clock(): number {
    return this.time;
  }
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
    void this.base;
    const spec = QUALITY[this.quality];

    this.renderer = new WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, spec.dpr));
    this.renderer.shadowMap.enabled = spec.shadow > 0;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.toneMapping = NoToneMapping;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.renderer.domElement.style.touchAction = 'none';
    this.pmrem = new PMREMGenerator(this.renderer);
    await progress(0.3);

    // Licht
    this.scene.fog = new FogExp2('#e8b88a', 0.005);
    this.scene.add(this.sky, this.hemi, this.sun, this.sun.target, this.fill);
    this.sun.castShadow = spec.shadow > 0;
    this.sun.shadow.mapSize.set(Math.max(512, spec.shadow), Math.max(512, spec.shadow));
    const sc = this.sun.shadow.camera;
    sc.left = -13;
    sc.right = 13;
    sc.top = 13;
    sc.bottom = -13;
    sc.near = 1;
    sc.far = 90;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.target.position.set(0, 0, 0);
    this.fill.position.set(2, FLOOR + 2.6, -1);

    // Landschaft und Café
    this.land = buildLandscape({
      reflect: this.quality > 0,
      reflectRes: this.quality === 2 ? 1024 : 512,
      bamboo: this.quality === 2 ? 240 : this.quality === 1 ? 160 : 90,
      mist: this.quality === 0 ? 14 : 26,
    });
    this.scene.add(this.land.group);
    if (this.quality > 0) {
      this.simpleWater = makeWater(false, 0);
      this.simpleWater.visible = false;
      this.scene.add(this.simpleWater);
    }
    await progress(0.5);
    this.cafe = buildCafe(this.quality === 2 ? 4 : this.quality === 1 ? 3 : 1);
    this.scene.add(this.cafe.group);
    this.shafts = new LightShafts(
      this.cafe.shaftWindows,
      this.quality === 2 ? 480 : this.quality === 1 ? 260 : 100,
    );
    this.scene.add(this.shafts.group);
    this.steam = new Steam(this.quality === 0 ? 160 : 320);
    for (const s of this.cafe.steam) this.steam.addEmitter(s.pos, s.rate, 0.02, s.size);
    this.steam.addEmitter(this.cafe.incenseTip, 1.4, 0.005, 0.45);
    this.scene.add(this.steam.points);
    this.petals = new Petals(240, this.land.blossomCanopy, (x, z) => {
      if (x > HALL.x0 && x < HALL.x1 && z > HALL.z0 && z < TERRACE.z1) return FLOOR - 0.02;
      return heightAt(x, z);
    });
    this.petals.setActive(Math.round(240 * spec.petals * (this.calm ? 0.4 : 1)));
    this.scene.add(this.petals.mesh);
    this.fireflies = new Fireflies(40, new Vector3(POND.x, 0, POND.z), POND.rx, POND.rz);
    this.scene.add(this.fireflies.points);
    this.nav = new NavGrid();
    await progress(0.7);

    // Spielfigur
    this.outfit = Math.min(PLAYER_LOOKS.length - 1, Math.max(0, store.settings.outfit ?? 0));
    this.player = new Agent(PLAYER_LOOKS[this.outfit]!, this.nav);
    this.player.place(START.x, START.z, Math.PI);
    this.scene.add(this.player.ch.root);
    this.agents.push(this.player);

    // Postprocessing
    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: HalfFloatType,
      multisampling: spec.msaa,
    });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.buildEffects();

    this.cam = new FollowCam(this.camera);
    this.cam.snapBehind(Math.PI);
    this.input = new Input(this.renderer.domElement);
    this.input.enabled = false;
    this.buildPrompt();

    this.applyTime(true);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.compile(this.scene, this.camera);
    this.renderer.setAnimationLoop(() => this.frame());
    await progress(1);
  }

  // ───────────────────────────────────────── Spielfigur

  get outfitIndex(): number {
    return this.outfit;
  }

  /** Outfit wechseln (Auswahl am Anfang) */
  setOutfit(i: number): void {
    const idx = ((i % PLAYER_LOOKS.length) + PLAYER_LOOKS.length) % PLAYER_LOOKS.length;
    if (idx === this.outfit && this.player) return;
    this.outfit = idx;
    store.setSettings({ outfit: idx });
    const old = this.player;
    const p = new Agent(PLAYER_LOOKS[idx]!, this.nav);
    p.place(old.x, old.z, old.ch.yaw);
    this.scene.remove(old.ch.root);
    this.scene.add(p.ch.root);
    this.agents[this.agents.indexOf(old)] = p;
    this.player = p;
    p.ch.play('hop', 0.8);
  }

  /** Brustpunkt der Spielfigur (Kameraziel) */
  playerTarget(): Vector3 {
    const p = this.player.ch.root.position;
    const sit = this.player.ch.sitAmount;
    return new Vector3(p.x, p.y + this.player.ch.H * (0.86 - sit * 0.3), p.z);
  }

  // ───────────────────────────────────────── Interaktionen

  private buildPrompt(): void {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'act-prompt';
    b.hidden = true;
    b.addEventListener('click', () => this.useFocus());
    document.body.appendChild(b);
    this.promptEl = b;
  }

  addInteractable(i: Interactable): void {
    this.interactables.push(i);
  }

  private useFocus(): void {
    if (this.focus && this.mode === 'free') this.focus.use();
  }

  private updateFocus(): void {
    let best: Interactable | null = null;
    let bestScore = Infinity;
    if (this.mode === 'free') {
      const p = this.player.ch.root.position;
      const fwd = new Vector2(Math.sin(this.player.ch.yaw), Math.cos(this.player.ch.yaw));
      for (const it of this.interactables) {
        if (it.enabled && !it.enabled()) continue;
        const ip = it.pos();
        const dx = ip.x - p.x;
        const dz = ip.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > it.radius) continue;
        // Was vor der Figur liegt, gewinnt
        const facing = d > 0.01 ? (dx * fwd.x + dz * fwd.y) / d : 1;
        const score = d * (1.4 - facing * 0.5) - (it.priority ?? 0) * 0.3;
        if (score < bestScore) {
          bestScore = score;
          best = it;
        }
      }
    }
    if (best !== this.focus) {
      this.focus = best;
      this.onFocusChange?.(best);
    }
    const el = this.promptEl;
    if (best) {
      const label = best.label();
      const key = this.input.touch ? '' : '<kbd>E</kbd> ';
      const html = `${key}${label}`;
      if (el.innerHTML !== html) el.innerHTML = html;
      el.hidden = false;
    } else el.hidden = true;
  }

  /** Antippen in der Welt: Objekt benutzen (dorthin laufen) oder zum Boden laufen */
  private handleTap(x: number, y: number): void {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    // 1) Interaktive Objekte
    let bestIt: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.interactables) {
      if (!it.hit || (it.enabled && !it.enabled())) continue;
      const h = this.ray.intersectObjects(it.hit, true)[0];
      if (h && h.distance < bestD) {
        bestD = h.distance;
        bestIt = it;
      }
    }
    if (bestIt) {
      const ip = bestIt.pos();
      const p = this.player.ch.root.position;
      if (Math.hypot(ip.x - p.x, ip.z - p.z) <= bestIt.radius) {
        bestIt.use();
        return;
      }
      // hingehen, dann benutzen
      const dir = new Vector2(p.x - ip.x, p.z - ip.z)
        .normalize()
        .multiplyScalar(Math.max(0.6, bestIt.radius * 0.6));
      this.pendingUse = bestIt;
      const target = bestIt;
      this.player.goTo(ip.x + dir.x, ip.z + dir.y, false, () => {
        if (this.pendingUse === target) {
          this.pendingUse = null;
          this.player.faceTo(ip.x, ip.z);
          target.use();
        }
      });
      return;
    }
    // 2) Boden
    const targets = [
      ...this.cafe.floors,
      ...this.land.group.children.filter((c) => c.name === 'terrain' || c.name === 'bridge'),
    ];
    const h = this.ray.intersectObjects(targets, true)[0];
    if (!h) return;
    this.pendingUse = null;
    const ok = this.player.goTo(h.point.x, h.point.z, h.distance > 9);
    if (ok) this.marker(h.point);
  }

  private markerEl: HTMLElement | null = null;
  private markerPos: Vector3 | null = null;
  private markerT = 0;
  /** Kleiner Ring am Zielpunkt */
  private marker(p: Vector3): void {
    if (!this.markerEl) {
      this.markerEl = document.createElement('div');
      this.markerEl.className = 'walk-marker';
      document.body.appendChild(this.markerEl);
    }
    this.markerPos = p.clone();
    this.markerT = 1;
  }

  // ───────────────────────────────────────── Effekte und Qualität

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
          intensity: 0.75,
          luminanceThreshold: 0.75,
          luminanceSmoothing: 0.25,
          mipmapBlur: true,
          radius: 0.7,
        }),
      );
    }
    this.dof = null;
    if (spec.dof && !this.calm) {
      this.dof = new DepthOfFieldEffect(this.camera, {
        focusDistance: 4,
        focusRange: 9,
        bokehScale: 1.0,
        resolutionScale: 0.5,
      });
      effects.push(this.dof);
    }
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

  private governor(rawDt: number): void {
    if (this.qualityForced || this.mode === 'intro' || rawDt > 0.5 || document.hidden) return;
    const f = this.fps;
    f.acc += rawDt;
    f.frames++;
    if (f.acc < 4) return;
    const fps = f.frames / f.acc;
    f.acc = 0;
    f.frames = 0;
    f.windows++;
    if (f.windows < 2) return;
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
    this.sun.position.copy(p.sunDir).multiplyScalar(45).add(this.sun.target.position);
    this.hemi.color.copy(p.hemiSky);
    this.hemi.groundColor.copy(p.hemiGround);
    this.hemi.intensity = p.hemi;
    this.renderer.toneMappingExposure = p.exposure;
    this.fill.intensity = 1.6 + p.lantern * 2.2;
    RIM.uRimColor.value.copy(p.sun).lerp(new Color('#ffd9a8'), 0.5);
    RIM.uRim.value = 0.3 + (1 - p.stars) * 0.2;
    for (const m of this.cafe.windowMats) m.emissiveIntensity = 0.15 + p.window * 0.35;
    if (force || Math.abs(this.t - this.envT) > 0.06) {
      this.envT = this.t;
      const envScene = new Scene();
      envScene.add(this.sky.clone());
      const old = this.envTarget;
      this.envTarget = this.pmrem.fromScene(envScene, 0.04);
      this.scene.environment = this.envTarget.texture as Texture;
      this.scene.environmentIntensity = 0.5 - p.stars * 0.25;
      old?.dispose();
      bus.emit('time:changed', { t: this.t });
    }
  }

  // ───────────────────────────────────────── Hilfen

  nudgeLantern(l: { swing: number }, k: number): void {
    l.swing = Math.min(1.2, l.swing + 0.6 * k);
  }

  /** Wie toScreen, aber „sichtbar“ auch knapp über dem oberen Rand (für Sprechblasen, die dort andocken) */
  toScreenLoose(v: Vector3): { x: number; y: number; visible: boolean } {
    const p = v.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return {
      x: r.left + ((p.x + 1) / 2) * r.width,
      y: r.top + ((1 - p.y) / 2) * r.height,
      visible: p.z < 1 && Math.abs(p.x) < 1.25 && p.y > -1,
    };
  }

  toScreen(v: Vector3): { x: number; y: number; visible: boolean } {
    const p = v.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return {
      x: r.left + ((p.x + 1) / 2) * r.width,
      y: r.top + ((1 - p.y) / 2) * r.height,
      visible: p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1,
    };
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.fov = this.camera.aspect < 1 ? 66 : this.camera.aspect < 1.4 ? 58 : 52;
    this.camera.updateProjectionMatrix();
    SHARED.uPx.value =
      (h * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.composer?.setSize(w, h);
  }

  // ───────────────────────────────────────── Bildschleife

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

    if (this.auto) {
      this.autoPhase += (dt * Math.PI * 2) / 600;
      this.tTarget = 0.5 + 0.5 * Math.sin(this.autoPhase);
    }
    if (Math.abs(this.tTarget - this.t) > 0.0005) {
      this.t += (this.tTarget - this.t) * Math.min(1, dt * (this.auto ? 3 : 0.9));
      this.applyTime();
    }
    const p = this.pal;
    const inp = this.input;

    // ── Steuerung
    let wish: { x: number; z: number; run: boolean } | null = null;
    if (this.mode === 'free') {
      if (inp.lookDX || inp.lookDY) this.cam.rotate(inp.lookDX, inp.lookDY);
      if (inp.zoom) this.cam.zoom(inp.zoom);
      const a = inp.axis();
      if (a.x || a.y) {
        const fy = this.cam.forwardYaw;
        const fx = Math.sin(fy);
        const fz = Math.cos(fy);
        wish = { x: fx * a.y - fz * a.x, z: fz * a.y + fx * a.x, run: a.run };
        this.pendingUse = null;
      }
      for (const t of inp.taps) this.handleTap(t.x, t.y);
      if (inp.interact) this.useFocus();
      if (inp.wave) {
        this.player.ch.play(this.player.seated ? 'nod' : 'wave', 1.6);
        this.onWave?.();
      }
    }
    for (let i = this.tickers.length - 1; i >= 0; i--)
      if (this.tickers[i]!(dt) === true) this.tickers.splice(i, 1);
    this.player.update(dt, wish);
    for (const a of this.agents) if (a !== this.player) a.update(dt, null);
    // Spieler weicht anderen Figuren aus
    const pp = this.player.ch.root.position;
    for (const a of this.agents) {
      if (a === this.player) continue;
      const dx = pp.x - a.x;
      const dz = pp.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = 0.5 + (a.ch.H > 2 ? 0.1 : 0);
      if (d < min && d > 0.001 && !this.player.seated) {
        const [nx, nz] = this.nav.move(pp.x, pp.z, (dx / d) * (min - d), (dz / d) * (min - d));
        pp.x = nx;
        pp.z = nz;
      }
    }
    // Kamera folgt bei Tastatur-/Joystick-Bewegung sanft der Laufrichtung
    if (this.mode === 'free' && wish && !inp.lookDX && Math.abs(inp.axis().y) > 0.2 && inp.axis().y > 0) {
      this.cam.follow(this.player.ch.yaw, dt, 0.8);
    }
    this.cam.update(dt, this.playerTarget(), this.cafe.blockers);
    // Kamera klebt an der Figur (enge Ecke): Figur ausblenden statt den Kopf groß ins Bild zu schieben
    this.player.ch.root.visible = this.cam.locked || this.cam.close > 0.6;
    this.updateFocus();
    inp.endFrame();

    // drinnen/draußen
    const c = this.camera.position;
    const inside = c.x > HALL.x0 && c.x < HALL.x1 && c.z > HALL.z0 && c.z < HALL.z1 && c.y < FLOOR + 3.5;
    if (inside !== this.inside) {
      this.inside = inside;
      this.onInsideChange?.(inside);
    }

    // Detailstufe der Figuren (Gesicht, Finger erst in der Nähe)
    for (const a of this.agents) a.ch.setDetail(a.ch.root.position.distanceTo(c) < 11);

    // ── Laternen und Effekte
    for (const l of this.cafe.lanterns) {
      l.phase += dt;
      const flick =
        0.88 +
        Math.sin(l.phase * 7.3) * 0.05 +
        Math.sin(l.phase * 13.1 + 1) * 0.04 +
        (Math.random() - 0.5) * 0.04;
      const k = p.lantern * flick;
      (l.body.material as unknown as { emissiveIntensity: number }).emissiveIntensity = 0.35 + k * 1.1;
      (l.glow.material as unknown as { opacity: number }).opacity = 0.18 + k * 0.3;
      if (l.light) l.light.intensity = 1.2 + k * 3.4;
      l.swing *= Math.pow(0.4, dt);
      l.group.rotation.z = Math.sin(this.time * 2.4 + l.phase * 0.1) * (0.02 * motion + l.swing * 0.35);
      l.group.rotation.x = Math.sin(this.time * 1.7 + l.phase) * 0.012 * motion;
    }
    const sunUp = Math.max(0, p.sunDir.y);
    const shaftK = (1 - p.stars) * (0.2 + 0.5 * clamp(1 - sunUp * 1.6, 0, 1));
    this.shafts.update(p.sunDir.clone().negate(), shaftK, p.sun, this.time, motion);
    this.steam.update(dt, this.time, QUALITY[this.quality].steam);
    this.petals.update(dt, this.time, motion);
    this.fireflies.update(this.time, p.stars);
    this.land.koi.update(dt * motion + dt * (1 - motion) * 0.3, this.time);
    this.land.magpie.update(dt, this.time);
    this.land.flock.update(dt, this.time);
    this.land.atmosphere.update(this.time, p, motion);

    if (this.markerEl && this.markerPos) {
      this.markerT = Math.max(0, this.markerT - dt * 1.2);
      const s = this.toScreen(this.markerPos);
      this.markerEl.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${1.4 - this.markerT * 0.4})`;
      this.markerEl.style.opacity = String(this.markerT);
      if (this.markerT <= 0 || !this.player.path.length) this.markerT = Math.min(this.markerT, 0.3);
    }
    if (this.dof) {
      this.dof.target = this.playerTarget();
    }
    this.composer.render(dt);
  }

  get walkSpeed(): number {
    return WALK;
  }
}
