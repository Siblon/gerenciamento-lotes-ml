// src/services/importer.js
import { parsePlanilha } from '../utils/excel.js';
import { addLot, setCurrentLotId, addItemsBulk, ensureDbOpen } from '../store/db.js';

const META_KEY = 'confApp.meta.v1';

export function saveMeta(partial) {
  const cur = loadMeta();
  const next = { ...cur, ...partial, savedAt: new Date().toISOString() };
  localStorage.setItem(META_KEY, JSON.stringify(next));
  return next;
}

export function loadMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); }
  catch { return {}; }
}

export function wireLotFileCapture(inputEl) {
  inputEl?.addEventListener('change', () => {
    const file = inputEl.files?.[0];
    if (file) saveMeta({ loteName: file.name });
  });
}

export function wireRzCapture(selectEl) {
  selectEl?.addEventListener('change', () => {
    const rz = selectEl.value || '';
    saveMeta({ rz });
  });
}

// Importa a planilha e persiste como um novo lote
export async function importFile(file, rz) {
  if (!file) return null;
  await ensureDbOpen();
  const buffer = await file.arrayBuffer();
  const { itens } = await parsePlanilha(buffer);
  const lotId = await addLot({ name: file.name, rz });
  setCurrentLotId(lotId);
  const parsedItems = itens.map(it => ({
    lotId,
    sku: String(it.codigoML || '').trim(),
    descricao: String(it.descricao || ''),
    qtd: Number(it.qtd || 0),
    preco: Number(it.valorUnit || 0),
    status: 'pending'
  }));
  await addItemsBulk(lotId, parsedItems);
  window.refreshAll?.();
  return lotId;
}
