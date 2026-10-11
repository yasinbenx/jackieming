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
- `/lab/figuren/` ist das **Figuren-Labor**: jede Rolle im Vorher-Nachher-Vergleich und alle Figuren nebeneinander, mit Stehen, Gehen, Laufen, Sitzen, Winken, Trinken, Sprechen und Verbeugen
- `/lab/musik/` stellt die Musikvarianten zum Probehören nebeneinander

## Bedienung

| Aktion                  | Maus / Touch                                 | Tastatur         |
| ----------------------- | -------------------------------------------- | ---------------- |
| Gehen / Laufen          | Boden anklicken bzw. Joystick                | WASD / Pfeile, ⇧ |
| Kamera drehen / zoomen  | ziehen, Mausrad / zwei Finger                | –                |
| Ansprechen, benutzen    | Figur/Gegenstand antippen                    | E                |
| Weg zum Platz abbrechen | „Abbrechen“                                  | Esc              |
| Winken                  | –                                            | G                |
| Antwort sofort zeigen   | Blase antippen                               | Leertaste        |
| Gespräch schließen      | ×                                            | Esc              |
| Ton                     | Lautsprecher-Knopf (Musik, Stimmen, Effekte) | M                |

## Figuren und Animation

- **Skelett und Bewegungen:** Quaternius „Ultimate Modular Men“ (CC0) liefert Skelett (62 Knochen), 24 Animationen und die Hände. Körper und Kleidung entstehen im Code (`src/world/tailor.ts`, `src/world/rigchar.ts`): weiche Röhren entlang der Knochen, direkt an das Skelett „genäht“. Weil die Kleidung zugleich die Körperform ist, liegt nichts darunter, was durchstechen könnte.
- **Kleidung wie im Teehaus:** Tang-Anzug mit Knotenknöpfen (盘扣), Changshan, Hanfu-Jacke mit Überlappkragen, Westen, Schürze, weite Hosen, Stoffschuhe, Gürtel mit Quasten; Stickerei (Drachen, Wolken) und Stofffalten als Textur und Normal-Map. Keine moderne Kleidung, Turnschuhe nur bei Yaos Basketball-Look.
- **Teile-Baukasten:** Körper, Kopf, Frisur, Hut und Kleidung sind austauschbare Teile auf demselben Skelett (`src/world/looks.ts`, Feld `dress`). Frisuren: kurz, Dutt, Zopf, grau, Glatze mit Bart, Kinderzöpfchen, Reishut, Gelehrtenkappe.
- **Gesichter** sind generisch und stilisiert (Mandelaugen, weiche Nase, klare Brauen und Mund), verschieden in Hautton und Alter. Keine Gesichtsähnlichkeit zu realen Personen: Jackie Chan und Yao Ming werden nur über Kontext erkennbar (Größe, Statur, Kleidung, Basketball, Namensschild, Charakterkarte).
- **Rollen:** Spielfigur in vier Outfits, Teemeister (alt, grauer Bart, Schürze), Brettspieler, Dichterin, Händler mit Fächer, Kind, Reisender mit Hut, Besucherin, Gast auf der Terrasse, Katze; Yao groß im roten Drachenmantel mit Basketball, Jackie kleiner in dunkler Jacke mit Goldstickerei.
- **Bewegung:** Idle/Gehen/Laufen nach Geschwindigkeit gemischt, Tempo aus der gemessenen Bodengeschwindigkeit (kaum Fußrutschen), Kurvenneigung, Fuß-IK auf Stufen und Brücke.
- **Sitzen:** feste Plätze je Tisch (Position und Blickrichtung). Becken auf der Sitzfläche, Füße auf dem Boden, Hände auf den Knien oder am Tisch.
- **Gespräch:** „Ansprechen“ lässt die Spielfigur zum freien Hocker direkt neben Jackie und Yao gehen, sich setzen und zur Person drehen; erst dann fährt die Kamera in die Zweier-Einstellung. Esc bricht den Weg ab; ist kein Platz frei oder kein Weg da, beginnt das Gespräch im Stehen. Am Ende steht die Figur wieder auf. An Gäste-Tischen kann man sich ebenfalls dazusetzen.
- **Gesprächsansicht:** Fragen und Charakterkarte in einer schmalen Leiste rechts (höchstens ein Drittel des Bildes; auf dem Telefon ein niedriges Blatt unten), Steckbrief aufklappbar. Sprechblasen verschiedener Sprecher weichen einander aus.
- **Lebendigkeit:** zwei Idle-Varianten, Atmen, Blinzeln, Mund zu Sprechblasen und Simlish, Sprechgesten, Zuhören mit Nicken, nachschwingende Quasten und Haare; Alltag mit Trinken, Einschenken, Polieren, Schreiben, Fächeln, Brettspielzügen, Verbeugen, Winken, Streicheln.
- **Kamera:** über die Schulter; verdeckende Figuren werden durchscheinend; Tiefenschärfe auf dem Blickpunkt; Kontaktschatten.
- Rückfall: Fehlen die Modelle, erscheinen die gezeichneten Figuren (`?gezeichnet` erzwingt das zum Vergleich).

