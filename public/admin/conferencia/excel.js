import * as XLSX from 'xlsx';
import { setRZs, setCurrentRZ, setItens } from './store/index.js';

const REQUIRED_KEYS = ['codigo', 'descricao', 'rz', 'quantidade'];

const COLUMN_ALIASES = {
  codigo: [
    'sku',
    'codigo',
    'código',
    'cod',
    'cód',
    'cod.',
    'codigo produto',
    'cod produto',
    'codigo sku',
    'referencia',
    'referência',
    'item id',
  ],
  descricao: [
    'descricao',
    'descrição',
    'produto',
    'nome',
    'descricao do produto',
    'descrição do produto',
    'description',
    'titulo',
    'título',
  ],
  rz: [
    'rz',
    'palete',
    'palet',
    'paletizacao',
    'paletização',
    'regiao',
    'região',
    'hub',
    'deposito',
    'depósito',
    'centro de distribuicao',
    'centro de distribuição',
    'cd',
  ],
  quantidade: [
    'quantidade',
    'qtd',
    'qtde',
    'qt',
    'qtdade',
    'quant',
    'quant.',
    'qty',
    'quantidade total',
    'saldo',
  ],
};

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

function matchesAlias(normalizedHeader, alias) {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) return false;

  return (
    normalizedHeader === normalizedAlias ||
    normalizedHeader.includes(normalizedAlias) ||
    normalizedAlias.includes(normalizedHeader)
  );
}

function detectarColunas(headerRow) {
  const map = {};

  headerRow.forEach((cell, index) => {
    const normalizedHeader = normalizeText(cell);
    if (!normalizedHeader) return;

    Object.entries(COLUMN_ALIASES).forEach(([key, aliases]) => {
      if (map[key] != null) return;

      const hasMatch = aliases.some((alias) => matchesAlias(normalizedHeader, alias));
      if (hasMatch) {
        map[key] = index;
      }
    });
  });

  REQUIRED_KEYS.forEach((key) => {
    if (map[key] == null) {
      const index = headerRow.findIndex((cell) => normalizeText(cell) === key);
      if (index >= 0) {
        map[key] = index;
      }
    }
  });

  const missing = REQUIRED_KEYS.filter((key) => map[key] == null);
  if (missing.length) {
    console.warn('[EXCEL] Colunas não identificadas:', missing);
  }

  return map;
}

function detalharColunas(headerRow, colunas) {
  return REQUIRED_KEYS.reduce((detalhes, key) => {
    const index = colunas[key];
    if (index == null) {
      detalhes[key] = null;
      return detalhes;
    }

    const headerValue = headerRow[index];
    detalhes[key] = {
      indice: index,
      header:
        headerValue != null && String(headerValue).trim() !== ''
          ? String(headerValue).trim()
          : null,
    };
    return detalhes;
  }, {});
}

function lerArquivoComoArrayBuffer(file) {
  if (typeof FileReader === 'undefined' || typeof FileReader !== 'function') {
    if (file && typeof file.arrayBuffer === 'function') {
      return file.arrayBuffer();
    }
    return Promise.reject(new Error('FileReader não está disponível no ambiente.'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const buffer = event?.target?.result;
      if (buffer instanceof ArrayBuffer) {
        resolve(buffer);
        return;
      }

      if (buffer?.buffer instanceof ArrayBuffer) {
        resolve(buffer.buffer);
        return;
      }

      resolve(buffer);
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('Não foi possível ler o arquivo.'));
    };

    reader.readAsArrayBuffer(file);
  });
}

function sanitizeString(value) {
  if (value == null) return '';
  return String(value).trim();
}

function parseQuantidade(value) {
  if (value == null || value === '') return '';

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : '';
  }

  const texto = String(value).trim();
  if (!texto) return '';

  const cleaned = texto.replace(/\s+/g, '').replace(/[^0-9,.-]/g, '');

  if (!cleaned) {
    return texto;
  }

  let normalizado = cleaned;
  const temVirgula = cleaned.includes(',');
  const temPonto = cleaned.includes('.');

  if (temVirgula && temPonto) {
    normalizado = cleaned.replace(/\./g, '').replace(/,/g, '.');
  } else if (temVirgula) {
    normalizado = cleaned.replace(/,/g, '.');
  }

  const parsed = Number(normalizado);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return texto;
}

