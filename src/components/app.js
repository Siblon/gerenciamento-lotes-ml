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
import { wireNcmToggle, renderExcedentes, renderCounts, loadSettings, saveSettings, refreshLoteSelector } from '../utils/ui.js';
import { db } from '../db/indexed.js';
import store from '../store/index.js';

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
  wireNcmToggle();
  window.refreshExcedentesTable = renderExcedentes;
  refreshLoteSelector();
  renderExcedentes();
  renderCounts();
  refreshIndicators();
  window.refreshKpis?.();
  render();
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

// ===== Export helpers =====
function toCSV(rows, headers) {
  const esc = v => {
    const s = (v == null ? '' : String(v));
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const head = headers.map(esc).join(';');
  const body = rows.map(r => headers.map(h => esc(r[h])).join(';')).join('\n');
  return head + '\n' + body;
}

function downloadFile(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCSV(name, rows, headers) {
  const csv = toCSV(rows, headers);
  downloadFile(name, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
}

async function doExport() {
  try {
    const lotId = window.currentLotId;
    const itens = await db.itens.where('lotId').equals(lotId).toArray();
    const conferidosRaw = await db.conferidos.where('lotId').equals(lotId).toArray();
    const excedentesRaw = await db.excedentes.where('lotId').equals(lotId).toArray();

    const itemMap = {};
    itens.forEach(it => { itemMap[it.sku] = it; });

    const conferidos = conferidosRaw.map(it => {
      const meta = itemMap[it.sku] || {};
      const preco = Number(meta.precoML || 0);
      const qtd = Number(it.qtd || 0);
      return {
        SKU: it.sku,
        Descrição: meta.descricao || '',
        Qtd: qtd,
        'Preço Médio (R$)': preco,
        'Valor Total (R$)': qtd * preco,
        Status: 'Conferido'
      };
    });

    const confSet = new Set(conferidosRaw.map(it => it.sku));
    const excSet = new Set(excedentesRaw.map(it => it.sku));
    const pendentes = itens.filter(it => !confSet.has(it.sku) && !excSet.has(it.sku)).map(it => ({
      SKU: it.sku,
      Descrição: it.descricao || '',
      Qtd: it.qtd,
      'Preço Médio (R$)': it.precoML || 0,
      'Valor Total (R$)': (it.qtd || 0) * (it.precoML || 0),
      Status: 'Pendente'
    }));

    const excedentes = excedentesRaw.map(ex => ({
      SKU: ex.sku,
      Descrição: ex.descricao || '',
      Qtd: ex.qtd || 0,
      'Preço Unitário (R$)': ex.preco_unit ?? '',
      'Valor Total (R$)': (ex.preco_unit == null ? '' : (Number(ex.preco_unit) * Number(ex.qtd || 0))),
      Status: 'Excedente'
    }));

    const hConf = ['SKU','Descrição','Qtd','Preço Médio (R$)','Valor Total (R$)','Status'];
    const hPend = ['SKU','Descrição','Qtd','Preço Médio (R$)','Valor Total (R$)','Status'];
    const hExc  = ['SKU','Descrição','Qtd','Preço Unitário (R$)','Valor Total (R$)','Status'];

    const hasXLSX = typeof window !== 'undefined' && window.XLSX && typeof XLSX.utils?.book_new === 'function';

    if (hasXLSX) {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(conferidos, { header: hConf }), 'Conferidos');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pendentes , { header: hPend }), 'Pendentes');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excedentes, { header: hExc  }), 'Excedentes');
      const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      downloadFile(`conferencia_${new Date().toISOString().slice(0,10)}.xlsx`, new Blob([wbout], { type: 'application/octet-stream' }));
    } else {
      exportCSV(`conferidos_${new Date().toISOString().slice(0,10)}.csv`, conferidos, hConf);
      exportCSV(`pendentes_${new Date().toISOString().slice(0,10)}.csv`,  pendentes , hPend);
      exportCSV(`excedentes_${new Date().toISOString().slice(0,10)}.csv`, excedentes, hExc );
    }
  } catch (e) {
    console.error(e);
  }
}

// Ligar no botão:
(function wireExportButton(){
  const btn = document.getElementById('exportBtn');
  if (!btn) return;
  btn.addEventListener('click', doExport);
})();
