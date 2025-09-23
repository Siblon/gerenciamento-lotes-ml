import '../styles.css';
import '../styles/icons.css';
import * as storeModule from '../store/index.js';
import { initIndicators, computeFinance } from './Indicators.js';
import { initActionsPanel } from './ActionsPanel.js';
import { initRzBinding } from './RzBinding.js';
import { hideBoot, showBoot } from '../utils/boot.js';
import Alert from './ui/Alert.js';

// store singleton
const { init } = storeModule;
const store = Object.prototype.hasOwnProperty.call(storeModule, 'default')
  ? storeModule.default
  : storeModule;

let autoRzAlertHost = null;
let autoRzAlertEl = null;
let autoRzListenerBound = false;

function ensureAutoRzAlertHost() {
  if (autoRzAlertHost?.isConnected) return autoRzAlertHost;
  const card = document.getElementById('card-importacao');
  if (!card) return null;
  const container = card.querySelector('.card-body') || card;
  let host = container.querySelector('[data-role="auto-rz-alert"]');
  if (!host) {
    host = document.createElement('div');
    host.dataset.role = 'auto-rz-alert';
    container.insertAdjacentElement?.('afterbegin', host) ||
      container.prepend?.(host) ||
      container.insertBefore?.(host, container.firstChild ?? null) ||
      container.appendChild?.(host);
  }
  autoRzAlertHost = host;
  return host;
}

function mountAutoRzAlert(message) {
  const host = ensureAutoRzAlertHost();
  if (!host) return;
  host.innerHTML = '';
  autoRzAlertEl = Alert({ message });
  if (autoRzAlertEl) host.appendChild(autoRzAlertEl);
}

export function clearAutoRzAlert() {
  if (autoRzAlertHost?.isConnected) {
    autoRzAlertHost.innerHTML = '';
  }
  autoRzAlertEl = null;
}

export function applyAutoRzSelection(rzAuto) {
  if (!rzAuto) {
    clearAutoRzAlert();
    return;
  }

  const select = document.getElementById('select-rz');
  if (select) {
    const hasOption = Array.from(select.options || []).some((opt) => opt.value === rzAuto);
    if (!hasOption) {
      const opt = document.createElement('option');
      opt.value = rzAuto;
      opt.textContent = rzAuto;
      select.prepend?.(opt) || select.appendChild(opt);
    }
    const previous = select.value;
    select.value = rzAuto;
    if (previous !== rzAuto) {
      select.dispatchEvent?.(new Event('change', { bubbles: true }));
    }
  }

  mountAutoRzAlert(`⚠️ Nenhuma coluna RZ encontrada. Usando ${rzAuto}`);
}

function setupAutoRzListener() {
  if (autoRzListenerBound) return;
  autoRzListenerBound = true;
  if (typeof store.on === 'function') {
    store.on('rz:auto', (value) => {
      applyAutoRzSelection(value || null);
    });
  }
}

/**
 * Captura o upload da planilha e alimenta o store
 */
function setupFileImport() {
  const input = document.getElementById('file');
  if (!input) return;

  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showBoot('Importando planilha...');
    try {
      const excel = await import('../utils/excel.js');
      const processFn = excel.processarPlanilha; // <- usamos processarPlanilha

      if (typeof processFn !== 'function') {
        throw new Error('processarPlanilha não encontrada em utils/excel.js');
      }

      const result = await processFn(file);
      if (result?.rzAuto) {
        store.emit?.('rz:auto', result.rzAuto);
      }
    } catch (err) {
      console.error('Erro ao importar planilha:', err);
      mountAutoRzAlert('❌ Falha ao importar planilha');
    } finally {
      hideBoot();
    }
  });
}

export function initApp() {
  showBoot('aguardando...');
  init();
  if (typeof window !== 'undefined') window.computeFinance = computeFinance;
  initIndicators?.();
  initRzBinding?.();
  initActionsPanel?.();
  setupAutoRzListener();
  setupFileImport(); // agora o input #file é monitorado
  if (store?.state?.rzAuto) {
    applyAutoRzSelection(store.state.rzAuto);
  }
  hideBoot();
}

export default { initApp };
