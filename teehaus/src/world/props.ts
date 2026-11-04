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

/** Beidseitig sichtbares Material (eigener Cache-Schlüssel, damit geteilte Materialien unverändert bleiben) */
const twoSided = (c: string): Material => {
  const m = vinyl(c, { rough: 1, key: `zweiseitig-${c}` });
  m.side = DoubleSide;
  return m;
};

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
    case 'broom': {
      // Reisigbesen: Stiel durch die Hand, Besen unten
      const g = new Group();
      const stick = mk(new CylinderGeometry(0.014, 0.016, 1.35, 5), vinyl('#8a6a42', { rough: 0.8 }));
      stick.position.y = -0.25;
      const twigs = mk(new ConeGeometry(0.13, 0.42, 7, 1, true), twoSided('#b89a5c'));
      twigs.position.y = -0.98;
      g.add(stick, twigs);
      return g;
    }
    case 'hammer': {
      const g = new Group();
      const h = mk(new CylinderGeometry(0.014, 0.016, 0.34, 5), vinyl('#7a5a3a', { rough: 0.8 }));
      h.position.y = 0.1;
      const head = mk(
        new CylinderGeometry(0.03, 0.03, 0.12, 8),
        vinyl('#4a4a50', { rough: 0.4, metal: 0.6 }),
      );
      head.position.y = 0.26;
      head.rotation.z = Math.PI / 2;
      g.add(h, head);
      return g;
    }
    case 'axe': {
      const g = new Group();
      const h = mk(new CylinderGeometry(0.016, 0.018, 0.62, 5), vinyl('#8a6a42', { rough: 0.8 }));
      h.position.y = 0.2;
      const blade = mk(new ConeGeometry(0.07, 0.16, 3), vinyl('#5a5a62', { rough: 0.35, metal: 0.6 }));
      blade.position.set(0.06, 0.46, 0);
      blade.rotation.z = -Math.PI / 2;
      blade.scale.set(1, 1, 0.25);
      g.add(h, blade);
      return g;
    }
    case 'pole': {
      // Tragestange über den Schultern mit zwei Eimern (Wasserträger)
      const g = new Group();
      const wood = vinyl('#9a7a4a', { rough: 0.8 });
      const pole = mk(new CylinderGeometry(0.02, 0.02, 1.7, 6), wood);
      pole.rotation.z = Math.PI / 2;
      g.add(pole);
      for (const x of [-0.78, 0.78]) {
        const rope = mk(new CylinderGeometry(0.004, 0.004, 0.5, 3), vinyl('#c8b48a'));
        rope.position.set(x, -0.25, 0);
        const bucket = mk(new CylinderGeometry(0.13, 0.11, 0.24, 10), wood, true);
        bucket.position.set(x, -0.6, 0);
        const water = mk(new CircleGeometry(0.12, 10), vinyl('#5c8a92', { rough: 0.1 }));
        water.rotation.x = -Math.PI / 2;
        water.position.set(x, -0.49, 0);
        g.add(rope, bucket, water);
      }
      return g;
    }
    case 'erhu': {
      // Zweisaitige Kniegeige: Hals senkrecht, Resonanzkörper unten
      const g = new Group();
      const neck = mk(new CylinderGeometry(0.008, 0.01, 0.8, 5), vinyl('#3a2218', { rough: 0.5 }));
      neck.position.y = 0.15;
      const body = mk(new CylinderGeometry(0.045, 0.045, 0.12, 8), vinyl('#5a2a1a', { rough: 0.4 }));
      body.position.y = -0.24;
      body.rotation.x = Math.PI / 2;
      const head = mk(new SphereGeometry(0.02, 6, 4), vinyl('#c9a227', { rough: 0.4, metal: 0.4 }));
      head.position.y = 0.56;
      g.add(neck, body, head);
      return g;
    }
    case 'spool': {
      // Garnrolle der Drachenschnur
      const m = mk(new CylinderGeometry(0.035, 0.035, 0.09, 8), vinyl('#c8a46a', { rough: 0.8 }));
      m.rotation.z = Math.PI / 2;
      const g = new Group();
      g.add(m);
      return g;
    }
    case 'basket': {
      // Henkelkorb (Einkauf)
      const g = new Group();
      const b = mk(new CylinderGeometry(0.15, 0.11, 0.16, 10, 1, true), twoSided('#b89a5c'));
      b.position.y = -0.22;
      const handle = mk(new CylinderGeometry(0.006, 0.006, 0.3, 3), vinyl('#8a6a42'));
      handle.position.y = -0.06;
      const veg = mk(new SphereGeometry(0.07, 6, 4), vinyl('#6f9a3c', { rough: 0.7 }));
      veg.position.y = -0.16;
      g.add(b, handle, veg);
      return g;
    }
  }
}
