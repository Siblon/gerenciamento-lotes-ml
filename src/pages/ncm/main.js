import { RUNTIME, NCM_CACHE_KEY } from '../../config/runtime.js';
import * as ncmSvc from '../../services/ncmService.js';
import { startNcmQueue } from '../../services/ncmQueue.js';
import store from '../../store/index.js';

const PREFIX = `${NCM_CACHE_KEY}:`;

// Cache helpers -------------------------------------------------------------
function lsKeys() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) out.push(k);
  }
  return out;
}

function readCacheEntry(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeCacheEntry(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(err);
  }
}

function removeCacheEntry(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.error(err);
  }
}

// UI bindings ---------------------------------------------------------------
const q = document.getElementById('q');
const btnSearch = document.getElementById('btnSearch');
const source = document.getElementById('source');
const rows = document.getElementById('rows');
const status = document.getElementById('status');
const btnExport = document.getElementById('btnExport');
const btnClear = document.getElementById('btnClear');
const btnBulkQueue = document.getElementById('btnBulkQueue');
const importFile = document.getElementById('importFile');
const endpointInfo = document.getElementById('endpointInfo');

endpointInfo.textContent = `${RUNTIME.NCM_API_BASE} (${RUNTIME.NCM_API_TOKEN ? '✔️' : 'sem token'})`;

// Rendering -----------------------------------------------------------------
function renderRows(list = []) {
  rows.innerHTML = '';
  for (const it of list) {
    const tr = document.createElement('tr');
    const keyTd = document.createElement('td');
    keyTd.textContent = it.key.replace(PREFIX, '');
    const descTd = document.createElement('td');
    descTd.textContent = it.desc || it.query || '';
    const ncmTd = document.createElement('td');
    const ncmInput = document.createElement('input');
    ncmInput.className = 'ncm-input';
    ncmInput.value = it.ncm || '';
    ncmTd.appendChild(ncmInput);
    const actionsTd = document.createElement('td');
    const btnSave = document.createElement('button');
    btnSave.textContent = 'Salvar';
    const btnRemove = document.createElement('button');
    btnRemove.textContent = 'Remover';
    const btnAPI = document.createElement('button');
    btnAPI.textContent = 'Consultar API';
    actionsTd.append(btnSave, btnRemove, btnAPI);
    tr.append(keyTd, descTd, ncmTd, actionsTd);
    rows.appendChild(tr);

    btnSave.addEventListener('click', () => {
      const val = ncmInput.value.trim();
      if (!val) return;
      const entry = { ...(readCacheEntry(it.key) || {}), desc: it.desc, query: it.query, ncm: val };
      writeCacheEntry(it.key, entry);
    });

    btnRemove.addEventListener('click', () => {
      removeCacheEntry(it.key);
      tr.remove();
    });

    btnAPI.addEventListener('click', async () => {
      try {
        const term = it.desc || it.query || '';
        const r = await apiSearch(term);
        if (r[0]?.ncm) {
          ncmInput.value = r[0].ncm;
          const entry = { ...(readCacheEntry(it.key) || {}), desc: it.desc, query: it.query, ncm: r[0].ncm };
          writeCacheEntry(it.key, entry);
        } else {
          alert('NCM não encontrado');
        }
      } catch (err) {
        console.error(err);
        alert('Erro na consulta API');
      }
    });
  }
  status.textContent = `${list.length} itens`;
}

// Busca --------------------------------------------------------------------
async function apiSearch(term) {
  if (!term) return [];
  try {
    if (typeof ncmSvc.search === 'function') {
      const list = await ncmSvc.search(term);
      return (list || []).map((it) => ({ key: `${PREFIX}${it.key || term}`, desc: it.desc || it.query || term, ncm: it.ncm || null, origin: 'api' }));
    }
    if (typeof ncmSvc.resolve === 'function') {
      const r = await ncmSvc.resolve(term);
      if (r?.ncm) return [{ key: `${PREFIX}${term}`, desc: term, ncm: r.ncm, origin: 'api' }];
      return [];
    }
    if (typeof ncmSvc.fetchAPI === 'function') {
      const r = await ncmSvc.fetchAPI(`/search?q=${encodeURIComponent(term)}`);
      const arr = Array.isArray(r) ? r : r?.items || [];
      return arr.map((it) => ({ key: `${PREFIX}${it.key || term}`, desc: it.desc || it.query || term, ncm: it.ncm || null, origin: 'api' }));
    }
  } catch (err) {
    console.error(err);
    alert('Erro na busca API');
  }
  return [];
}

async function doSearch() {
  const term = (q.value || '').trim().toLowerCase();
  const keys = lsKeys().filter((k) => !term || k.toLowerCase().includes(term));
  const cacheList = keys.map((k) => {
    const v = readCacheEntry(k) || {};
    return { key: k, desc: v.desc, query: v.query, ncm: v.ncm, origin: 'cache' };
  });
  let apiList = [];
  if (term) {
    apiList = await apiSearch(term);
  }
  source.textContent = term ? 'cache + api' : 'cache';
  renderRows([...cacheList, ...apiList]);
}

// Export/Import/Limpar ------------------------------------------------------
function onExport() {
  try {
    const data = {};
    for (const k of lsKeys()) data[k] = readCacheEntry(k);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ncm-cache.json';
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (err) {
    console.error(err);
    alert('Erro ao exportar');
  }
}

function onImportFile() {
  importFile.click();
}

importFile?.addEventListener('change', () => {
  const file = importFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result || '{}');
      if (typeof data !== 'object') throw new Error('Formato');
      for (const [k, v] of Object.entries(data)) writeCacheEntry(k, v);
      doSearch();
    } catch (err) {
      console.error(err);
      alert('JSON inválido');
    }
  };
  reader.readAsText(file);
  importFile.value = '';
});

function onClear() {
  try {
    for (const k of lsKeys()) removeCacheEntry(k);
    doSearch();
  } catch (err) {
    console.error(err);
    alert('Erro ao limpar');
  }
}

async function onRunQueue() {
  try {
    await startNcmQueue(store.selectAllItems ? store.selectAllItems() : []);
    alert('Fila iniciada');
  } catch (err) {
    console.error(err);
    alert('Erro na fila');
  }
}

// Event bindings ------------------------------------------------------------
btnSearch?.addEventListener('click', doSearch);
btnExport?.addEventListener('click', onExport);
btnClear?.addEventListener('click', onClear);
btnBulkQueue?.addEventListener('click', onRunQueue);

// Initial load --------------------------------------------------------------
window.addEventListener('DOMContentLoaded', doSearch);

export { lsKeys, readCacheEntry, writeCacheEntry, removeCacheEntry };
