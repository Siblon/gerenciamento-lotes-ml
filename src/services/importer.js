// src/services/importer.js
import { db, setSetting } from '../store/db.js';

const META_KEY = 'confApp.meta.v1';

// Salva sempre que: o usuário escolhe planilha, escolhe RZ, ou você finaliza import
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

// Helpers para integrar com seus componentes:
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

// Assumindo que já temos "file", e "selectedRz" (string do select de RZ)
export async function importPlanilhaAsLot({ file, selectedRz, parsedItems }) {
  const fileName = file?.name || 'lote-sem-nome';
  const lotName = fileName.replace(/\.[^.]+$/, '');

  // Cria o lote
  const lotId = await db.lots.add({
    name: lotName,
    rz: selectedRz || '',
    createdAt: new Date().toISOString()
  });

  // Salva os itens com o lotId
  // parsedItems deve ser seu array de itens padronizados (sku, descricao, qtd, preco_ml_unit, valor_total, status)
  await db.items.bulkAdd(
    parsedItems.map(it => ({
      lotId,
      sku: String(it.sku || '').trim(),
      desc: String(it.descricao || ''),
      qtd: Number(it.qtd || 0),
      precoMedio: Number(it.preco_ml_unit || 0),
      valorTotal: Number(it.valor_total || 0),
      status: it.status || 'pendente' // conferido / pendente / excedente
    }))
  );

  // Define esse lote como "ativo"
  await setSetting('activeLotId', lotId);
  return lotId;
}
