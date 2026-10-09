// Raumklang: Die Hörposition folgt der Kamera, jede sprechende Figur klingt von ihrem Kopf aus (PannerNode).
// Dazu leises Simlish-Gemurmel der Gäste im Hintergrund – nur drinnen und nicht während eines Gesprächs.
import { Vector3 } from 'three';
import type { World } from './world';
import { HALL } from './layout';
import type { Speaker } from '../ui/bubbles';
import type { Simlish } from '../audio/simlish';

export interface Murmurer {
  speaker: Speaker;
  /** darf gerade murmeln (sitzt, ist nicht beschäftigt) */
  idle: () => boolean;
}

const fwd = new Vector3();

export class Soundscape {
  private speakers = new Map<string, Speaker>();
  private murmurers: Murmurer[] = [];
  private next = 5;
  private placeTimer = 0;

  constructor(
    private world: World,
    private voice: Simlish,
    private busy: () => boolean,
  ) {
    voice.onSyllable = (id) => this.speakers.get(id)?.onBlip?.();
    world.tickers.push((dt) => this.update(dt));
  }

  add(sp: Speaker, murmur?: () => boolean): void {
    this.speakers.set(sp.id, sp);
    if (murmur) this.murmurers.push({ speaker: sp, idle: murmur });
  }

  private update(dt: number): void {
    const w = this.world;
    const cam = w.camera;
    cam.getWorldDirection(fwd);
    this.voice.listener(cam.position.x, cam.position.y, cam.position.z, fwd.x, fwd.y, fwd.z);
    // Sprecherpositionen reichen ~15-mal pro Sekunde
    this.placeTimer -= dt;
    if (this.placeTimer <= 0) {
      this.placeTimer = 0.066;
      for (const sp of this.speakers.values()) {
        const p = sp.anchor();
        this.voice.place(sp.id, p.x, p.y - 0.15, p.z);
      }
    }
    // Hintergrund-Gemurmel
    const pp = w.player.ch.root.position;
    const inside = pp.x > HALL.x0 && pp.x < HALL.x1 && pp.z > HALL.z0 && pp.z < HALL.z1;
    if (!inside || this.busy() || w.mode !== 'free') return;
    this.next -= dt;
    if (this.next > 0) return;
    this.next = 3.5 + Math.random() * 5;
    const near = this.murmurers.filter((m) => m.idle() && m.speaker.anchor().distanceTo(pp) < 14);
    const m = near[Math.floor(Math.random() * near.length)];
    if (!m) return;
    this.voice.murmur(m.speaker.id, 3 + Math.floor(Math.random() * 5), 0.3);
    window.setTimeout(() => m.speaker.onEnd?.(), 1600);
  }
}
