// Bewegte Figur (Spieler und NPCs): Laufen mit Beschleunigung, Gleiten an Hindernissen, Wegpunkte (A*),
// Hinsetzen auf Hocker und Aufstehen. Die Animation steuert das Character-Rig über speed/sitDown.
import { Vector2 } from 'three';
import { Character } from './character';
import type { Look } from './character';
import { groundY } from './nav';
import type { NavGrid } from './nav';
import type { Seat } from './layout';
import { FLOOR } from './layout';

export const WALK = 1.45;
export const RUN = 3.5;

type SeatPhase = 'none' | 'approach' | 'settle' | 'seated' | 'rising';

export class Agent {
  readonly ch: Character;
  readonly vel = new Vector2();
  path: [number, number][] = [];
  private onArrive: (() => void) | null = null;
  private pathRun = false;
  seat: Seat | null = null;
  private seatPhase: SeatPhase = 'none';
  private seatT = 0;
  private seatFrom = new Vector2();
  private seatFromYaw = 0;
  private yawTarget: number | null = null;
  /** Gehgeschwindigkeit dieses Agenten (Kinder trippeln, der Teemeister schlurft) */
  walkSpeed = WALK;
  runSpeed = RUN;
  /** Kollisionen mit dem Raster beachten (Skripte dürfen das kurz abschalten, z. B. hinter der Theke) */
  collide = true;
  private y = FLOOR;

  constructor(
    look: Look,
    private nav: NavGrid,
  ) {
    this.ch = new Character(look);
  }

  get x(): number {
    return this.ch.root.position.x;
  }

  get z(): number {
    return this.ch.root.position.z;
  }

  get busy(): boolean {
    return (
      this.path.length > 0 ||
      this.seatPhase === 'approach' ||
      this.seatPhase === 'settle' ||
      this.seatPhase === 'rising'
    );
  }

  get seated(): boolean {
    return this.seatPhase === 'seated';
  }

  place(x: number, z: number, yaw = 0): void {
    this.ch.root.position.set(x, groundY(x, z), z);
    this.y = this.ch.root.position.y;
    this.ch.yaw = yaw;
    this.vel.set(0, 0);
  }

  /** Sofort sitzend platzieren (Startzustand der Gäste) */
  placeSeated(seat: Seat): void {
    this.seat = seat;
    this.place(seat.x, seat.z, seat.yaw);
    this.ch.sitDown(seat.h);
    this.seatPhase = 'seated';
  }

  faceYaw(yaw: number | null): void {
    this.yawTarget = yaw;
  }

  faceTo(x: number, z: number): void {
    this.yawTarget = Math.atan2(x - this.x, z - this.z);
  }

  /** Mit Wegfindung zu einem Punkt gehen. false, wenn kein Weg existiert. */
  goTo(x: number, z: number, run = false, onArrive?: () => void): boolean {
    if (this.seatPhase === 'seated') this.standUp();
    const p = this.nav.path(this.x, this.z, x, z);
    if (!p) return false;
    this.path = p;
    this.pathRun = run;
    this.onArrive = onArrive ?? null;
    return true;
  }

  /** Direkter Weg ohne Rasterprüfung (für kurze Skriptstrecken, z. B. hinter der Theke) */
  walkDirect(points: [number, number][], onArrive?: () => void): void {
    this.path = points.slice();
    this.pathRun = false;
    this.onArrive = onArrive ?? null;
  }

  stopPath(): void {
    this.path = [];
    this.onArrive = null;
  }

  /** Zum Hocker gehen und hinsetzen */
  sitAt(seat: Seat, onSeated?: () => void): boolean {
    const t = { x: seat.x - Math.sin(seat.yaw) * 0.55, z: seat.z - Math.cos(seat.yaw) * 0.55 };
    // Der Annäherungspunkt liegt vom Tisch weg; der Hocker selbst ist frei begehbar
    const ok = this.goTo(t.x, t.z, false, () => {
      this.seat = seat;
      this.seatPhase = 'settle';
      this.seatT = 0;
      this.seatFrom.set(this.x, this.z);
      this.seatFromYaw = this.ch.yaw;
      this.ch.sitDown(seat.h);
      onSeated?.();
    });
    if (ok) this.seatPhase = 'approach';
    return ok;
  }

  standUp(): void {
    if (this.seatPhase !== 'seated' && this.seatPhase !== 'settle') return;
    this.ch.standUp();
    this.seatPhase = 'rising';
    this.seatT = 0;
  }

