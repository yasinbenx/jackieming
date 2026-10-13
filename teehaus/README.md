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
| `npm test`                                    | Unit-Tests (Wegfindung, Platzwahl, Sprechblasen)                   |
| `node scripts/test/rundgang.mjs`              | Rundgang im Browser mit Prüfwerten (siehe Kopf der Datei)          |

Test-Adressen:

- `?q=0|1|2` erzwingt die Grafikqualität (niedrig bis hoch)
- `?galerie` zeigt alle Figuren nebeneinander (`&anim=walk|run|sit|wave…`, `&fig=jackie&nah=1&winkel=0.6`)
- `/lab/modelle/` ist das **Modell-Labor**: jedes Charaktermodell drehbar, mit Datei-, Skelett- und Animationsinfos und Knöpfen zum Abspielen der Animationen
- `/lab/figuren/` ist das **Figuren-Labor**: jede Rolle im Vorher-Nachher-Vergleich und alle Figuren nebeneinander, mit Stehen, Gehen, Laufen, Sitzen, Winken, Trinken, Sprechen und Verbeugen
- `/lab/musik/` stellt die Musikvarianten zum Probehören nebeneinander

Fehler und ihr Stand stehen in [`BUGS.md`](./BUGS.md).

## Bedienung

| Aktion                  | Maus / Touch                                 | Tastatur (Standard, umlegbar) |
| ----------------------- | -------------------------------------------- | ----------------------------- |
| Gehen / Laufen          | Boden anklicken bzw. Joystick                | WASD / Pfeile, Umschalt       |
| Kamera drehen / zoomen  | ziehen, Mausrad / zwei Finger                | –                             |
| Ansprechen, benutzen    | Figur/Gegenstand antippen                    | E                             |
| Weg zum Platz abbrechen | „Abbrechen“                                  | Esc                           |
| Winken                  | –                                            | G                             |
| Antwort sofort zeigen   | Blase antippen                               | Leertaste                     |
| Gespräch schließen      | ×                                            | Esc                           |
| Pause                   | ☰ oben rechts                               | Esc oder P                    |
| Ton an/aus              | Lautsprecher-Knopf (Musik, Stimmen, Effekte) | T                             |
| Karte                   | –                                            | M (kommt mit der Welt)        |

## Menü, Spielstand und Einstellungen

- **Hauptmenü** über der echten 3D-Szene (das Teehaus von der anderen Teichseite): Weiter, Neues Spiel, Einstellungen, Credits, Info und Hinweis. „Neues Spiel“ fragt nach, wenn schon ein Spielstand da ist.
- **Spielstand** wird automatisch gespeichert (gebündelt, alle paar Sekunden und beim Verlassen der Seite) in `localStorage` unter `teehaus.save` mit Versionsnummer: gestellte Fragen, Wörter, Quiz, Outfit, Tageszeit, Position, entdeckte Orte, Aufgaben, Münzen, Spielergebnisse, Tutorial. Einstellungen liegen getrennt unter `teehaus.settings`. Der alte Stand (`teehaus.v1`) wird beim ersten Start übernommen. Ist ein Spielstand unlesbar, wird er unter `teehaus.save.backup` gesichert und ein neues Spiel begonnen (Hinweis im Menü). Format und Umzug: `src/state/savefile.ts` (getestet).
- **Pausemenü** (Esc, P oder ☰): Weiter, Einstellungen, Hilfe, Zurück zum Hauptmenü. Esc schließt immer zuerst das oberste Fenster.
- **Einstellungen:** Musik, Stimmen, Effekte getrennt; Grafikqualität (Automatisch, Hoch, Mittel, Niedrig); Kamerageschwindigkeit; Tastenbelegung (belegte Tasten werden getauscht, Esc und Pfeile bleiben fest); Pinyin an/aus; Schriftgröße; hoher Kontrast; weniger Bewegung; Untertitel fürs Gemurmel. „Einstellungen zurücksetzen“ und „Fortschritt zurücksetzen“ jeweils mit Sicherheitsabfrage.
- **Tutorial** beim ersten Spiel: Gehen, Umsehen, Ansprechen, Hinsetzen. Jede Einblendung erledigt sich, sobald man es getan hat; überspringbar, in der Hilfe wiederholbar.

## Tee-Mini-Spiel (泡茶 pào chá)

An der Theke (links, beim Ofen) „Tee zubereiten“ wählen. Der Teemeister kommt herüber und bestellt auf Chinesisch, dann vier Schritte in der Leiste rechts:

1. **Teesorte wählen** (选茶): Die Bestellung steht nur auf Chinesisch mit Pinyin da, z. B. 请来一杯绿茶 (qǐng lái yì bēi lǜchá). Fünf Dosen: 绿茶 Grüntee, 红茶 Schwarztee, 茉莉花茶 Jasmintee, 乌龙茶 Oolong, 白茶 Weißtee. Eine falsche Dose zeigt ihren deutschen Namen.
2. **Wasser erhitzen** (烧水): Knopf oder Leertaste halten; das Wasser kühlt langsam wieder ab. Der grüne Bereich am Thermometer ist die passende Temperatur (Grüntee 75–85 °C, Schwarztee 90–100 °C …). Dazu die Wasserstufen 凉水, 温水, 热水, 开水.
3. **Ziehen lassen** (泡茶): Die Tasse färbt sich, im grünen Zeitfenster abgießen (Leertaste). Eine Minute dauert im Spiel drei Sekunden.
4. **Servieren** (上茶): die passende Wendung wählen, 请喝茶 qǐng hē chá.