## Startbild

Nur der Pinselschriftzug 茶馆, Pinyin _cháguǎn_, „Das Teehaus“ und der Knopf „进 Eintreten“ vor einem gemalten Teehaus in nebligen Bergen (SVG mit ziehendem Nebel, schwingender Laterne und fallenden Blüten; bei „Bewegung reduzieren“ ruhig). Der Hinweis steht klein unten und auf der Info-Seite. Das Vorschaubild `public/og.png` wird mit `node scripts/make-og.mjs <url>` aus dem Startbild erzeugt.

## Qualitätsstufen

Hoch / Mittel / Niedrig unterscheiden sich in Pixeldichte, Schatten, Bloom/Tiefenunschärfe und Teich-Spiegelung. Figuren weiter als 11 m entfernt sparen Feinbewegung (Fuß-IK, Nachschwingen, Animation nur jedes zweite Bild). Standard ist **automatisch** (Desktop hoch, Mobilgeräte mittel, bei dauerhaft unter 40 fps eine Stufe tiefer). Fest einstellen über die Info-Seite (ⓘ) oder `?q=`. „Bewegung reduzieren“ im System schaltet den Ruhe-Modus ein.

## Auf Vercel veröffentlichen

1. Repository bei [vercel.com](https://vercel.com) importieren (**Add New → Project**).
2. **Root Directory** auf `teehaus` setzen. Preset **Vite**, Build `npm run build`, Output `dist`.
3. **Deploy** – keine Environment Variables nötig. Optional `VITE_SITE_URL` für eine eigene Domain (Canonical/Open Graph).

Oder per CLI: `npx vercel` (Vorschau) bzw. `npx vercel --prod`.

## Modelle, Quellen und Lizenzen

Alles außer den unten genannten Dateien entsteht im Code (Teehaus, Landschaft, Licht, Stickereimuster, Musik, Simlish-Stimmen).

| Was                                                                  | Datei(en)                           | Quelle                                                                                         | Lizenz                                                        |
| -------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Skelett, Hände, Charaktermodelle (für Vorher-Vergleich und Rückfall) | `public/charaktere/*.glb`           | [Quaternius – Ultimate Modular Men](https://quaternius.com)                                    | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| 24 Animationen (Idle, Walk, Run, Wave, Interact …)                   | `public/charaktere/animationen.glb` | Quaternius – Ultimate Modular Men                                                              | CC0 1.0                                                       |
| Haare und Augenbrauen                                                | `public/charaktere/haare.glb`       | [Quaternius – Universal Base Characters](https://quaternius.itch.io/universal-base-characters) | CC0 1.0                                                       |
| three.js                                                             | npm                                 | three.js authors                                                                               | MIT                                                           |
| postprocessing                                                       | npm                                 | Raoul van Rüschen (pmndrs)                                                                     | Zlib                                                          |
| Noto Serif SC, Ma Shan Zheng (Subsets)                               | `public/fonts/`                     | Google Fonts                                                                                   | SIL OFL 1.1                                                   |

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
src/lab/          Labore: Modelle, Figuren, Musik (/lab/…)
public/charaktere Komprimierte Modelle + LICENSE.md
assets-src/       Original-Modellpakete (nicht ausgeliefert)
scripts/          Fakten-Generator, Schrift-Subset, Icons, Modell-Werkzeuge
```

## Datenschutz

Keine Cookies, kein Tracking, keine Anfragen an fremde Server. Spielstand und Einstellungen liegen nur im `localStorage` des Browsers.
