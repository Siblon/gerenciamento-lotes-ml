// src/components/app.js
import { iniciarLeitura, pararLeitura } from '../utils/scan.js';
import { processarPlanilha } from '../utils/excel.js';
import store from '../store/index.js';

const log = (...a) => console.log('[CONF-DBG]', ...a);

// helpers
const up = s => String(s||'').trim().toUpperCase();
const sum = o => Object.values(o||{}).reduce((a,b)=>a+(Number(b)||0),0);

function getCountsForRZ(rz) {
  const total = sum(store.state.totalByRZSku?.[rz] || {});
  const conf  = sum(store.state.conferidosByRZSku?.[rz] || {});
  return { conferidos: conf, pendentes: Math.max(0, total - conf) };
}

function renderCounts() {
  const rz = store.state.currentRZ;
  const { conferidos, pendentes } = getCountsForRZ(rz);
  (document.getElementById('count-conferidos')||{}).textContent = String(conferidos);
  (document.getElementById('count-pendentes')||{}).textContent = String(pendentes);
}

function groupPendentes(rz) {
  const items = store.state.itemsByRZ?.[rz] || [];
  const totals = store.state.totalByRZSku?.[rz] || {};
  const confs  = store.state.conferidosByRZSku?.[rz] || {};

  // agrega por SKU
  const map = {};
  for (const it of items) {
    const sku = up(it.codigoML);
    if (!sku) continue;
    const pend = (totals[sku] || 0) - (confs[sku] || 0);
    if (pend <= 0) continue;
    const r = (map[sku] ||= { sku, descricao: it.descricao, qtd: 0, vSum: 0, qSum: 0 });
    const q = Number(it.qtd)||0;
    r.qtd  = pend; // sempre refletir o pendente atual
    r.vSum += (Number(it.valorUnit)||0) * q;
    r.qSum += q;
  }
  // calcula preço médio ponderado e total R$
  return Object.values(map).map(r => ({
    sku: r.sku,
    descricao: r.descricao,
    qtd: r.qtd,
    precoMedio: r.qSum ? (r.vSum / r.qSum) : 0,
    valorTotal: r.qtd * (r.qSum ? (r.vSum / r.qSum) : 0),
  }));
}

