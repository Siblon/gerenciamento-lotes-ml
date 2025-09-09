import { init } from './store/index.js';
import { startNcmQueue } from './services/ncmQueue.js';
import { initIndicators, computeFinance } from './components/Indicators.js';
import { initActionsPanel } from './components/ActionsPanel.js';

init();
window.computeFinance = computeFinance;
initIndicators?.();
initActionsPanel?.();
startNcmQueue();
