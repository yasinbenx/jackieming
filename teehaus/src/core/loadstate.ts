// Ladezustand jedes Schritts (Schriften, Welt, Modelle, Bewohner, Shader …): Status, Dauer, Fehler. Wird in der
// Debug-Anzeige gezeigt und in der Konsole gemeldet. Jeder Schritt hat ein Zeitlimit:
//  - optionale Schritte (Schriften, Modelle, Vorbereitungen) werden nach dem Limit übersprungen, das Spiel
//    startet trotzdem (mit Ersatz, etwa gezeichneten Figuren);
//  - Pflichtschritte (Welt aufbauen) melden das Überschreiten, laufen aber weiter, weil es ohne sie nicht geht.
import { report } from './guard';

export type LoadStatus = 'wartet' | 'lädt' | 'fertig' | 'Fehler' | 'Zeitlimit' | 'übersprungen';

export interface LoadItem {
  label: string;
  status: LoadStatus;
  /** Dauer in ms (wenn abgeschlossen) */
  ms?: number;
  error?: string;
  started?: number;
}

export const loadItems: LoadItem[] = [];

/** Gesamtbudget für optionale Vorbereitung; danach wird übersprungen */
let deadline = Infinity;
export function setOptionalDeadline(msFromNow: number): void {
  deadline = performance.now() + msFromNow;
}

function item(label: string): LoadItem {
  let it = loadItems.find((x) => x.label === label);
  if (!it) {
    it = { label, status: 'wartet' };
    loadItems.push(it);
  }
  return it;
}

export interface StepOptions<T> {
  /** Zeitlimit in ms */
  timeout: number;
  /** optional: bei Fehler/Zeitlimit mit fallback weitermachen */
  optional?: boolean;
  fallback?: T;
}

/** Einen Ladeschritt ausführen und protokollieren */
export async function loadStep<T>(label: string, fn: () => Promise<T> | T, o: StepOptions<T>): Promise<T> {
  const it = item(label);
  if (o.optional && performance.now() > deadline) {
    it.status = 'übersprungen';
    report(`laden: ${label}`, new Error('übersprungen, Ladebudget aufgebraucht'), 'warn');
    return o.fallback as T;
  }
  it.status = 'lädt';
  it.started = performance.now();
  let timer = 0;
  let timedOut = false;
  const run = (async () => fn())();
  const limit = new Promise<'limit'>((resolve) => {
    timer = window.setTimeout(() => {
      timedOut = true;
      resolve('limit');
    }, o.timeout);
  });
  try {
    if (o.optional) {
      const r = await Promise.race([run, limit]);
      if (r === 'limit' && timedOut) {
        it.status = 'Zeitlimit';
        it.ms = performance.now() - it.started;
        report(`laden: ${label}`, new Error(`Zeitlimit ${o.timeout / 1000} s – übersprungen`), 'warn');
        run.catch((e) => report(`laden: ${label} (nach Zeitlimit)`, e, 'warn'));
        return o.fallback as T;
      }
      it.status = 'fertig';
      it.ms = performance.now() - it.started;
      return r as T;
    }
    // Pflichtschritt: Überschreiten nur melden, weiter warten
    void limit.then(() => {
      if (it.status === 'lädt')
        report(`laden: ${label}`, new Error(`dauert länger als ${o.timeout / 1000} s`), 'warn');
    });
    const r = await run;
    it.status = 'fertig';
    it.ms = performance.now() - it.started;
    return r;
  } catch (e) {
    it.status = 'Fehler';
    it.ms = performance.now() - (it.started ?? 0);
    it.error = e instanceof Error ? e.message : String(e);
    report(`laden: ${label}`, e, o.optional ? 'warn' : 'error');
    if (o.optional) return o.fallback as T;
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Kurzfassung für Debug-Anzeige und Konsole */
export function loadSummary(): string {
  return loadItems
    .map((i) => `${i.label}: ${i.status}${i.ms !== undefined ? ` ${Math.round(i.ms)} ms` : ''}`)
    .join(' · ');
}
