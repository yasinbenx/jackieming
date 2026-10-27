// Watchdog: prüft jede Sekunde, ob das Spiel noch lebt, und meldet sonst Zustand und Stapel in der Konsole.
//  - Kein Bild seit 3 s (bei sichtbarem Tab): Schleife tot → melden und neu anstoßen.
//  - Der Watchdog selbst kam über 2 s zu spät: der Hauptthread war blockiert → melden, wie lange.
//  - Ein Übergangszustand (Zwischensequenz, Weg zum Platz, gesperrte Eingabe, Laden) bleibt über 10 s
//    unverändert → melden; einige werden nach längerer Zeit zurückgesetzt (Notausgang).
import { report, reports } from './guard';
import { loadItems, loadSummary } from './loadstate';

export interface WatchedState {
  name: string;
  /** aktueller Wert; null = gerade nichts zu beobachten (Grundzustand) */
  value: () => string | null;
  /** nach so vielen Sekunden unverändert melden */
  warnAfter?: number;
  /** nach so vielen Sekunden unverändert zurücksetzen */
  recoverAfter?: number;
  recover?: () => void;
}

interface Track {
  value: string | null;
  since: number;
  warned: boolean;
  recovered: boolean;
}

export interface WatchdogHost {
  /** performance.now() des letzten Bildes (0 = noch keins) */
  lastFrameAt: () => number;
  /** Hauptschleife neu anstoßen */
  restartLoop: () => void;
}

export class Watchdog {
  private states: WatchedState[] = [];
  private tracks = new Map<string, Track>();
  private lastTick = performance.now();
  private host: WatchdogHost | null = null;
  private frameWarned = false;
  /** letzte Watchdog-Meldungen (für die Debug-Anzeige) */
  readonly notes: string[] = [];

  constructor() {
    window.setInterval(() => this.tick(), 1000);
  }

  attach(host: WatchdogHost): void {
    this.host = host;
  }

  watch(s: WatchedState): void {
    this.states.push(s);
  }

  private note(text: string): void {
    this.notes.push(`${new Date().toLocaleTimeString()} ${text}`);
    if (this.notes.length > 6) this.notes.shift();
  }

  private tick(): void {
    const now = performance.now();
    const late = now - this.lastTick - 1000;
    this.lastTick = now;
    // Der Intervall-Rückruf kommt nur zu spät, wenn der Hauptthread so lange beschäftigt war
    if (late > 2000 && !document.hidden) {
      const msg = `Hauptthread war ${(late / 1000).toFixed(1)} s blockiert`;
      report('Watchdog', new Error(msg), 'warn');
      this.note(msg);
    }
    if (document.hidden) return;
    // ── Bilder
    const h = this.host;
    if (h && h.lastFrameAt() > 0) {
      const since = now - h.lastFrameAt();
      if (since > 3000 && late < 2000) {
        if (!this.frameWarned) {
          this.frameWarned = true;
          const msg = `seit ${(since / 1000).toFixed(1)} s kein Bild – Schleife wird neu angestoßen`;
          report('Watchdog', new Error(msg));
          console.warn('[Teehaus] letzte Fehler:', reports().slice(-5));
          this.note(msg);
        }
        h.restartLoop();
      } else if (since < 1000) this.frameWarned = false;
    }
    // ── Zustände
    for (const s of this.states) {
      let v: string | null = null;
      try {
        v = s.value();
      } catch (e) {
        report(`Watchdog: ${s.name}`, e, 'warn');
      }
      let t = this.tracks.get(s.name);
      if (!t || t.value !== v) {
        t = { value: v, since: now, warned: false, recovered: false };
        this.tracks.set(s.name, t);
        continue;
      }
      if (v === null) continue;
      const secs = (now - t.since) / 1000;
      if (!t.warned && secs > (s.warnAfter ?? 10)) {
        t.warned = true;
        const msg = `${s.name} seit ${Math.round(secs)} s unverändert: ${v}`;
        // Stapel des Watchdogs selbst plus die letzten Fehler – damit sieht man, was davor schiefging
        report('Watchdog', new Error(msg), 'warn');
        console.warn('[Teehaus] letzte Fehler:', reports().slice(-5));
        this.note(msg);
      }
      if (s.recover && s.recoverAfter && !t.recovered && secs > s.recoverAfter) {
        t.recovered = true;
        const msg = `${s.name}: Notausgang nach ${Math.round(secs)} s`;
        report('Watchdog', new Error(msg), 'warn');
        this.note(msg);
        try {
          s.recover();
        } catch (e) {
          report(`Watchdog: Notausgang ${s.name}`, e);
        }
      }
    }
  }
}

export const watchdog = new Watchdog();

/** Laden beobachten: Hängt ein Schritt über 10 s, wird gemeldet, welcher */
watchdog.watch({
  name: 'Laden',
  value: () => {
    if (document.body.classList.contains('is-loaded')) return null;
    const cur = loadItems.filter((i) => i.status === 'lädt').map((i) => i.label);
    return cur.length ? `lädt: ${cur.join(', ')} (${loadSummary()})` : null;
  },
});
