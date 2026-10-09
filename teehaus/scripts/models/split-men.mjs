// Quaternius Ultimate Modular Men: Humans_Master.glb in Figuren + animationen.glb teilen und komprimieren.
// 1) FBX -> GLB: npx fbx2gltf --binary --input "assets-src/charaktere/All together/FBX/Humans_Master.fbx" --output /tmp/Humans_Master
// 2) node scripts/models/split-men.mjs /tmp/Humans_Master.glb public/charaktere
// Benötigt (nicht im Projekt installiert): npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer
// Humans_Master.glb (alle Teile + 24 Animationen, gemeinsames Skelett) in einzelne Figuren + Animationsdatei teilen
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, quantize, meshopt, resample, getBounds } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import fs from 'fs';
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const [src, outDir] = process.argv.slice(2);
const chars = { Adventurer: ['Adventurer_'], Beach: ['Beach_'], Casual: ['Casual_'], Casual2: ['Casual2_'], Farmer: ['Farmer_'], King: ['King_'], Punk: ['Punk_'], SpaceSuit: ['SpaceSuit_'], Suit: ['Suit_'], Swat: ['Swat_'], Worker: ['Worker_'] };
const compress = [dedup(), prune({ keepLeaves: true }), weld(), quantize({ quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' })];
for (const [name, prefixes] of Object.entries(chars)) {
  const d = await io.read(src);
  const r = d.getRoot();
  for (const a of r.listAnimations()) a.dispose();
  for (const n of r.listNodes()) if (n.getMesh() && !prefixes.some((p) => n.getName().startsWith(p))) { n.getMesh().dispose(); n.dispose(); }
  await d.transform(...compress);
  const out = `${outDir}/${name.toLowerCase()}.glb`;
  await io.write(out, d);
  const b = getBounds(r.listScenes()[0]);
  console.log(name, fs.statSync(out).size, 'h', (b.max[1] - b.min[1]).toFixed(2), r.listMeshes().map((m) => m.getName()).join(','));
}
{
  const d = await io.read(src);
  const r = d.getRoot();
  for (const n of r.listNodes()) if (n.getMesh()) { n.getMesh().dispose(); n.dispose(); }
  for (const s of r.listSkins()) s.dispose();
  for (const a of r.listAnimations()) a.setName(a.getName().replace('CharacterArmature|', ''));
  await d.transform(resample(), prune({ keepLeaves: true }), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = `${outDir}/animationen.glb`;
  await io.write(out, d);
  console.log('animationen', fs.statSync(out).size, r.listAnimations().map((a) => a.getName()).join(','));
}
