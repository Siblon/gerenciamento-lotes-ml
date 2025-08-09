import { initApp } from './components/app.js';

window.__DEBUG_SCAN__ = true;

window.addEventListener('DOMContentLoaded', () => {
  console.log('[BOOT] DOM pronto → initApp()');
  initApp();
});

