// Third-Person-Kamera: folgt der Spielfigur, Maus/Touch dreht, Rad/Pinch zoomt, Wände und Decke schieben die
// Kamera nach vorn (Kollisionsschutz). Für Intro und Gespräche lassen sich feste Einstellungen überblenden.
import { PerspectiveCamera, Raycaster, Vector3 } from 'three';
import type { Mesh } from 'three';

export interface Shot {
  pos: Vector3;
  look: Vector3;
}

export class FollowCam {
  yaw = Math.PI; // Kamera hinter der Figur (Figur schaut nach -z)
  pitch = 0.32;
  dist = 4.2;
  private dYaw = Math.PI;
  private dPitch = 0.32;
  private dDist = 4.2;
  private ray = new Raycaster();
  private pos = new Vector3();
  private look = new Vector3();
  private shot: { from: Shot; to: Shot; t: number; dur: number } | null = null;
  private blend = 0;
  /** Wird gerade ein fester Bildausschnitt gezeigt? */
  locked = false;
  minDist = 1.4;
  /** tatsächlicher Abstand nach Kollision (zum Ausblenden der Figur bei sehr kleinem Abstand) */
  close = 4;
  maxDist = 7;

  constructor(readonly camera: PerspectiveCamera) {}

  rotate(dx: number, dy: number): void {
    this.dYaw -= dx * 0.0055;
    this.dPitch = Math.max(-0.05, Math.min(1.15, this.dPitch + dy * 0.004));
  }

  zoom(dz: number): void {
    this.dDist = Math.max(this.minDist, Math.min(this.maxDist, this.dDist + dz));
  }

  /** Kamera sofort hinter die Figur setzen */
  snapBehind(yaw: number): void {
    this.dYaw = this.yaw = yaw + Math.PI;
  }

  /** Gemächlich hinter die Laufrichtung drehen (nur, wenn der Spieler die Kamera nicht selbst bewegt) */
  follow(yaw: number, dt: number, amount: number): void {
    const target = yaw + Math.PI;
    let d = target - this.dYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.dYaw += d * Math.min(1, dt * amount);
  }

  /** Festen Bildausschnitt ansteuern (Intro, Gespräch) */
  setShot(to: Shot | null, dur = 1.2): void {
    if (!to) {
      this.locked = false;
      return;
    }
    this.shot = {
      from: { pos: this.camera.position.clone(), look: this.look.clone() },
      to: { pos: to.pos.clone(), look: to.look.clone() },
      t: 0,
      dur,
    };
    this.locked = true;
  }

  get forwardYaw(): number {
    return this.yaw + Math.PI;
  }

  update(dt: number, target: Vector3, blockers: Mesh[]): void {
    const k = Math.min(1, dt * 10);
    let dy = this.dYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * k;
    this.pitch += (this.dPitch - this.pitch) * k;
    this.dist += (this.dDist - this.dist) * Math.min(1, dt * 6);
    // gewünschte Position auf der Kugel um den Zielpunkt; ist es dahinter zu eng, steiler von oben schauen
    const cast = (pitch: number): { dir: Vector3; d: number } => {
      const dir = new Vector3(
        Math.sin(this.yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(this.yaw) * Math.cos(pitch),
      );
      this.ray.set(target, dir);
      this.ray.far = this.dist + 0.3;
      const hit = this.ray.intersectObjects(blockers, false)[0];
      return { dir, d: hit ? Math.max(0.35, hit.distance - 0.3) : this.dist };
    };
    let { dir, d } = cast(this.pitch);
    if (d < this.dist * 0.55) {
      const alt = cast(Math.min(1.25, this.pitch + 0.55));
      if (alt.d > d * 1.3) ({ dir, d } = alt);
    }
    this.close = d;
    const want = target.clone().addScaledVector(dir, d);
    // Kollisionen sofort, Zurückweichen weich
    const cur = this.pos.distanceTo(target);
    if (d < cur || cur === 0) this.pos.copy(want);
    else this.pos.lerp(want, Math.min(1, dt * 5));
    this.look.lerp(target, Math.min(1, dt * 12));
    if (this.look.lengthSq() === 0) this.look.copy(target);

    if (this.locked && this.shot) {
      const s = this.shot;
      s.t = Math.min(1, s.t + dt / s.dur);
      this.blend = Math.min(1, this.blend + dt / s.dur);
    } else {
      this.blend = Math.max(0, this.blend - dt / 0.9);
    }
    const e = this.blend * this.blend * (3 - 2 * this.blend);
    if (this.shot && e > 0) {
      const s = this.shot;
      const u = s.t * s.t * (3 - 2 * s.t);
      const sp = s.from.pos.clone().lerp(s.to.pos, u);
      const sl = s.from.look.clone().lerp(s.to.look, u);
      this.camera.position.copy(this.pos).lerp(sp, e);
      this.camera.lookAt(this.look.clone().lerp(sl, e));
      if (!this.locked && e <= 0) this.shot = null;
    } else {
      this.camera.position.copy(this.pos);
      this.camera.lookAt(this.look);
    }
  }
}
