import XLSX from 'xlsx-js-style';
import store, { setRZs, setItens, emit, setCurrentRZ } from '../store/index.js';
import { parseBRLLoose } from './number.js';

const isDev = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV);
const DBG = (...args) => { if (isDev) console.log('[XLSX]', ...args); };

const stripAccents = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = (value) => stripAccents(String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase());

async function toArrayBuffer(input) {
  if (input instanceof ArrayBuffer) return input;
  if (input instanceof Uint8Array) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  }
  if (input?.arrayBuffer) return input.arrayBuffer();
  throw new Error('processarPlanilha: entrada inválida');
}

function pickSheet(wb) {
  const byName = wb.SheetNames.find((name) => {
    const n = norm(name);
    return n === '3p' || n.includes('3p');
  });
  if (byName) return { name: byName, ws: wb.Sheets[byName] };

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    if (!rows.length) continue;
    const headerIndex = findHeaderRow(rows, 50);
    if (headerIndex >= 0) {
      const header = rows[headerIndex].map(norm);
      const hasRZ = header.some((cell) => cell.includes('codigo rz') || cell === 'rz');
      const hasDescricao = header.some((cell) => cell.includes('descricao'));
      if (hasRZ || hasDescricao) {
        return { name, ws };
      }
    }
  }

  const name = wb.SheetNames[0];
  return { name, ws: wb.Sheets[name] };
}

function findHeaderRow(rows, maxRows = 200) {
  for (let i = 0; i < Math.min(rows.length, maxRows); i++) {
    const header = rows[i].map(norm);
    const hasRZ = header.some((v) => v.includes('codigo rz') || v.includes('cod rz') || v === 'rz' || v.includes('rz-'));
    const hasSKU = header.some((v) => v.includes('codigo ml') || v.includes('codigo do ml') || v.includes('sku'));
    const hasDescricao = header.some((v) => v.includes('descricao'));
    if ((hasRZ && hasSKU) || (hasRZ && hasDescricao)) {
      return i;
    }
  }
  return -1;
}

function buildHeaderMap(headerCells) {
  const map = {};
  headerCells.forEach((cell, idx) => {
    const value = norm(cell);
    if (!value) return;
    if (/^tipo$/.test(value)) map.tipo = idx;
    if (/end.*wms/.test(value)) map.enderecoWMS = idx;
    if (/(cod|codigo)\s*ml/.test(value) || value === 'sku') map.codigoML = idx;
    if (/(cod|codigo)\s*rz/.test(value) || value === 'rz') map.codigoRZ = idx;
    if (/(cod|codigo)\s*p7/.test(value)) map.codigoP7 = idx;
    if (/^qtd$|^qt$|quant|qde/.test(value)) map.qtd = idx;
    if (/descricao/.test(value)) map.descricao = idx;
    if (/^seller$/.test(value)) map.seller = idx;
    if (/^vertical$/.test(value)) map.vertical = idx;
    if (/valor\s*uni/.test(value) || /preco\s*unit/.test(value)) map.valorUnit = idx;
    if (/valor\s*tot/.test(value)) map.valorTotal = idx;
    if (/^categoria$/.test(value)) map.categoria = idx;
    if (/subcat/.test(value)) map.subcategoria = idx;
  });

  if (map.descricao == null && headerCells.length > 7) {
    const maybeDescricao = headerCells[7]; // Coluna H padrão do Mercado Livre
    if (norm(maybeDescricao).includes('descricao')) map.descricao = 7;
  }

  return map;
}

