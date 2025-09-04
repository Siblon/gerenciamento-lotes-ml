// src/components/ImportPanel.js
import { parsePlanilha } from '../utils/excel.js';
import store, { setCurrentRZ, setRZs, setItens } from '../store/index.js';
import { exportWorkbook } from '@/services/exportExcel';
import { startNcmQueue } from '../services/ncmQueue.js';
import { toast } from '../utils/toast.js';
import { loadSettings, renderCounts, renderExcedentes } from '../utils/ui.js';
import { importPlanilhaAsLot, wireLotFileCapture, wireRzCapture, loadMeta } from '../services/importer.js';
import { initLotSelector } from './LotSelector.js';
import { updateBoot } from '../utils/boot.js';
import { db, resetAll, setSetting } from '../store/db.js';

export function initImportPanel(render){
  const fileInput = document.getElementById('file');
  const fileName  = document.getElementById('file-name');
  const rzSelect  = document.getElementById('select-rz');
  // hidratar UI com meta salvo
  const meta = loadMeta();
  if (rzSelect && meta.rz) rzSelect.value = meta.rz;

  wireLotFileCapture(fileInput);
  wireRzCapture(rzSelect);

  // botão de reset
  ensureResetButton();

  let ncmActive = !!loadSettings().resolveNcm;

  const currentMeta = () => {
    const rz = document.querySelector('#select-rz')?.value || store.selectRz?.() || '';
    const lote = document.querySelector('#select-lote')?.value || store.selectLote?.() || '';
    return { rz, lote };
  };

  fileInput?.addEventListener('change', async (e)=>{
    const f = e.target?.files?.[0];
    const name = f?.name || '';
    if (fileName) {
      fileName.textContent = name;
      fileName.title = name;
    }
    if (!f) return;
      const loteName = name;
      await setSetting('loteName', loteName);
    updateBoot(`Lote carregado: <strong>${loteName}</strong> — prossiga com a importação.`);
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
      const initialRz = (meta.rz && rzs.includes(meta.rz)) ? meta.rz : rzs[0];
      if (initialRz){
        rzSelect.value = initialRz;
        setCurrentRZ(initialRz);
      }
    } else {
      setCurrentRZ(rzs[0] || null);
    }
    render?.();
  });

    rzSelect?.addEventListener('change', async e=>{
      setCurrentRZ(e.target.value || null);
      await setSetting('rz', e.target.value || '');
      updateBoot(`RZ atual: <strong>${e.target.value}</strong>`);
    render?.();
    const input = document.querySelector('#input-codigo-produto');
    if (input) { input.focus(); input.select(); }
  });

  document.getElementById('btn-export')?.addEventListener('click', () => {
    const items = store.selectAllItems ? store.selectAllItems() : [];
    const conferidos = items.filter(i => i.status === 'Conferido');
    const excedentes = items.filter(i => i.status === 'Excedente');
    const pendentes = items.filter(i => (i.status ?? 'Pendente') === 'Pendente');

    exportWorkbook({
      conferidos, pendentes, excedentes,
      meta: currentMeta()
    });
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

function ensureResetButton() {
  const host = document.querySelector('#card-importacao .card-header, #card-importacao .card-body') || document.body;
  if (!host || typeof host.querySelector !== 'function' || host.querySelector('#btn-reset-db')) return;
  const btn = document.createElement('button');
  btn.id = 'btn-reset-db';
  btn.className = 'btn btn-ghost';
  btn.type = 'button';
  btn.textContent = 'Zerar dados';
  btn.title = 'Limpar banco e começar novo palete';
  btn.style.marginLeft = '8px';
  host.appendChild(btn);

  btn.addEventListener('click', async () => {
    if (!confirm('Zerar todos os dados (itens, excedentes e preferências)?')) return;
      await resetAll();
    updateBoot('Banco limpo. Você pode importar uma nova planilha e selecionar o RZ.');
    // opcional: também limpe elementos visuais/contadores via eventos do seu store
  });
}
