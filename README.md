# 成龙 VS 姚明 – Das Duell

Präsentation im Kampfspiel-Stil, nur HTML, CSS und JavaScript, keine Abhängigkeiten.

## Starten

`index.html` per Doppelklick im Browser öffnen. Vollbild mit **F**.

## Steuerung

| Taste | Aktion |
|---|---|
| → / Leertaste / Bild ↓ | weiter (auch nächste Duell-Runde, Quiz-Auflösung) |
| ← / Bild ↑ | zurück |
| Home / End | zur ersten / letzten Folie |
| F | Vollbild |
| Klick auf Quiz-Antwort | löst auf |

Mit `index.html#6` startest du direkt bei Folie 6.

## Anpassen

- **Dein Name**: `index.html`, Titelfolie, Zeile „Chinesischkurs · Dein Name“
- **Fotos**: Bilder in den Ordner `bilder/` legen. Dann in `index.html` das `<div class="placeholder">…</div>` durch `<img src="bilder/jackie.jpg" alt="Jackie Chan">` ersetzen (analog für Yao Ming).
- **Farben und Schriften**: oben in `style.css` unter `:root`
- **Texte**: direkt in `index.html`, jede Folie ist ein `<section class="slide">`
- **Chinesische Schrift**: Die Seite nutzt Schriften, die auf deinem Rechner installiert sind (z. B. Songti auf dem Mac, SimSun/Microsoft YaHei unter Windows).

Die Quellen zum Gegenchecken stehen in `FAKTEN.md`.