function parseNumberBR(value) {
  const str = String(value ?? '').replace(/[^\d,.-]/g, '');
  if (!str) return 0;
  const normalized = str.replace(/\./g, '').replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function normalizeRZ(value) {
  if (!value) return '';
  const match = String(value).match(/rz\s*[-–—_:]?\s*(\d+)/i);
  if (match) return `RZ-${match[1]}`;
  const digits = String(value).match(/\b(\d{3,})\b/);
  return digits ? `RZ-${digits[1]}` : '';
}

function bruteForceRZ(rows) {
  const set = new Set();
  for (const row of rows) {
    for (const cell of row) {
      const match = String(cell ?? '').match(/\bRZ\s*[-–—_:]?\s*(\d+)\b/i);
      if (match) set.add(`RZ-${match[1]}`);
    }
  }
  return Array.from(set).sort();
}

function detectCentsMode(items) {
  let checked = 0;
  let centsLike = 0;
  for (const item of items.slice(0, 50)) {
    const raw = String(item.__preco_raw ?? '').trim();
    if (!raw) continue;
    if (/[,\.]/.test(raw)) return false;
    if (/^\d+$/.test(raw)) {
      checked++;
      if (Number(raw) >= 100) centsLike++;
    }
  }
  return checked >= 3 && centsLike / checked > 0.8;
}

export async function parsePlanilha(input) {
  const data = await toArrayBuffer(input);
  const wb = XLSX.read(data, { type: 'array' });
  DBG('Abas:', wb.SheetNames);

  const { name, ws } = pickSheet(wb);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  DBG(`Usando aba '${name}' — linhas:`, rows.length);

  const headerIndex = findHeaderRow(rows);
  if (headerIndex >= 0) {
    const header = rows[headerIndex];
    const map = buildHeaderMap(header);
    DBG('Header index:', headerIndex, 'map:', map);

    const items = [];
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((cell) => !String(cell ?? '').trim())) continue;

      const get = (key) => (map[key] != null ? row[map[key]] : '');
      const codigoML = get('codigoML');
      const descricao = get('descricao');
      const codigoRZ = normalizeRZ(get('codigoRZ'));
      if (!codigoML && !descricao && !codigoRZ) continue;
      if (norm(codigoML) === 'total') continue;

      const precoRaw = get('valorUnit');
      const totalRaw = get('valorTotal');
      const qtdRaw = get('qtd');
      const qtdNum = typeof qtdRaw === 'number' ? qtdRaw : parseNumberBR(qtdRaw);

      const item = {
        tipo: get('tipo'),
        enderecoWMS: get('enderecoWMS'),
        codigoML,
        codigoRZ,
        codigoP7: get('codigoP7'),
        qtd: Number.isFinite(qtdNum) ? qtdNum : 0,
        descricao,
        seller: get('seller'),
        vertical: get('vertical'),
        valorUnit: parseBRLLoose(precoRaw),
        valorTotalPlan: parseBRLLoose(totalRaw),
        categoria: get('categoria'),
        subcategoria: get('subcategoria'),
        __preco_raw: precoRaw,
        __valor_total_raw: totalRaw,
        _rowIndex: i + 1,
      };

      items.push(item);
    }

    const validItems = items.filter((item) => item.codigoRZ);

    const centsMode = detectCentsMode(validItems);
    if (centsMode) {
      console.log('[PRICE] planilha em centavos detectada; normalizando');
      for (const item of validItems) {
        if (typeof item.valorUnit === 'number') item.valorUnit /= 100;
      }
    }

    for (const item of validItems) {
      const qtd = Number(item.qtd) || 0;
      const valorUnit = Number(item.valorUnit) || 0;
      item.valorTotal = valorUnit * qtd;
      if (valorUnit > 1000 && qtd <= 5) {
        item.__price_anomaly = true;
        console.log('[PRICE]', item.codigoRZ, item.codigoML, valorUnit, 'x', qtd);
      }
    }

    const rzs = Array.from(new Set(validItems.map((item) => item.codigoRZ))).sort();
    return { rzs, itens: validItems };
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
  const withRz = itens.map((it, idx) => ({
    id: it.id || crypto.randomUUID?.() || `tmp_${Date.now()}_${idx}`,
    ...it,
    rz,
  }));
  await store.bulkUpsertItems(withRz);
  emit('refresh');
  return { rzList: rzs, itemsByRZ, totalByRZSku, metaByRZSku };
}