  update(dt: number, wish: { x: number; z: number; run: boolean } | null): void {
    const ch = this.ch;
    const pos = ch.root.position;
    // ── Sitzen
    if (this.seatPhase === 'settle' && this.seat) {
      this.seatT = Math.min(1, this.seatT + dt / 0.6);
      const u = this.seatT * this.seatT * (3 - 2 * this.seatT);
      pos.x = this.seatFrom.x + (this.seat.x - this.seatFrom.x) * u;
      pos.z = this.seatFrom.y + (this.seat.z - this.seatFrom.y) * u;
      let dy = this.seat.yaw - this.seatFromYaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      ch.yaw = this.seatFromYaw + dy * u;
      ch.speed = 0;
      if (this.seatT >= 1) this.seatPhase = 'seated';
      ch.update(dt);
      return;
    }
    if (this.seatPhase === 'seated') {
      ch.speed = 0;
      if (wish && Math.hypot(wish.x, wish.z) > 0.3) this.standUp();
      else {
        if (this.yawTarget !== null) this.turnTo(this.yawTarget, dt, 1.2);
        ch.update(dt);
        return;
      }
    }
    if (this.seatPhase === 'rising' && this.seat) {
      this.seatT = Math.min(1, this.seatT + dt / 0.7);
      const u = Math.max(0, (this.seatT - 0.35) / 0.65);
      const bx = this.seat.x - Math.sin(this.seat.yaw) * 0.55;
      const bz = this.seat.z - Math.cos(this.seat.yaw) * 0.55;
      pos.x = this.seat.x + (bx - this.seat.x) * u;
      pos.z = this.seat.z + (bz - this.seat.z) * u;
      ch.speed = u > 0 && u < 1 ? 0.6 : 0;
      ch.update(dt);
      if (this.seatT >= 1) {
        this.seatPhase = 'none';
        this.seat = null;
      }
      return;
    }

    // ── Gehen
    let dx = 0;
    let dz = 0;
    let run = false;
    if (wish && Math.hypot(wish.x, wish.z) > 0.05) {
      if (this.path.length) this.stopPath();
      if (this.seatPhase === 'approach') this.seatPhase = 'none';
      dx = wish.x;
      dz = wish.z;
      run = wish.run;
    } else if (this.path.length) {
      const [tx, tz] = this.path[0]!;
      const ddx = tx - this.x;
      const ddz = tz - this.z;
      const d = Math.hypot(ddx, ddz);
      const last = this.path.length === 1;
      if (d < (last ? 0.08 : 0.3)) {
        this.path.shift();
        if (!this.path.length) {
          const cb = this.onArrive;
          this.onArrive = null;
          this.vel.multiplyScalar(0.3);
          cb?.();
        }
      } else {
        // am Ziel abbremsen
        const slow = last ? Math.min(1, d / 0.6) : 1;
        dx = (ddx / d) * slow;
        dz = (ddz / d) * slow;
        run = this.pathRun;
      }
    }
    const maxV = run ? this.runSpeed : this.walkSpeed;
    const tv = new Vector2(dx, dz).multiplyScalar(maxV);
    const acc = tv.lengthSq() > this.vel.lengthSq() ? 7 : 9;
    this.vel.lerp(tv, Math.min(1, dt * acc));
    if (this.vel.lengthSq() < 1e-4) this.vel.set(0, 0);
    const mx = this.vel.x * dt;
    const mz = this.vel.y * dt;
    if (mx || mz) {
      if (this.collide) [pos.x, pos.z] = this.nav.move(pos.x, pos.z, mx, mz);
      else {
        pos.x += mx;
        pos.z += mz;
      }
    }
    // Höhe weich nachführen (Stufen, Brückenbogen)
    const gy = groundY(pos.x, pos.z);
    this.y += (gy - this.y) * Math.min(1, dt * 12);
    pos.y = this.y;
    const sp = this.vel.length();
    ch.speed = sp;
    if (sp > 0.15) this.turnTo(Math.atan2(this.vel.x, this.vel.y), dt, 9);
    else if (this.yawTarget !== null) this.turnTo(this.yawTarget, dt, 5);
    ch.update(dt);
  }

  private turnTo(target: number, dt: number, rate: number): void {
    let d = target - this.ch.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.ch.yaw += d * Math.min(1, dt * rate);
  }
}
