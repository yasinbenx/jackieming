// Fehler abfangen und klar melden, statt dass eine Ausnahme die Hauptschleife oder den Ladevorgang beendet.
// Jede Meldung landet in der Konsole (mit Ort, Fehler und Stapel) und in einer kurzen Liste für die
// Debug-Anzeige. Gleiche Fehler am selben Ort werden gebündelt, damit ein Fehler in jedem Bild die Konsole nicht
// flutet.

export interface Report {
  /** wo es passiert ist, z. B. „ticker“, „laden: Haarmodelle“, „watchdog“ */
  where: string;
  message: string;
  stack?: string;
  /** wie oft (gebündelt) */
  count: number;
  at: number;
  level: 'error' | 'warn';
}

const recent: Report[] = [];
const byKey = new Map<string, Report>();
/** zusätzlicher Zustand für jede Meldung (Spielmodus, Position …), vom Spiel gesetzt */
let snapshot: () => Record<string, unknown> = () => ({});

export function setSnapshot(fn: () => Record<string, unknown>): void {
  snapshot = fn;
}

export function reports(): readonly Report[] {
  return recent;
}

function describe(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack };
  if (typeof err === 'string') return { message: err };
  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: String(err) };
  }
}

/** Fehler melden. Liefert true, wenn es die erste Meldung dieser Art ist. */
export function report(where: string, err: unknown, level: 'error' | 'warn' = 'error'): boolean {
  const { message, stack } = describe(err);
  const key = `${where}|${message}`;
  const old = byKey.get(key);
  if (old) {
    old.count++;
    old.at = performance.now();
    // Wiederholungen nur selten erneut ausgeben
    if (old.count === 10 || old.count === 100 || old.count % 1000 === 0)
      console[level](`[Teehaus] ${where}: ${message} (schon ${old.count}×)`);
    return false;
  }
  const r: Report = { where, message, stack, count: 1, at: performance.now(), level };
  byKey.set(key, r);
  recent.push(r);
  if (recent.length > 30) byKey.delete(`${recent[0]!.where}|${recent.shift()!.message}`);
  let state: Record<string, unknown> = {};
  try {
    state = snapshot();
  } catch {
    /* Zustand nicht lesbar */
  }
  console[level](`[Teehaus] ${where}: ${message}`, { fehler: err, stapel: stack, zustand: state });
  return true;
}

/** Funktion ausführen; Fehler melden statt weiterwerfen */
export function guard<T>(where: string, fn: () => T, fallback?: T): T | undefined {
  try {
    return fn();
  } catch (e) {
    report(where, e);
    return fallback;
  }
}

/** Promise mit Zeitlimit: löst mit fallback auf (und meldet), statt ewig zu warten oder zu scheitern */
export async function withTimeout<T>(where: string, p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer = 0;
  try {
    return await Promise.race([
      p,
      new Promise<T>((resolve) => {
        timer = window.setTimeout(() => {
          report(where, new Error(`Zeitlimit ${(ms / 1000).toFixed(0)} s überschritten`), 'warn');
          resolve(fallback);
        }, ms);
      }),
    ]);
  } catch (e) {
    report(where, e);
    return fallback;
  } finally {
    window.clearTimeout(timer);
  }
}

let installed = false;
/** window.onerror und unhandledrejection: nichts geht unbemerkt verloren */
export function installGlobalHandlers(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (e) => {
    report('unbehandelter Fehler', e.error ?? `${e.message} (${e.filename}:${e.lineno})`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    report('unbehandeltes Promise', e.reason);
  });
}
