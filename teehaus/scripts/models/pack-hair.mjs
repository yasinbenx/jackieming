// Haare (Universal Base Characters, glTF Godot) zu public/charaktere/haare.glb packen.
// Aufruf: node scripts/models/pack-hair.mjs "assets-src/charaktere/glTF (Godot)" public/charaktere/haare.glb
// Benötigt (nicht im Projekt installiert): npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition, dedup, prune, weld, quantize, meshopt, textureCompress, flatten, getBounds, transformMesh, resample } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
const [src, out] = process.argv.slice(2);
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const files = fs.readdirSync(src).filter((f) => f.endsWith('.gltf')).sort();
const docs = [];
for (const f of files) {
  const d = await io.read(path.join(src, f));
  const name = f.replace('.gltf', '');
  const scene = d.getRoot().listScenes()[0];
  await d.transform(flatten());
  // Einheitlich Meter: einige Dateien sind in Zentimetern exportiert
  const b = getBounds(scene);
  const size = Math.max(...b.max.map((v, i) => v - b.min[i]));
  const s = size > 5 ? 0.01 : 1;
  for (const n of d.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m) continue;
    const mat = n.getWorldMatrix().map((v) => v * s); mat[15] = 1;
    transformMesh(m, mat);
    n.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    n.setName(name); m.setName(name);
  }
  docs.push([name, d, size, s]);
}
const base = docs[0][1];
for (const [, d] of docs.slice(1)) mergeDocuments(base, d);
// alle Szenen-Wurzeln in eine Szene
const root = base.getRoot();
const scenes = root.listScenes();
for (const sc of scenes.slice(1)) { for (const c of sc.listChildren()) scenes[0].addChild(c); sc.dispose(); }
await base.transform(
  unpartition(), dedup(), prune(), weld(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
  quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(out, base);
for (const [n, , size, s] of docs) console.log(n, 'orig size', size.toFixed(3), s === 1 ? 'm' : 'cm→m');
const sc = base.getRoot().listScenes()[0];
for (const n of sc.listChildren()) { const bb = getBounds(n); console.log(' ', n.getName(), bb.min.map((v) => v.toFixed(3)).join(','), '→', bb.max.map((v) => v.toFixed(3)).join(',')); }
console.log('bytes', fs.statSync(out).size);
