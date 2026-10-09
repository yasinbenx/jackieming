// Intro: Kleidung wählen, dann über die Brücke zur Tür laufen, Tür öffnet sich, Überblendung nach innen.
import { Vector3 } from 'three';
import type { World } from './world';
import { PLAYER_LOOKS } from './looks';
import { BRIDGE, HALL, INSIDE, START } from './layout';
import { bus } from '../core/bus';
import { h } from '../ui/dom';

const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

/** Schwarzblende über der Szene */
function fader(): { el: HTMLElement; to(o: number, ms: number): Promise<void> } {
  let el = document.getElementById('fade');
  if (!el) {
    el = h('div', { id: 'fade', 'aria-hidden': 'true' });
    document.body.appendChild(el);
  }
  const node = el;
  return {
    el: node,
    async to(o: number, ms: number) {
      node.style.transition = `opacity ${ms}ms ease`;
      node.style.opacity = String(o);
      await wait(ms);
    },
  };
}

/** Kleiderauswahl vor dem Haus. Löst auf, wenn der Spieler losgeht. */
export function pickOutfit(world: World): Promise<void> {
  const p = world.player.ch.root.position;
  const shot = (): void =>
    world.cam.setShot(
      { pos: new Vector3(p.x - 1.1, p.y + 1.25, p.z - 2.6), look: new Vector3(p.x, p.y + 1.0, p.z) },
      0.01,
    );
  shot();
  return new Promise((resolve) => {
    const swatches = PLAYER_LOOKS.map((l, i) =>
      h(
        'button',
        {
          class: 'swatch',
          type: 'button',
          'aria-pressed': i === world.outfitIndex,
          'aria-label': `Outfit ${l.label}`,
          style: `--sw:${l.swatch}`,
          onclick: () => {
            bus.emit('ui:click');
            world.setOutfit(i);
            for (const [k, b] of swatches.entries()) b.setAttribute('aria-pressed', String(k === i));
          },
        },
        h('span', { class: 'swatch-dot' }),
        h('span', { class: 'swatch-label' }, l.label),
      ),
    );
    const go = h(
      'button',
      { class: 'btn primary big', type: 'button' },
      h('span', { lang: 'zh' }, '走'),
      ' Zum Teehaus gehen',
    );
    const panel = h(
      'section',
      { class: 'outfit panel', role: 'dialog', 'aria-label': 'Kleidung wählen' },
      h('h2', {}, h('span', { lang: 'zh' }, '衣服'), ' ', h('i', {}, 'yīfu'), ' · Deine Kleidung'),
      h('div', { class: 'swatches' }, ...swatches),
      h('p', { class: 'outfit-hint' }, 'Mit ← → wechseln, Enter zum Losgehen.'),
      go,
    );
    document.body.appendChild(panel);
    (swatches[world.outfitIndex] ?? go).focus({ preventScroll: true });
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const n = world.outfitIndex + (e.key === 'ArrowRight' ? 1 : -1);
        swatches[(n + swatches.length) % swatches.length]!.click();
        swatches[world.outfitIndex]!.focus({ preventScroll: true });
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', key);
    go.addEventListener('click', () => {
      bus.emit('ui:click');
      window.removeEventListener('keydown', key);
      panel.classList.add('out');
      window.setTimeout(() => panel.remove(), 400);
      resolve();
    });
  });
}

/** Lauf über die Brücke bis ins Haus. skip.requested beendet sofort. */
export async function walkIn(
  world: World,
  skip: { requested: boolean },
  onStep: (u: number) => void,
): Promise<void> {
  const pl = world.player;
  const f = fader();
  world.mode = 'intro';
  world.cam.setShot(null);
  world.cam.snapBehind(Math.PI);
  world.cam.pitch = 0.28;
  world.cam.dist = 4.6;
  const doorZ = HALL.z1 + 0.85;
  const total = START.z - doorZ;
  let done = false;
  if (!skip.requested && !world.calm) {
    pl.goTo(0, doorZ, false, () => (done = true));
    while (!done && !skip.requested) {
      onStep(Math.min(1, (START.z - pl.z) / total));
      world.cam.follow(Math.PI, 0.05, 1.2);
      // Auf der Brücke kurz die Aussicht zeigen
      if (pl.z < BRIDGE.z1 && pl.z > BRIDGE.z0) world.cam.follow(Math.PI - 0.35, 0.05, 0.6);
      await wait(50);
    }
  }
  pl.stopPath();
  if (!skip.requested && !world.calm) {
    // Tür öffnet sich
    pl.place(0, doorZ, Math.PI);
    bus.emit('scene:door');
    const t0 = performance.now();
    while (performance.now() - t0 < 1100 && !skip.requested) {
      const u = (performance.now() - t0) / 1100;
      world.cafe.door.set(1 - Math.pow(1 - u, 3));
      await wait(30);
    }
    world.cafe.door.set(1);
    world.nav.setDoor(true);
    pl.walkDirect([[0, HALL.z1 - 0.1]]);
    await wait(900);
    await f.to(1, 450);
  } else {
    await f.to(1, 250);
  }
  world.cafe.door.set(1);
  world.nav.setDoor(true);
  pl.stopPath();
  pl.place(INSIDE.x, INSIDE.z, Math.PI);
  world.cam.snapBehind(Math.PI);
  world.cam.pitch = 0.3;
  world.cam.dist = 3.8;
  onStep(1);
  world.mode = 'free';
  world.input.enabled = true;
  await wait(250);
  await f.to(0, 700);
}
