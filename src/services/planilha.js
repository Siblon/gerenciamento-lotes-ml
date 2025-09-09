import { processarPlanilha as parseAndStore } from '../utils/excel.js';
import { addLot, setCurrentLotId, addItemsBulk, setSetting } from '../store/db.js';

/**
 * Processa uma planilha Excel e persiste os itens no banco Dexie.
 * Reexporta processarPlanilha de utils/excel.js adicionando integração
 * com o banco, similar ao antigo importer.js.
 *
 * @param {File|ArrayBuffer|Uint8Array} file - arquivo ou buffer da planilha
 * @param {string} rz - código de RZ selecionado
 * @returns {Promise<object>} resultado de parseAndStore
 */
export async function processarPlanilha(file, rz = '') {
  // Executa parsing e popula o store em memória
  const result = await parseAndStore(file);

  // Cria novo lote e define como atual
  const lotId = await addLot({ name: file?.name || 'planilha.xlsx', rz });
  setCurrentLotId(lotId);
  await setSetting('activeLotId', lotId);

  // Converte os totais agregados em itens individuais para o Dexie
  const items = [];
  const totalMap = result.totalByRZSku || {};
  const metaMap = result.metaByRZSku || {};
  for (const [rzKey, skuMap] of Object.entries(totalMap)) {
    for (const [sku, qtd] of Object.entries(skuMap)) {
      const meta = metaMap[rzKey]?.[sku] || {};
      items.push({
        sku,
        descricao: meta.descricao || '',
        qtd,
        preco: meta.precoMedio || 0,
        status: 'pending',
      });
    }
  }

  if (items.length) {
    await addItemsBulk(lotId, items);
  }

  return result;
}
