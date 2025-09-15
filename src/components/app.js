import '../styles.css';
import '../styles/icons.css';
import { init } from '../store/index.js';
import { initIndicators, computeFinance } from './Indicators.js';
import { initActionsPanel } from './ActionsPanel.js';
import { initRzBinding } from './RzBinding.js';
import { hideBoot, showBoot } from '../utils/boot.js';

export function initApp() {
  showBoot('aguardando...');
  init();
  if (typeof window !== 'undefined') window.computeFinance = computeFinance;
  initIndicators?.();
  initRzBinding?.();
  initActionsPanel?.();
  hideBoot();
}

export default { initApp };
