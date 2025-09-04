import XLSX from 'xlsx-js-style';
import { db, getMeta } from '../store/db.js';

/**
 * Gera workbook com 3 abas: Conferidos, Pendentes, Excedentes.
 * Inclui metadados nas primeiras linhas (Lote, RZ, Data).
 */
export async function exportarPlanilha() {
  const rz = await getMeta('rzAtual', '—');
  const lote = await getMeta('loteAtual', '—');
  const agora = new Date().toLocaleString('pt-BR');

  // cole seus dados das stores locais
  const conferidos = await db.itens.where('status').equals('Conferido').toArray();
  const pendentes  = await db.itens.where('status').equals('Pendente').toArray();
  const excedentes = await db.excedentes.toArray();

  const book = XLSX.utils.book_new();

  // helpers
  const headerStyle = {
    fill: { patternType: 'solid', fgColor: { rgb: 'FFA500' } }, // laranja
    font: { bold: true, color: { rgb: '000000' } },
    alignment: { vertical: 'center' }
  };
  const makeSheet = (linhas) => {
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    // aplica estilo na primeira linha
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 3, c }); // linha 4 (0-based) = cabeçalho
      if (!ws[addr]) continue;
      ws[addr].s = headerStyle;
    }
    ws['!rows'] = [{ hpt: 14 }, { hpt: 14 }, { hpt: 8 }, { hpt: 18 }]; // altura meta + header
    return ws;
  };

  // 5.1) Conferidos
  {
    const linhas = [
      ['Lote', lote], ['RZ', rz], ['Gerado em', agora],
      ['SKU','Descrição','Qtd','Preço Méd','Valor Total','Status']
    ];
    for (const it of conferidos) {
      linhas.push([it.sku, it.descricao, it.qtd, it.precoMedio, it.valorTotal, 'Conferido']);
    }
    XLSX.utils.book_append_sheet(book, makeSheet(linhas), 'Conferidos');
  }

  // 5.2) Pendentes
  {
    const linhas = [
      ['Lote', lote], ['RZ', rz], ['Gerado em', agora],
      ['SKU','Descrição','Qtd','Preço Méd','Valor Total','Status']
    ];
    for (const it of pendentes) {
      linhas.push([it.sku, it.descricao, it.qtd, it.precoMedio, it.valorTotal, 'Pendente']);
    }
    XLSX.utils.book_append_sheet(book, makeSheet(linhas), 'Pendentes');
  }

  // 5.3) Excedentes
  {
    const linhas = [
      ['Lote', lote], ['RZ', rz], ['Gerado em', agora],
      ['SKU','Descrição','Qtd','Preço (R$)','Valor Total (R$)','Status']
    ];
    for (const ex of excedentes) {
      const total = Number(ex.qtd || 0) * Number(ex.preco || 0);
      linhas.push([ex.sku, ex.descricao || '', ex.qtd || 0, ex.preco ?? '', total || '', 'Excedente']);
    }
    XLSX.utils.book_append_sheet(book, makeSheet(linhas), 'Excedentes');
  }

  const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
  const filename = `conferencia_${safe(rz)}_${safe(lote)}_${new Date().toISOString().slice(0,10)}.xlsx`;

  XLSX.writeFile(book, filename);
}

