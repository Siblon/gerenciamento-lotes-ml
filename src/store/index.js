// src/store/index.js
const state = {
  currentRZ: null,
  rzAtual: null,

  // listas e dados brutos
  rzList: [],
  itemsByRZ: {},          // { RZ: [ { codigoML, descricao, qtd, valorUnit, ... } ] }

  // totais por RZ → SKU (vindo do Excel)
  totalByRZSku: {},       // { [rz]: { [sku]: qtdTotal } }

  // metadados por RZ → SKU (vindo do Excel)
  metaByRZSku: {},        // { [rz]: { [sku]: { descricao, precoMedio, ncm } } }

    // conferidos em runtime (pode acumular quantidade)
    conferidosByRZSku: {},  // { [rz]: { [sku]: { qtd, precoAjustado, observacao, status } } }

  // contadores por RZ
  contadores: {},         // { [rz]: { conferidos, total } }

  // eventos de conferência (para auditoria/finalizar)
  movimentos: [],         // [{ ts, rz, sku, precoAjustado, observacao }]

  // excedentes por RZ
  excedentes: {},         // { [rz]: [ { sku, descricao, qtd, preco, obs, fonte, ncm } ] }

  limits: {
    conferidos: 50,
    pendentes: 50,
  },

  // cache simples de NCM por SKU
  ncmCache: (() => {
    try {
      return JSON.parse(localStorage.getItem('ncmCache:v1') || '{}');
    } catch {
      return {};
    }
  })(),

  // tags livres por item (id -> Set)
  itemTags: {},
};

function updateContadores(rz){
  const totalMap = state.totalByRZSku[rz] || {};
  const confMap = state.conferidosByRZSku[rz] || {};
  const total = Object.keys(totalMap).length;
  const conf = Object.keys(confMap).filter(sku => (confMap[sku]?.qtd || 0) >= (totalMap[sku] || 0)).length;
  const exc  = (state.excedentes[rz] || []).length;
  state.contadores[rz] = { conferidos: conf, total, excedentes: exc };
}

export function setCurrentRZ(rz){
  state.currentRZ = state.rzAtual = rz;
  if (rz) updateContadores(rz);
}

export function addMovimento(m){ state.movimentos.push(m); }
export function setLimits(part, v){ state.limits[part] = Number(v)||50; }

// Helpers de acesso seguro
export function getTotals(rz) {
  return state.totalByRZSku[rz] || {};
}

export function getConferidos(rz) {
  return state.conferidosByRZSku[rz] || {};
}

