import { defineConfig } from 'vite';

// PixiJS ist groß: eigener Chunk, damit der Ladescreen (index.html + kleines Boot-Skript)
// sofort erscheint und die Engine im Hintergrund nachgeladen wird.
export default defineConfig({
  base: './',
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
});
