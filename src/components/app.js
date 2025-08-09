// src/components/app.js
import { iniciarLeitura, pararLeitura } from '../utils/scan.js';
import { processarPlanilha } from '../utils/excel.js';
import store, { init as storeInit, selectRZ } from '../store/index.js';

const log = (...a) => console.log('[CONF-DBG]', ...a);

export function initApp() {
  console.log('[CONF] app module loaded');
  try { if (typeof storeInit === 'function') storeInit(); } catch {}

  const fileInput = document.querySelector('#input-arquivo');
  const rzSelect  = document.querySelector('#select-rz');
  const btnAuto   = document.querySelector('#btn-scan-auto') || document.querySelector('button#ler-codigo, button[aria-label="Ler código"]');
  const btnStop   = document.querySelector('#btn-scan-stop');
  const videoEl   = document.querySelector('#preview');

  if (!fileInput || !rzSelect || !btnAuto || !videoEl) {
    console.error('[INIT-ERRO] Elementos não encontrados', { fileInput, rzSelect, btnAuto, videoEl });
    const st = document.getElementById('boot-status'); if (st) st.innerHTML = '<strong>Boot:</strong> elementos faltando ❌ (veja Console)';
    return;
  }

  // Upload planilha → processa → popula RZ
  fileInput.addEventListener('change', async (e) => {
    const f = e.target?.files?.[0];
    if (!f) { log('Nenhum arquivo selecionado'); return; }
    log('Arquivo selecionado:', f.name);
    try {
      // compat: aceita File ou ArrayBuffer, conforme implementado em processarPlanilha
      const maybeBuffer = await f.arrayBuffer?.();
      const result = await processarPlanilha(maybeBuffer || f);
      const list = store?.state?.rzList || result?.rzList || [];
      log('RZs carregados:', list.length, list);
      renderRZOptions(rzSelect, list);
      if (typeof window.render === 'function') window.render();
      const st = document.getElementById('boot-status'); if (st) st.innerHTML = `<strong>Boot:</strong> Planilha OK (${list.length} RZs) ✅`;
    } catch (err) {
      console.error('Falha processarPlanilha', err);
      const st = document.getElementById('boot-status'); if (st) st.innerHTML = '<strong>Boot:</strong> Erro na planilha ❌ (veja Console)';
    }
  });

  rzSelect.addEventListener('change', (e) => {
    const rz = e.target.value || null;
    store.dispatch(selectRZ(rz));
    log('RZ selecionado:', rz);
    if (typeof window.render === 'function') window.render();
  });

  btnAuto.addEventListener('click', async () => {
    log('Iniciar scan automático → solicitando câmera');
    try { await navigator.mediaDevices.getUserMedia({ video: true }); } catch {}
    btnAuto.disabled = true;
    if (btnStop) btnStop.style.display = '';
    try {
      await iniciarLeitura(videoEl, (texto) => {
        log('Código lido:', texto);
        // TODO: chamar rotina de consulta/registro existente
      });
      const st = document.getElementById('boot-status'); if (st) st.innerHTML = '<strong>Boot:</strong> Scanner ativo ▶️';
    } catch (e) {
      console.error('Erro iniciarLeitura', e);
      btnAuto.disabled = false;
      if (btnStop) btnStop.style.display = 'none';
    }
  });

  btnStop?.addEventListener('click', async () => {
    log('Parar scan');
    btnStop.disabled = true;
    await pararLeitura(videoEl);
    btnAuto.disabled = false;
    btnStop.disabled = false;
    btnStop.style.display = 'none';
    const st = document.getElementById('boot-status'); if (st) st.innerHTML = '<strong>Boot:</strong> Scanner parado ⏹️';
  });
}

function renderRZOptions(rzSelect, list) {
  rzSelect.innerHTML =
    '<option value="">Selecione um RZ</option>' +
    list.map(rz => `<option value="${rz}">${rz}</option>`).join('');
}
