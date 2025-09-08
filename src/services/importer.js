import { parsePlanilha } from '../utils/excel.js';
import { addLot, setCurrentLotId, addItemsBulk } from '../store/db.js';

function mapRowToItem(row, lotId) {
  return {
    lotId,
    sku: String(row.sku || '').trim(),
    descricao: String(row.descricao || '').trim(),
    qtd: Number(row.qtd || 0),
    preco: Number(row.preco || 0),
    status: 'pending',
  };
}

// Importa a planilha e persiste como um novo lote
export async function importFile(file, rz) {
  if (!file) return null;
  const buffer = await file.arrayBuffer();
  const { itens } = await parsePlanilha(buffer);
  const lotId = await addLot({ name: file.name, rz });
  setCurrentLotId(lotId);
  const items = itens.map(it =>
    mapRowToItem({
      sku: it.codigoML,
      descricao: it.descricao,
      qtd: it.qtd,
      preco: it.valorUnit,
    }, lotId)
  );
  if (items.length) await addItemsBulk(lotId, items);
  if (window.refreshAll) await window.refreshAll();
  return lotId;
}