Der Teemeister bewertet mit 1 bis 3 Teeblättern und sagt bei jedem Schritt, was gut war oder warum nicht (zum Beispiel „Zu heißes Wasser macht Grüntee bitter“). Es gibt 5 Münzen je Blatt (oben links neben den Fragen). Neue Lernwörter: die fünf Teesorten, 水, 开水, 请喝茶. Tastatur: 1–5 wählen, Leertaste erhitzen bzw. abgießen, Eingabe weiter, Esc bricht ab. Daten: `src/content/teas.ts`, Regeln: `src/minigames/tea.ts` (getestet). Temperaturen und Ziehzeiten sind übliche Richtwerte für Blatttee in der Kanne.

## Aufgaben vom Teemeister (任务 rènwu)

Hat der Teemeister eine Aufgabe, erscheint ein **!** über ihm; ansprechen, Aufgabe ansehen, „Annehmen“. Oben links steht dann der nächste Schritt; ein **?** über dem Meister heißt: abgeben.

| Aufgabe                     | Was zu tun ist                                                              | Belohnung                                                         |
| --------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 送茶 Tee bringen            | Tasse an der Theke nehmen, der Dichterin am Fenster bringen                 | 10 Münzen, Reishut 斗笠, Wort 送                                  |
| 找猫 Katze finden           | Die Katze versteckt sich (Terrasse, Ecken der Halle); finden und streicheln | 10 Münzen, Zopf und Haarknoten, Wort 找                           |
| 认识客人 Gäste kennenlernen | Mit drei verschiedenen Gästen sprechen                                      | 15 Münzen, Outfit „Seidenjacke“, Wort 朋友                        |
| 好茶 Ein meisterlicher Tee  | Im Tee-Mini-Spiel 3 Teeblätter schaffen                                     | 20 Münzen, „Gelehrtengewand“ und Gelehrtenkappe 瓜皮帽, Wort 好茶 |

Im Pausemenü: **Aufgaben** (Aufgabenbuch mit Stand) und **Garderobe** (Kleidung und Hut oder Frisur wechseln; noch nicht freigeschaltete Teile sind ausgegraut). Botengänge ins Dorf kommen mit der Welt-Erweiterung. Daten: `src/content/quests.ts`, Ablauf: `src/minigames/quests.ts` (getestet), im Spiel: `src/world/questrun.ts`.

## Mini-Xiangqi am Brettspieltisch (象棋 xiàngqí)

Am Tisch der Brettspieler (links in der Halle) „Xiangqi spielen“ wählen. Beim ersten Mal erklären Regeln und Figurenkarten das Spiel, danach wählt man einen Gegner:

| Stufe  | Gegner             | Spielweise                                         | Sieg      |
| ------ | ------------------ | -------------------------------------------------- | --------- |
| 1 初学 | Brettspieler Lin   | schaut einen Zug weit, greift oft daneben          | 5 Münzen  |
| 2 中级 | Brettspieler Lin   | zwei Halbzüge voraus, kleine Fehler                | 10 Münzen |
| 3 高手 | Alter Meister Zhou | bis vier Halbzüge voraus (Alpha-Beta), ohne Zufall | 20 Münzen |

**Regeln (vereinfacht):** Brett mit 5 × 6 Punkten, acht Steine pro Seite: General 帅/将, zwei Wagen 车 (jū), Pferd 马, Kanone 炮, drei Soldaten 兵/卒. Echte Zugregeln (Pferd kann gehemmt werden, Kanone schlägt nur über genau einen Stein, Soldaten jenseits der Mitte auch seitwärts). Rot beginnt. Gewonnen hat, wer den General schlägt; wer keinen Zug hat, verliert; nach 120 Halbzügen unentschieden. Ohne Palast, Elefanten, Berater und ohne das Verbot gegenüberstehender Generäle.

**Bedienung:** Stein anklicken zeigt die erlaubten Ziele und wie er zieht, Ziel anklicken. Der letzte Zug ist markiert, „将军！“ warnt, wenn der eigene General angegriffen ist. Esc schließt, die Partie wird gespeichert und lässt sich fortsetzen. Siege, Niederlagen und Remis je Stufe stehen im Spielstand. Lernwörter: 将军, 车, 马, 炮, 兵. Regeln und Gegner: `src/minigames/xiangqi.ts` (getestet), Texte: `src/content/xiangqi.ts`.

## Die Welt ums Teehaus (W1)

Das Teehaus liegt jetzt in einem begehbaren Tal von etwa 220 × 240 m. Wege mit Trittplatten, Laternen und Stufen führen zu sechs Orten:

