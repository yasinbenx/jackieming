# 茶馆 · Das Teehaus

Ein warmes, atmosphärisches 3D-Teehaus in den Bergen: Eine Kamerafahrt führt über Weg, Brücke und Teich hinein, danach drehst du die Szene frei. Drinnen sitzen Jackie Chan (成龙) und Yao Ming (姚明) als Papierfiguren aus frei lizenzierten Fotos. Tippe sie an, stelle Fragen, sammle chinesische Wörter (mit Pinyin und Aussprache) und stoße am Ende gemeinsam an.

> **Fiktives Gespräch, basiert auf öffentlich bekannten Fakten. Keine echten Zitate. Nicht mit den dargestellten Personen verbunden.**
> Alle Fakten und Quellen stehen in [`FAKTEN.md`](./FAKTEN.md). Im Zweifel wurde etwas weggelassen.

Gebaut mit Vite, TypeScript, [three.js](https://threejs.org) und [postprocessing](https://github.com/pmndrs/postprocessing). Landschaft, Teehaus, Licht, Partikel und Klänge entstehen live im Code (Low-Poly, prozedural). Dateien von außen sind nur:

- die beiden Porträtfotos (Wikimedia Commons, freie Lizenzen, siehe [Bildquellen](#bildquellen-und-lizenzen)),
- die Schriften Noto Serif SC und Ma Shan Zheng (SIL OFL), als Subset eingebunden.

## Schnellstart

Voraussetzung: Node.js ≥ 20.19.

```bash
cd teehaus
npm install
npm run dev        # http://localhost:5173
```

| Befehl                                        | Zweck                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`                                 | Entwicklungsserver (inkl. lokalem `/api/chat`)                                    |
| `npm run build`                               | Typprüfung + Produktions-Build nach `dist/`                                       |
| `npm run preview`                             | Build lokal ansehen (mit denselben Sicherheits-Headern wie auf Vercel)            |
| `npm run typecheck` / `lint` / `format:check` | Qualitätsprüfungen                                                                |
| `npm run facts`                               | `FAKTEN.md` und die Wissensbasis für den Chat aus `src/content/facts.ts` erzeugen |
| `npm run check:content`                       | Inhalte prüfen (Fakten-IDs, Quellen, Wörter, Quiz)                                |
| `npm run test:chat`                           | Serverless Function mit gestubbtem Netz testen (kein Schlüssel nötig)             |

URL-Parameter zum Testen: `?q=0|1|2` erzwingt die Grafikqualität (niedrig bis hoch).

## Bedienung

| Aktion                    | Maus / Touch                                                    | Tastatur  |
| ------------------------- | --------------------------------------------------------------- | --------- |
| Szene drehen              | ziehen                                                          | ← →       |
| Zoomen                    | Mausrad / zwei Finger                                           | ↑ ↓       |
| Kamera-Presets            | Knöpfe unten links: 全景 Überblick, 桌边 Am Tisch, 外面 Draußen | 1, 2, 3   |
| Mit Jackie / Yao sprechen | Figur antippen oder Namensknopf                                 | J, Y      |
| Antwort sofort zeigen     | „Überspringen“                                                  | Leertaste |
| Fenster schließen         | ×                                                               | Esc       |
| Ton                       | Lautsprecher-Knopf (Musik und Effekte getrennt)                 | M         |

Die Drehung ist begrenzt (kein Blick unter den Boden, kein Flug hinter das Haus), der Zoom ebenfalls.

## Qualitätsstufen

| Stufe   | Pixeldichte | Schatten             | Effekte                      | Teich                        |
| ------- | ----------- | -------------------- | ---------------------------- | ---------------------------- |
| Hoch    | bis 2×      | 2048er Schattenkarte | Bloom, Tiefenunschärfe, MSAA | Echtzeit-Spiegelung          |
| Mittel  | bis 1,5×    | 1024er               | Bloom, FXAA                  | Spiegelung (halbe Auflösung) |
| Niedrig | 1×          | keine                | FXAA                         | Glanzfläche ohne Spiegelung  |

- **Automatisch** (Standard): Desktop startet auf Hoch, Smartphones und Tablets auf Mittel. Sinkt die Bildrate dauerhaft unter 40 fps, schaltet das Teehaus eine Stufe herunter.
- Fest einstellen: Info-Seite (ⓘ) → „Grafik“, oder per URL `?q=0|1|2`.
- **Ruhe-Modus** (Info-Seite, oder automatisch bei „Bewegung reduzieren“ im System): keine Kamerafahrt, sanftere Animationen, weniger Blütenblätter, keine Tiefenunschärfe, Antworten sofort sichtbar.
- Eine leichte Vignette liegt als CSS-Verlauf über der Szene (auf allen Geräten gleich weich, ohne Shader-Kosten).

## Auf Vercel veröffentlichen

1. Repository auf GitHub hochladen (dieses Repo liegt dort bereits; die App steckt im Ordner `teehaus/`).
2. Auf [vercel.com](https://vercel.com) **Add New → Project** und das Repository importieren.
3. **Root Directory** auf `teehaus` setzen. Framework Preset: **Vite** (wird erkannt), Build Command `npm run build`, Output `dist` (Standard).
4. Optional: Environment Variables setzen (siehe unten), dann **Deploy**.
5. Fertig: Du bekommst eine `*.vercel.app`-Adresse zum Teilen. Die Vorschaubild-Links (Open Graph) nutzen automatisch diese Adresse; für eine eigene Domain `VITE_SITE_URL` setzen.

Per Kommandozeile geht es auch:

```bash
npm i -g vercel
cd teehaus
vercel           # Vorschau-Deployment (beim ersten Mal Projekt verknüpfen)
vercel --prod    # Produktion
```

### Optionaler KI-Chat („Eigene Frage“)

Das Spiel funktioniert **vollständig ohne** Chat. Wird auf dem Server ein Schlüssel hinterlegt, erscheint im Dialog zusätzlich ein Freitextfeld.

| Variable                                             | Pflicht      | Bedeutung                                                                                            |
| ---------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                                  | für den Chat | Anthropic-API-Schlüssel. Liegt nur auf dem Server, nie im Frontend.                                  |
| `ANTHROPIC_MODEL`                                    | nein         | Standard `claude-sonnet-5`. Ein kleineres Modell senkt die Kosten.                                   |
| `DAILY_CAP`                                          | nein         | Anfragen pro Tag für alle Besucher zusammen (Standard 1500). Danach greift der Fallback.             |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | nein         | Macht das Rate-Limit instanzübergreifend dauerhaft. Ohne sie zählt jede Serverless-Instanz für sich. |
| `ALLOWED_ORIGIN`                                     | nein         | z. B. `https://dein-projekt.vercel.app`; blockiert Anfragen von fremden Seiten.                      |
| `VITE_SITE_URL`                                      | nein         | Öffentliche Adresse für Canonical/Open Graph (eigene Domain).                                        |

In Vercel: **Project → Settings → Environment Variables**, danach neu deployen.

Schutzmaßnahmen in `api/chat.ts`: höchstens 200 Zeichen pro Frage, 6 Verlaufsnachrichten, 6 KB Body, 12 Anfragen pro 10 Minuten und 60 pro Tag je IP, Tagesbudget global, Zeitlimit, strukturierte Ausgabe mit serverseitiger Prüfung, Fallback auf die vorbereiteten Fragen bei jedem Fehler. Der System-Prompt verlangt: nur gut belegte öffentliche Fakten (die geprüfte Wissensbasis), nichts erfinden, bei Unbekanntem freundlich ausweichen, keine Politik, Skandale oder Privates, immer kurz und in Ich-Form. Antworten sind als „KI-generiert“ gekennzeichnet. Kosten: jede Frage ist ein kurzer API-Aufruf; mit `DAILY_CAP` und dem Modell stellst du die Obergrenze ein.

Lokal testen: `.env.local` mit `ANTHROPIC_API_KEY=…` anlegen (siehe `.env.example`) und `npm run dev`. Ohne Schlüssel bleibt das Feld unsichtbar.

## Bildquellen und Lizenzen

Die Papierfiguren nutzen zwei Fotos von Wikimedia Commons. Die Gesichter sind **nicht verändert**, es wurde nur freigestellt, zugeschnitten, skaliert und ein Papierrand mit gerissener Kante ergänzt. Im Spiel stehen alle Angaben unter ⓘ → „Bildnachweise und Lizenzen“.

| Person      | Datei                                                                                                                                                                                              | Urheber                        | Lizenz                                                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jackie Chan | [Jackie Chan (7588072360) (cropped).jpg](<https://commons.wikimedia.org/wiki/File:Jackie_Chan_(7588072360)_(cropped).jpg>)                                                                         | Gage Skidmore                  | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) (die bearbeitete Fassung in `public/avatars/jackie*.webp` steht ebenfalls unter CC BY-SA 2.0) |
| Yao Ming    | [Yao Ming, Former NBA player, Founder, The Yao Foundation (13982586406).jpg](<https://commons.wikimedia.org/wiki/File:Yao_Ming,_Former_NBA_player,_Founder,_The_Yao_Foundation_(13982586406).jpg>) | World Travel & Tourism Council | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)                                                                                                     |

Hinweise:

- Das Jackie-Foto stammt aus Gage Skidmores Serie von der San Diego Comic-Con 2012. Bitte einmal prüfen, dass es genau die oben verlinkte Datei ist (es gibt eine fast gleiche Variante „Jackie Chan by Gage Skidmore.jpg“ unter CC BY-SA 3.0). Die Angaben stehen zentral in `src/content/credits.ts`.
- Neben der Bildlizenz gelten Persönlichkeitsrechte. Das Projekt ist ein nicht-kommerzielles Lernspiel mit deutlichem Hinweis, dass es nicht mit den Personen verbunden ist.
- Das Vorschaubild (`public/og.png`) zeigt bewusst nur die selbst erzeugte Szene ohne Fotos.
- Ohne Foto (z. B. Ladefehler) erscheint eine schlichte Silhouette mit Namensschild.

So entstehen die Texturen (nur nötig, wenn du andere Fotos einsetzen willst):

1. Original von Commons laden (Lizenz CC0, CC BY oder CC BY-SA).
2. Hintergrund lokal entfernen, z. B. mit [`@imgly/background-removal-node`](https://www.npmjs.com/package/@imgly/background-removal-node). Das ist nur ein Werkzeug und wird nicht ausgeliefert.
3. `python3 scripts/make-avatars.py jackie_cut.png yao_cut.png` erzeugt `public/avatars/*.webp` (Zuschnitt, Papierrand, Porträt-Ausschnitt). Die Kopfmaße (`chin`, `centerX`, `aspect`) stehen in `src/three/paperFigure.ts`.
4. `src/content/credits.ts` anpassen und `npm run facts` ausführen.

## Inhalte ändern

Alles liegt getrennt vom Code in `src/content/`:

- `jackie.ts`, `yao.ts`: Fragen, Antworten, Zwischenrufe, Wörter je Frage, Freischaltungen
- `facts.ts`: jede Tatsache mit ID, Quelle und Sicherheitsstufe (Quelle für `FAKTEN.md`)
- `words.ts`: Lernwörter (Zeichen, Pinyin mit Tonziffern, Deutsch)
- `quiz.ts`, `extras.ts` (Easter Eggs), `categories.ts`
- `credits.ts`: Bildnachweise (erscheinen im Spiel und in `FAKTEN.md`)

Nach Änderungen `npm run facts` und `npm run check:content` ausführen. **Regel:** nur belegbare öffentliche Fakten, keine erfundenen Zitate; im Zweifel weglassen.

## Aufbau

```
api/chat.ts        Serverless Function (optionaler Chat)
public/            Favicon, Icons, OG-Bild, Manifest
scripts/           Fakten-Generator, Schrift-Subset, Icon/OG-Erzeugung, Chat-Test
src/three/         3D: stage (Renderer, Kamera, Steuerung, Qualität, Postprocessing), landscape (Berge, Teich,
                   Brücke, Bambus, Koi, Vögel), teahouse (Haus, Laternen, Einrichtung), effects (Lichtstrahlen,
                   Staub, Dampf, Blüten, Glühwürmchen), paperFigure (Foto-Papierfiguren), palette (Tageszeit)
public/avatars/    Freigestellte Porträts (siehe Bildquellen)
src/content/       Texte, Fakten, Wörter, Quiz
src/ui/            Dialog, Lernkarte, Wörterbuch, Info, Ton-Panel, HUD (DOM)
src/audio/         Web-Audio-Engine: Musik, Ambiente, Effekte, Stimm-Blips
src/interactions/  Easter Eggs, Finale (Anstoßen + Quiz)
src/state/         Spielstand (localStorage)
```

**Warum three.js ohne React?** Das Projekt ist reines TypeScript ohne Framework; die Oberfläche (Dialog, Karten, Quiz) ist bewusst normales DOM, damit sie zugänglich, tastaturbedienbar und scharf bleibt. `@react-three/fiber` hätte React als zweite Schicht mitgebracht, ohne hier etwas zu vereinfachen. three.js und postprocessing werden erst nach dem Ladescreen nachgeladen (eigener Chunk, ca. 170 KB gzip); das Start-Skript ist wenige KB groß.

Weitere Hinweise: Fokusrahmen für alle Bedienelemente, Musik startet erst nach dem ersten Klick (Web Audio, Pentatonik), Lautstärken und Stummschaltung werden gespeichert. Draußen klingen Wind und Vögel lauter, drinnen Kessel und Laternen.

## Assets neu erzeugen (selten nötig)

- Schriften: `python3 scripts/subset-fonts.py` (benötigt `fonttools`, `brotli`)
- Favicon/Icons: `python3 scripts/make-favicon.py`
- OG-Bild: `node scripts/make-og.mjs http://localhost:5173` (benötigt Playwright und einen laufenden Dev-Server; blendet die Fotos aus)
- Papierfiguren: siehe [Bildquellen und Lizenzen](#bildquellen-und-lizenzen)

## Datenschutz

Keine Cookies, kein Tracking. Der Spielstand liegt nur im `localStorage` des Browsers. Nur bei aktiviertem Chat wird der eingegebene Text an den Server und die Claude-API gesendet (Hinweis steht direkt am Eingabefeld und auf der Info-Seite).
