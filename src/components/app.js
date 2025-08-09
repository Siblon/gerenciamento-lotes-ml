import { iniciarLeitura, pararLeitura } from '../utils/scan.js';
import { processarPlanilha } from '../utils/excel.js';
import store, { selectRZ } from '../store/index.js';

const log = (...a) => console.log('[CONF-DBG]', ...a);

export function initApp() {
  log('initApp() — conectando handlers');

  const fileInput = document.querySelector('#input-arquivo');
  const rzSelect  = document.querySelector('#select-rz');
  const btnAuto   = document.querySelector('#btn-scan-auto');
  const btnStop   = document.querySelector('#btn-scan-stop');
  const videoEl   = document.querySelector('#preview');

  if (!fileInput || !rzSelect || !btnAuto || !videoEl) {
    console.error('[INIT-ERRO] Elementos não encontrados', { fileInput, rzSelect, btnAuto, videoEl });
    return;
  }

  // Carregar planilha -> popular RZs
  fileInput.addEventListener('change', async (e) => {
    const f = e.target?.files?.[0];
    if (!f) { log('Nenhum arquivo selecionado'); return; }
    log('Arquivo selecionado:', f.name);
    try {
      await processarPlanilha(f);
      const list = store?.state?.rzList || [];
      log('RZs carregados:', list.length, list);
      renderRZOptions(rzSelect, list);
    } catch (err) {
      console.error('Falha processarPlanilha', err);
    }
  });

  // Seleção de RZ
  rzSelect.addEventListener('change', (e) => {
    const rz = e.target.value || null;
    store.dispatch(selectRZ(rz));
    log('RZ selecionado:', rz);
    // se houver render() global, chamar aqui
    if (typeof window.render === 'function') window.render();
  });

  // Iniciar/Parar scanner
  btnAuto.addEventListener('click', async () => {
    log('Iniciar scan automático — solicitando câmera');
    try { await navigator.mediaDevices.getUserMedia({ video: true }); } catch {}
    btnAuto.disabled = true;
    btnStop.style.display = '';
    try {
      await iniciarLeitura(videoEl, (texto) => {
        log('Código lido:', texto);
        // TODO: chamar rotina de consulta/registro existente
      });
    } catch (e) {
      console.error('Erro iniciarLeitura', e);
      btnAuto.disabled = false;
      btnStop.style.display = 'none';
    }
  });

  btnStop.addEventListener('click', async () => {
    log('Parar scan');
    btnStop.disabled = true;
    await pararLeitura(videoEl);
    btnAuto.disabled = false;
    btnStop.disabled = false;
    btnStop.style.display = 'none';
  });
}

function renderRZOptions(rzSelect, list) {
  rzSelect.innerHTML =
    '<option value="">Selecione um RZ</option>' +
    list.map(rz => `<option value="${rz}">${rz}</option>`).join('');
}