| Ort                                     | Lage vom Teehaus                                                  | Weg                       |
| --------------------------------------- | ----------------------------------------------------------------- | ------------------------- |
| Bambushain 竹林                         | links, über den Holzsteg am Bach                                  | Westweg                   |
| Aussichtspunkt 观景台                   | hinten links auf dem Grat (Pavillon, Bank, Blick übers Tal)       | Westweg, steiler Aufstieg |
| Teefeld 茶园                            | rechts am sanften Hang, Reihen von Teesträuchern                  | Ostweg                    |
| Schrein 神社                            | hinten rechts auf dem Hügel, über eine Steintreppe mit zwei Toren | Schreinweg                |
| Dorfplatz 村子                          | vorn rechts, gepflastert, mit Brunnen (die Häuser kommen in W2)   | Dorfweg mit Tor           |
| Steinbrücke 石桥 und Reisterrassen 梯田 | über den Fluss am Talboden                                        | Brückenweg                |

- **Gelände** (`src/world/terrain.ts`): Höhenfunktion in Schichten (Tal, Hügel, ebene Plätze, Wege quer flach mit geglättetem Längsprofil, Terrassen, Bach- und Flussbetten), daraus ein 1-m-Raster. Figuren stehen exakt auf dem sichtbaren Boden.
- **Weltdaten** (`src/world/map.ts`): Orte, Wege, Fluss und Bäche als Linienzüge – eine Quelle für Gelände, Bewuchs, Laufraster und später die Karte (M). Neue Wege oder Orte dort eintragen.
- **Bewuchs** (`src/world/scatter.ts`, `src/three/nature.ts`): Kiefern, Tannen, Laubbäume, Kirschen, Ginkgos, Ahorn, Bambus, Teesträucher und Felsen als Instanzen. Bäume haben zwei Detailstufen (nah mit Schatten, fern einfach); jenseits der Sichtweite wird nichts gezeichnet. Die Verteilung wird alle 3 m Kamerabewegung neu sortiert. Gras wächst im Shader in einer 48-m-Kachel um die Kamera und liest Höhe und Dichte aus einer Textur. Wind bewegt Bäume, Sträucher, Bambus und Gras.
- **Grenzen:** Am Talrand steigt das Gelände steil zu bewaldeten Bergen an, dahinter Nebel und Bergketten. Es gibt keine unsichtbaren Wände; Wasser ist nur über Brücken passierbar.
- **Laufen:** draußen ein eigenes Laufraster (0,25 m) aus Steigung, Wasser und Hindernissen; Klick zum Laufen findet Wege auch über weite Strecken (A*, für lange Wege gröber). Die Kamera bleibt über dem Boden und hält vor Bauwerken an; der Schattenausschnitt folgt der Figur.
- **Entdeckte Orte** werden im Spielstand vermerkt (für die Karte in W4).

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

## Musik

Generative Web-Audio-Partitur „Erhu & Guzheng“ in G-Pentatonik (`src/audio/music.ts`, Instrumente in `instruments.ts`, Notation in `sequencer.ts`), ohne Audiodateien. Vordersätze, Nachsätze, Guzheng-Zwischenspiele und stille Abschnitte werden laufend neu kombiniert und abgewandelt, gelegentlich mit Ausweichen nach D- oder A-Gong.

- **Tag:** Erhu über Guzheng, etwa 62 Schläge pro Minute. **Abend:** langsamer, wärmer, mehr Stille. **Nacht:** meist Guzheng, Klangschale, Bordun, Laternenglöckchen.
- **Draußen** luftiger mit mehr Hall, **drinnen** näher und wärmer mit leisem Teegießen; **im Gespräch** verstummt die Erhu und die Musik wird deutlich leiser.
- Windspiele spielen in der Tonart der Musik. Regler für Musik, Stimmen und Effekte im Ton-Panel; Standard dezent.

## Qualitätsstufen

Hoch / Mittel / Niedrig unterscheiden sich in Pixeldichte, Schatten, Bloom/Tiefenunschärfe, Teich-Spiegelung und draußen in Grasmenge (18 000 / 9 000 / aus), Detailweite der Bäume (70 / 45 / 25 m) und Sichtweite des Bewuchses (420 / 260 / 160 m). Figuren weiter als 11 m entfernt sparen Feinbewegung (Fuß-IK, Nachschwingen, Animation nur jedes zweite Bild). Standard ist **automatisch** (Desktop hoch, Mobilgeräte mittel, bei dauerhaft unter 40 fps eine Stufe tiefer). Fest einstellen über die Info-Seite (ⓘ) oder `?q=`. „Bewegung reduzieren“ im System schaltet den Ruhe-Modus ein.

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
                  character + looks (Figuren), agent (Bewegung), camera, input, npcs, heroes, finds, intro,
                  map (Orte, Wege, Gewässer), terrain (Höhe, Wasser, Untergrund), scatter (Bewuchs, Bauwerke)
src/three/        Landschaft, nature (Bäume, Gras), waterways (Fluss, Bäche, Reisfelder), structures (Brücken,
                  Laternen, Tore, Schrein, Pavillon, Dorfplatz), Effekte, Materialien
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
