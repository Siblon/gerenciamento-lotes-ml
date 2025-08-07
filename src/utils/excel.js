import * as XLSX from 'xlsx';

// Lê a planilha do Mercado Livre e retorna um mapeamento
// de RZ -> { codigo: quantidade }.
// Espera-se que as colunas estejam na ordem:
// 0: código ML, 1: quantidade, 2: RZ
export function readPlanilha(data) {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const pallets = {};
  rows.slice(1).forEach(row => {
    const codigo = String(row[0]).trim();
    const quantidade = Number(row[1]) || 1;
    const rz = String(row[2]).trim();
    if (!codigo || !rz) return;
    if (!pallets[rz]) pallets[rz] = {};
    pallets[rz][codigo] = (pallets[rz][codigo] || 0) + quantidade;
  });

  return pallets;
}

// Exporta os resultados finais em um arquivo .xlsx com três abas:
// conferidos, faltantes e excedentes. Cada aba recebe um array de objetos
// no formato { codigo, quantidade }.
export function exportResult({ conferidos, faltantes, excedentes }, filename = 'resultado.xlsx') {
  const wb = XLSX.utils.book_new();
  const toSheet = arr => XLSX.utils.json_to_sheet(arr);
  XLSX.utils.book_append_sheet(wb, toSheet(conferidos), 'conferidos');
  XLSX.utils.book_append_sheet(wb, toSheet(faltantes), 'faltantes');
  XLSX.utils.book_append_sheet(wb, toSheet(excedentes), 'excedentes');
  XLSX.writeFile(wb, filename);
}

