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

  const conferidos = await db.itens.where('status').equals('Conferido').toArray();
  const pendentes = await db.itens.where('status').equals('Pendente').toArray();
  const excedentes = await db.excedentes.toArray();

  const book = XLSX.utils.book_new();

  // Aba Resumo
  const resumoLinhas = [
    ['Lote', lote],
    ['RZ', rz],
    ['Data/Hora', agora]
  ];
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(resumoLinhas), 'Resumo');

  const headerStyle = {
    fill: { patternType: 'solid', fgColor: { rgb: 'F59E0B' } },
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { vertical: 'center' }
  };
  const makeSheet = (linhas) => {
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[addr]) continue;
      ws[addr].s = headerStyle;
    }
    return ws;
  };

  // Conferidos
  {
    const linhas = [['SKU','Descrição','Qtd','Preço Méd (R$)','Valor Total (R$)','Status']];
    for (const it of conferidos) {
      linhas.push([it.sku, it.descricao, it.qtd, it.precoMedio, it.valorTotal, 'Conferido']);
    }
    XLSX.utils.book_append_sheet(book, makeSheet(linhas), 'Conferidos');
  }

  // Pendentes
  {
    const linhas = [['SKU','Descrição','Qtd','Preço Méd (R$)','Valor Total (R$)','Status']];
    for (const it of pendentes) {
      linhas.push([it.sku, it.descricao, it.qtd, it.precoMedio, it.valorTotal, 'Pendente']);
    }
    XLSX.utils.book_append_sheet(book, makeSheet(linhas), 'Pendentes');
  }

  // Excedentes
  {
    const linhas = [['SKU','Descrição','Qtd','Preço (R$)','Valor Total (R$)','Status']];
    for (const ex of excedentes) {
      const total = Number(ex.qtd || 0) * Number(ex.preco || 0);
      linhas.push([ex.sku, ex.descricao || '', ex.qtd || 0, ex.preco ?? '', total || '', 'Excedente']);
    }
    XLSX.utils.book_append_sheet(book, makeSheet(linhas), 'Excedentes');
  }

  const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
  const stamp = new Date().toISOString().replace('T', '_').slice(0,16).replace(':','-');
  const filename = `conferencia_${safe(lote)}_${safe(rz)}_${stamp}.xlsx`;

  XLSX.writeFile(book, filename);
}

