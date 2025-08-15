import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  server: {
    proxy: {
      '/api/ncm': {
        target: 'https://portalunico.siscomex.gov.br',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api\/ncm/, '/classif/api/publico/ncm')
      }
    }
  }
});
