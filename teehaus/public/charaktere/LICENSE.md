# Charakter-Modelle – Quelle und Lizenz

## haare.glb

| | |
|---|---|
| **Paket** | Universal Base Characters (Standard) |
| **Autor** | Quaternius |
| **Quelle** | https://quaternius.itch.io/universal-base-characters |
| **Lizenz** | CC0 1.0 Universal (Public Domain Dedication) – https://creativecommons.org/publicdomain/zero/1.0/ |

Enthaltene Teile (je ein eigener Knoten in `haare.glb`):
`Eyebrows_Female`, `Eyebrows_Regular`, `Hair_Beard`, `Hair_Buns`, `Hair_Buzzed`,
`Hair_BuzzedFemale`, `Hair_Long`, `Hair_SimpleParted`.

CC0 verlangt keine Namensnennung. Wir nennen Quaternius trotzdem gern in den Credits.

### Bearbeitung für dieses Projekt

- Ausgangsdateien: Ordner `glTF (Godot)` aus dem Paket (Originale liegen unverändert in
  `teehaus/assets-src/charaktere/` und werden nicht mit ausgeliefert)
- alle Teile in eine Datei zusammengeführt, einheitlich in Metern
- Geometrie quantisiert und mit **Meshopt** komprimiert (`EXT_meshopt_compression`)
- Texturen von 2048 px PNG auf 1024 px **WebP** verkleinert (`EXT_texture_webp`)
- Größe: rund 47 MB (alle Formate) bzw. 15 MB (glTF-Godot) → 0,43 MB

## Figuren und Animationen

| | |
|---|---|
| **Paket** | Ultimate Modular Men |
| **Autor** | Quaternius (https://quaternius.com, https://www.patreon.com/quaternius) |
| **Lizenz** | CC0 1.0 Universal (Public Domain Dedication), laut `License.txt` im Paket |

Dateien:

| Datei | Inhalt |
|---|---|
| `adventurer.glb`, `beach.glb`, `casual.glb`, `casual2.glb`, `farmer.glb`, `king.glb`, `punk.glb`, `spacesuit.glb`, `suit.glb`, `swat.glb`, `worker.glb` | je eine Figur (Kopf, Körper, Beine, Füße) mit dem gemeinsamen Skelett `CharacterArmature` (62 Knochen), ohne Animationen |
| `animationen.glb` | nur Skelett + 24 Animationen (Death, Gun_Shoot, HitRecieve, HitRecieve_2, Idle, Idle_Gun, Idle_Gun_Pointing, Idle_Gun_Shoot, Idle_Neutral, Idle_Sword, Interact, Kick_Left, Kick_Right, Punch_Left, Punch_Right, Roll, Run, Run_Back, Run_Left, Run_Right, Run_Shoot, Sword_Slash, Walk, Wave); passen auf alle Figuren |

### Bearbeitung für dieses Projekt

- Ausgangsdatei: `All together/FBX/Humans_Master.fbx` (alle Teile + Animationen auf einem Skelett), mit FBX2glTF nach glTF umgewandelt
- je Figur eine eigene Datei; Pferdekopf, Rucksack und Waffen nicht übernommen
- Geometrie quantisiert und mit **Meshopt** komprimiert, Animationen neu abgetastet und komprimiert
- Größe: Originalpaket ~125 MB (FBX/Blend), Ausgabe je Figur 0,46–0,56 MB, Animationen 0,34 MB
- Die Varianten „Humanoid Rig“ (anderes Skelett, ohne Animationen) und die Einzelteile liegen unverändert in `teehaus/assets-src/charaktere/`
