# 茶馆 · Das Teehaus

Ein atmosphärisches Browser-Erlebnis: Du betrittst ein Teehaus in den Bergen, in dem Jackie Chan (成龙) und Yao Ming (姚明) sitzen. Klicke oder tippe sie an, stelle Fragen, sammle chinesische Wörter (mit Pinyin und Aussprache) und stoße am Ende gemeinsam an.

> **Fiktives Gespräch, basiert auf öffentlich bekannten Fakten. Keine echten Zitate. Nicht mit den dargestellten Personen verbunden.**
> Alle Fakten und Quellen stehen in [`FAKTEN.md`](./FAKTEN.md). Im Zweifel wurde etwas weggelassen.

Gebaut mit Vite, TypeScript und PixiJS. Alle Bilder, Figuren und Klänge entstehen live im Code (keine fremden Assets). Einzige Dateien von außen: die Schriften Noto Serif SC und Ma Shan Zheng (SIL OFL), als Subset eingebunden.

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

## Inhalte ändern

Alles liegt getrennt vom Code in `src/content/`:

- `jackie.ts`, `yao.ts`: Fragen, Antworten, Zwischenrufe, Wörter je Frage, Freischaltungen
- `facts.ts`: jede Tatsache mit ID, Quelle und Sicherheitsstufe (Quelle für `FAKTEN.md`)
- `words.ts`: Lernwörter (Zeichen, Pinyin mit Tonziffern, Deutsch)
- `quiz.ts`, `extras.ts` (Easter Eggs), `categories.ts`

Nach Änderungen `npm run facts` und `npm run check:content` ausführen. **Regel:** nur belegbare öffentliche Fakten, keine erfundenen Zitate; im Zweifel weglassen.

## Aufbau

```
api/chat.ts        Serverless Function (optionaler Chat)
public/            Favicon, Icons, OG-Bild, Manifest
scripts/           Fakten-Generator, Schrift-Subset, Icon/OG-Erzeugung, Chat-Test
src/scene/         Landschaft, Teehaus-Innenraum, Tageszeit, Partikel, Kamera (PixiJS)
src/figures/       Figuren-Rig (IK-Arme, parametrisches Gesicht, Reaktionen)
src/content/       Texte, Fakten, Wörter, Quiz
src/ui/            Dialog, Lernkarte, Wörterbuch, Info, Ton-Panel, HUD (DOM)
src/audio/         Web-Audio-Engine: Musik, Ambiente, Effekte, Stimm-Blips
src/interactions/  Easter Eggs, Finale (Anstoßen + Quiz)
src/state/         Spielstand (localStorage)
```

**Warum PixiJS?** Eine 2D-Szene mit vielen Ebenen, Filtern (Wasserspiegelung), Partikeln und Tint-Mischung braucht GPU-Rendering mit kleinem Footprint. PixiJS (WebGL) liefert das ohne Spiel-Engine-Ballast; die Oberfläche (Dialog, Karten) ist bewusst normales DOM, damit sie zugänglich, tastaturbedienbar und scharf bleibt.

Weitere Hinweise: Tastatur (`J`/`Y` Figur wählen, `Esc` zu, `M` Ton), Fokusrahmen, `prefers-reduced-motion` und ein Ruhe-Modus (Info-Seite) reduzieren Bewegung. Eine Qualitätsregelung senkt bei niedriger Framerate automatisch Effekte. Musik startet erst nach dem ersten Klick; Lautstärken und Stummschaltung werden gespeichert.

## Assets neu erzeugen (selten nötig)

- Schriften: `python3 scripts/subset-fonts.py` (benötigt `fonttools`, `brotli`)
- Favicon/Icons: `python3 scripts/make-favicon.py`
- OG-Bild: `node scripts/make-og.mjs` (benötigt Playwright und einen laufenden Dev-Server)

## Datenschutz

Keine Cookies, kein Tracking. Der Spielstand liegt nur im `localStorage` des Browsers. Nur bei aktiviertem Chat wird der eingegebene Text an den Server und die Claude-API gesendet (Hinweis steht direkt am Eingabefeld und auf der Info-Seite).
