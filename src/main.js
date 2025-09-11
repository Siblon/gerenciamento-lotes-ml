// Main application entry point
import './styles.css';
import { init } from './store/index.js';
import { startNcmQueue } from './services/ncmQueue.js';
import { initIndicators, computeFinance } from './components/Indicators.js';
import { initActionsPanel } from './components/ActionsPanel.js';
import { initRzBinding } from './components/RzBinding.js';
import { hideBoot, showBoot } from './utils/boot.js';

const __debug = (
  (typeof location !== 'undefined' && /\bdebug=1\b/.test(location.search)) ||
  localStorage.DEBUG_RZ === '1'
);

showBoot('aguardando...');
init();
if (typeof window !== 'undefined') window.computeFinance = computeFinance;
initIndicators?.();
initRzBinding?.();
initActionsPanel?.();
// Iniciar NCM; não deve travar a UI; em localhost deve retornar 'skipped'
Promise.resolve(startNcmQueue?.()).finally(() => hideBoot());
// Fallback de segurança:
setTimeout(() => hideBoot(), 2000);

if (__debug) {
  import('./debug/traceRZ.js').then(m => m.enableRzDebug?.());
}

