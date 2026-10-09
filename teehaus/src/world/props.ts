// Requisiten, die Figuren in der Hand halten (Fächer, Pinsel, Teekanne, Tasse, Schale) oder unter dem Arm tragen
// (Basketball). Gemeinsam für die gezeichneten Figuren und die Rig-Figuren. Ursprung = Griffpunkt in der Hand,
// +y zeigt vom Griff weg nach oben (bei aufrecht gehaltener Hand).
import {
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  SphereGeometry,
  Vector2,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import { ballTexture, vinyl } from './materials';
import type { Prop } from './character';

const mk = (geo: BufferGeometry, mat: Material, shadow = false): Mesh => {
  const m = new Mesh(geo, mat);
  m.castShadow = shadow;
  return m;
};

/** Baut ein Requisit. s = Figurenmaßstab (Größe / 1,75 m). */
export function makeProp(p: Exclude<Prop, null>, s: number): Mesh | Group {
  switch (p) {
    case 'ball':
      return mk(new SphereGeometry(0.12, 18, 12), vinyl('#ffffff', { rough: 0.6, map: ballTexture() }), true);
    case 'fan': {
      const g = new Group();
      const paper = vinyl('#e9d9b0', { rough: 0.8 });
      paper.side = DoubleSide;
      const leaf = mk(new CircleGeometry(0.16 * s, 16, 0, Math.PI), paper);
      leaf.rotation.set(0, Math.PI / 2, -Math.PI / 2);
      g.add(leaf);
      const redMat = vinyl('#b3261a', { rough: 0.8 });
      redMat.side = DoubleSide;
      const red = mk(new CircleGeometry(0.07 * s, 12, 0, Math.PI), redMat);
      red.rotation.copy(leaf.rotation);
      red.position.x = 0.002;
      g.add(red);
      return g;
    }
    case 'brush': {
      const g = new Group();
      const stick = mk(new CylinderGeometry(0.008, 0.008, 0.2 * s, 6), vinyl('#6a3a1a'));
      stick.position.y = 0.04 * s;
      g.add(stick);
      const tip = mk(new ConeGeometry(0.014, 0.05, 6), vinyl('#1c130e'));
      tip.rotation.x = Math.PI;
      tip.position.y = -0.08 * s;
      g.add(tip);
      return g;
    }
    case 'teapot': {
      const pts = [0, 0.2, 0.45, 0.7, 0.9, 1].map(
        (t) => new Vector2(0.02 + Math.sin(t * Math.PI * 0.95) * 0.07, t * 0.11),
      );
      const g = new Group();
      const body = mk(new LatheGeometry(pts, 14), vinyl('#7a3a22', { rough: 0.4 }));
      body.position.y = -0.1;
      g.add(body);
      const spout = mk(new CylinderGeometry(0.008, 0.014, 0.08, 6), vinyl('#7a3a22', { rough: 0.4 }));
      spout.position.set(0, -0.06, 0.08);
      spout.rotation.x = 0.9;
      g.add(spout);
      return g;
    }
    case 'cup': {
      const pts = [
        new Vector2(0.0001, 0),
        new Vector2(0.025, 0),
        new Vector2(0.036, 0.045),
        new Vector2(0.032, 0.045),
      ];
      const m = mk(new LatheGeometry(pts, 12), vinyl('#ece6d6', { rough: 0.25 }));
      m.position.y = -0.02;
      const g = new Group();
      g.add(m);
      return g;
    }
    case 'bowl': {
      const pts = [
        new Vector2(0.0001, 0),
        new Vector2(0.03, 0),
        new Vector2(0.05, 0.035),
        new Vector2(0.047, 0.036),
      ];
      const m = mk(new LatheGeometry(pts, 12), vinyl('#dfe6e2', { rough: 0.25 }));
      m.position.y = -0.02;
      const g = new Group();
      g.add(m);
      return g;
    }
  }
}
