import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/',
  root: '.',
  build: {
    // Bundle gerado para engines compatíveis com ES2020
    target: 'es2020',
    commonjsOptions: {
      include: [/node_modules/, /xlsx-js-style/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      stream: path.resolve(__dirname, 'src/shims/empty.js'),
      fs: path.resolve(__dirname, 'src/shims/empty.js'),
      crypto: path.resolve(__dirname, 'src/shims/empty.js'),
      util: path.resolve(__dirname, 'src/shims/empty.js'),
      buffer: path.resolve(__dirname, 'src/shims/empty.js'),
    },
  },
  optimizeDeps: {
    include: ['xlsx-js-style', 'xlsx'],
    needsInterop: ['xlsx-js-style'],
  },
  server: {
    proxy: {
    },
  },
});
