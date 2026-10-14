// Wetter: klar, bewölkt, Regen und Nebel wechseln sich ab (weiche Übergänge über ~25 s). Die Welt liest nur
// drei Werte: Bewölkung, Regen und Nebel (je 0..1). Regentropfen fallen in einem Kasten um die Kamera
// (GPU, ein Draw-Call).
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  LineSegments,
  ShaderMaterial,
  Vector3,
} from 'three';

export type WeatherKind = 'klar' | 'wolkig' | 'regen' | 'nebel';

const TARGET: Record<WeatherKind, { cloud: number; rain: number; fog: number }> = {
  klar: { cloud: 0, rain: 0, fog: 0 },
  wolkig: { cloud: 0.7, rain: 0, fog: 0.15 },
  regen: { cloud: 1, rain: 1, fog: 0.35 },
  nebel: { cloud: 0.4, rain: 0, fog: 1 },
};

/** Dauer je Wetter (s) und Gewicht bei der Auswahl */
const PLAN: Record<WeatherKind, { min: number; max: number; w: number }> = {
  klar: { min: 240, max: 480, w: 5 },
  wolkig: { min: 120, max: 240, w: 3 },
  regen: { min: 90, max: 180, w: 2 },
  nebel: { min: 90, max: 160, w: 1 },
};

export const WEATHER_ZH: Record<WeatherKind, string> = {
  klar: '晴',
  wolkig: '多云',
  regen: '下雨',
  nebel: '雾',
};

export class Weather {
  kind: WeatherKind = 'klar';
  cloud = 0;
  rain = 0;
  fog = 0;
  private left = 200;
  /** fest vorgegeben (Einstellung „immer klar“ oder ?wetter=…) */
  fixed: WeatherKind | null = null;
  /** per Adresse vorgegeben (?wetter=…), gilt, solange die Einstellung „wechselnd“ ist */
  readonly urlFixed: WeatherKind | null = null;
  onChange?: (k: WeatherKind) => void;

  constructor() {
    const q = new URLSearchParams(location.search).get('wetter');
    if (q === 'klar' || q === 'wolkig' || q === 'regen' || q === 'nebel') {
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
      this.left -= dt;
      if (this.left <= 0) {
        // nächstes Wetter (nicht zweimal dasselbe)
        const opts = (Object.keys(PLAN) as WeatherKind[]).filter((k) => k !== this.kind);
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
