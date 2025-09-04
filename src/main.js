import './styles.css';
import { initImportPanel } from './components/ImportPanel.js';
import { initLotSelector } from './components/LotSelector.js';
import { renderPendentes, renderConferidos, renderExcedentes } from './components/Results.js';
import { getCurrentLotId, countByStatus, getItemsByLotAndStatus } from './store/db.js';

export async function loadDashboard(){
  const currentLotId = getCurrentLotId();
  if (!currentLotId){
    renderPendentes([]); renderConferidos([]); renderExcedentes([]);
    const hdr = document.getElementById('hdr-conferidos'); if (hdr) hdr.textContent = '0 de 0 conferidos';
    ['count-conferidos','count-pendentes','excedentesCount'].forEach(id=>{const el=document.getElementById(id); if(el) el.textContent='0';});
    return;
  }
  const counts = await countByStatus(currentLotId);
  const total = counts.pending + counts.checked + counts.excedente;
  const hdr = document.getElementById('hdr-conferidos'); if (hdr) hdr.textContent = `${counts.checked} de ${total} conferidos`;
  const bc = document.getElementById('count-conferidos'); if (bc) bc.textContent = counts.checked;
  const bp = document.getElementById('count-pendentes'); if (bp) bp.textContent = counts.pending;
  const be = document.getElementById('excedentesCount'); if (be) be.textContent = counts.excedente;

  const pendLimit = Number(document.getElementById('limit-pendentes')?.value || 50);
  const confLimit = Number(document.getElementById('limit-conferidos')?.value || 50);
  const pend = await getItemsByLotAndStatus(currentLotId,'pending',{limit:pendLimit});
  const conf = await getItemsByLotAndStatus(currentLotId,'checked',{limit:confLimit});
  const exc = await getItemsByLotAndStatus(currentLotId,'excedente',{limit:50});
  renderPendentes(pend);
  renderConferidos(conf);
  renderExcedentes(exc);
}

window.refreshAll = loadDashboard;

window.addEventListener('DOMContentLoaded', async () => {
  await initLotSelector();
  initImportPanel();
  loadDashboard();
});
