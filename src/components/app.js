// src/components/app.js
// Orquestra os painéis da aplicação
import { initImportPanel } from './ImportPanel.js';
import { initActionsPanel } from './ActionsPanel.js';
import { initScannerPanel } from './ScannerPanel.js';
import { renderResults } from './ResultsPanel.js';
import { initNcmPanel } from './NcmPanel.js';
import { initDashboard } from './Dashboard.js';
import { refreshIndicators } from './Indicators.js';
import { updateBoot } from '../utils/boot.js';

export function initApp(){
  const render = () => { renderResults(); window.updateDashboard?.(); };

  const grid = document.querySelector('.page');
  grid?.classList.add('grid');
  const mainCol = grid?.querySelector('.main-col');
  if (mainCol && !document.getElementById('dashboard')) {
    const dash = document.createElement('section');
    dash.id = 'dashboard';
    mainCol.prepend(dash);
  }
  initDashboard();

  const actions = initActionsPanel(render);
  initImportPanel(render);
  initNcmPanel();
  initScannerPanel({
    onCode: (code) => {
      actions.setSku(code);
      actions.handleConsultar('scanner');
    }
  });

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-target]');
    if (!btn) return;
    const targetId = btn.getAttribute('data-target');
    const sec = document.getElementById(targetId);
    if (!sec) return;
    sec.classList.toggle('collapsed');
    btn.textContent = sec.classList.contains('collapsed') ? 'Expandir' : 'Recolher';
  });

  applySettings();
  wireSettingsUI();
  refreshIndicators();
  render();
}

const SETTINGS_KEY = 'confApp.settings';

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s || {}));
}

function applySettings() {
  const s = loadSettings();
  const scannerCard = document.getElementById('card-scanner');
  if (scannerCard) scannerCard.style.display = s.hideScanner ? 'none' : '';
  const selC = document.getElementById('limit-conferidos');
  const selP = document.getElementById('limit-pendentes');
  if (selC && s.pageSize) selC.value = String(s.pageSize);
  if (selP && s.pageSize) selP.value = String(s.pageSize);

  refreshIndicators();
}

function wireSettingsUI() {
  const btn = document.getElementById('btn-settings');
  const dlg = document.getElementById('dlg-settings');
  const chkHide = document.getElementById('cfg-hide-scanner');
  const selSize = document.getElementById('cfg-page-size');

  const inDiscount = document.getElementById('cfg-discount');
  const inAuctionFee = document.getElementById('cfg-auction-fee');
  const inFreight = document.getElementById('cfg-freight');
  const selFreight = document.getElementById('cfg-freight-mode');

  btn?.addEventListener('click', () => {
    const s = loadSettings();
    chkHide.checked = !!s.hideScanner;
    selSize.value = String(s.pageSize || 50);
    inDiscount.value = String(s.discountPct ?? 25);
    inAuctionFee.value = String(s.auctionFeePct ?? 8);
    inFreight.value = String(s.freightTotal ?? 0);
    selFreight.value = String(s.freightMode ?? 'por_unidade');
    dlg.showModal();
  });

  dlg?.addEventListener('close', () => {
    if (dlg.returnValue === 'default') {
      const s = loadSettings();
      s.hideScanner = chkHide.checked;
      s.pageSize = parseInt(selSize.value, 10);
      s.discountPct = Math.max(0, Number(inDiscount.value || 0));
      s.auctionFeePct = Math.max(0, Number(inAuctionFee.value || 0));
      s.freightTotal = Math.max(0, Number(inFreight.value || 0));
      s.freightMode = selFreight.value;
      saveSettings(s);
      applySettings();
      updateBoot('Configurações salvas ⚙️');
    }
  });
}
