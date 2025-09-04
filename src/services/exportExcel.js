import XLSX from 'xlsx-js-style';

function headerRow(headers) {
  return headers.map(h => ({
    v: h,
    t: 's',
    s: {
      font: { bold: true, color: { rgb: 'FFFFFFFF' }},
      fill: { fgColor: { rgb: 'FF8A2D' }}, /* laranja */
      alignment: { vertical: 'center', horizontal: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
      }
    }
  }));
}

function toSheet(data, headers) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  // largura aproximada
  const widths = headers.map(h => ({ wch: Math.max(12, String(h).length + 2) }));
  ws['!cols'] = widths;
  return ws;
}

export function exportWorkbook({ conferidos, pendentes, excedentes, meta }) {
  const { rz, lote } = meta || {};
  const headers = ['SKU', 'Descrição', 'Qtd', 'Preço Méd', 'Valor Total', 'Status', 'RZ', 'Lote'];
  const headerStyled = headerRow(headers);

  const mapRow = (it) => ([
    it.sku, it.descricao ?? '', it.qtd ?? 0,
    it.precoMedio ?? it.preco ?? '', it.valorTotal ?? '',
    it.status ?? '', rz ?? '', lote ?? ''
  ]);

  const wb = XLSX.utils.book_new();

  const confData = (conferidos || []).map(mapRow);
  const pendData = (pendentes || []).map(mapRow);
  const excData  = (excedentes || []).map(mapRow);

  const wsConf = toSheet([], headerStyled);
  XLSX.utils.sheet_add_aoa(wsConf, confData, { origin: 'A2' });
  XLSX.utils.book_append_sheet(wb, wsConf, 'Conferidos');

  const wsPend = toSheet([], headerStyled);
  XLSX.utils.sheet_add_aoa(wsPend, pendData, { origin: 'A2' });
  XLSX.utils.book_append_sheet(wb, wsPend, 'Pendentes');

  const wsExc = toSheet([], headerStyled);
  XLSX.utils.sheet_add_aoa(wsExc, excData, { origin: 'A2' });
  XLSX.utils.book_append_sheet(wb, wsExc, 'Excedentes');

  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  const safeLote = (lote || 'lote').replace(/[^\w\-]+/g, '_');
  const filename = `conferencia_${safeLote}_${y}-${m}-${d}.xlsx`;

  XLSX.writeFile(wb, filename, { compression: true });
}

