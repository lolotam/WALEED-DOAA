import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const pages = ['index', 'meals', 'log', 'pantry', 'history', 'settings', 'login'];

export default defineConfig({
  root: 'client',
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: { input: Object.fromEntries(pages.map((p) => [p, resolve(__dirname, 'client', `${p}.html`)])) },
  },
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
