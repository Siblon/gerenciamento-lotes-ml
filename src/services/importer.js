// src/services/importer.js
import { db, setSetting } from '../store/db.js';

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
