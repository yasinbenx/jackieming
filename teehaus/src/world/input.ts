// Eingabe: Tastatur (WASD/Pfeile, Umschalt = laufen, E = Interaktion), Maus (ziehen = Kamera, Klick = hinlaufen,
// Rad = Zoom) und Touch (virtueller Joystick, Wischen = Kamera, Tippen = hinlaufen, zwei Finger = Zoom).

export interface Tap {
  x: number;
  y: number;
}

export class Input {
  private keys = new Set<string>();
  /** Joystick-Vektor (-1..1), y nach oben = vorwärts */
  private joy = { x: 0, y: 0, id: -1, cx: 0, cy: 0 };
  private drag: {
    id: number;
    x: number;
    y: number;
    sx: number;
    sy: number;
    t: number;
    moved: boolean;
  } | null = null;
  private pinch = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  /** Kameradrehung seit dem letzten Frame (Pixel) */
  lookDX = 0;
  lookDY = 0;
  zoom = 0;
  taps: Tap[] = [];
  interact = false;
  wave = false;
  enabled = true;
  readonly joyEl: HTMLElement;
  private knob: HTMLElement;
  private touchMode = false;

  constructor(canvas: HTMLElement) {
    this.joyEl = document.createElement('div');
    this.joyEl.className = 'joystick';
    this.joyEl.setAttribute('aria-hidden', 'true');
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    this.joyEl.appendChild(this.knob);
    document.body.appendChild(this.joyEl);
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.setTouchMode(coarse);

    window.addEventListener('keydown', (e) => {
      if (this.isTyping(e)) return;
      this.keys.add(e.code);
      if (e.code === 'KeyE' || (e.code === 'Enter' && this.enabled)) {
        if (e.code === 'KeyE' || !(e.target instanceof HTMLButtonElement)) this.interact = true;
      }
      if (e.code === 'KeyG') this.wave = true;
      if (
        e.code.startsWith('Arrow') &&
        this.enabled &&
        !(e.target as HTMLElement)?.closest?.('.panel, .modal, .dlg3')
      )
        e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // Joystick
    this.joyEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.joy.id = e.pointerId;
      const r = this.joyEl.getBoundingClientRect();
      this.joy.cx = r.left + r.width / 2;
      this.joy.cy = r.top + r.height / 2;
      this.joyEl.setPointerCapture(e.pointerId);
      this.updateJoy(e.clientX, e.clientY);
    });
    this.joyEl.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joy.id) this.updateJoy(e.clientX, e.clientY);
    });
    const endJoy = (e: PointerEvent): void => {
      if (e.pointerId !== this.joy.id) return;
      this.joy.id = -1;
      this.joy.x = this.joy.y = 0;
      this.knob.style.transform = '';
    };
    this.joyEl.addEventListener('pointerup', endJoy);
    this.joyEl.addEventListener('pointercancel', endJoy);

    // Kamera ziehen / tippen / zoomen
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') this.setTouchMode(true);
      this.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch.size === 2) {
        const [a, b] = [...this.pinch.values()];
        this.pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        this.drag = null;
        return;
      }
      this.drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        sx: e.clientX,
        sy: e.clientY,
        t: performance.now(),
        moved: false,
      };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.pinch.has(e.pointerId)) this.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch.size === 2) {
        const [a, b] = [...this.pinch.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        this.zoom += (this.pinchDist - d) * 0.01;
        this.pinchDist = d;
        return;
      }
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 7) d.moved = true;
      if (d.moved) {
        this.lookDX += dx;
        this.lookDY += dy;
      }
    });
    const end = (e: PointerEvent): void => {
      this.pinch.delete(e.pointerId);
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      if (!d.moved && performance.now() - d.t < 450 && e.type === 'pointerup')
        this.taps.push({ x: e.clientX, y: e.clientY });
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom += Math.sign(e.deltaY) * 0.6;
      },
      { passive: false },
    );
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private isTyping(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable);
  }

  setTouchMode(on: boolean): void {
    this.touchMode = on;
    document.body.classList.toggle('touch', on);
  }

  get touch(): boolean {
    return this.touchMode;
  }

  private updateJoy(x: number, y: number): void {
    const R = 46;
    let dx = x - this.joy.cx;
    let dy = y - this.joy.cy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.joy.x = dx / R;
    this.joy.y = -dy / R;
  }

  /** Bewegungswunsch: x = rechts, y = vorwärts (Länge 0..1), run = Laufen */
  axis(): { x: number; y: number; run: boolean } {
    if (!this.enabled) return { x: 0, y: 0, run: false };
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let run = k.has('ShiftLeft') || k.has('ShiftRight');
    if (this.joy.id >= 0) {
      x = this.joy.x;
      y = this.joy.y;
      run = Math.hypot(x, y) > 0.92;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y, run };
  }

  /** Pro Frame aufrufen, nachdem alles gelesen wurde */
  endFrame(): void {
    this.lookDX = this.lookDY = 0;
    this.zoom = 0;
    this.taps.length = 0;
    this.interact = false;
    this.wave = false;
  }
}
