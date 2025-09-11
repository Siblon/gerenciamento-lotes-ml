// Novo util de Excel com estilos
import XLSX from 'xlsx-js-style';
import store, { setRZs, setItens, emit, setCurrentRZ } from '../store/index.js';
import { parseBRLLoose } from './number.js';
import { startNcmQueue } from '../services/ncmQueue.js';

const isDev = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV);
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

function findHeaderRow(rows, maxRows = 200) {
  // procura uma linha que contenha pelo menos estes campos (tolerante):
  // "Código RZ", "Código ML", "Qtd" (ou equivalentes)
  for (let i = 0; i < Math.min(rows.length, maxRows); i++) {
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
    if (n.replace(/\./g, '') === 'ncm' || n === 'ncm_code') map.ncm = idx;
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

function sanitizeNCM(n) {
  const onlyDigits = String(n ?? '').replace(/\D/g, '');
  return /^\d{8}$/.test(onlyDigits) ? onlyDigits : null;
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

function detectCentsMode(items) {
  let checked = 0;
  let centsLike = 0;
  for (const it of items.slice(0, 50)) {
    const raw = String(it.__preco_raw ?? '').trim();
    if (!raw) continue;
    if (/[,\.]/.test(raw)) return false; // se algum tem separador, não é centavos
    if (/^\d+$/.test(raw)) {
      checked++;
      if (Number(raw) >= 100) centsLike++;
    }
  }
  return checked >= 3 && centsLike / checked > 0.8;
}

export async function parsePlanilha(input) {
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

  const hdrIdx = findHeaderRow(rows);
  if (hdrIdx >= 0) {
    const header = rows[hdrIdx];
    const map = buildHeaderMap(header);
    DBG('Header index:', hdrIdx, 'map:', map);

    const items = [];
    for (let i = hdrIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const get = (k) => (map[k] != null ? r[map[k]] : '');
      const precoRaw = get('valorUnit');
      const totalRaw = get('valorTotal');
      const obj = {
        tipo: get('tipo'),
        enderecoWMS: get('enderecoWMS'),
        codigoML: get('codigoML'),
        codigoRZ: normalizeRZ(get('codigoRZ')),
        codigoP7: get('codigoP7'),
        qtd: Number(get('qtd')) || parseNumberBR(get('qtd')),
        descricao: get('descricao'),
        seller: get('seller'),
        vertical: get('vertical'),
        valorUnit: parseBRLLoose(precoRaw),
        valorTotalPlan: parseBRLLoose(totalRaw),
        categoria: get('categoria'),
        subcategoria: get('subcategoria'),
        ncm: sanitizeNCM(get('ncm')),
        __preco_raw: precoRaw,
        __valor_total_raw: totalRaw,
        _rowIndex: i + 1,
      };
      if (obj.codigoRZ) items.push(obj);
    }

    const centsMode = detectCentsMode(items);
    if (centsMode) {
      console.log('[PRICE] planilha em centavos detectada; normalizando');
      for (const it of items) {
        if (typeof it.valorUnit === 'number') it.valorUnit /= 100;
      }
    }
    for (const it of items) {
      it.valorTotal = Number(it.valorUnit || 0) * (Number(it.qtd) || 0);
      if (it.valorUnit > 1000 && (it.qtd || 0) <= 5) {
        it.__price_anomaly = true;
        console.log('[PRICE]', it.codigoRZ, it.codigoML, it.valorUnit, 'x', it.qtd);
      }
    }

    const rzs = Array.from(new Set(items.map(it => it.codigoRZ))).sort();
    return { rzs, itens: items };
  }

  const rzs = bruteForceRZ(rows);
  return { rzs, itens: [] };
}

export async function processarPlanilha(input, currentRZ) {
  const { rzs, itens } = await parsePlanilha(input);
  setRZs(rzs);
  if (currentRZ) setCurrentRZ(currentRZ);
  const { itemsByRZ, totalByRZSku, metaByRZSku } = setItens(itens);
  const rz = store.state.currentRZ || null;
  const withRz = itens.map((it, i) => ({
    id: it.id || crypto.randomUUID?.() || `tmp_${Date.now()}_${i}`,
    ...it,
    rz,
  }));
  await store.bulkUpsertItems(withRz);
  emit('refresh');
  startNcmQueue(itens);
  return { rzList: rzs, itemsByRZ, totalByRZSku, metaByRZSku };
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
  const fin = (typeof window !== 'undefined' && window.computeFinance) ? window.computeFinance({ includeFrete: true }) : null;
  const finMap = fin ? Object.fromEntries(fin.byItem.map(it => [it.sku, it])) : {};
  const enrich = arr => arr.map(it => {
    const f = finMap[it.SKU] || finMap[it.sku];
    return f ? { ...it,
      custo_pago_unit: f.custo_pago_unit,
      preco_venda_unit: f.preco_venda_unit,
      frete_unit: f.frete_unit,
      lucro_unit: f.lucro_unit,
      lucro_total: f.lucro_total,
    } : it;
  });
  XLSX.utils.book_append_sheet(wb, toSheet(enrich(conferidos)), 'conferidos');
  XLSX.utils.book_append_sheet(wb, toSheet(enrich(faltantes)), 'faltantes');
  XLSX.utils.book_append_sheet(wb, toSheet(enrich(excedentes)), 'excedentes');
  XLSX.utils.book_append_sheet(wb, toSheet(ajustes), 'ajustesPrecoOuErro');
  if (fin) {
    resumo.push({
      preco_medio_ml_palete: fin.aggregates.preco_medio_ml_palete,
      custo_medio_pago_palete: fin.aggregates.custo_medio_pago_palete,
      preco_venda_medio_palete: fin.aggregates.preco_venda_medio_palete,
      lucro_total_palete: fin.aggregates.lucro_total_palete,
    });
  }
  if (resumo.length) {
    XLSX.utils.book_append_sheet(wb, toSheet(resumo), 'resumoFinanceiro');
  }
  XLSX.writeFile(wb, filename);
}

export function exportarConferencia({ conferidos, pendentes, excedentes, resumoRZ }) {
  const wb = XLSX.utils.book_new();

  function addSheet(nome, data, headers) {
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    headers.forEach((h, i) => {
      const addr = XLSX.utils.encode_cell({ r:0, c:i });
      ws[addr].s = { font: { bold: true } };
    });
    ws['!cols'] = headers.map(h => ({ wch: Math.max(12, h.length + 2) }));
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, ws, nome);
  }

  function sheetFinanceiroPorItem(){
    const f = (typeof window !== 'undefined' && window.computeFinance) ? window.computeFinance({ includeFrete: true }) : null;
    if (!f) return [];
    return f.byItem.map(it => ({
      'SKU': it.sku,
      'Descrição': it.descricao,
      'preco_ml_unit': it.preco_ml_unit,
      '_custo_pago_unit': it.custo_pago_unit,
      '_preco_venda_unit': it.preco_venda_unit,
      '_frete_unit': it.frete_unit,
      '_lucro_unit': it.lucro_unit,
      '_lucro_total': it.lucro_total,
    }));
  }

  addSheet('Conferidos', conferidos, ['SKU','Descrição','Qtd','Preço Médio (R$)','Valor Total (R$)','NCM']);
  addSheet('Pendentes', pendentes, ['SKU','Descrição','Qtd','Preço Médio (R$)','Valor Total (R$)','NCM']);
  addSheet('Excedentes', excedentes, ['SKU','Descrição','Qtd','Preço Médio (R$)','Valor Total (R$)','NCM']);
  const fin = (typeof window !== 'undefined' && window.computeFinance) ? window.computeFinance({ includeFrete: true }) : null;
  addSheet('Resumo RZ', resumoRZ.map(r => ({
    'RZ': r.rz,
    'Conferidos': r.conferidos,
    'Pendentes': r.pendentes,
    'Excedentes': r.excedentes,
    'Valor Total (R$)': r.valorTotal,
    'Preço médio ML (palete)': fin?.aggregates.preco_medio_ml_palete,
    'Custo pago médio (palete)': fin?.aggregates.custo_medio_pago_palete,
    'Preço de venda médio (palete)': fin?.aggregates.preco_venda_medio_palete,
    'Lucro total (palete)': fin?.aggregates.lucro_total_palete,
  })), ['RZ','Conferidos','Pendentes','Excedentes','Valor Total (R$)','Preço médio ML (palete)','Custo pago médio (palete)','Preço de venda médio (palete)','Lucro total (palete)']);

  addSheet('Financeiro (por item)', sheetFinanceiroPorItem(), [
    'SKU','Descrição','preco_ml_unit','_custo_pago_unit','_preco_venda_unit','_frete_unit','_lucro_unit','_lucro_total'
  ]);

  XLSX.writeFile(wb, `conferencia_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ==== Utilidades novas para exportação estilizada ====

/**
 * buildWorkbook cria uma planilha estilizada.
 * @param {{
 *   sheetName: string,
 *   rows: Array<Record<string, any>>,
 *   rz?: string,
 *   lote?: string
 * }} opts
 */
export function buildWorkbook({ sheetName, rows, rz, lote }) {
  const data = [];
  // Cabeçalho com colunas fixas e metadados do lote
  const header = ['SKU', 'Descrição', 'Qtd', 'Preço Méd', 'Valor Total', 'Status', 'RZ', 'Lote'];
  data.push(header);
  for (const r of rows) {
    data.push([
      r.sku ?? '',
      r.descricao ?? '',
      r.qtd ?? 0,
      r.precoMedio ?? '',
      r.valorTotal ?? '',
      r.status ?? '',
      rz ?? '',
      lote ?? ''
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Estilo do cabeçalho: fundo laranja, texto branco e bold, centralizado
  const headerStyle = {
    fill: { patternType: 'solid', fgColor: { rgb: 'FF7A1A' } }, // laranja
    font: { color: { rgb: 'FFFFFF' }, bold: true },
    alignment: { vertical: 'center', horizontal: 'center' }
  };
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cell]) continue;
    ws[cell].s = headerStyle;
  }

  // Larguras amigáveis
  ws['!cols'] = [
    { wch: 14 }, // SKU
    { wch: 50 }, // Descrição
    { wch: 6  }, // Qtd
    { wch: 10 }, // Preço Méd
    { wch: 12 }, // Valor Total
    { wch: 12 }, // Status
    { wch: 12 }, // RZ
    { wch: 20 }  // Lote
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Conferidos');
  return wb;
}

export function downloadWorkbook(wb, filename) {
  // filename já deve vir “limpo”
  XLSX.writeFile(wb, filename, { compression: true });
}
