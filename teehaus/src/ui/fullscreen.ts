// Vollbild an/aus (Taste F, umlegbar; Knopf in den Einstellungen). Für Beamer und große Bildschirme.

/** Ist das Spiel gerade im Vollbild? */
export function isFullscreen(): boolean {
  return !!document.fullscreenElement;
}

export function toggleFullscreen(): void {
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    /* Browser erlaubt es nicht (z. B. eingebettet) */
  }
}
