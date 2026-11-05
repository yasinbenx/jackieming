// Wetter: klar, bewölkt, Regen und Nebel wechseln sich ab (weiche Übergänge über ~25 s). Die Welt liest nur
// drei Werte: Bewölkung, Regen und Nebel (je 0..1). Regentropfen fallen in einem Kasten um die Kamera
// (GPU, ein Draw-Call).
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  LineSegments,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';

export type WeatherKind = 'klar' | 'wolkig' | 'regen' | 'nebel' | 'schnee';

const TARGET: Record<WeatherKind, { cloud: number; rain: number; fog: number; snow: number }> = {
  klar: { cloud: 0, rain: 0, fog: 0, snow: 0 },
  wolkig: { cloud: 0.7, rain: 0, fog: 0.15, snow: 0 },
  regen: { cloud: 1, rain: 1, fog: 0.35, snow: 0 },
  nebel: { cloud: 0.4, rain: 0, fog: 1, snow: 0 },
  schnee: { cloud: 0.6, rain: 0, fog: 0.3, snow: 1 },
};

/** Dauer je Wetter (s) und Gewicht bei der Auswahl */
const PLAN: Record<WeatherKind, { min: number; max: number; w: number }> = {
  klar: { min: 240, max: 480, w: 5 },
  wolkig: { min: 120, max: 240, w: 3 },
  regen: { min: 90, max: 180, w: 2 },
  nebel: { min: 90, max: 160, w: 1 },
  schnee: { min: 150, max: 300, w: 3 },
};

export const WEATHER_ZH: Record<WeatherKind, string> = {
  klar: '晴',
  wolkig: '多云',
  regen: '下雨',
  nebel: '雾',
  schnee: '下雪',
};

export class Weather {
  kind: WeatherKind = 'klar';
  cloud = 0;
  rain = 0;
  fog = 0;
  snow = 0;
  /** Winter: statt Regen fällt Schnee (Jahreszeiten) */
  winter = false;
  private left = 200;
  /** fest vorgegeben (Einstellung „immer klar“ oder ?wetter=…) */
  fixed: WeatherKind | null = null;
  /** per Adresse vorgegeben (?wetter=…), gilt, solange die Einstellung „wechselnd“ ist */
  readonly urlFixed: WeatherKind | null = null;
  onChange?: (k: WeatherKind) => void;

  constructor() {
    const q = new URLSearchParams(location.search).get('wetter');
    if (q === 'klar' || q === 'wolkig' || q === 'regen' || q === 'nebel' || q === 'schnee') {
      this.fixed = q;
      this.urlFixed = q;
      this.kind = q;
      Object.assign(this, TARGET[q]);
    }
  }

  set(kind: WeatherKind): void {
    if (kind === this.kind) return;
    this.kind = kind;
    this.onChange?.(kind);
  }

  update(dt: number): void {
    if (this.fixed) this.set(this.fixed);
    else {
      // Jahreszeit gewechselt: Regen wird zu Schnee und umgekehrt
      if (this.winter && this.kind === 'regen') this.set('schnee');
      if (!this.winter && this.kind === 'schnee') this.set('wolkig');
      this.left -= dt;
      if (this.left <= 0) {
        // nächstes Wetter (nicht zweimal dasselbe)
        const opts = (Object.keys(PLAN) as WeatherKind[]).filter(
          (k) => k !== this.kind && (this.winter ? k !== 'regen' : k !== 'schnee'),
        );
        let r = Math.random() * opts.reduce((a, k) => a + PLAN[k].w, 0);
        let next = opts[0]!;
        for (const k of opts) {
          r -= PLAN[k].w;
          if (r <= 0) {
            next = k;
            break;
          }
        }
        this.set(next);
        const p = PLAN[next];
        this.left = p.min + Math.random() * (p.max - p.min);
      }
    }
    const t = TARGET[this.kind];
    const k = Math.min(1, dt / 25);
    this.cloud += (t.cloud - this.cloud) * k;
    this.rain += (t.rain - this.rain) * k * (t.rain > this.rain ? 0.7 : 1.4);
    this.fog += (t.fog - this.fog) * k;
    this.snow += (t.snow - this.snow) * k;
  }
}

