// src/components/app.js
import { iniciarLeitura, pararLeitura } from '../utils/scan.js';
import { processarPlanilha } from '../utils/excel.js';
import store from '../store/index.js';

const log = (...a) => console.log('[CONF-DBG]', ...a);

function sum(obj){ return Object.values(obj || {}).reduce((a,b)=>a+(Number(b)||0),0); }

function getCountsForRZ(rz) {
  const totalMap = store.state.totalByRZSku?.[rz] || {};
  const confMap  = store.state.conferidosByRZSku?.[rz] || {};
  const total = sum(totalMap);
  const conf  = sum(confMap);
  const pend  = Math.max(0, total - conf);
  return { conferidos: conf, pendentes: pend };
}

function renderCounts() {
  const rz = store.state.currentRZ;
  const { conferidos, pendentes } = getCountsForRZ(rz);
  const elConf = document.getElementById('count-conferidos');
  const elPend = document.getElementById('count-pendentes');
  if (elConf) elConf.textContent = String(conferidos);
  if (elPend) elPend.textContent = String(pendentes);
}

function normalizar(c){
  return String(c || '').replace(/\s+/g,'').toLowerCase();
}

function registrarConferido(raw) {
  const rz = store.state.currentRZ;
  const lidoBruto = String(raw || '').trim();
  if (!rz || !lidoBruto) {
    console.warn('[CONF] sem RZ ou SKU');
    return;
  }

  const nLido = normalizar(lidoBruto);

  const totalMap = store.state.totalByRZSku?.[rz] || {};
  const confMap  = (store.state.conferidosByRZSku[rz] ||= {});

  let skuMatch = null;
  for (const sku of Object.keys(totalMap)) {
    const nSku = normalizar(sku);
    if (nLido.includes(nSku) || nSku.includes(nLido)) {
      skuMatch = sku;
      break;
    }
  }

  if (!skuMatch) {
    console.log('[SCAN]', lidoBruto, '→ não encontrado');
    alert('Produto não encontrado no lote atual');
    const el = document.querySelector('#codigoInput') || document.querySelector('input[type="text"]');
    if (el) {
      const old = el.style.backgroundColor;
      el.style.backgroundColor = '#faa';
      setTimeout(()=>{ el.style.backgroundColor = old; }, 500);
    }
    return;
  }

  const total = Number(totalMap[skuMatch] || 0);
  const atual = Number(confMap[skuMatch] || 0);

  if (atual >= total) {
    console.log('[SCAN]', lidoBruto, '→ já conferido');
    console.info('[CONF] SKU já conferido no limite:', skuMatch, `${atual}/${total}`);
    return;
  }

  confMap[skuMatch] = atual + 1;
  console.log('[SCAN]', lidoBruto, '→ registrado como', skuMatch);
  renderCounts();
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
    document.querySelector('input[placeholder="Código do produto"]') ||
    document.querySelector('input[type="text"]');

  const btnRegistrar =
    document.querySelector('button#btn-registrar') ||
    Array.from(document.querySelectorAll('button')).find(b => /Registrar/i.test(b.textContent));

  function clearAndFocus(){
    if (codeInput) { codeInput.select(); codeInput.focus(); }
  }

  if (!window._bindRegistrarOnce) {
    window._bindRegistrarOnce = true;
    codeInput?.addEventListener('keydown', (ev)=>{
      if (ev.key === 'Enter') {
        registrarConferido(codeInput.value);
        clearAndFocus();
      }
    });
    if (btnRegistrar) {
      btnRegistrar.addEventListener('click', ()=>{
        registrarConferido(codeInput?.value);
        clearAndFocus();
      });
    }
  }

  // Captura global para leitores USB que atuam como teclado
  if (!window._bindGlobalScanOnce) {
    window._bindGlobalScanOnce = true;
    let buffer = '';
    window.addEventListener('keydown', (ev) => {
      if (isScanning) return; // apenas no modo manual
      const tgt = ev.target;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (ev.key === 'Enter') {
        if (buffer) {
          const input = document.querySelector('#codigoInput') || document.querySelector('input[type="text"]');
          if (input) input.value = buffer;
          registrarConferido(buffer);
        }
        buffer = '';
      } else if (ev.key === 'Backspace') {
        buffer = buffer.slice(0, -1);
      } else if (ev.key.length === 1) {
        buffer += ev.key;
      }
    });
  }

  if (!fileInput || !rzSelect || !btnAuto || !videoEl) {
    console.error('[INIT-ERRO] Elementos não encontrados', { fileInput, rzSelect, btnAuto, videoEl });
    setBoot('elementos faltando ❌ (veja Console)');
    return;
  }

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
    renderCounts();
  });

  // ===== Seleção de RZ =====
  rzSelect.addEventListener('change', (e) => {
    const rz = e.target.value || null;
    store.state.currentRZ = rz;
    renderCounts();
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
      await iniciarLeitura(videoEl, (texto) => {
        registrarConferido(texto);
        if (codeInput) codeInput.value = texto;
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
