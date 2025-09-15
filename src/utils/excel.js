import * as XLSX from 'xlsx';

function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[^\w]+/g, ' ')
    .trim()
    .toLowerCase();
}

export async function processarPlanilha(file) {
  try {
    const data = file.arrayBuffer ? await file.arrayBuffer() : file;
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    if (!rows.length) return [];
    const header = rows[0];
    const map = {};
    header.forEach((cell, idx) => {
      const h = normalize(cell);
      if (h.includes('codigo rz') || h === 'rz') map.rz = idx;
      if (h.includes('codigo ml') || h.includes('sku')) map.codigoML = idx;
      if (h.includes('descricao')) map.descricao = idx;
      if (h === 'qtd' || h.includes('quant')) map.qtd = idx;
    });
    const itens = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const item = {
        rz: r[map.rz] || '',
        codigoML: String(r[map.codigoML] || '').trim(),
        descricao: r[map.descricao] || '',
        qtdPlanejada: Number(r[map.qtd]) || 0,
        qtdConferida: 0
      };
      if (item.rz && item.codigoML) itens.push(item);
    }
    return itens;
  } catch (err) {
    console.error('Erro ao ler planilha', err);
    return [];
  }
}

export function exportResult(data) {
  try {
    const wb = XLSX.utils.book_new();
    if (data.conferidos) {
      const ws = XLSX.utils.json_to_sheet(data.conferidos);
      XLSX.utils.book_append_sheet(wb, ws, 'Conferidos');
    }
    if (data.faltantes) {
      const ws = XLSX.utils.json_to_sheet(data.faltantes);
      XLSX.utils.book_append_sheet(wb, ws, 'Faltantes');
    }
    if (data.excedentes) {
      const ws = XLSX.utils.json_to_sheet(data.excedentes);
      XLSX.utils.book_append_sheet(wb, ws, 'Excedentes');
    }
    XLSX.writeFile(wb, 'resultado.xlsx');
  } catch (err) {
    console.error('Erro ao exportar planilha', err);
  }
}