function normalizarItem(row, colunas) {
  const getValue = (key) => {
    const index = colunas[key];
    if (index == null) return '';
    return row[index];
  };

  const codigo = sanitizeString(getValue('codigo'));
  const descricao = sanitizeString(getValue('descricao'));
  const rz = sanitizeString(getValue('rz'));
  const quantidade = parseQuantidade(getValue('quantidade'));

  const todosVazios =
    !codigo &&
    !descricao &&
    !rz &&
    (quantidade === '' || quantidade == null);

  if (todosVazios) {
    return null;
  }

  return {
    codigo,
    descricao,
    rz,
    quantidade,
  };
}

function extrairRzs(itens) {
  const conjunto = new Set();

  itens.forEach((item) => {
    const valor = item?.rz;
    if (valor == null) return;

    const texto = typeof valor === 'string' ? valor.trim() : String(valor).trim();
    if (texto) {
      conjunto.add(texto);
    }
  });

  return Array.from(conjunto);
}

export async function processarPlanilha(file) {
  console.log('[EXCEL] Iniciando processamento', file?.name ?? 'arquivo indefinido');

  if (!file) {
    setRZs([]);
    setCurrentRZ(null);
    setItens([]);
    return { rzs: [], itens: [] };
  }

  const arrayBuffer = await lerArquivoComoArrayBuffer(file);
  const bytes =
    arrayBuffer instanceof ArrayBuffer
      ? arrayBuffer.byteLength
      : ArrayBuffer.isView(arrayBuffer)
        ? arrayBuffer.byteLength
        : null;
  console.log('[EXCEL] Arquivo carregado', { nome: file.name, bytes });

  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetNames = workbook.SheetNames ?? [];
  console.debug('[DEBUG] Abas encontradas', sheetNames);

  const primeiraAba = sheetNames[0];
  if (!primeiraAba) {
    console.warn('[EXCEL] Nenhuma aba encontrada no arquivo.');
    setRZs([]);
    setCurrentRZ(null);
    setItens([]);
    return { rzs: [], itens: [] };
  }

  const worksheet = workbook.Sheets[primeiraAba];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  console.debug('[DEBUG] Primeiras linhas da planilha', rows.slice(0, 3));

  if (!rows.length) {
    console.warn('[EXCEL] Planilha vazia.');
    setRZs([]);
    setCurrentRZ(null);
    setItens([]);
    return { rzs: [], itens: [] };
  }

  const headerIndex = rows.findIndex(
    (row) => Array.isArray(row) && row.some((cell) => String(cell).trim() !== '')
  );

  const headerRow = headerIndex >= 0 ? rows[headerIndex] : rows[0];
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows.slice(1);

  console.log('[EXCEL] Número de linhas parseadas', dataRows.length);

  const colunas = detectarColunas(headerRow);
  const colunasMapeadas = detalharColunas(headerRow, colunas);
  console.log('[EXCEL] Colunas mapeadas', colunasMapeadas);

  const itens = [];
  dataRows.forEach((row) => {
    if (!Array.isArray(row)) return;
    const item = normalizarItem(row, colunas);
    if (item) {
      itens.push(item);
    }
  });

  console.log('[EXCEL] Total de itens carregados', itens.length);

  const rzs = extrairRzs(itens);
  console.log('[EXCEL] RZs detectados', rzs);

  setRZs(rzs);
  if (Array.isArray(rzs) && rzs.length === 1) {
    setCurrentRZ(rzs[0]);
  } else {
    setCurrentRZ(null);
  }
  setItens(itens);

  console.log('[EXCEL] Processamento concluído', { totalItens: itens.length, rzs });

  return { rzs, itens };
}
