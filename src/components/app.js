// src/components/app.js
import { iniciarLeitura, pararLeitura } from '../utils/scan.js';
import { processarPlanilha } from '../utils/excel.js';
import store, { init as storeInit, selectRZ } from '../store/index.js';

const log = (...a) => console.log('[CONF-DBG]', ...a);
const setBoot = (msg) => {
  const st = document.getElementById('boot-status');
  if (st) st.innerHTML = `<strong>Boot:</strong> ${msg}`;
};

let isScanning = false;

export function initApp() {
  console.log('[CONF] app module loaded');
  try { if (typeof storeInit === 'function') storeInit(); } catch {}

  const fileInput = document.querySelector('#input-arquivo');
  const rzSelect  = document.querySelector('#select-rz');
  const btnAuto   = document.querySelector('#btn-scan-auto') || document.querySelector('button#ler-codigo, button[aria-label="Ler código"]');
  const btnStop   = document.querySelector('#btn-scan-stop');
  const videoEl   = document.querySelector('#preview');

  // campo onde vamos jogar o código lido (fallback por placeholder)
  const codeInput =
    document.querySelector('#codigoInput') ||
    document.querySelector('input[placeholder="Código do produto"]') ||
    document.querySelector('input[type="text"]');

  if (!fileInput || !rzSelect || !btnAuto || !videoEl) {
    console.error('[INIT-ERRO] Elementos não encontrados', { fileInput, rzSelect, btnAuto, videoEl });
    setBoot('elementos faltando ❌ (veja Console)');
    return;
  }

  // ===== Upload planilha → processa → popula RZ =====
  fileInput.addEventListener('change', async (e) => {
    const f = e.target?.files?.[0];
    if (!f) { log('Nenhum arquivo selecionado'); return; }
    log('Arquivo selecionado:', f.name);

    try {
      const buf = (f.arrayBuffer ? await f.arrayBuffer() : f);
      const { rzList } = await processarPlanilha(buf);
      const list = store?.state?.rzList || rzList || [];
      log('RZs carregados:', list.length, list);

      renderRZOptions(rzSelect, list);

      // auto‑seleciona se só houver 1 RZ
      if (list.length === 1) {
        rzSelect.value = list[0];
        if (store && typeof store.dispatch === 'function') {
          store.dispatch(selectRZ(list[0]));
        } else {
          if (!store.state) store.state = {};
          store.state.currentRZ = list[0];
        }
        log('RZ auto‑selecionado:', list[0]);
      }

      if (typeof window.render === 'function') window.render();
      setBoot(`Planilha OK (${list.length} RZs) ✅`);
    } catch (err) {
      console.error('Falha processarPlanilha', err);
      setBoot('Erro na planilha ❌ (veja Console)');
    }
  });

  // ===== Seleção de RZ =====
  rzSelect.addEventListener('change', (e) => {
    const rz = e.target.value || null;
    if (store && typeof store.dispatch === 'function') {
      store.dispatch(selectRZ(rz));
    } else {
      // fallback para store simples
      if (!store.state) store.state = {};
      store.state.currentRZ = rz;
    }
    log('RZ selecionado:', rz);
    if (typeof window.render === 'function') window.render();
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
        log('Código lido:', texto);
        // joga no input de código, se houver
        if (codeInput) {
          codeInput.value = texto;
          // dispara Enter caso você já trate registro via keypress
          const ev = new KeyboardEvent('keydown', { key: 'Enter' });
          codeInput.dispatchEvent(ev);
        }
        // aqui você pode chamar diretamente sua rotina de consulta/registro, se preferir
        // ex: consultar(texto) ou registrar(texto)
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
