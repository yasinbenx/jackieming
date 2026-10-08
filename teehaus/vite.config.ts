import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

// Öffentliche Adresse für Canonical/Open-Graph. Auf Vercel automatisch aus der Produktions-URL,
// sonst über VITE_SITE_URL (z. B. https://teehaus.example). Ohne Angabe bleiben die Pfade relativ.
const siteUrl = (
  process.env.VITE_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
).replace(/\/$/, '');

const siteUrlPlugin: Plugin = {
  name: 'site-url',
  transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl),
};

// Dieselben Sicherheits-Header wie auf Vercel (vercel.json) auch in `npm run preview`, damit CSP-Fehler lokal auffallen.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const previewHeaders = Object.fromEntries(vercel.headers[0]!.headers.map((h) => [h.key, h.value]));

// PixiJS ist groß: eigener Chunk, damit der Ladescreen (index.html + kleines Boot-Skript)
// sofort erscheint und die Engine im Hintergrund nachgeladen wird.
export default defineConfig({
  base: './',
  plugins: [siteUrlPlugin],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/pixi.js') || id.includes('node_modules/@pixi')) return 'pixi';
          return undefined;
        },
      },
    },
  },
  server: { host: true },
  preview: { headers: previewHeaders },
});
