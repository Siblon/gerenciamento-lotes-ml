import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/',
  root: '.',
  build: {
    // Gera bundle para engines modernas (TLA requer es2022+)
    target: ['es2022', 'chrome98', 'edge98', 'firefox102', 'safari15.4'],
    // Opcional: garante que o esbuild não “rebaixe” TLA
    // esbuild: { supported: { 'top-level-await': true } },
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        ncm: path.resolve(__dirname, 'public/ncm.html'),
      },
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  optimizeDeps: {
    include: ['xlsx-js-style'],
  },
  server: {
    proxy: {
      '/api/ncm': {
        target: 'https://portalunico.siscomex.gov.br',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api\/ncm/, '/classif/api/publico/ncm'),
      },
    },
  },
});
