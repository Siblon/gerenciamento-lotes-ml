import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/',
  root: '.',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || ''),
    __COMMIT_HASH__: JSON.stringify(process.env.VITE_COMMIT || ''),
    __BRANCH__: JSON.stringify(process.env.VITE_BRANCH || ''),
  },
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
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
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
