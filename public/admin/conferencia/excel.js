import * as XLSX from 'xlsx';

const REQUIRED_COLUMNS = ['codigoML', 'descricao', 'qtd', 'valorUnit'];

const COLUMN_ALIASES = {
  codigoML: ['codigo ml', 'código ml', 'codigo', 'código', 'sku', 'mlb', 'id ml', 'item id'],
  descricao: ['descricao', 'descrição', 'description', 'titulo', 'título', 'nome', 'produto'],
  qtd: ['quantidade', 'qtd', 'qtde', 'qty', 'qtdade', 'quant.', 'qtd.'],
  valorUnit: ['valor unitario', 'valor unitário', 'valor unit', 'preco unitario', 'preço unitário', 'preco', 'preço', 'unit price', 'vl unit'],
  rz: ['rz', 'regiao', 'região', 'hub', 'centro', 'deposito', 'depósito'],
};

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function detectarColunas(headerRow) {
  const map = {};

  headerRow.forEach((cell, index) => {
    const normalized = normalizeText(cell);
    if (!normalized) return;

    Object.entries(COLUMN_ALIASES).forEach(([key, aliases]) => {
      if (map[key] != null) return;
      if (aliases.some((alias) => normalized.includes(alias))) {
        map[key] = index;
      }
    });
  });

  return map;
}

function parseNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const stringValue = String(value ?? '').trim();
  if (!stringValue) return null;

  const cleaned = stringValue.replace(/\s+/g, '').replace(/[^0-9,.-]/g, '');
  if (!cleaned) return null;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  let normalized = cleaned;
  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, '').replace(/,/g, '.');
  } else if (hasComma) {
    normalized = cleaned.replace(/,/g, '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseQuantidade(value) {
  const parsed = parseNumber(value);
  if (parsed == null) return 0;
  return parsed;
}

function parseValorUnit(value) {
  const parsed = parseNumber(value);
  if (parsed == null) return 0;
  return parsed;
}

function normalizarItem(row, colunas) {
  const getValue = (key) => {
    const index = colunas[key];
    if (index == null) return '';
    return row[index] ?? '';
  };

  const codigoML = String(getValue('codigoML')).trim();
  const descricao = String(getValue('descricao')).trim();
  const qtd = parseQuantidade(getValue('qtd'));
  const valorUnit = parseValorUnit(getValue('valorUnit'));
  const rzRaw = colunas.rz != null ? row[colunas.rz] : null;
  const rz = typeof rzRaw === 'string' ? rzRaw.trim() : rzRaw ?? null;

  if (!codigoML && !descricao) return null;

  return {
    codigoML,
    descricao,
    qtd,
    valorUnit,
    ...(rz ? { rz } : {}),
  };
}

function validarColunas(colunas) {
  const faltantes = REQUIRED_COLUMNS.filter((col) => colunas[col] == null);
  if (faltantes.length) {
    console.warn('[EXCEL] Colunas obrigatórias não encontradas:', faltantes);
  }
}

export async function processarPlanilha(file) {
  console.log('[EXCEL] Iniciando processamento', file?.name ?? 'arquivo indefinido');
  if (!file) {
    return { rzs: [], itens: [] };
  }

  const arrayBuffer = await file.arrayBuffer();
  console.log('[EXCEL] Arquivo carregado, convertendo planilha');
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) {
    console.warn('[EXCEL] Nenhuma aba encontrada no arquivo');
    return { rzs: [], itens: [] };
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rows.length) {
    console.warn('[EXCEL] Planilha vazia');
    return { rzs: [], itens: [] };
  }

  const headerIndex = rows.findIndex((row) => Array.isArray(row) && row.some((cell) => String(cell).trim() !== ''));
  const headerRow = headerIndex >= 0 ? rows[headerIndex] : rows[0];
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows.slice(1);

  const colunas = detectarColunas(headerRow);
  validarColunas(colunas);

  const itens = [];
  dataRows.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) return;
    const item = normalizarItem(row, colunas);
    if (item) {
      itens.push(item);
    } else {
      console.log('[EXCEL] Linha ignorada', headerIndex + 1 + rowIndex + 1, row);
    }
  });

  const rzs = Array.from(
    new Set(
      itens
        .map((item) => item.rz)
        .filter((value) => value != null && value !== '')
        .map((value) => (typeof value === 'string' ? value.trim() : value)),
    ),
  );

  console.log('[EXCEL] Processamento concluído', { totalItens: itens.length, rzs });

  return { rzs, itens };
}
