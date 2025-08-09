import * as XLSX from 'xlsx';

function toNumberBR(v) {
  if (v == null) return 0;
  const s = String(v);
  if (s.includes(',')) {
    return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return Number(s) || 0;
}

function pickByRegex(row, regexArray) {
  const key = Object.keys(row).find(k => regexArray.some(r => r.test(k)));
  return key ? row[key] : undefined;
}

const RX_UNIT = [
  /valor\s*unit/i,
  /pre(ç|c)o\s*unit/i,
  /unit(á|a)rio/i,
  /^pre(ç|c)o$/i,
  /^valor(?!.*total)/i,
];
const RX_TOTAL = [/valor\s*total/i, /total/i, /vlr\s*total/i];

// Remove acentos, espaços e coloca tudo em minúsculas
function normalize(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Encontra o índice de uma coluna dado o cabeçalho e uma lista de aliases
export function getColIndex(headers, aliases) {
  const normHeaders = headers.map(h => normalize(h));
  for (const alias of aliases) {
    const idx = normHeaders.indexOf(normalize(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

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

// Processa uma planilha possivelmente bagunçada e retorna
// um array de objetos padronizados
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

    const workbook = XLSX.read(data, {
      type: 'array',
      raw: true,
      cellFormula: false,
    });

    // Alias das colunas aceitando diversos nomes
    // para tornar o parser mais tolerante a planilhas variadas
    const aliases = {
      // Código do produto no Mercado Livre. Aceita variações comuns
      codigoML: [
        'Código ML',
        'ML',
        'Cod. ML',
        'Código',
        'Código do Produto',
        'SKU',
        'Código Mercado Livre',
      ],
      // Texto descritivo do item
      descricao: [
        'Descrição',
        'Descrição do Produto',
        'Descrição do Item',
        'Produto',
        'Item',
      ],
      // Preço unitário do produto
      preco: [
        'Preço',
        'Preco',
        'Preço Unitário',
        'Preco Unitario',
        'Valor',
        'Valor Unitário',
        'Valor Unitario',
      ],
      // Quantidade esperada do produto
      quantidade: [
        'Qtd',
        'Quantidade',
        'Qtde',
        'Quantidade Esperada',
        'Qtd Esperada',
      ],
      // Identificador do palete ou RZ onde o item está armazenado
      rz: [
        'RZ',
        'Código RZ',
        'Palete',
        'Código do Palete',
        'Paletização',
        'Paletizacao',
      ],
    };

    let lastMissingFields = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet || !sheet['!ref']) continue;

      // Converte a planilha para uma matriz ignorando colunas ocultas e fórmulas
      const range = XLSX.utils.decode_range(sheet['!ref']);
      const hiddenCols = new Set();
      (sheet['!cols'] || []).forEach((col, idx) => {
        if (col && col.hidden) hiddenCols.add(idx);
      });

      const rows = [];
      for (let R = range.s.r; R <= range.e.r; R++) {
        const row = [];
        for (let C = range.s.c; C <= range.e.c; C++) {
          if (hiddenCols.has(C)) {
            row.push(null);
            continue;
          }
          const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
          if (!cell || cell.f) {
            row.push(null);
            continue;
          }
          row.push(cell.v);
        }
        rows.push(row);
      }

      if (!rows.length) continue;

      // Busca cabeçalho nas primeiras 10 linhas
      let headerRow = -1;
      let indices = {};
      let lastHeaderIndices = {};
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i];
        const headerIndices = {
          codigoML: getColIndex(row, aliases.codigoML),
          descricao: getColIndex(row, aliases.descricao),
          quantidade: getColIndex(row, aliases.quantidade),
          rz: getColIndex(row, aliases.rz),
          preco: getColIndex(row, aliases.preco),
        };
        lastHeaderIndices = headerIndices;

        if (
          headerIndices.codigoML !== -1 &&
          headerIndices.quantidade !== -1 &&
          headerIndices.rz !== -1
        ) {
          headerRow = i;
          indices = headerIndices;
          break;
        }
      }

      const missingFields = ['codigoML', 'quantidade', 'rz'].filter(
        f => lastHeaderIndices[f] === -1,
      );

      if (headerRow === -1) {
        lastMissingFields = missingFields;
        console.warn(
          `⚠️ Cabeçalho não detectado na aba '${sheetName}'. Faltando colunas: ${missingFields.join(', ')}`,
        );
        continue;
      }

      const headerCols = rows[headerRow];
      const dataRows = rows
        .slice(headerRow + 1)
        .filter(r => r && r.some(c => c !== null && String(c).trim() !== ''));

      const produtos = [];
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const codigoML = row[indices.codigoML]
          ? String(row[indices.codigoML]).trim()
          : '';
        const descricao =
          indices.descricao !== -1 && row[indices.descricao]
            ? String(row[indices.descricao]).trim()
            : '';
        const quantidadeRaw = row[indices.quantidade];
        let quantidade = Number(quantidadeRaw);
        if (!quantidade || Number.isNaN(quantidade)) quantidade = 1;
        const rz = row[indices.rz] ? String(row[indices.rz]).trim() : '';
        const rowObj = {};
        headerCols.forEach((h, idx) => {
          rowObj[h] = row[idx];
        });
        const rawUnit = pickByRegex(rowObj, RX_UNIT);
        const rawTotal = pickByRegex(rowObj, RX_TOTAL);
        const preco = toNumberBR(rawUnit);
        let valorTotal = toNumberBR(rawTotal);
        if (!valorTotal && preco) valorTotal = preco * quantidade;

        if (!codigoML || !descricao || !rz) {
          console.warn(`Linha ${headerRow + i + 2} ignorada por falta de dados essenciais`);
          continue;
        }

        produtos.push({ codigoML, descricao, quantidade, rz, preco, valorTotal });
      }

      const rzs = Array.from(new Set(produtos.map(p => p.rz)));
      return {
        produtos,
        totalItens: produtos.length,
        rzs,
        headerRow: headerRow + 1,
        missingFields: [],
      };
    }

    console.warn('⚠️ Planilha lida, mas está vazia ou sem colunas esperadas.');
    return { produtos: [], totalItens: 0, rzs: [], headerRow: null, missingFields: lastMissingFields };
  } catch (error) {
    console.error('❌ Erro ao processar planilha:', error);
    return { produtos: [], totalItens: 0, rzs: [], headerRow: null, missingFields: [] };
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

