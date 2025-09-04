import './styles.css';
import { initImportPanel } from './components/ImportPanel.js';
import { initLotSelector } from './components/LotSelector.js';
import { initHealthModal } from './components/HealthModal.js';
import { getCurrentLotId, countByStatus, getItemsByLotAndStatus, clearAll } from './store/db.js';

async function renderPendentes(lotId) {
  const tbody = document.querySelector('#tbl-pendentes tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const rows = await getItemsByLotAndStatus(lotId, 'pending', { limit: 50 });
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.sku}</td>
      <td>${r.descricao}</td>
      <td>${r.qtd}</td>
      <td>${(r.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td>${((r.preco || 0) * (r.qtd || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td>Pendente</td>
    `;
    tbody.appendChild(tr);
  }
}

export async function refreshAll() {
  const lotId = getCurrentLotId();
  if (!lotId) return;

  const counts = await countByStatus(lotId);

  const elTotal = document.getElementById('kpi-total');
  const elConf  = document.getElementById('kpi-conf');
  const elPend  = document.getElementById('kpi-pend');
  const elExc   = document.getElementById('kpi-exc');
  if (elTotal) elTotal.textContent = counts.total;
  if (elConf)  elConf.textContent  = counts.checked;
  if (elPend)  elPend.textContent  = counts.pending;
  if (elExc)   elExc.textContent   = counts.excedente;

  await renderPendentes(lotId);
}
window.refreshAll = refreshAll;

// expose reset for "Zerar dados" button
window.resetAllData = async () => { await clearAll(); window.location.reload(); };

window.addEventListener('DOMContentLoaded', async () => {
  await initLotSelector();
  initImportPanel();
  initHealthModal();
  refreshAll();
});
