import { buildWorkbook, downloadWorkbook } from '../utils/excel.js';
import { getSetting } from '../store/db.js';

export async function exportConferidos(items) {
  // Novo: pega metadados (RZ, lote) e usa util com estilo
  const rz = await getSetting('rz');
  const lote = await getSetting('loteName');
  const safe = (s = '') => String(s).replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const date = new Date().toISOString().slice(0,10);
  const filename = `conferencia_${safe(lote || 'lote')}_${date}.xlsx`;

  const rows = items.map(it => ({
    sku: it.sku,
    descricao: it.descricao,
    qtd: it.qtd,
    precoMedio: it.precoMedio,
    valorTotal: it.valorTotal,
    status: it.status
  }));
  const wb = buildWorkbook({ sheetName: 'Conferidos', rows, rz, lote });
  downloadWorkbook(wb, filename);
}
