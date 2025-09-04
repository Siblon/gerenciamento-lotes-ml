// src/main.js
import './styles.css';
import { initApp } from './components/app.js';
import { initIndicators } from './components/Indicators.js';
import { initScannerUI } from './components/ScannerUI.js';
import './components/ExcedenteDialog.js';
import './utils/kpis.js';
import { initLotSelector } from './components/LotSelector.js';
import { exportarLoteAtual } from './services/exportExcel.js';
import db, { getSetting } from './store/db.js';
import store, { setRZs, setItens, setCurrentRZ } from './store/index.js';
import { renderCounts, renderExcedentes } from './utils/ui.js';
import { startAutoBackup, downloadSnapshot } from './services/backup.js';
import { loadMeta } from './services/importer.js';

if (import.meta.env?.DEV) {
  window.__DEBUG_SCAN__ = true;
}

async function preloadFromDb() {
  const activeLotId = await getSetting('activeLotId', null);
  if (!activeLotId) return;
  const lot = await db.lots.get(activeLotId);
  if (!lot) return;
  const items = await db.items.where('lotId').equals(activeLotId).toArray();
  const parsed = items.map(i => ({
    codigoRZ: lot.rz || '',
    codigoML: i.sku,
    descricao: i.desc,
    qtd: i.qtd,
    valorUnit: i.precoMedio
  }));
  if (lot.rz) setRZs([lot.rz]);
  setItens(parsed);
  setCurrentRZ(lot.rz || null);
  for (const it of items) {
    const sku = String(it.sku || '').toUpperCase();
    if (it.status === 'conferido') {
      (store.state.conferidosByRZSku[lot.rz] ||= {})[sku] = {
        qtd: it.qtd,
        precoAjustado: it.precoMedio,
        observacao: null,
        status: 'conferido'
      };
    } else if (it.status === 'excedente') {
      (store.state.excedentes[lot.rz] ||= []).push({
        sku: it.sku,
        descricao: it.desc,
        qtd: it.qtd,
        preco_unit: it.precoMedio
      });
    }
  }
  renderExcedentes();
  renderCounts();
}

window.addEventListener('DOMContentLoaded', async () => {
  await preloadFromDb();
  initApp();
  initIndicators();
  initScannerUI();
  initLotSelector();
  const btnExport = document.getElementById('btn-exportar');
  btnExport?.addEventListener('click', async () => {
    const meta = loadMeta();
    await exportarLoteAtual(meta);
  });
  // Inicia backup automático a cada 30s
  try { startAutoBackup(db, { intervalMs: 30_000 }); } catch {}
  const btnBk = document.getElementById('btn-download-backup');
  btnBk?.addEventListener('click', () => downloadSnapshot(db));
});
