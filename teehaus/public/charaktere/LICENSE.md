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
