# 茶馆 · Das Teehaus

Ein begehbares 3D-Teehaus in den Bergen. Du gehst als eigene Figur über die Brücke ins Café, triffst den alten Teemeister, Gäste beim Xiangqi, eine Dichterin, einen Händler, ein Kind mit Katze – und am Haupttisch Jackie Chan (成龙) und Yao Ming (姚明). Sprich sie an, wähle Fragen, sammle chinesische Wörter mit Pinyin und entdecke Fundstücke.

> **Fiktives Gespräch, basiert auf öffentlich bekannten Fakten. Keine echten Zitate. Nicht mit den dargestellten Personen verbunden.**
> Alle Fakten und Quellen stehen in [`FAKTEN.md`](./FAKTEN.md). Im Zweifel wurde etwas weggelassen.

Gebaut mit Vite, TypeScript, [three.js](https://threejs.org) und [postprocessing](https://github.com/pmndrs/postprocessing). Kein Server, keine API, keine Environment Variables: Alle Fragen und Antworten stehen in `src/content/dialogs.ts`.

## Schnellstart

Voraussetzung: Node.js ≥ 20.19.

```bash
cd teehaus
npm install
npm run dev        # http://localhost:5173
```

| Befehl                                        | Zweck                                                              |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                                 | Entwicklungsserver                                                 |
| `npm run build`                               | Typprüfung + Produktions-Build nach `dist/`                        |
| `npm run preview`                             | Build lokal ansehen (mit denselben Sicherheits-Headern wie Vercel) |
| `npm run typecheck` / `lint` / `format:check` | Qualitätsprüfungen                                                 |
| `npm run facts`                               | `FAKTEN.md` aus den Inhalten erzeugen; `check:content` prüft nur   |

Test-Adressen:

- `?q=0|1|2` erzwingt die Grafikqualität (niedrig bis hoch)
- `?galerie` zeigt alle Figuren nebeneinander (`&anim=walk|run|sit|wave…`, `&fig=jackie&nah=1&winkel=0.6`)
- `/lab/modelle/` ist das **Modell-Labor**: jedes Charaktermodell drehbar, mit Datei-, Skelett- und Animationsinfos und Knöpfen zum Abspielen der Animationen

## Bedienung

| Aktion                 | Maus / Touch                                 | Tastatur         |
| ---------------------- | -------------------------------------------- | ---------------- |
| Gehen / Laufen         | Boden anklicken bzw. Joystick                | WASD / Pfeile, ⇧ |
| Kamera drehen / zoomen | ziehen, Mausrad / zwei Finger                | –                |
| Ansprechen, benutzen   | Figur/Gegenstand antippen                    | E                |
| Winken                 | –                                            | G                |
| Antwort sofort zeigen  | Blase antippen                               | Leertaste        |
| Gespräch schließen     | ×                                            | Esc              |
| Ton                    | Lautsprecher-Knopf (Musik, Stimmen, Effekte) | M                |

## Qualitätsstufen

Hoch / Mittel / Niedrig unterscheiden sich in Pixeldichte, Schatten, Bloom/Tiefenunschärfe und Teich-Spiegelung. Standard ist **automatisch** (Desktop hoch, Mobilgeräte mittel, bei dauerhaft unter 40 fps eine Stufe tiefer). Fest einstellen über die Info-Seite (ⓘ) oder `?q=`. „Bewegung reduzieren“ im System schaltet den Ruhe-Modus ein.

## Auf Vercel veröffentlichen

1. Repository bei [vercel.com](https://vercel.com) importieren (**Add New → Project**).
2. **Root Directory** auf `teehaus` setzen. Preset **Vite**, Build `npm run build`, Output `dist`.
3. **Deploy** – keine Environment Variables nötig. Optional `VITE_SITE_URL` für eine eigene Domain (Canonical/Open Graph).

Oder per CLI: `npx vercel` (Vorschau) bzw. `npx vercel --prod`.

## Modelle, Quellen und Lizenzen

Alles außer den unten genannten Dateien entsteht im Code (Teehaus, Landschaft, Licht, Stickereimuster, Musik, Simlish-Stimmen).

| Was                                                               | Datei(en)                           | Quelle                                                                                         | Lizenz                                                        |
| ----------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Charaktermodelle (11 Figuren, gemeinsames Skelett mit 62 Knochen) | `public/charaktere/*.glb`           | [Quaternius – Ultimate Modular Men](https://quaternius.com)                                    | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| 24 Animationen (Idle, Walk, Run, Wave, Interact …)                | `public/charaktere/animationen.glb` | Quaternius – Ultimate Modular Men                                                              | CC0 1.0                                                       |
| Haare und Augenbrauen                                             | `public/charaktere/haare.glb`       | [Quaternius – Universal Base Characters](https://quaternius.itch.io/universal-base-characters) | CC0 1.0                                                       |
| three.js                                                          | npm                                 | three.js authors                                                                               | MIT                                                           |
| postprocessing                                                    | npm                                 | Raoul van Rüschen (pmndrs)                                                                     | Zlib                                                          |
| Noto Serif SC, Ma Shan Zheng (Subsets)                            | `public/fonts/`                     | Google Fonts                                                                                   | SIL OFL 1.1                                                   |

Details zur Bearbeitung (Komprimierung mit Meshopt, Texturen als WebP) stehen in [`public/charaktere/LICENSE.md`](./public/charaktere/LICENSE.md); die Originale liegen in `assets-src/charaktere/` und werden nicht ausgeliefert. Im Spiel stehen alle Angaben unter ⓘ → Credits.

Modelle neu erzeugen: siehe Kopfkommentare in `scripts/models/pack-hair.mjs` und `scripts/models/split-men.mjs`.

## Inhalte ändern

Alles liegt getrennt vom Code in `src/content/`:

- `dialogs.ts`: alle Fragen und Antworten (Jackie, Yao), Zwischenrufe, Charakterkarten, Sprüche der Gäste
- `words.ts`: Lernwörter (Zeichen, Pinyin mit Tonziffern, Deutsch)
- `credits.ts`: Fremdinhalte und Lizenzen

Danach `npm run facts` ausführen. **Regel:** nur belegbare öffentliche Fakten, keine erfundenen Zitate, nichts zu Privatleben, Gesundheit, Skandalen oder Politik; im Zweifel weglassen.

## Aufbau

```
src/world/        Spielwelt: world (Renderer, Licht, Schleife, Qualität), layout, nav (Kollision, A*), cafe,
                  character + looks (Figuren), agent (Bewegung), camera, input, npcs, heroes, finds, intro
src/three/        Landschaft, Effekte (Lichtstrahlen, Dampf, Blüten), Materialien
src/audio/        Web-Audio: Musik (Pentatonik), Ambiente, Effekte, Simlish-Stimmen mit Raumklang
src/ui/           Sprechblasen, Gesprächsfenster, Lernkarte, Wörterbuch, Info, Ton-Panel, HUD
src/content/      Dialoge, Wörter, Credits
src/lab/          Modell-Labor (/lab/modelle/)
public/charaktere Komprimierte Modelle + LICENSE.md
assets-src/       Original-Modellpakete (nicht ausgeliefert)
scripts/          Fakten-Generator, Schrift-Subset, Icons, Modell-Werkzeuge
```

## Datenschutz

Keine Cookies, kein Tracking, keine Anfragen an fremde Server. Spielstand und Einstellungen liegen nur im `localStorage` des Browsers.
