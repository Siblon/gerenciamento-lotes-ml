import { NCM_CACHE_KEY } from './config/runtime.js';
import { resolve, normalizeNCM, slug, cacheSet } from './services/ncmService.js';
import { startNcmQueue } from './services/ncmQueue.js';
import store from './store/index.js';
import toast from './utils/toast.js';

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(NCM_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeCache(data) {
  localStorage.setItem(NCM_CACHE_KEY, JSON.stringify(data));
}

const termEl = document.getElementById('term');
const ncmEl = document.getElementById('ncm');
const resultEl = document.getElementById('result');
const queueEl = document.getElementById('queue-items');

// Busca NCM no cache/API
async function onSearch() {
  const term = termEl.value.trim();
  if (!term) return;
  resultEl.textContent = 'Buscando…';
  try {
    const r = await resolve(term);
    if (r?.ncm) {
      ncmEl.value = r.ncm;
      resultEl.textContent = `Fonte: ${r.source}`;
    } else {
      ncmEl.value = '';
      resultEl.textContent = 'NCM não encontrado';
    }
  } catch (err) {
    console.error(err);
    resultEl.textContent = 'Erro na busca';
    toast.error('Erro na busca');
  }
}

// Salva NCM manualmente
function onSave() {
  const term = termEl.value.trim();
  const ncm = normalizeNCM(ncmEl.value);
  if (!term || !ncm) {
    toast.warn('Informe termo e NCM válido');
    return;
  }
  const key = slug(term);
  cacheSet(key, { ncm, source: 'manual', ts: Date.now() });
  toast.success('Salvo no cache');
}

// Exporta cache para JSON
function onExport() {
  const data = localStorage.getItem(NCM_CACHE_KEY) || '{}';
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${NCM_CACHE_KEY}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Importa cache JSON
const fileInput = document.getElementById('file-import');
function onImportFile() { fileInput.click(); }
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result || '{}');
      if (typeof data !== 'object' || Array.isArray(data)) throw new Error('Formato');
      const cache = readCache();
      Object.assign(cache, data);
      writeCache(cache);
      toast.success('Cache importado');
    } catch {
      toast.error('JSON inválido');
    }
  };
  reader.readAsText(file);
  fileInput.value = '';
});

// Limpa cache
function onClear() {
  if (confirm('Limpar todo cache NCM?')) {
    writeCache({});
    toast.info('Cache limpo');
  }
}

// Dispara fila de NCM
async function onQueue() {
  let items;
  try {
    items = JSON.parse(queueEl.value || '[]');
  } catch {
    toast.error('JSON inválido');
    return;
  }
  if (!Array.isArray(items) || items.length === 0) {
    toast.warn('Nenhum item informado');
    return;
  }
  for (const it of items) {
    const rz = it.codigoRZ || 'RZ';
    const sku = String(it.codigoML || '').trim().toUpperCase();
    (store.state.itemsByRZ[rz] ||= []).push({ codigoML: sku, descricao: it.descricao });
    (store.state.metaByRZSku[rz] ||= {});
    store.state.metaByRZSku[rz][sku] = { descricao: it.descricao };
  }
  toast.info('Fila iniciada');
  try {
    await startNcmQueue(items);
    toast.success('Fila concluída');
  } catch (err) {
    console.error(err);
    toast.error('Erro na fila');
  }
}

// Bind events
document.getElementById('btn-search').addEventListener('click', onSearch);
document.getElementById('btn-save').addEventListener('click', onSave);
document.getElementById('btn-export').addEventListener('click', onExport);
document.getElementById('btn-import').addEventListener('click', onImportFile);
document.getElementById('btn-clear').addEventListener('click', onClear);
document.getElementById('btn-queue').addEventListener('click', onQueue);

