import * as XLSX from 'xlsx';
import { resolveNCM, sanitizeNCM } from '../services/ncmService.js';

// Map of possible header names for each field
export const headerMap = {
  sku: ['SKU','Codigo','Código','cod','sku'],
  descricao: ['Descricao','Descrição','descricao','descrição','desc'],
  qtd: ['Qtd','Quantidade','qtd','quantidade'],
  precoMedioML: ['Preço médio','Preco medio','Preço Médio ML','preco_medio_ml','preco_medio'],
  ncm: ['NCM','ncm','N.C.M.','ncm_code'],
};

function normalize(str){
  return String(str||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'').toLowerCase();
}

function getVal(row, names){
  for(const n of names){
    if(row[n] != null && row[n] !== '') return row[n];
  }
  const keys = Object.keys(row);
  for(const key of keys){
    const normKey = normalize(key);
    for(const n of names){
      if(normKey === normalize(n)) return row[key];
    }
  }
  return '';
}

export async function processarPlanilha(input){
  let data;
  if(input instanceof ArrayBuffer) data = input;
  else if(input instanceof Uint8Array) data = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  else if(typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) data = input; // Node Buffer
  else if(input?.arrayBuffer) data = await input.arrayBuffer();
  else throw new Error('processarPlanilha: entrada inválida');

  const isBuf = typeof Buffer !== 'undefined' && Buffer.isBuffer(data);
  const wb = XLSX.read(data, { type: isBuf ? 'buffer' : 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const out = [];
  for(const row of rows){
    const sku = String(getVal(row, headerMap.sku) || '').trim();
    if(!sku) continue;
    const desc = String(getVal(row, headerMap.descricao) || '').trim();
    const qtd = Number(getVal(row, headerMap.qtd)) || 0;
    const ml = Number(getVal(row, headerMap.precoMedioML)) || 0;
    const ncmPlan = sanitizeNCM(getVal(row, headerMap.ncm));
    const ncm = await resolveNCM({ sku, ncmPlanilha: ncmPlan, descricao: desc });
    out.push({ sku, descricao: desc, qtd, precoMedioML: ml, ncm });
  }
  return out;
}

export default processarPlanilha;