export function exportResult({
  conferidos,
  faltantes,
  excedentes,
  ajustes = [],
  resumo = [],
}, filename = 'resultado.xlsx') {
  const wb = XLSX.utils.book_new();
  const toSheet = (arr) => XLSX.utils.json_to_sheet(arr);

  const fin = (typeof window !== 'undefined' && window.computeFinance)
    ? window.computeFinance({ includeFrete: true })
    : null;
  const finMap = fin ? Object.fromEntries(fin.byItem.map((it) => [it.sku, it])) : {};

  const enrich = (arr) => arr.map((item) => {
    const finance = finMap[item.SKU] || finMap[item.sku];
    if (!finance) return item;
    return {
      ...item,
      custo_pago_unit: finance.custo_pago_unit,
      preco_venda_unit: finance.preco_venda_unit,
      frete_unit: finance.frete_unit,
      lucro_unit: finance.lucro_unit,
      lucro_total: finance.lucro_total,
    };
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

  XLSX.writeFile(wb, filename, { compression: true });
}

export function exportarConferencia({ conferidos, pendentes, excedentes, resumoRZ }) {
  const wb = XLSX.utils.book_new();

  const headerStyle = {
    fill: { patternType: 'solid', fgColor: { rgb: 'FF7A1A' } },
    font: { color: { rgb: 'FFFFFFFF' }, bold: true },
    alignment: { vertical: 'center', horizontal: 'center' },
  };

  function styleHeader(ws, headers) {
    if (!headers?.length) return;
    headers.forEach((_, idx) => {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c: idx });
      if (ws[cellAddr]) ws[cellAddr].s = headerStyle;
    });
    ws['!cols'] = headers.map((header) => ({ wch: Math.max(12, String(header).length + 2) }));
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  }

  function addSheet(nome, data, headers) {
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    styleHeader(ws, headers);
    XLSX.utils.book_append_sheet(wb, ws, nome);
  }

  function sheetFinanceiroPorItem() {
    const fin = (typeof window !== 'undefined' && window.computeFinance)
      ? window.computeFinance({ includeFrete: true })
      : null;
    if (!fin) return [];
    return fin.byItem.map((it) => ({
      SKU: it.sku,
      Descrição: it.descricao,
      preco_ml_unit: it.preco_ml_unit,
      _custo_pago_unit: it.custo_pago_unit,
      _preco_venda_unit: it.preco_venda_unit,
      _frete_unit: it.frete_unit,
      _lucro_unit: it.lucro_unit,
      _lucro_total: it.lucro_total,
    }));
  }

  addSheet('Conferidos', conferidos, ['SKU', 'Descrição', 'Qtd', 'Preço Médio (R$)', 'Valor Total (R$)']);
  addSheet('Pendentes', pendentes, ['SKU', 'Descrição', 'Qtd', 'Preço Médio (R$)', 'Valor Total (R$)']);
  addSheet('Excedentes', excedentes, ['SKU', 'Descrição', 'Qtd', 'Preço Médio (R$)', 'Valor Total (R$)']);

  const fin = (typeof window !== 'undefined' && window.computeFinance)
    ? window.computeFinance({ includeFrete: true })
    : null;

  addSheet('Resumo RZ', resumoRZ.map((r) => ({
    RZ: r.rz,
    Conferidos: r.conferidos,
    Pendentes: r.pendentes,
    Excedentes: r.excedentes,
    'Valor Total (R$)': r.valorTotal,
    'Preço médio ML (palete)': fin?.aggregates.preco_medio_ml_palete,
    'Custo pago médio (palete)': fin?.aggregates.custo_medio_pago_palete,
    'Preço de venda médio (palete)': fin?.aggregates.preco_venda_medio_palete,
    'Lucro total (palete)': fin?.aggregates.lucro_total_palete,
  })), ['RZ', 'Conferidos', 'Pendentes', 'Excedentes', 'Valor Total (R$)', 'Preço médio ML (palete)', 'Custo pago médio (palete)', 'Preço de venda médio (palete)', 'Lucro total (palete)']);

  addSheet('Financeiro (por item)', sheetFinanceiroPorItem(), [
    'SKU', 'Descrição', 'preco_ml_unit', '_custo_pago_unit', '_preco_venda_unit', '_frete_unit', '_lucro_unit', '_lucro_total',
  ]);

  XLSX.writeFile(wb, `conferencia_${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
}

export function buildWorkbook({ sheetName, rows, rz, lote }) {
  const header = ['SKU', 'Descrição', 'Qtd', 'Preço Méd', 'Valor Total', 'Status', 'RZ', 'Lote'];
  const data = [header];
  for (const row of rows) {
    data.push([
      row.sku ?? '',
      row.descricao ?? '',
      row.qtd ?? 0,
      row.precoMedio ?? '',
      row.valorTotal ?? '',
      row.status ?? '',
      rz ?? '',
      lote ?? '',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  const headerStyle = {
    fill: { patternType: 'solid', fgColor: { rgb: 'FF7A1A' } },
    font: { color: { rgb: 'FFFFFFFF' }, bold: true },
    alignment: { vertical: 'center', horizontal: 'center' },
  };

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[cell]) ws[cell].s = headerStyle;
  }

  ws['!cols'] = [
    { wch: 14 },
    { wch: 50 },
    { wch: 6 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 20 },
  ];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Conferidos');
  return wb;
}

export function downloadWorkbook(wb, filename) {
  XLSX.writeFile(wb, filename, { compression: true });
}
