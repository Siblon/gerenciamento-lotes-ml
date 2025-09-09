// src/components/Indicators.js
import store from '../store/index.js';
import {
  loadFinanceConfig,
  loadMetricsPrefs,
  saveMetricsPrefs,
  computeItemFinance,
  computeAggregates,
} from '../utils/financeUtils.js';
import { loadPrefs, savePrefs } from '../utils/prefs.js';
import { hideBoot } from '../utils/boot.js';

function brl(n) {
  return (n || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function applyFinanceVisibility(show) {
  const panel = document.getElementById('finance-panel');
  panel?.classList.toggle('collapsed', !show);
}

export function computeFinance(opts = {}) {
  const { includeFrete = false } = opts;
  const cfg = loadFinanceConfig();
  const prefs = loadPrefs();
  const freteTotal =
    prefs.calcFreteMode === 'ao_vivo' || includeFrete ? cfg.frete_total : 0;
  const raw = store.selectAllImportedItems
    ? store.selectAllImportedItems()
    : [];
  const items = raw.map((it) => ({
    sku: it.sku,
    descricao: it.descricao,
    preco_ml_unit: Number(it.preco_ml_unit || 0),
    qtd: Number(it.qtd || 0),
  }));
  const totalQtd = items.reduce((s, it) => s + it.qtd, 0);
  const totalValor = items.reduce(
    (s, it) => s + it.preco_ml_unit * it.qtd,
    0,
  );
  const ctx = { totalQtd, totalValor, frete_total: freteTotal, rateio_frete: cfg.rateio_frete };
  const byItem = items.map((it) => ({
    sku: it.sku,
    descricao: it.descricao,
    qtd: it.qtd,
    preco_ml_unit: it.preco_ml_unit,
    ...computeItemFinance(it, { ...cfg, frete_total: freteTotal }, ctx),
  }));
  const aggregates = computeAggregates(items, {
    ...cfg,
    frete_total: freteTotal,
  });
  return { byItem, aggregates, config: { ...cfg, frete_total: freteTotal } };
}

export function refreshIndicators() {
  try {
    const ui = loadPrefs();
    const metrics = loadMetricsPrefs();
    const sec = document.getElementById('indicadores');
    if (sec) sec.classList.toggle('hidden', !ui.showIndicators);
    const grid = sec?.querySelector('.indicators-grid');
    if (!ui.showIndicators || !grid) return;
    grid.innerHTML = '';
    const { aggregates, config } = computeFinance();
    const mapping = [
      {
        key: 'preco_medio_ml_palete',
        label: 'Preço médio ML (palete)',
        value: aggregates.preco_medio_ml_palete,
        foot: null,
      },
      {
        key: 'custo_medio_pago_palete',
        label: 'Custo pago médio (palete)',
        value: aggregates.custo_medio_pago_palete,
        foot: `pagamos ${Math.round(
          config.percent_pago_sobre_ml * 100,
        )}% do preço ML`,
      },
      {
        key: 'preco_venda_medio_palete',
        label: 'Preço de venda médio (palete)',
        value: aggregates.preco_venda_medio_palete,
        foot: `baseado em desconto ${Math.round(
          config.desconto_venda_vs_ml * 100,
        )}% vs ML`,
      },
      {
        key: 'lucro_total_palete',
        label: 'Lucro total (palete)',
        value: aggregates.lucro_total_palete,
        foot: null,
      },
      {
        key: 'rateio_frete',
        label: 'Rateio do frete',
        value:
          config.rateio_frete === 'valor' ? 'por valor' : 'por quantidade',
        foot: null,
      },
    ];
    mapping.forEach((m) => {
      if (!metrics.visible[m.key]) return;
      const card = document.createElement('article');
      card.className = 'metric-card';
      const lbl = document.createElement('div');
      lbl.className = 'metric-label';
      lbl.textContent = m.label;
      card.appendChild(lbl);
      const val = document.createElement('div');
      val.className = 'metric-value';
      val.textContent =
        m.key === 'rateio_frete' ? m.value : brl(m.value);
      card.appendChild(val);
      if (m.foot) {
        const fn = document.createElement('div');
        fn.className = 'metric-footnote';
        fn.textContent = m.foot;
        card.appendChild(fn);
      }
      grid.appendChild(card);
    });
  } catch (e) {
    console.warn('refreshIndicators', e);
  }
}

window.refreshIndicators = refreshIndicators;

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('confApp.settings')) || {};
  } catch {
    return {};
  }
}

function saveSettings(s) {
  localStorage.setItem('confApp.settings', JSON.stringify(s || {}));
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
      hideBoot();
    }
  });
}

export function initIndicators() {
  const toggleBtn = document.getElementById('toggle-indicators');
  const configBtn = document.getElementById('config-indicators');
  const dialog = document.getElementById('dlg-indicators');
  const options = document.getElementById('metrics-options');
  const applyBtn = document.getElementById('apply-indicators');

  function updateToggle() {
    const p = loadPrefs();
    if (toggleBtn)
      toggleBtn.textContent = p.showIndicators
        ? 'Ocultar indicadores'
        : 'Mostrar indicadores';
  }

  toggleBtn?.addEventListener('click', () => {
    const p = loadPrefs();
    p.showIndicators = !p.showIndicators;
    savePrefs(p);
    updateToggle();
    refreshIndicators();
  });

  configBtn?.addEventListener('click', () => {
    if (!dialog) return;
    const prefs = loadMetricsPrefs();
    options.innerHTML = '';
    const labels = {
      preco_medio_ml_palete: 'Preço médio ML (palete)',
      custo_medio_pago_palete: 'Custo pago médio (palete)',
      preco_venda_medio_palete: 'Preço de venda médio (palete)',
      lucro_total_palete: 'Lucro total (palete)',
      rateio_frete: 'Rateio do frete',
    };
    Object.keys(prefs.visible).forEach((k) => {
      const id = 'chk-' + k;
      const div = document.createElement('div');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = id;
      cb.checked = !!prefs.visible[k];
      const lb = document.createElement('label');
      lb.htmlFor = id;
      lb.textContent = labels[k];
      div.appendChild(cb);
      div.appendChild(lb);
      options.appendChild(div);
    });
    dialog.showModal();
  });

  applyBtn?.addEventListener('click', () => {
    const prefs = loadMetricsPrefs();
    Object.keys(prefs.visible).forEach((k) => {
      const cb = document.getElementById('chk-' + k);
      prefs.visible[k] = !!cb?.checked;
    });
    saveMetricsPrefs(prefs);
    dialog.close();
    refreshIndicators();
  });

  const prefs = loadPrefs();
  applyFinanceVisibility(prefs.showFinance);
  const finTgl = document.getElementById('toggle-finance');
  if (finTgl) {
    finTgl.checked = prefs.showFinance;
    finTgl.addEventListener('change', (e) => {
      const p = loadPrefs();
      p.showFinance = e.target.checked;
      savePrefs(p);
      applyFinanceVisibility(p.showFinance);
    });
  }

  updateToggle();
  refreshIndicators();
  applySettings();
  wireSettingsUI();
}
