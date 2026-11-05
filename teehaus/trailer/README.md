# Trailer „Das Teehaus“

Ergebnis: `trailer/teehaus-trailer.mp4`, 55 s, 1920×1080, 30 fps, H.264 und AAC.

## Ablauf

| Zeit         | Szene                                                            | Quelle                          |
| ------------ | ---------------------------------------------------------------- | ------------------------------- |
| 0–4,7 s      | Nacht am Teich, Laternen, Titel 茶馆 · cháguǎn · Das Teehaus     | echtes Spiel, Kamerafahrt       |
| 4,7–13,6 s   | Anflug zur goldenen Stunde über Dorf und Tal zu Brücke und Teehaus | echtes Spiel, Kamerafahrt     |
| 13,6–25 s    | Innenraum: die zwei Gäste, Sprechblase und Wortkarte 欢迎光临   | echtes Spiel, Einblendungen     |
| 25–36,4 s    | Dorfplatz mit Markt, Abend wird Nacht, die Laternen gehen an     | echtes Spiel, Kamerafahrt       |
| 36,4–46,3 s  | Tee zubereiten, Xiangqi, Angeln                                  | echte Screenshots, langsamer Zoom |
| 46,3–55 s    | Schlusskarte mit Adresse, „Am Computer öffnen“, Hinweis          | gesetzte Karte                  |

## Werkzeuge

- `render.mjs`: lädt das gebaute Spiel in Headless-Chromium (Software-WebGL, Qualität „Hoch“), schaltet die
  Spielschleife ab und rechnet jedes Bild selbst: feste Zeit pro Bild (1/30 s), feste Zufallswerte, geskriptete
  Kamera und Tageszeit. Gerendert wird in 1280×720 (direkt aus dem Canvas gelesen, etwa 3 s pro Bild), beim
  Zusammensetzen auf 1920×1080 hochskaliert. Abgebrochene Szenen werden fortgesetzt.
- `stills.mjs`: Screenshots der Mini-Spiele in 1920×1080. Ihre Fenster sind HTML über der 3D-Szene und stecken
  deshalb nicht im Canvas-Bild.
- `overlays.mjs`: Titel, Einblendungen, Sprechblase, Wortkarte, Schlusskarte und Hinweis als transparente PNGs,
  gesetzt mit den Schriften des Spiels (Ma Shan Zheng, Noto Serif SC, SIL OFL, aus @fontsource).
- `music.py`: Musik und Atmosphäre, komplett selbst erzeugt mit numpy: Guzheng-artige Zupftöne
  (Karplus-Strong) und Flöte in D-Pentatonik, Wind, Vögel, Teeplätschern, Glöckchen an den Schnitten, leise
  Trommel im Dorf.
- `build.sh`: ffmpeg setzt Szenen, Überblendungen, Einblendungen und Musik zusammen.

Neu erzeugen (Build muss unter Port 5300 laufen: `npx vite build && npx vite preview --port 5300`):

```bash
node trailer/render.mjs alle
node trailer/stills.mjs
node trailer/overlays.mjs
python3 trailer/music.py trailer/work/musik.wav 55
bash trailer/build.sh
```

Zwischendateien liegen in `trailer/work/` (nicht im Repository).

## Probleme und Entscheidungen

- **Variante A (echtes Spiel)** hat funktioniert. Ein Bild dauert in der Software-Grafik etwa 3 s. Darum wird in
  720p gerendert und hochskaliert; die Szenen sind kurz und fortsetzbar, weil die Arbeitsumgebung zwischendurch
  neu starten kann.
- Die Teichspiegelung wird nur bei neuem Bild neu gezeichnet; der eigene Bildtakt zählt den Bildzähler deshalb mit.
- Die Mini-Spiele sind als Standbilder mit langsamem Zoom drin (ihre Oberfläche ist HTML, nicht Teil des
  3D-Bildes).
- Die Schriften des Spiels sind auf die verwendeten Zeichen reduziert; für die Einblendungen werden die
  vollständigen Schriften aus `node_modules/@fontsource` geladen (sonst Kästchen).
- Bewusst weggelassen: Funktionen, die man im Trailer nicht sauber zeigen kann oder die nur kurz aufblitzen
  würden (KI-Chat, Quiz, Fotomodus, Jahreszeiten, Drachentanz), und alle Zahlenangaben. Keine Zitate der
  realen Personen; die Sprechblase spricht der Teemeister.
