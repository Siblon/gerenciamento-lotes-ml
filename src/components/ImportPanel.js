// src/components/ImportPanel.js
import { parsePlanilha } from '../utils/excel.js';
import store, { setCurrentRZ, setRZs, setItens } from '../store/index.js';
import { startNcmQueue } from '../services/ncmQueue.js';
import { toast } from '../utils/toast.js';
import { loadSettings, renderCounts, renderExcedentes } from '../utils/ui.js';
import { importPlanilhaAsLot } from '../services/importer.js';
import { initLotSelector } from './LotSelector.js';

export function initImportPanel(render){
  const fileInput = document.getElementById('file');
  const fileName  = document.getElementById('file-name');
  const rzSelect  = document.getElementById('select-rz');

  let ncmActive = !!loadSettings().resolveNcm;

  fileInput?.addEventListener('change', async (e)=>{
    const f = e.target?.files?.[0];
    const name = f?.name || '';
    if (fileName) {
      fileName.textContent = name;
      fileName.title = name;
    }
    if (!f) return;
    const buf = (f.arrayBuffer ? await f.arrayBuffer() : f);
    let rzs = [];
    let itens = [];
    try {
      ({ rzs, itens } = await parsePlanilha(buf));
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível processar a planilha...');
      return;
    }

    try {
      await importPlanilhaAsLot({
        file: f,
        selectedRz: rzs[0],
        parsedItems: itens.map(it => ({
          sku: it.codigoML,
          descricao: it.descricao,
          qtd: it.qtd,
          preco_ml_unit: it.valorUnit,
          valor_total: Number(it.valorUnit || 0) * Number(it.qtd || 0),
          status: 'pendente'
        }))
      });
      initLotSelector();
    } catch (err) {
      console.error(err);
    }
    setRZs(rzs);
    setItens(itens);
    renderExcedentes();
    renderCounts();
    window.dispatchEvent?.(new CustomEvent('app:changed', { detail: { type: 'import' } }));
    try {
      if (ncmActive) startNcmQueue(itens);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível processar a planilha...');
    }
    if (rzSelect){
      rzSelect.innerHTML = rzs.map(rz=>`<option value="${rz}">${rz}</option>`).join('');
      if (rzs.length){
        rzSelect.value = rzs[0];
        setCurrentRZ(rzs[0]);
      }
    } else {
      setCurrentRZ(rzs[0] || null);
    }
    render?.();
  });

  rzSelect?.addEventListener('change', e=>{
    setCurrentRZ(e.target.value || null);
    render?.();
    const input = document.querySelector('#input-codigo-produto');
    if (input) { input.focus(); input.select(); }
  });

  const badge = document.getElementById('ncm-badge');
  const badgeCount = document.getElementById('ncm-badge-count');
  document.addEventListener('ncm-progress', e=>{
    if(!ncmActive || !badge) return;
    const { done, total } = e.detail;
    if(total > 0 && done < total){
      badge.hidden = false;
      if(badgeCount) badgeCount.textContent = `${done}/${total}`;
    }else{
      badge.hidden = true;
    }
  });

  document.addEventListener('ncm-pref-changed', ev => {
    ncmActive = !!ev.detail?.enabled;
    if(!ncmActive) badge.hidden = true;
  });
}