// ───────────────────────────────────────── Schnee

/** Schneeflocken: langsam taumelnde Punkte in einem Kasten um die Kamera (GPU, ein Draw-Call) */
export class Snow {
  readonly points: Points;
  private mat: ShaderMaterial;

  constructor(count: number) {
    const pos: number[] = [];
    const seed: number[] = [];
    for (let i = 0; i < count; i++) {
      pos.push(Math.random() * BOX.x, Math.random() * BOX.y, Math.random() * BOX.z);
      seed.push(Math.random());
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
    this.mat = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new Vector3() },
        uAmount: { value: 0 },
        uBox: { value: BOX },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uCam;
        uniform vec3 uBox;
        uniform float uAmount;
        attribute float aSeed;
        varying float vA;
        void main() {
          vec3 p = position;
          p.y -= uTime * (0.9 + aSeed * 0.8);
          p.x += sin(uTime * 0.7 + aSeed * 40.0) * 0.6;
          p.z += cos(uTime * 0.5 + aSeed * 23.0) * 0.5;
          vec3 w = uCam + mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5;
          vA = step(aSeed, uAmount);
          vec4 mv = viewMatrix * vec4(w, 1.0);
          gl_PointSize = min(7.0, (2.0 + aSeed * 3.0) * 40.0 / max(1.0, -mv.z));
          // ganz nah an der Kamera ausblenden (sonst große Kleckse)
          vA *= smoothstep(1.5, 3.5, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          if (vA <= 0.01) discard;
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(0.95, 0.97, 1.0, (1.0 - d * 2.0) * 0.85);
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.name = 'snow';
    this.points.visible = false;
  }

  update(time: number, cam: Vector3, amount: number, inside: boolean): void {
    this.points.visible = amount > 0.02 && !inside;
    const u = this.mat.uniforms;
    u.uTime!.value = time;
    (u.uCam!.value as Vector3).copy(cam);
    u.uAmount!.value = amount;
  }
}

// ───────────────────────────────────────── Regen

const BOX = new Vector3(40, 22, 40);

export class Rain {
  readonly mesh: LineSegments;
  private mat: ShaderMaterial;

  constructor(count: number) {
    const pos: number[] = [];
    const seed: number[] = [];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * BOX.x;
      const y = Math.random() * BOX.y;
      const z = Math.random() * BOX.z;
      const s = Math.random();
      // zwei Punkte je Tropfen: oben (0) und unten (1)
      pos.push(x, y, z, x, y, z);
      seed.push(s, 0, s, 1);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new Float32BufferAttribute(seed, 2));
    this.mat = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new Vector3() },
        uAmount: { value: 0 },
        uBox: { value: BOX },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uCam;
        uniform vec3 uBox;
        uniform float uAmount;
        attribute vec2 aSeed;
        varying float vA;
        void main() {
          vec3 p = position;
          // fallen und um die Kamera herum wiederholen
          p.y -= uTime * (11.0 + aSeed.x * 4.0);
          vec3 w = uCam + mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5;
          // Strich: unteres Ende etwas tiefer und leicht schräg (Wind)
          w += aSeed.y * vec3(0.06, -0.55, 0.03);
          // nur ein Teil der Tropfen bei leichtem Regen
          vA = step(aSeed.x, uAmount) * (1.0 - aSeed.y * 0.7);
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          if (vA <= 0.01) discard;
          gl_FragColor = vec4(0.75, 0.8, 0.86, 0.32 * vA);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.mesh = new LineSegments(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'rain';
    this.mesh.visible = false;
  }

  update(time: number, cam: Vector3, amount: number, inside: boolean): void {
    this.mesh.visible = amount > 0.02 && !inside;
    const u = this.mat.uniforms;
    u.uTime!.value = time;
    (u.uCam!.value as Vector3).copy(cam);
    u.uAmount!.value = amount;
  }
}
