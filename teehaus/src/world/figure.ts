// Fabrik für Figuren: Rig-Figur (Quaternius-Skelett mit Animationen), wenn die Modelle geladen sind und das
// Aussehen eine Rig-Beschreibung hat; sonst die gezeichnete Figur als Rückfallebene.
import { Character } from './character';
import type { Look } from './character';
import { RigCharacter } from './rigchar';
import { rigAssets } from './rig';

export type Figure = Character | RigCharacter;

export function makeFigure(look: Look): Figure {
  if (look.rig && rigAssets() && !new URLSearchParams(location.search).has('gezeichnet'))
    return new RigCharacter(look);
  return new Character(look);
}