export function sumQuant(obj) {
  return Object.values(obj || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

export function totalPendentesCount(rz) {
  const tot = getTotals(rz);
  const conf = getConferidos(rz);
  const totalAll = Object.keys(tot).length; // cada SKU conta 1
  const doneAll = Object.keys(conf).length; // cada SKU conta 1
  return Math.max(0, totalAll - doneAll);
}

// evita duplicidade
export function addConferido(rz, sku, payload = {}) {
  const map = (state.conferidosByRZSku[rz] ||= {});
  const total = state.totalByRZSku[rz]?.[sku] || 0;
  const qty = Math.max(1, parseInt(payload.qty ?? 1, 10));
  const existente = map[sku] || { qtd: 0, precoAjustado: null, observacao: null, status: null, avariados: 0 };
  const restante = Math.max(0, total - existente.qtd);
  const efetivo = Math.min(qty, restante);
  if (efetivo <= 0) return;
  existente.qtd += efetivo;
  if (payload.precoAjustado !== undefined) existente.precoAjustado = payload.precoAjustado;
  if (payload.observacao) existente.observacao = payload.observacao;
  if (payload.avaria) {
    existente.status = 'avariado';
    existente.avariados = (existente.avariados || 0) + efetivo;
  }
  map[sku] = existente;
  state.movimentos.push({ ts: Date.now(), rz, sku, qty: efetivo, precoAjustado: existente.precoAjustado, observacao: existente.observacao, status: existente.status });
  updateContadores(rz);
}

export function getSkuInRZ(rz, sku){
  return !!(state.totalByRZSku[rz] || {})[sku];
}

export function isConferido(rz, sku){
  const tot = state.totalByRZSku[rz]?.[sku] || 0;
  const conf = state.conferidosByRZSku[rz]?.[sku]?.qtd || 0;
  return conf >= tot && tot > 0;
}

export function findInRZ(rz, sku){
  const tot = state.totalByRZSku[rz] || {};
  if (!tot[sku]) return null;
  const confQtd = state.conferidosByRZSku[rz]?.[sku]?.qtd || 0;
  if (confQtd >= tot[sku]) return null;
  const meta = state.metaByRZSku[rz]?.[sku] || {};
  return {
    sku,
    descricao: meta.descricao || '',
    qtd: tot[sku] - confQtd,
    precoMedio: meta.precoMedio,
    ncm: meta.ncm ?? null,
  };
}

export function findConferido(rz, sku){
  const conf = state.conferidosByRZSku[rz]?.[sku];
  if (!conf) return null;
  const meta = state.metaByRZSku[rz]?.[sku] || {};
  return {
    sku,
    descricao: meta.descricao || '',
    qtd: conf.qtd || 0,
    precoMedio: meta.precoMedio,
    ncm: meta.ncm ?? null,
  };
}

export function findEmOutrosRZ(sku){
  for (const [rz, map] of Object.entries(state.totalByRZSku || {})){
    if (rz !== state.rzAtual && map[sku]) return rz;
  }
  return null;
}

export function addExcedente(rz, { sku, descricao, qtd, preco, obs, fonte, ncm }){
  const list = (state.excedentes[rz] ||= []);
  const existente = list.find(it => it.sku === sku);
  const q = Number(qtd) || 0;
  const p = Number(preco) || 0;
  const metaNcm = ncm ?? state.metaByRZSku[rz]?.[sku]?.ncm ?? null;
  if (existente) {
    existente.qtd += q;
    existente.preco = p || existente.preco;
    existente.obs = obs || existente.obs;
    existente.ncm = metaNcm ?? existente.ncm ?? null;
  } else {
    list.push({ sku, descricao: descricao || '', qtd: q, preco: p, obs: obs || '', fonte: fonte || '', ncm: metaNcm });
  }
  state.movimentos.push({ ts: Date.now(), tipo: 'EXCEDENTE', rz, sku, qtd: q, preco: p, obs, fonte });
  updateContadores(rz);
}

export function moveItemEntreRZ(origem, destino, sku, qtd=1){
  const q = Number(qtd) || 0;
  const mapOrig = state.totalByRZSku[origem] || {};
  const mapDest = (state.totalByRZSku[destino] ||= {});
  if (mapOrig[sku]) {
    mapOrig[sku] -= q;
    if (mapOrig[sku] <= 0) delete mapOrig[sku];
  }
  mapDest[sku] = (mapDest[sku] || 0) + q;
  const meta = state.metaByRZSku[origem]?.[sku];
  if (meta){
    (state.metaByRZSku[destino] ||= {});
    state.metaByRZSku[destino][sku] = meta;
  }
  updateContadores(origem);
  updateContadores(destino);
}

export function dispatch(action){
  if (action?.type === 'REGISTRAR'){
    const { rz, sku, qty, precoAjustado, observacao } = action;
    addConferido(rz, sku, { qty, precoAjustado, observacao });
  }
}

export function conferir(sku, opts = {}) {
  const rz = state.rzAtual;
  addConferido(rz, sku, { qty: opts.qty, precoAjustado: opts.price, observacao: opts.note, avaria: opts.avaria });
}

export function registrarExcedente({ sku, qty, price, note }) {
  const rz = state.rzAtual;
  addExcedente(rz, { sku, descricao: '', qtd: qty, preco: price, obs: note, fonte: 'preset' });
}

function parseId(id){
  const [rz, sku] = String(id || '').split(':');
  return { rz, sku };
}

export function setItemNcm(id, ncm, source){
  const { rz, sku } = parseId(id);
  if(!rz || !sku) return;
  (state.metaByRZSku[rz] ||= {});
  const meta = (state.metaByRZSku[rz][sku] ||= {});
  meta.ncm = ncm;
  meta.ncm_source = source;
  meta.ncm_status = 'ok';
  state.ncmCache[sku] = ncm;
  try{ localStorage.setItem('ncmCache:v1', JSON.stringify(state.ncmCache)); }catch{}
}

export function setItemNcmStatus(id, status){
  const { rz, sku } = parseId(id);
  const meta = state.metaByRZSku[rz]?.[sku];
  if(meta) meta.ncm_status = status;
}

export function tagItem(id, tag){
  const set = (state.itemTags[id] ||= new Set());
  set.add(tag);
}

export function untagItem(id, tag){
  const set = state.itemTags[id];
  if(!set) return;
  set.delete(tag);
  if(set.size === 0) delete state.itemTags[id];
}

export function selectAllItems(){
  const rz = state.currentRZ;
  const out = [];
  const totals = state.totalByRZSku[rz] || {};
  const meta = state.metaByRZSku[rz] || {};
  for(const sku of Object.keys(totals)){
    out.push({ id:`${rz}:${sku}`, sku, ...(meta[sku]||{}) });
  }
  const exc = state.excedentes[rz] || [];
  for(const it of exc){
    out.push({ id:`${rz}:${it.sku}`, ...it });
  }
  return out;
}

const store = { state, dispatch, getSkuInRZ, isConferido, findInRZ, findConferido, addExcedente, findEmOutrosRZ, moveItemEntreRZ, conferir, registrarExcedente, setItemNcm, setItemNcmStatus, tagItem, untagItem, selectAllItems };

export default store;
