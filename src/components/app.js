import { iniciarLeitura, pararLeitura } from '../utils/scan.js';
import { processarPlanilha } from '../utils/excel.js';
import store, { selectRZ } from '../store/index.js';

const dbg = (...a)=>console.log('[CONF-DBG]', ...a);
window.__DEBUG_SCAN__ = true; // deixar true por enquanto

const fileInput = document.querySelector('#input-arquivo');
const rzSelect  = document.querySelector('#select-rz');
const btnAuto   = document.querySelector('#btn-scan-auto') || document.querySelector('#btn-ler-codigo');
const btnStop   = document.querySelector('#btn-scan-stop');
const videoEl   = document.querySelector('#preview');

function renderRZOptions() {
  const list = store?.state?.rzList || [];
  rzSelect.innerHTML = '<option value="">Selecione um RZ</option>' +
    list.map(rz => `<option value="${rz}">${rz}</option>`).join('');
}

fileInput?.addEventListener('change', async (e) => {
  const f = e.target?.files?.[0];
  if (!f) return;
  dbg('Arquivo selecionado:', f.name);
  try {
    const data = await processarPlanilha(f);
    if (data?.rzs) store.state.rzList = data.rzs;
    dbg('RZs carregados:', store?.state?.rzList?.length, store?.state?.rzList);
    renderRZOptions();
    // se houver um render() global de UI, chamar aqui
    if (typeof render === 'function') render();
  } catch (err) {
    console.error('Falha processarPlanilha', err);
  }
});

rzSelect?.addEventListener('change', (e) => {
  const rz = e.target.value || null;
  selectRZ(rz);
  dbg('RZ selecionado:', rz);
  if (typeof render === 'function') render();
});

btnAuto?.addEventListener('click', async () => {
  dbg('Iniciar scan automático');
  try {
    await navigator.mediaDevices.getUserMedia({video:true}); // força prompt
  } catch {}
  await iniciarLeitura(videoEl, (texto, raw) => {
    dbg('Código lido:', texto);
    // TODO: chamar sua rotina atual de consulta/registro aqui
    // ex: consultar(texto) ou registrar(texto)
  });
});

btnStop?.addEventListener('click', async () => {
  dbg('Parar scan');
  await pararLeitura(videoEl);
});

