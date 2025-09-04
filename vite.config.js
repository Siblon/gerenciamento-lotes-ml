import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/',
  root: '.',
  build: {
    // Bundle gerado para engines compatíveis com ES2020
    target: 'es2020',
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
