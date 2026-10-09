// Entwicklungsansicht (?galerie): alle Figuren nebeneinander auf der Terrasse, zum Prüfen von Proportionen,
// Gesichtern und Animationen. Im normalen Spiel wird diese Datei nicht geladen.
import { Vector3 } from 'three';
import type { World } from './world';
import { makeFigure } from './figure';
import type { Figure } from './figure';
import type { Action } from './character';
import { GUEST_LOOKS, JACKIE_LOOK, MASTER_LOOK, PLAYER_LOOKS, YAO_LOOK } from './looks';
import { FLOOR } from './layout';

export function gallery(world: World, action: string | null, view: 'front' | 'side' | 'close'): Figure[] {
  const looks = [YAO_LOOK, JACKIE_LOOK, MASTER_LOOK, ...Object.values(GUEST_LOOKS), ...PLAYER_LOOKS];
  const chars: Figure[] = [];
  const gap = 0.9;
  const x0 = -((looks.length - 1) * gap) / 2;
  looks.forEach((l, i) => {
    const c = makeFigure(l);
    c.root.position.set(x0 + i * gap, FLOOR, 5.2);
    c.root.rotation.y = view === 'side' ? Math.PI / 2 : 0;
    world.scene.add(c.root);
    chars.push(c);
    if (action === 'walk') c.speed = 1.4;
    else if (action === 'run') c.speed = 3.6;
    else if (action === 'sit') c.sitDown(0.46);
    else if (action) c.hold(action as Action);
  });
  world.player.ch.root.visible = false;
  world.mode = 'cutscene';
  // Porträt einer Figur: ?galerie&ansicht=portrait&fig=jackie&winkel=0.6
  const params = new URLSearchParams(location.search);
  const fig = params.get('fig');
  if (fig) {
    const i = looks.findIndex((l) => l.id === fig);
    const c = chars[i];
    if (c) {
      const ang = Number(params.get('winkel') ?? 0);
      for (const o of chars) o.root.visible = o === c;
      c.root.position.set(0, FLOOR, 5.2);
      c.root.updateMatrixWorld(true);
      const head = c.headWorld();
      const dist = params.get('nah') ? c.H * 0.32 : c.H * 1.25;
      const ly = params.get('nah') ? head.y : FLOOR + c.H * 0.55;
      world.cam.setShot(
        {
          pos: new Vector3(
            Math.sin(ang) * dist,
            ly + (params.get('nah') ? 0.02 : 0.1),
            5.2 + Math.cos(ang) * dist,
          ),
          look: new Vector3(0, ly, 5.2),
        },
        0.01,
      );
      world.tickers.push((dt) => c.update(dt));
      return chars;
    }
  }
  const look =
    view === 'close' ? new Vector3(x0 + gap * 0.5, FLOOR + 1.6, 5.2) : new Vector3(0, FLOOR + 1.1, 5.2);
  const pos =
    view === 'close' ? new Vector3(x0 + gap * 0.5, FLOOR + 1.75, 7.6) : new Vector3(0, FLOOR + 1.5, 13.5);
  world.cam.setShot({ pos, look }, 0.01);
  world.tickers.push((dt) => {
    for (const c of chars) c.update(dt);
  });
  return chars;
}
