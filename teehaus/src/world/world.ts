// Die Spielwelt: Renderer und Postprocessing, Licht und Tageszeit, Landschaft und Café, Spielfigur mit
// Steuerung und Kamera, Interaktionen und Qualitätsregelung. NPCs und Dialog hängen sich über Hooks an.
import {
  Color,
  WebGLRenderTarget,
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
import type { Object3D, PointsMaterial, ShaderMaterial, Texture } from 'three';
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
import { report } from '../core/guard';
import { loadStep } from '../core/loadstate';
import { store } from '../state/store';
import { buildCafe } from './cafe';
import type { Cafe } from './cafe';
import { loadHairKit } from './hairkit';
import { loadRig } from './rig';
import { groundY, NavGrid } from './nav';
import { buildVillage } from '../three/village';
import { Critters } from '../three/critters';
import { DebugOverlay } from '../ui/debug';
import { Rain, Weather, WEATHER_ZH } from './weather';
import type { Village } from '../three/village';
import { Agent, WALK } from './agent';
import { FollowCam } from './camera';
import { Input } from './input';
import { ALL_OUTFITS, withHead } from './looks';
import { RIM } from './materials';
import type { Speaker } from '../ui/bubbles';
import type { Egg } from '../content/extras';
import { FLOOR, HALL, START, TERRACE } from './layout';

export type Quality = 0 | 1 | 2;
export type Mode = 'intro' | 'free' | 'dialog' | 'cutscene';

interface QualitySpec {
  dpr: number;
  shadow: number;
  /** Grasbüschel um die Kamera (0 = aus) */
  grass: number;
  /** Bäume in voller Form bis (m), sonst einfache Form */
  near: number;
  /** Sichtweite für Bewuchs (m) */
  far: number;
  bloom: boolean;
  dof: boolean;
  msaa: number;
  petals: number;
  steam: number;
}

/** Bis zu diesem Abstand (m) zeigt das Dorf volle Häuser, je Qualitätsstufe */
const VILLAGE_RANGE: Record<Quality, number> = { 2: 170, 1: 120, 0: 80 };

const WX_GREY = new Color();
const WX_DAY = new Color('#a3a9ad');
const WX_NIGHT = new Color('#252a33');

const QUALITY: Record<Quality, QualitySpec> = {
  2: {
    dpr: 1.5,
    shadow: 2048,
    bloom: true,
    dof: true,
    msaa: 2,
    petals: 1,
    steam: 1,
    grass: 18000,
    near: 70,
    far: 420,
  },
  1: {
    dpr: 1.5,
    shadow: 1024,
    bloom: true,
    dof: false,
    msaa: 0,
    petals: 0.55,
    steam: 0.8,
    grass: 9000,
    near: 45,
    far: 260,
  },
  0: {
    dpr: 1,
    shadow: 0,
    bloom: false,
    dof: false,
    msaa: 0,
    petals: 0.25,
    steam: 0.5,
    grass: 0,
    near: 25,
    far: 160,
  },
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
  private envT = -1;
  private envCache = new Map<number, WebGLRenderTarget>();
  land!: Landscape;
  village!: Village;
  critters!: Critters;
  private npcsHidden = false;
  private frameNo = 0;
  readonly weather = new Weather();
  private rain!: Rain;
  private moreFireflies: Fireflies[] = [];
  /** Debug-Anzeige (F3) */
  debug: DebugOverlay | null = null;
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
      this.urlQuality = true;
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
    // Schattenkarte immer an (auch auf Niedrig): Ein- und Ausschalten würde alle Shader ändern und das Spiel
    // beim Wechsel der Qualität sekundenlang anhalten. Auf Niedrig wird sie nur nicht gezeichnet und ausgeblendet.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    // erstes Bild: Schattenkarte sofort anlegen (sonst liest der Shader eine leere Textur)
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.info.autoReset = false;
    this.renderer.toneMapping = NoToneMapping;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.renderer.domElement.style.touchAction = 'none';
    this.pmrem = new PMREMGenerator(this.renderer);
    await progress(0.3);

    // Licht
    this.scene.fog = new FogExp2('#e8b88a', 0.005);
    this.scene.add(this.sky, this.hemi, this.sun, this.sun.target, this.fill);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(Math.max(512, spec.shadow), Math.max(512, spec.shadow));
    this.sun.shadow.intensity = spec.shadow > 0 ? 1 : 0;
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
      bambooLeaves: this.quality === 2 ? 9 : this.quality === 1 ? 6 : 3,
      mist: this.quality === 0 ? 14 : 26,
      nature: { grass: spec.grass, near: spec.near, far: spec.far },
    });
    this.scene.add(this.land.group);
    this.village = buildVillage(VILLAGE_RANGE[this.quality]);
    this.scene.add(this.village.group);
    this.critters = new Critters((x, z) => this.nav?.walkable(x, z) ?? true);
    this.scene.add(this.critters.group);
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
    // Glühwürmchen auch am Fluss beim Dorf und im Bambushain
    for (const [x, z, rx, rz] of [
      [24, 77, 16, 3],
      [-30, 24, 12, 9],
    ] as const) {
      const ff = new Fireflies(36, new Vector3(x, 0, z), rx, rz, (gx, gz) => groundY(gx, gz));
      this.moreFireflies.push(ff);
      this.scene.add(ff.points);
    }
    this.rain = new Rain(this.quality === 2 ? 4000 : this.quality === 1 ? 2200 : 900);
    this.scene.add(this.rain.mesh);
    this.scene.add(this.fireflies.points);
    this.nav = new NavGrid();
    await progress(0.7);

    // Haarmodelle (klein, ~0,4 MB) vor den Figuren laden
    // mit Zeitlimit: hängt eine Datei im Netz, startet das Spiel mit gezeichneten Figuren/Frisuren
    await Promise.all([
      loadStep('Haarmodelle', () => loadHairKit(), { timeout: 15000, optional: true }),
      loadStep('Figurenmodelle', () => loadRig(), { timeout: 20000, optional: true, fallback: null }),
    ]);
    // Spielfigur
    this.outfit = Math.min(ALL_OUTFITS.length - 1, Math.max(0, store.outfit));
    this.player = new Agent(this.playerLook(), this.nav);
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
    this.cam.ground = groundY;
    this.cam.snapBehind(Math.PI);
    this.input = new Input(this.renderer.domElement);
    this.input.enabled = false;
    this.buildPrompt();

    this.applyTime(true);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.slimReflection();
    this.debug = new DebugOverlay(() => this.quality);
    this.debug.memoryInfo = () => {
      const i = this.renderer.info;
      return {
        geometries: i.memory.geometries,
        textures: i.memory.textures,
        programs: i.programs?.length ?? 0,
      };
    };
    this.debug.lines.push(() => {
      const pp = this.player.ch.root.position;
      const open = document.querySelector('.modal:not([hidden]), #worldmap:not([hidden]), .menu.show');
      return `Zustand    ${this.mode}${this.player.seated ? ' · sitzt' : ''}${open ? ` · Fenster ${open.id || open.className}` : ''} · x ${pp.x.toFixed(1)} z ${pp.z.toFixed(1)} · Tageszeit ${this.t.toFixed(2)}`;
    });
    this.debug.lines.push(() => `Wetter     ${WEATHER_ZH[this.weather.kind]} ${this.weather.kind}`);
    this.debug.lines.push(() => {
      const pp = this.player.ch.root.position;
      return `Zone       ${this.zoneAt(pp.x, pp.z)} · geladen: ${this.zoneList
        .filter((z) => z.on)
        .map((z) => z.id)
        .join(', ')}`;
    });
    this.setupZones();
    this.renderer.compile(this.scene, this.camera);
    this.renderer.setAnimationLoop(() => this.frame());
    await progress(1);
  }

  /**
   * Alle Shader vorab übersetzen, auch für gerade ausgeblendete Teile (Dorf, Terrassen, Regen, Figuren der
   * Bewohner). Sonst übersetzt der Browser sie beim ersten Anblick, und das Bild steht kurz.
   */
  async precompile(): Promise<void> {
    const hidden: Object3D[] = [];
    const culled: Object3D[] = [];
    // auch Schattenwurf vorübergehend für alle Teile an: Bewohner werfen erst aus der Nähe Schatten, und jede
    // Schatten-Variante (etwa mit Textur) braucht ihren eigenen Shader
    const noShadow: Object3D[] = [];
    this.scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
      if (o.frustumCulled) {
        culled.push(o);
        o.frustumCulled = false;
      }
      if ((o as Mesh).isMesh && !o.castShadow) {
        noShadow.push(o);
        o.castShadow = true;
      }
    });
    try {
      // alle Texturen ausdrücklich hochladen (auch die von gerade unsichtbaren Teilen)
      const seen = new Set<Texture>();
      this.scene.traverse((o) => {
        const ms = (o as Mesh).material;
        for (const m of Array.isArray(ms) ? ms : ms ? [ms] : [])
          for (const v of Object.values(m as unknown as Record<string, unknown>))
            if ((v as Texture | null)?.isTexture && !seen.has(v as Texture)) {
              seen.add(v as Texture);
              try {
                this.renderer.initTexture(v as Texture);
              } catch (e) {
                report('Textur vorab laden', e, 'warn');
              }
            }
      });
      if (this.renderer.extensions.has('KHR_parallel_shader_compile'))
        await this.renderer.compileAsync(this.scene, this.camera);
      else this.renderer.compile(this.scene, this.camera);
      // einmal durch die echte Bildpipeline zeichnen (der Ladebildschirm liegt darüber): lädt alle Texturen und
      // Geometrien auf die Grafikkarte und übersetzt genau die Shader-Varianten, die das Spiel später braucht,
      // samt Schatten, Teichspiegelung und Nachbearbeitung
      this.renderer.shadowMap.needsUpdate = true;
      this.composer.render(0);
      this.warmEffects();
    } finally {
      for (const o of hidden) o.visible = false;
      for (const o of culled) o.frustumCulled = true;
      for (const o of noShadow) o.castShadow = false;
    }
  }

  // ───────────────────────────────────────── Spielfigur

  get outfitIndex(): number {
    return this.outfit;
  }

  /** Outfit wechseln (Auswahl am Anfang) */
  /** Look der Spielfigur aus Outfit und Kopf (Garderobe) */
  private playerLook() {
    return withHead(ALL_OUTFITS[this.outfit]!.look, store.progress.wardrobe.head);
  }

  setOutfit(i: number): void {
    const n = ALL_OUTFITS.length;
    const idx = ((i % n) + n) % n;
    if (idx === this.outfit && this.player) return;
    this.outfit = idx;
    store.setOutfit(idx);
    this.rebuildPlayer();
  }

  /** Spielfigur neu einkleiden (nach Outfit- oder Kopfwechsel) */
  rebuildPlayer(): void {
    const old = this.player;
    const p = new Agent(this.playerLook(), this.nav);
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

  /** Eine Interaktion wurde benutzt (Tutorial) */
  onUse?: (id: string) => void;
  /** Spielfigur ausblenden (Hauptmenü) */
  hidePlayer = false;

  private useFocus(): void {
    if (this.focus && this.mode === 'free') {
      this.focus.use();
      this.onUse?.(this.focus.id);
    }
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
        this.onUse?.(bestIt.id);
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
          this.onUse?.(target.id);
        }
      });
      return;
    }
    // 2) Boden
    const targets = [
      ...this.cafe.floors,
      ...this.land.group.children.filter((c) => c.name === 'terrain' || c.name === 'bridge'),
      this.land.structures.walkables,
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

  /**
   * Nachbearbeitung je Qualitätsstufe und Ruhe-Modus. Fertige Varianten bleiben erhalten (nicht freigeben!),
   * damit ein Wechsel der Automatik keine Shader neu übersetzt; warmEffects() bereitet sie im Ladebildschirm vor.
   */
  private effectCache = new Map<string, { pass: EffectPass; dof: DepthOfFieldEffect | null }>();

  private buildEffects(): void {
    const spec = QUALITY[this.quality];
    if (this.effectPass) this.composer.removePass(this.effectPass);
    const key = `${this.quality}|${this.calm}`;
    let fx = this.effectCache.get(key);
    if (!fx) {
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
      let dof: DepthOfFieldEffect | null = null;
      if (spec.dof && !this.calm) {
        dof = new DepthOfFieldEffect(this.camera, {
          focusDistance: 4,
          focusRange: 9,
          bokehScale: 1.0,
          resolutionScale: 0.5,
        });
        effects.push(dof);
      }
      effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
      if (spec.msaa === 0) effects.push(new FXAAEffect());
      fx = { pass: new EffectPass(this.camera, ...effects), dof };
      this.effectCache.set(key, fx);
    }
    this.effectPass = fx.pass;
    this.dof = fx.dof;
    this.composer.addPass(fx.pass);
    this.composer.multisampling = spec.msaa;
  }

  /** Nachbearbeitung der niedrigeren Stufen vorab übersetzen (die Automatik schaltet nur nach unten) */
  private warmEffects(): void {
    const q0 = this.quality;
    for (let q = q0 - 1; q >= 0; q--) {
      this.quality = q as Quality;
      this.buildEffects();
      this.resize();
      this.composer.render(0);
    }
    this.quality = q0;
    this.buildEffects();
    this.resize();
  }

  /** Automatische Qualitätswahl nach Bildrate an/aus */
  setAutoQuality(on: boolean): void {
    if (!this.urlQuality) this.qualityForced = !on;
  }
  /** Qualität per Adresse (?q=) fest vorgegeben */
  private urlQuality = false;

  setQuality(q: Quality, forced = true): void {
    if (this.urlQuality && forced) return;
    if (q === this.quality) return;
    this.quality = q;
    this.qualityForced = forced;
    const spec = QUALITY[q];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, spec.dpr));
    // Schatten an/aus nur über ihre Stärke (siehe init): die Shader bleiben dieselben
    this.sun.shadow.intensity = spec.shadow > 0 ? 1 : 0;
    this.renderer.shadowMap.needsUpdate = true;
    if (spec.shadow > 0 && this.sun.shadow.map && this.sun.shadow.mapSize.x !== spec.shadow) {
      this.sun.shadow.mapSize.set(spec.shadow, spec.shadow);
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null as unknown as typeof this.sun.shadow.map;
    }
    if (this.simpleWater) {
      this.simpleWater.visible = q === 0;
      this.land.water.visible = q > 0;
    }
    this.petals.setActive(Math.round(240 * spec.petals * (this.calm ? 0.4 : 1)));
    this.land.nature.setRange(spec.near, spec.far, spec.grass);
    this.village.range = VILLAGE_RANGE[q];
    this.buildEffects();
    this.resize();
  }

  setCalm(on: boolean): void {
    this.calm = on || reducedMotion();
    this.petals.setActive(Math.round(240 * QUALITY[this.quality].petals * (this.calm ? 0.4 : 1)));
    this.buildEffects();
    this.resize();
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
    if (fps < 48 && this.quality > 0) this.setQuality((this.quality - 1) as Quality, false);
  }

  // ───────────────────────────────────────── Tageszeit

  setTime(id: TimePreset | 'auto', instant = false): void {
    if (id === 'day' || id === 'golden' || id === 'night' || id === 'auto') store.setTime(id);
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
    if (force || Math.abs(this.t - this.envT) > 0.05) {
      this.envT = this.t;
      // Umgebungslicht je Tageszeit-Stufe nur einmal berechnen und aufheben (sonst ruckelt es bei jedem
      // Wechsel kurz, weil der Himmel in eine Würfelkarte gerechnet wird)
      const env = this.envFor(Math.round(this.t * 20));
      this.scene.environment = env.texture as Texture;
      this.scene.environmentIntensity = 0.5 - p.stars * 0.25;
      bus.emit('time:changed', { t: this.t });
    }
  }

  /** Umgebungslicht für eine Tageszeit-Stufe (0…20) aus dem Himmel, so wie er gerade eingestellt ist */
  private envFor(key: number): WebGLRenderTarget {
    let env = this.envCache.get(key);
    if (!env) {
      const envScene = new Scene();
      envScene.add(this.sky.clone());
      // 64 statt 256 Pixel je Würfelseite: für das weiche Umgebungslicht reicht das, und es kostet ein
      // Sechzehntel der Rechenzeit
      env = this.pmrem.fromScene(envScene, 0.04, 0.1, 100, { size: 64 });
      this.envCache.set(key, env);
    }
    return env;
  }

  /**
   * Umgebungslicht für alle Tageszeiten im Voraus berechnen (Ladebildschirm). Sonst rechnet der Tageslauf
   * beim ersten Erreichen jeder Stufe und das Bild hakt kurz.
   */
  async prepareEnvironment(step?: () => Promise<void>): Promise<void> {
    for (let k = 0; k <= 20; k++) {
      if (this.envCache.has(k)) continue;
      updateSky(this.sky, palette(k / 20));
      this.envFor(k);
      if (k % 5 === 4) await step?.();
    }
    this.applyTime(true);
  }

  // ───────────────────────────────────────── Zonen

  /**
   * Weltteile, die erst in der Nähe gebraucht werden: jenseits ihres Radius (plus Rand gegen Flackern) werden
   * sie gar nicht gezeichnet; der Nebel verdeckt den Übergang.
   */
  private zoneList: { id: string; x: number; z: number; r: number; objs: () => Object3D[]; on: boolean }[] =
    [];
  private setupZones(): void {
    const byName = (n: string): Object3D[] => {
      const o = this.land.group.getObjectByName(n);
      return o ? [o] : [];
    };
    this.zoneList = [
      { id: 'Teehaus', x: 0, z: 2, r: 150, objs: () => [this.cafe.group], on: true },
      { id: 'Dorf', x: 38, z: 57, r: 140, objs: () => [this.village.group, this.critters.group], on: true },
      { id: 'Terrassen', x: -32, z: 110, r: 120, objs: () => byName('paddies'), on: true },
    ];
  }

  private updateZones(c: Vector3): void {
    for (const z of this.zoneList) {
      const d = Math.hypot(c.x - z.x, c.z - z.z);
      const want = z.on ? d < z.r + 12 : d < z.r;
      if (want === z.on) continue;
      z.on = want;
      for (const o of z.objs()) o.visible = want;
    }
  }

  /** Name der Gegend, in der die Spielfigur gerade ist */
  zoneAt(x: number, z: number): string {
    if (Math.hypot(x, z * 0.85) < 18) return 'Teehaus';
    if (Math.hypot(x - 38, z - 57) < 34) return 'Dorf';
    if (Math.hypot(x - 62, z + 60) < 22) return 'Schrein';
    if (z > 76) return 'Fluss und Terrassen';
    if (Math.hypot(x, z - 18) > 85) return 'Berge';
    return 'Weg';
  }

  // ───────────────────────────────────────── Wetter

  /** Wolken, Regen und Nebel über die Tageszeit-Palette legen (jedes Bild, nur ein paar Werte) */
  private applyWeather(): void {
    const p = this.pal;
    const w = this.weather;
    const c = w.cloud;
    const fogK = w.fog;
    const grey = WX_GREY.copy(WX_DAY).lerp(WX_NIGHT, p.stars);
    const u = (this.sky.material as ShaderMaterial).uniforms;
    (u.top!.value as Color).copy(p.skyTop).lerp(grey, c * 0.75);
    (u.horizon!.value as Color).copy(p.skyHorizon).lerp(grey, Math.min(1, c * 0.55 + fogK * 0.35));
    (u.sunColor!.value as Color).copy(p.sun).multiplyScalar(1 - c * 0.8);
    const fog = this.scene.fog as FogExp2;
    fog.color.copy(p.fog).lerp(grey, Math.max(c * 0.5, fogK * 0.75));
    fog.density = p.fogDensity * 0.55 * (1 + fogK * 3.2 + w.rain * 0.9 + c * 0.25);
    this.sun.intensity = p.sunIntensity * (1 - 0.65 * c);
    this.hemi.intensity = p.hemi * (1 - 0.2 * c);
  }

  // ───────────────────────────────────────── Hilfen

  /** Weitere Objekte, die sich nicht im Teich spiegeln sollen (z. B. Dorfbewohner) */
  readonly noReflect: (() => Object3D[])[] = [];

  /**
   * Die Teichspiegelung rendert die Szene ein zweites Mal. Figuren, Gras, Tiere und das Dorf sind darin kaum zu
   * sehen, kosten aber viele Draw-Calls: Während des Spiegel-Renderns werden sie kurz ausgeblendet.
   */
  private slimReflection(): void {
    const water = this.land.water;
    const orig = water.onBeforeRender;
    const hidden: Object3D[] = [];
    water.onBeforeRender = (...args: Parameters<typeof orig>) => {
      const list: Object3D[] = [
        ...this.agents.map((a) => a.ch.root),
        this.village.group,
        this.critters.group,
        ...this.land.group.children.filter((c) => c.name === 'nature'),
        ...this.noReflect.flatMap((f) => f()),
      ];
      for (const o of list)
        if (o.visible) {
          o.visible = false;
          hidden.push(o);
        }
      try {
        orig.apply(water, args);
      } finally {
        for (const o of hidden) o.visible = true;
        hidden.length = 0;
      }
    };
  }

  /** Alles, vor dem die Kamera anhält (Wände des Teehauses, Bauwerke draußen) */
  private _camBlockers: Mesh[] | null = null;
  get camBlockers(): Mesh[] {
    return (this._camBlockers ??= [
      ...this.cafe.blockers,
      ...this.land.structures.solid,
      ...this.village.blockers,
    ]);
  }

  /**
   * Schattenausschnitt folgt der Spielfigur (in 1-m-Schritten, damit die Schattenkanten nicht flimmern).
   * Am Teehaus eng und scharf, draußen etwas weiter.
   */
  private followShadow(): void {
    const pp = this.player.ch.root.position;
    const t = this.sun.target.position;
    const outside = Math.hypot(pp.x, pp.z) > 22;
    const cx = outside ? Math.round(pp.x) : 0;
    const cz = outside ? Math.round(pp.z) : 0;
    const cy = outside ? Math.round(pp.y) : 0;
    const sc = this.sun.shadow.camera;
    const half = outside ? 20 : 13;
    if (sc.right !== half) {
      sc.left = -half;
      sc.right = half;
      sc.top = half;
      sc.bottom = -half;
      sc.updateProjectionMatrix();
    }
    if (t.x !== cx || t.z !== cz || t.y !== cy) {
      t.set(cx, cy, cz);
      this.sun.target.updateMatrixWorld();
    }
    this.sun.position.copy(this.pal.sunDir).multiplyScalar(45).add(t);
  }

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

  /** Zeitpunkt (performance.now) des letzten gezeichneten Bildes – für Watchdog und Debug-Anzeige */
  lastFrameAt = 0;
  /** Anzahl gezeichneter Bilder */
  frames = 0;

  /**
   * Ein Bild. Spiellogik und Zeichnen sind getrennt abgesichert: Eine Ausnahme irgendwo in der Logik wird
   * gemeldet, das Bild trotzdem gezeichnet, und die Schleife läuft weiter. (three.js fordert das nächste Bild
   * erst nach dem Ende dieser Funktion an – ein ungefangener Fehler hätte das Spiel dauerhaft eingefroren.)
   */
  private frame(): void {
    const now = performance.now();
    const rawDt = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(0.05, rawDt);
    try {
      this.tick(dt, rawDt);
    } catch (e) {
      report('Bild: Spiellogik', e);
    }
    try {
      this.draw(dt, rawDt, now);
    } catch (e) {
      report('Bild: Zeichnen', e);
    }
    this.lastFrameAt = performance.now();
    this.frames++;
  }

  private tick(dt: number, rawDt: number): void {
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
    // Jeder Ticker und jede Figur einzeln abgesichert: ein Fehler stoppt nur diesen Teil, nicht das Spiel.
    // Ein fehlerhafter Ticker wird entfernt (sonst würde er jedes Bild erneut scheitern).
    for (let i = this.tickers.length - 1; i >= 0; i--) {
      let done = true;
      try {
        done = this.tickers[i]!(dt) === true;
      } catch (e) {
        report('Ticker (entfernt)', e);
      }
      if (done) this.tickers.splice(i, 1);
    }
    try {
      this.player.update(dt, wish);
    } catch (e) {
      report('Spielfigur', e);
    }
    for (const a of this.agents)
      if (a !== this.player)
        try {
          a.update(dt, null);
        } catch (e) {
          report('Figur', e);
        }
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
    this.cam.update(dt, this.playerTarget(), this.camBlockers);
    // Kamera klebt an der Figur (enge Ecke): Figur ausblenden statt den Kopf groß ins Bild zu schieben
    this.player.ch.root.visible = !this.hidePlayer && (this.cam.locked || this.cam.close > 0.6);
    this.updateFocus();
    inp.endFrame();

    // drinnen/draußen
    const c = this.camera.position;
    const inside = c.x > HALL.x0 && c.x < HALL.x1 && c.z > HALL.z0 && c.z < HALL.z1 && c.y < FLOOR + 3.5;
    if (inside !== this.inside) {
      this.inside = inside;
      this.onInsideChange?.(inside);
    }

    // Weit weg vom Teehaus sind die Gäste drinnen nicht zu sehen: nicht zeichnen (spart viele Draw-Calls)
    const far = Math.hypot(c.x, c.z) > 45;
    if (far !== this.npcsHidden) {
      this.npcsHidden = far;
      for (const a of this.agents) if (a !== this.player) a.ch.root.visible = !far;
    }

    // Detailstufe der Figuren (Gesicht, Feinbewegung erst in der Nähe)
    for (const a of this.agents) {
      const d = a.ch.root.position.distanceTo(c);
      a.ch.setDetail(d < 11);
      // ferne Figuren seltener animieren (Spieler immer voll)
      a.animStride = a === this.player || d < 12 ? 1 : d < 24 ? 2 : 3;
    }
    this.fadeOccluders(dt);

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
    const dark = p.stars * (1 - this.weather.rain);
    this.fireflies.update(this.time, dark);
    for (const ff of this.moreFireflies) ff.update(this.time, dark);
    this.weather.update(dt);
    this.applyWeather();
    this.rain.update(this.time, c, this.weather.rain, this.inside);
    this.updateZones(c);
    this.land.koi.update(dt * motion + dt * (1 - motion) * 0.3, this.time);
    this.land.magpie.update(dt, this.time);
    this.land.flock.update(dt, this.time);
    this.land.atmosphere.update(this.time, p, motion);
    this.land.nature.update(c);
    // Spiegelung des Teichs nur aus der Nähe (sie rendert die Szene ein zweites Mal)
    if (this.simpleWater && this.quality > 0) {
      const nearPond = Math.hypot(c.x - POND.x, c.z - POND.z) < 42;
      this.land.water.visible = nearPond;
      this.simpleWater.visible = !nearPond;
    }
    this.village.update(c, 0.15 + p.window * 0.45, 0.35 + p.lantern * 1.1);
    this.critters.update(dt, this.time, this.player.ch.root.position, p.stars > 0.55);
    this.land.structures.lanternMat.emissiveIntensity = 0.2 + p.lantern * 1.4;
    (this.land.structures.glow.material as PointsMaterial).opacity = Math.max(0, p.lantern - 0.4) * 0.45;
    this.followShadow();

    if (this.markerEl && this.markerPos) {
      this.markerT = Math.max(0, this.markerT - dt * 1.2);
      const s = this.toScreen(this.markerPos);
      this.markerEl.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${1.4 - this.markerT * 0.4})`;
      this.markerEl.style.opacity = String(this.markerT);
      if (this.markerT <= 0 || !this.player.path.length) this.markerT = Math.min(this.markerT, 0.3);
    }
    if (this.dof) {
      // Schärfe dort, wo die Kamera hinschaut (im Gespräch: das Gesicht des Gegenübers)
      this.dof.target = this.cam.lookPoint;
    }
  }

  private draw(dt: number, rawDt: number, now: number): void {
    // Schatten nur jedes zweite Bild neu rechnen (spart einen ganzen Durchgang aller Schattenwerfer)
    this.frameNo++;
    // auf Niedrig gar nicht (Schatten sind dort ausgeblendet)
    if (QUALITY[this.quality].shadow > 0 && (this.frameNo % 2 === 0 || this.frameNo < 4 || this.cam.locked))
      this.renderer.shadowMap.needsUpdate = true;
    const info = this.renderer.info;
    info.reset();
    this.composer.render(dt);
    this.debug?.update(rawDt, performance.now() - now, info.render.calls, info.render.triangles);
  }

  /**
   * Figuren, die zwischen Kamera und Blickpunkt stehen, werden durchscheinend (z. B. ein Gast vor dem
   * Gesprächspartner). Abstand Strecke Kamera→Blickpunkt zur senkrechten Körperachse der Figur.
   */
  private fadeOccluders(dt: number): void {
    const cp = this.camera.position;
    const lp = this.cam.lookPoint;
    const seg = lp.clone().sub(cp);
    const len = seg.length();
    if (len < 0.01) return;
    seg.divideScalar(len);
    for (const a of this.agents) {
      const ch = a.ch;
      const r = ch.root.position;
      let want = 1;
      if (ch.root.visible && (a !== this.player || this.mode === 'dialog')) {
        // nächster Punkt auf der Kamerastrecke zur Achse (x/z), Höhe prüfen
        const t = Math.max(
          0,
          Math.min(len, (r.x - cp.x) * seg.x + (r.z - cp.z) * seg.z) /
            Math.max(1e-3, Math.hypot(seg.x, seg.z)),
        );
        const px = cp.x + seg.x * t;
        const py = cp.y + seg.y * t;
        const pz = cp.z + seg.z * t;
        const dxz = Math.hypot(px - r.x, pz - r.z);
        const inBody = py > r.y && py < r.y + ch.H * 1.02;
        const isTarget = Math.hypot(lp.x - r.x, lp.z - r.z) < 0.45 && lp.y > r.y && lp.y < r.y + ch.H + 0.2;
        if (dxz < 0.34 && inBody && !isTarget && t < len - 0.3) want = 0.22;
      }
      const f = a.fade ?? 1;
      a.fade = f + (want - f) * Math.min(1, dt * 8);
      ch.setFade(a.fade);
    }
  }

  get walkSpeed(): number {
    return WALK;
  }
}
