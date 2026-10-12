# Finanzplaner

Dein persönlicher Finanzplaner als Web-App – auf Deutsch, fürs Handy gemacht, ohne Excel.
**Alle Daten bleiben in deinem Browser.** Es gibt keinen Server, kein Konto, kein Tracking.

## Was die App kann

| Seite | Wofür |
| --- | --- |
| **Übersicht** | Wie viel Alltagsgeld diesen Monat noch übrig ist (Ampel), Stand aller Konten und Töpfe, Fortschritt pro Sparziel, „Nächstes Ziel erreicht in X Monaten“, Vermögensentwicklung |
| **Monatsbudget** | Einnahmen, Fixkosten, Sparraten, Leben – als Diagramm. Alltagsgeld pro Woche. Ausgaben schnell erfassen (Plus-Knopf), mit Monatsfilter |
| **Sparziele** | Töpfe mit Zielbetrag, Zieldatum, Stand und Sparrate. Die App rechnet aus, wann ein Ziel erreicht ist und wie viel du pro Monat bräuchtest. Prioritäten per Pfeil: Notgroschen zuerst, Überschuss fließt automatisch ins nächste Ziel |
| **Wochen-Check-in** | Geführter Ablauf: Kontostände → Ausgaben prüfen → Töpfe prüfen. Danach Verlauf der letzten Wochen |
| **Konten** | Konten mit fester Aufgabe anlegen, umbenennen, löschen, Stände eintragen |
| **Abos & Verträge** | Fixkosten und Abos mit Rhythmus, Konto, Kündigungsfrist und Enddatum. Summe pro Monat/Jahr, Kündigungs-Erinnerungen (auch als Kalender-Datei) |
| **Was wäre wenn** | Gehalt, Studiengebühren, Miete nach Auszug, Autokosten ändern und sofort sehen, was mit jedem Ziel passiert |
| **Listen** | Wunschliste mit 48-Stunden-Regel und To-dos für Finanzaufgaben |
| **Halal-Finanzen** | Zakat-Rechner (Nisab selbst eintragen, Haul, 2,5 %), Reinigung unreiner Erträge, ETF-Sparplan mit drei Szenarien und Risiko-Hinweis. Keine Zinsen, keine Kredite, keine Spekulation |
| **Einstellungen** | Hell/Dunkel, Währung, Monatsbeginn (z. B. Gehaltstag), Kategorien, Backup-Export/Import (JSON), CSV-Export, Beispieldaten, Alles zurücksetzen |

Beim ersten Start sind deine Startdaten als Beispiel eingetragen (Gehalt, Fixkosten, Ziele, Sparraten ab Februar 2027). Alles ist in der App änderbar.

### So rechnet die App
- **Freies Geld pro Monat** = Einnahmen − Fixkosten − Alltag & Spaß − Studiengebühren.
- Davon bekommt jedes Ziel seine **Sparrate**, in der Reihenfolge der Priorität und nie mehr als bis zum Zielbetrag.
- Was übrig bleibt (auch die Rate eines vollen Ziels), fließt ins **oberste noch offene Ziel** (abschaltbar unter Sparziele).
- Reicht das Geld nicht, bekommt die höchste Priorität (Notgroschen) zuerst Geld.
- Abos mit anderem Rhythmus (jährlich, vierteljährlich …) werden auf den Monat umgerechnet.

## Starten (auf deinem Rechner)

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.

```bash
cd finanzplaner
npm install
npm run dev
```

Dann im Browser `http://localhost:5173` öffnen. Mit `npm run dev -- --host` kannst du die App auch vom Handy im selben WLAN öffnen (Adresse steht im Terminal).

Weitere Befehle:

```bash
npm test          # Unit-Tests für die Rechnungen (Sparraten, Zieldaten, Zakat, ETF, Fristen …)
npm run build     # fertige App in dist/ bauen
npm run preview   # gebaute App lokal ansehen
```

## Auf Vercel veröffentlichen

1. Dieses Repository auf GitHub haben (ist es schon).
2. Auf [vercel.com](https://vercel.com) mit GitHub anmelden → **Add New… → Project** → das Repository auswählen.
3. Bei **Root Directory** auf **Edit** klicken und `finanzplaner` wählen. Wichtig, weil im Repository noch andere Dateien liegen.
4. Framework wird als **Vite** erkannt (Build `npm run build`, Output `dist`, steht auch in `vercel.json`). **Deploy** klicken.
5. Nach ca. einer Minute bekommst du eine Adresse wie `https://finanzplaner-xyz.vercel.app`.

Jeder neue Push auf den Branch aktualisiert die App automatisch.

> Deine Finanzdaten landen dabei **nicht** auf Vercel. Vercel liefert nur die App-Dateien aus, die Daten speichert jeder Browser für sich.

### Aufs Handy holen (PWA)
- **iPhone:** Adresse in Safari öffnen → Teilen-Symbol → „Zum Home-Bildschirm“.
- **Android:** In Chrome öffnen → Menü ⋮ → „App installieren“.

Danach startet die App wie eine normale App und funktioniert auch offline.

## Daten sichern – wichtig!

Die Daten liegen im Speicher (localStorage) **des Browsers auf diesem Gerät**. Sie sind weg, wenn du den Browserverlauf/Websitedaten löschst, das Handy wechselst oder die App deinstallierst.

- **Backup:** Einstellungen → „Backup exportieren (JSON)“. Die Datei z. B. in iCloud Drive, Google Drive oder per Mail an dich selbst sichern. Am besten einmal im Monat (die App erinnert dich nach 30 Tagen).
- **Wiederherstellen / auf neues Gerät:** Einstellungen → „Backup importieren“ → Datei wählen. Die aktuellen Daten werden ersetzt.
- **Tabellen:** Einstellungen → CSV-Export (Ausgaben, Verträge, Ziele, Konten, Check-ins). Öffnet sich direkt in Excel oder Numbers.
- **Handy und Laptop** haben getrennte Daten. Zum Übertragen: Backup auf dem einen Gerät exportieren, auf dem anderen importieren.
- **Alles zurücksetzen** (Einstellungen) löscht alles nach Eingabe von „LÖSCHEN“.

## Technik

- Vite + React + TypeScript + Tailwind CSS + Recharts, Icons von lucide
- PWA über `vite-plugin-pwa` (Offline-Cache, installierbar)
- Navigation über `#/seite` – keine Server-Weiterleitungen nötig
- Tests mit Vitest

```
finanzplaner/
├── src/
│   ├── lib/          Rechenlogik ohne Oberfläche (+ *.test.ts)
│   │   ├── plan.ts       Monatsplan, Prioritäten, Zieldaten
│   │   ├── halal.ts      Zakat, Reinigung, ETF-Szenarien
│   │   ├── contracts.ts  Kündigungsfristen, Abo-Summen
│   │   ├── dates.ts      Monate, Monatsbeginn, Wochen
│   │   ├── money.ts      Beträge lesen (8,99 / 1.234,56), prüfen, formatieren
│   │   ├── storage.ts    Speichern, Import prüfen, CSV
│   │   └── defaults.ts   Beispieldaten
│   ├── store/        Datenspeicher (React Context) und Navigation
│   ├── components/   wiederverwendbare Bausteine (Karten, Felder, Dialoge …)
│   └── pages/        eine Datei pro Seite
└── public/           Icons
```
