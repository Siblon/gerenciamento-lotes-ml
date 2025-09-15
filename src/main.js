// Main application entry point
import { initApp } from './components/app.js';
import { hideBoot } from './utils/boot.js';

const __debug = (
  (typeof location !== 'undefined' && /\bdebug=1\b/.test(location.search)) ||
  localStorage.DEBUG_RZ === '1'
);

initApp();
// Fallback de segurança:
setTimeout(() => hideBoot(), 2000);

if (__debug) {
  import('./debug/traceRZ.js').then(m => m.enableRzDebug?.());
}
