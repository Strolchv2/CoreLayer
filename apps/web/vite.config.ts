import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(root, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.API_URL ?? 'http://localhost:4000', changeOrigin: false },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: process.env.API_URL ?? 'http://localhost:4000', changeOrigin: false },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // index.html = Anwendung, render.html = Render-Bundle für die serverseitige PDF-Erzeugung
    rollupOptions: {
      input: {
        main: path.resolve(root, 'index.html'),
        render: path.resolve(root, 'render.html'),
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
