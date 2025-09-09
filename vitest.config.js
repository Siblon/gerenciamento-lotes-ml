import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: ['tests/**/*.{spec,test}.js'],
    setupFiles: ['tests/setup.ts'],
    deps: {
      inline: []
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'xlsx-js-style': 'xlsx',
      dexie: path.resolve(__dirname, 'tests/mocks/dexie.js')
    }
  }
})
