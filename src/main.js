import { initApp } from './components/app.js';

window.__DEBUG_SCAN__ = true; // manter por enquanto
window.addEventListener('DOMContentLoaded', () => {
  console.log('[BOOT] DOM pronto, initApp()');
  initApp();
});