function renderPendentes(limit = 50) {
  const rz = store.state.currentRZ;
  const rows = groupPendentes(rz).slice(0, limit);
  const tbody = document.querySelector('#tbl-pendentes tbody');
  if (!tbody) return;
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.sku}</td>
      <td>${r.descricao ?? ''}</td>
      <td style="text-align:right">${r.qtd}</td>
      <td style="text-align:right">${r.precoMedio.toFixed(2)}</td>
      <td style="text-align:right">${r.valorTotal.toFixed(2)}</td>
    </tr>
  `).join('') || `<tr><td colspan="5" style="text-align:center;color:#777">Sem pendências para este RZ</td></tr>`;
}

function refreshUI() {
  renderCounts();
  const sel = document.querySelector('#sel-limit-pendentes');
  const limit = Number(sel?.value || 50);
  renderPendentes(limit);
}

function registrarCodigo(raw) {
  const rz = store.state.currentRZ;
  const sku = up(raw);
  if (!rz || !sku) return;

  const totals = store.state.totalByRZSku?.[rz] || {};
  if (!totals[sku]) {
    console.info('[CONF] SKU fora do RZ atual:', sku);
    refreshUI();
    return;
  }
  const confs  = (store.state.conferidosByRZSku[rz] ||= {});
  const atual  = Number(confs[sku] || 0);
  const limite = Number(totals[sku] || 0);
  if (atual >= limite) {
    console.info('[CONF] SKU já conferido ao máximo:', sku, `${atual}/${limite}`);
    refreshUI();
    return;
  }
  confs[sku] = atual + 1; // 1 por leitura/enter
  refreshUI();
}

const setBoot = (msg) => {
  const st = document.getElementById('boot-status');
  if (st) st.innerHTML = `<strong>Boot:</strong> ${msg}`;
};

let isScanning = false;

export function initApp() {
  console.log('[CONF] app module loaded');

  const fileInput = document.querySelector('#input-arquivo');
  const rzSelect  = document.querySelector('#select-rz');
  const btnAuto   = document.querySelector('#btn-scan-auto') || document.querySelector('button#ler-codigo, button[aria-label="Ler código"]');
  const btnStop   = document.querySelector('#btn-scan-stop');
  const videoEl   = document.querySelector('#preview');

  const codeInput =
    document.querySelector('#codigoInput') ||
    document.querySelector('input[placeholder="Código do produto"]');

  const btnRegistrar = Array.from(document.querySelectorAll('button')).find(b => /registrar/i.test(b.textContent||''));
  const btnFinalizar = Array.from(document.querySelectorAll('button')).find(b=>/finalizar/i.test(b.textContent||''));

  if (!fileInput || !rzSelect || !btnAuto || !videoEl) {
    console.error('[INIT-ERRO] Elementos não encontrados', { fileInput, rzSelect, btnAuto, videoEl });
    setBoot('elementos faltando ❌ (veja Console)');
    return;
  }

  codeInput?.addEventListener('keydown', (ev)=>{
    if (ev.key === 'Enter') {
      registrarCodigo(codeInput.value);
      codeInput.select();
    }
  });
  btnRegistrar?.addEventListener('click', ()=>{
    registrarCodigo(codeInput?.value);
    codeInput?.select();
  });

  // ===== Upload planilha → processa → popula RZ =====
  fileInput.addEventListener('change', async (e) => {
    const f = e.target?.files?.[0];
    if (!f) return;
    const buf = (f.arrayBuffer ? await f.arrayBuffer() : f);
    const { rzList: list } = await processarPlanilha(buf);
    renderRZOptions(rzSelect, list);
    if (list.length) {
      rzSelect.value = list[0];
      store.state.currentRZ = list[0];
    }
    refreshUI();
  });

  // ===== Seleção de RZ =====
  rzSelect.addEventListener('change', (e)=>{
    store.state.currentRZ = e.target.value || null;
    refreshUI();
  });

  // ===== Iniciar scanner =====
  btnAuto.addEventListener('click', async () => {
    if (isScanning) { log('Scanner já ativo, ignorando clique'); return; }

    log('Iniciar scan automático → solicitando câmera');
    try { await navigator.mediaDevices.getUserMedia({ video: true }); } catch (e) {
      console.warn('Permissão de câmera negada/erro', e);
    }

    btnAuto.disabled = true;
    if (btnStop) btnStop.style.display = '';
    isScanning = true;

    try {
      await iniciarLeitura(videoEl, (texto)=>{
        console.log('[SCAN] lido:', texto);
        registrarCodigo(texto);
        if (codeInput) { codeInput.value = texto; codeInput.select(); }
      });
      setBoot('Scanner ativo ▶️');
    } catch (e) {
      console.error('Erro iniciarLeitura', e);
      btnAuto.disabled = false;
      if (btnStop) btnStop.style.display = 'none';
      isScanning = false;
      setBoot('Falha ao iniciar scanner ❌ (veja Console)');
    }
  });

  // ===== Parar scanner =====
  btnStop?.addEventListener('click', async () => {
    if (!isScanning) return;
    log('Parar scan');
    btnStop.disabled = true;
    try {
      await pararLeitura(videoEl);
    } finally {
      isScanning = false;
      btnAuto.disabled = false;
      btnStop.disabled = false;
      btnStop.style.display = 'none';
      setBoot('Scanner parado ⏹️');
    }
  });

  document.querySelector('#sel-limit-pendentes')?.addEventListener('change', refreshUI);

  btnFinalizar?.addEventListener('click', ()=>{
    const rz = store.state.currentRZ;
    const totals = store.state.totalByRZSku?.[rz] || {};
    const confs  = store.state.conferidosByRZSku?.[rz] || {};
    const total  = sum(totals);
    const conf   = sum(confs);
    const pend   = Math.max(0, total - conf);
    alert(`RZ: ${rz}\nConferidos: ${conf}\nPendentes: ${pend}\nTotal: ${total}`);
  });

  // segurança: parar scanner ao sair/navegar
  window.addEventListener('beforeunload', async () => {
    try { await pararLeitura(videoEl); } catch {}
  });

  window.store = store;
}

function renderRZOptions(rzSelect, list) {
  rzSelect.innerHTML =
    '<option value="">Selecione um RZ</option>' +
    list.map(rz => `<option value="${rz}">${rz}</option>`).join('');
}
