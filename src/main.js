// Main application entry point
import './styles.css';
import { init } from './store/index.js';
import { startNcmQueue } from './services/ncmQueue.js';
import { initIndicators, computeFinance } from './components/Indicators.js';
import { initActionsPanel } from './components/ActionsPanel.js';
import { initRzBinding } from './components/RzBinding.js';
import { hideBoot, showBoot } from './utils/boot.js';

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

