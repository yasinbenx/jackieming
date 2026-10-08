import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
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

// Lokal (`npm run dev`) wird api/chat.ts direkt eingebunden, damit der Chat ohne `vercel dev` testbar ist.
// Schlüssel aus .env.local; ohne Schlüssel meldet GET /api/chat enabled:false.
const devApiPlugin: Plugin = {
  name: 'dev-api-chat',
  apply: 'serve',
  configureServer(server) {
    Object.assign(process.env, { ...loadEnv('development', process.cwd(), ''), ...process.env });
    server.middlewares.use('/api/chat', (req, res, next) => {
      const run = async (): Promise<void> => {
        const mod = (await server.ssrLoadModule('/api/chat.ts')) as {
          GET: () => Promise<Response>;
          POST: (r: Request) => Promise<Response>;
        };
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
        const method = req.method ?? 'GET';
        const request = new Request(`http://localhost${req.url ?? ''}`, {
          method,
          headers,
          body: method === 'POST' ? Buffer.concat(chunks) : undefined,
        });
        const response = method === 'POST' ? await mod.POST(request) : await mod.GET();
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await response.text());
      };
      run().catch(() => next());
    });
  },
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
  plugins: [siteUrlPlugin, devApiPlugin],
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
