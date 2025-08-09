import * as XLSX from 'xlsx';
import store from '../store/index.js';

const isDev =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) ||
  (typeof window !== 'undefined' && window.__DEBUG_SCAN__ === true);
const DBG = (...a) => {
  if (isDev) console.log('[XLSX]', ...a);
};

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

// Processa a planilha e monta itemsByRZ
export async function processarPlanilha(file) {
  try {
    let data;
    if (file instanceof ArrayBuffer) {
      data = file;
    } else if (Buffer.isBuffer(file)) {
      data = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    } else if (file?.arrayBuffer) {
      data = await file.arrayBuffer();
    } else {
      throw new Error('Formato de arquivo não suportado');
    }

    const workbook = XLSX.read(data, { type: 'array', raw: true, cellFormula: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    if (!rows.length) return { rzList: [], itemsByRZ: {} };

    const headerAliases = {
      tipo: /^tipo$/i,
      enderecoWMS: /end.*wms/i,
      codigoML: /(c[oó]digo|cod)\s*ml/i,
      codigoRZ: /(c[oó]digo|cod)\s*rz/i,
      codigoP7: /(c[oó]digo|cod)\s*p7/i,
      qtd: /^qt[d]?$|quant/i,
      descricao: /descr/i,
      seller: /^seller$/i,
      vertical: /^vertical$/i,
      valorUnit: /valor\s*uni/i,
      valorTotal: /valor\s*tot/i,
      categoria: /^categoria$/i,
      subcategoria: /subcat/i,
    };

    let headerRow = -1;
    let colMap = {};
    for (let i = 0; i < rows.length; i++) {
      const header = rows[i];
      const map = {};
      header.forEach((h, idx) => {
        Object.entries(headerAliases).forEach(([key, rx]) => {
          if (rx.test(String(h))) map[key] = idx;
        });
      });
      if (Object.keys(map).length) {
        headerRow = i;
        colMap = map;
        break;
      }
    }
    if (headerRow === -1) {
      DBG('Cabeçalho não encontrado');
      return { rzList: [], itemsByRZ: {} };
    }

    const dataRows = rows.slice(headerRow + 1).filter(r => r.some(c => String(c).trim() !== ''));
    const linhas = [];
    for (const row of dataRows) {
      const get = key => row[colMap[key]];
      const codigoRZRaw = get('codigoRZ');
      const m = String(codigoRZRaw || '').match(/RZ\s*[-–—_:]?\s*(\d+)/i);
      const codigoRZ = m ? `RZ-${m[1]}` : '';
      const valorUnit = Number(String(get('valorUnit')).replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.')) || 0;
      const valorTotal = Number(String(get('valorTotal')).replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.')) || 0;
      const qtd = Number(get('qtd')) || 0;
      linhas.push({
        tipo: get('tipo'),
        enderecoWMS: get('enderecoWMS'),
        codigoML: get('codigoML'),
        codigoRZ,
        codigoP7: get('codigoP7'),
        qtd,
        descricao: get('descricao'),
        seller: get('seller'),
        vertical: get('vertical'),
        valorUnit,
        valorTotal,
        categoria: get('categoria'),
        subcategoria: get('subcategoria'),
      });
    }

    const itemsByRZ = {};
    for (const o of linhas) {
      if (!o.codigoRZ) continue;
      (itemsByRZ[o.codigoRZ] ||= []).push(o);
    }

    store.state.rzList = Object.keys(itemsByRZ).sort();
    store.state.itemsByRZ = itemsByRZ;
    if (!store.state.currentRZ) store.state.currentRZ = store.state.rzList[0] || null;

    return { rzList: store.state.rzList, itemsByRZ };
  } catch (error) {
    console.error('❌ Erro ao processar planilha:', error);
    return { rzList: store.state?.rzList || [], itemsByRZ: store.state?.itemsByRZ || {} };
  }
}

// Exporta os resultados finais em um arquivo .xlsx com quatro abas:
// conferidos, faltantes, excedentes e ajustes de preço ou erro.
// Cada aba recebe um array de objetos.
export function exportResult({
  conferidos,
  faltantes,
  excedentes,
  ajustes = [],
  resumo = [],
}, filename = 'resultado.xlsx') {
  const wb = XLSX.utils.book_new();
  const toSheet = arr => XLSX.utils.json_to_sheet(arr);
  XLSX.utils.book_append_sheet(wb, toSheet(conferidos), 'conferidos');
  XLSX.utils.book_append_sheet(wb, toSheet(faltantes), 'faltantes');
  XLSX.utils.book_append_sheet(wb, toSheet(excedentes), 'excedentes');
  XLSX.utils.book_append_sheet(wb, toSheet(ajustes), 'ajustesPrecoOuErro');
  if (resumo.length) {
    XLSX.utils.book_append_sheet(wb, toSheet(resumo), 'resumoFinanceiro');
  }
  XLSX.writeFile(wb, filename);
}

