import * as XLSX from 'xlsx';
import store from '../store/index.js';

const isDev = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) || (typeof window !== 'undefined' && window.__DEBUG_SCAN__ === true);
const DBG = (...a) => { if (isDev) console.log('[XLSX]', ...a); };

const stripAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = (s) => stripAccents(String(s || '').replace(/\s+/g, ' ').trim().toLowerCase());

/** tenta achar a aba mais provável: "3P" ou que contenha "codigo rz" no header */
function pickSheet(wb) {
  const byName = wb.SheetNames.find(n => norm(n) === '3p' || norm(n).includes('3p'));
  if (byName) return { name: byName, ws: wb.Sheets[byName] };

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    if (!rows.length) continue;
    const hdrRow = rows.find(r => r.some(v => norm(v).includes('codigo rz')));
    if (hdrRow) return { name, ws };
  }
  // fallback: primeira aba
  const name = wb.SheetNames[0];
  return { name, ws: wb.Sheets[name] };
}

function findHeaderRow(rows) {
  // procura uma linha que contenha pelo menos estes campos (tolerante):
  // "Código RZ", "Código ML", "Qtd" (ou equivalentes)
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const r = rows[i].map(norm);
    const hasRZ  = r.some(v => v.includes('codigo rz') || v.includes('cod rz') || v === 'rz' || v.includes('rz-'));
    const hasML  = r.some(v => v.includes('codigo ml') || v.includes('codigo do ml') || v.includes('codigo ml'));
    const hasQtd = r.some(v => v === 'qtd' || v === 'qt' || v.includes('quant'));
    if (hasRZ && hasML) return i;
  }
  return -1;
}

function buildHeaderMap(headerCells) {
  const map = {};
  headerCells.forEach((cell, idx) => {
    const n = norm(cell);
    if (/^tipo$/.test(n)) map.tipo = idx;
    if (/end.*wms/.test(n)) map.enderecoWMS = idx;
    if (/(cod|codigo)\s*ml/.test(n)) map.codigoML = idx;                    // SKU
    if (/(cod|codigo)\s*rz/.test(n) || n === 'rz') map.codigoRZ = idx;
    if (/(cod|codigo)\s*p7/.test(n)) map.codigoP7 = idx;
    if (/^qtd$|^qt$|quant/.test(n)) map.qtd = idx;
    if (/descr/.test(n)) map.descricao = idx;
    if (/^seller$/.test(n)) map.seller = idx;
    if (/^vertical$/.test(n)) map.vertical = idx;
    if (/valor\s*uni/.test(n)) map.valorUnit = idx;                          // preço
    if (/valor\s*tot/.test(n)) map.valorTotal = idx;
    if (/^categoria$/.test(n)) map.categoria = idx;
    if (/subcat/.test(n)) map.subcategoria = idx;
  });
  return map;
}

function parseNumberBR(v) {
  const s = String(v ?? '').replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  // remove milhar . e usa vírgula como decimal
  const t = s.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRZ(v) {
  const m = String(v || '').match(/rz\s*[-–—_:]?\s*(\d+)/i);
  return m ? `RZ-${m[1]}` : '';
}

/** Fallback burro: varre todas as células e pega qualquer RZ-\d+ */
function bruteForceRZ(rows) {
  const set = new Set();
  for (const row of rows) {
    for (const cell of row) {
      const m = String(cell || '').match(/\bRZ\s*[-–—_:]?\s*(\d+)\b/i);
      if (m) set.add(`RZ-${m[1]}`);
    }
  }
  return Array.from(set).sort();
}

export async function processarPlanilha(input) {
  let data;
  if (input instanceof ArrayBuffer) data = input;
  else if (input instanceof Uint8Array) data = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  else if (input?.arrayBuffer) data = await input.arrayBuffer();
  else throw new Error('processarPlanilha: entrada inválida');

  const wb = XLSX.read(data, { type: 'array' });
  DBG('Abas:', wb.SheetNames);

  const { name, ws } = pickSheet(wb);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  DBG(`Usando aba '${name}' — linhas:`, rows.length);

  // 1) tenta header
  const hdrIdx = findHeaderRow(rows);
  if (hdrIdx >= 0) {
    const header = rows[hdrIdx];
    const map = buildHeaderMap(header);
    DBG('Header index:', hdrIdx, 'map:', map);

    const items = [];
    for (let i = hdrIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const get = (k) => (map[k] != null ? r[map[k]] : '');
      const obj = {
        tipo: get('tipo'),
        enderecoWMS: get('enderecoWMS'),
        codigoML: get('codigoML'),                       // SKU
        codigoRZ: normalizeRZ(get('codigoRZ')),
        codigoP7: get('codigoP7'),
        qtd: Number(get('qtd')) || parseNumberBR(get('qtd')),
        descricao: get('descricao'),
        seller: get('seller'),
        vertical: get('vertical'),
        valorUnit: parseNumberBR(get('valorUnit')),      // preço
        valorTotal: parseNumberBR(get('valorTotal')),
        categoria: get('categoria'),
        subcategoria: get('subcategoria'),
        _rowIndex: i + 1,
      };
      if (obj.codigoRZ) items.push(obj);
    }

    const itemsByRZ = {};
    for (const it of items) {
      (itemsByRZ[it.codigoRZ] ||= []).push(it);
    }
    const rzList = Object.keys(itemsByRZ).sort();

    const totalByRZSku = {};
    for (const rz of rzList) {
      const map = {};
      for (const it of itemsByRZ[rz]) {
        const sku = String(it.codigoML || '').trim();
        const inc = Number(it.qtd) || 0;
        if (!sku) continue;
        map[sku] = (map[sku] || 0) + inc;
      }
      totalByRZSku[rz] = map;
    }

    store.state = store.state || {};
    store.state.itemsByRZ = itemsByRZ;
    store.state.rzList = rzList;
    store.state.totalByRZSku = totalByRZSku;
    store.state.conferidosByRZSku = {};
    if (!store.state.currentRZ) store.state.currentRZ = rzList[0] || null;

    DBG('RZs (header):', rzList.length, rzList.slice(0, 30));
    return { rzList, itemsByRZ, totalByRZSku };
  }

  // 2) fallback regex se não achar header
  const rzList = bruteForceRZ(rows);
  const itemsByRZ = {};
  for (const rz of rzList) itemsByRZ[rz] = []; // sem linhas mapeadas no fallback

  store.state = store.state || {};
  store.state.itemsByRZ = itemsByRZ;
  store.state.rzList = rzList;
  store.state.totalByRZSku = {};
  store.state.conferidosByRZSku = {};
  if (!store.state.currentRZ) store.state.currentRZ = rzList[0] || null;

  DBG('RZs (fallback):', rzList.length, rzList.slice(0, 30));
  return { rzList, itemsByRZ, totalByRZSku: {} };
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
