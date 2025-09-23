import { parsePlanilha } from '../utils/excel.js';
import {
  addLot,
  setCurrentLotId,
  addItemsBulk,
  setRZs,
} from '../store/db.js';
import { setCurrentRZ, emit } from '../store/index.js';

/**
 * Converte uma linha da planilha em um item do banco
 */
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

/**
 * Importa a planilha, atualiza os RZs e persiste como um novo lote
 */
export async function importFile(file, rz) {
  if (!file) return null;

  const buffer = await file.arrayBuffer();
  const { itens, rzs, rzAuto } = await parsePlanilha(buffer, { fileName: file?.name });

  // Atualiza lista de RZs disponíveis
  if (rzs?.length) {
    await setRZs(rzs);
  }

  // Se gerou RZ automático → seta como atual e dispara evento
  if (rzAuto) {
    setCurrentRZ(rzAuto);
    emit('rz:auto', rzAuto);
  }

  const lotId = await addLot({ name: file.name, rz: rzAuto || rz });
  setCurrentLotId(lotId);

  const items = itens.map((it) =>
    mapRowToItem(
      {
        sku: it.codigoML,
        descricao: it.descricao,
        qtd: it.qtd,
        preco: it.valorUnit,
      },
      lotId
    )
  );

  if (items.length) {
    await addItemsBulk(lotId, items);
  }

  if (window.refreshAll) {
    await window.refreshAll();
  }

  return lotId;
}
