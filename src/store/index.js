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
  metaByRZSku: {},        // { [rz]: { [sku]: { descricao, precoMedio } } }

  // conferidos em runtime (sem duplicidade)
  conferidosByRZSku: {},  // { [rz]: { [sku]: { precoAjustado, observacao } } }

  // contadores por RZ
  contadores: {},         // { [rz]: { conferidos, total } }

  // eventos de conferência (para auditoria/finalizar)
  movimentos: [],         // [{ ts, rz, sku, precoAjustado, observacao }]

  limits: {
    conferidos: 50,
    pendentes: 50,
  },
};

function updateContadores(rz){
  const total = Object.keys(state.totalByRZSku[rz] || {}).length;
  const conf = Object.keys(state.conferidosByRZSku[rz] || {}).length;
  state.contadores[rz] = { conferidos: conf, total };
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
  const totalAll = sumQuant(tot);
  const doneAll = Object.keys(conf).length; // cada SKU conta 1
  return Math.max(0, totalAll - doneAll);
}

// evita duplicidade
export function addConferido(rz, sku, payload = {}) {
  const map = (state.conferidosByRZSku[rz] ||= {});
  if (map[sku]) return; // já conferido
  map[sku] = { precoAjustado: payload.precoAjustado || null, observacao: payload.observacao || null };
  state.movimentos.push({ ts: Date.now(), rz, sku, ...map[sku] });
  updateContadores(rz);
}

export function getSkuInRZ(rz, sku){
  return !!(state.totalByRZSku[rz] || {})[sku];
}

export function isConferido(rz, sku){
  return !!(state.conferidosByRZSku[rz] || {})[sku];
}

export function findInRZ(rz, sku){
  const tot = state.totalByRZSku[rz] || {};
  const conf = state.conferidosByRZSku[rz] || {};
  if (!tot[sku] || conf[sku]) return null;
  const meta = state.metaByRZSku[rz]?.[sku] || {};
  return { sku, descricao: meta.descricao || '', qtd: tot[sku], precoMedio: meta.precoMedio };
}

export function findConferido(rz, sku){
  const conf = state.conferidosByRZSku[rz] || {};
  if (!conf[sku]) return null;
  const tot = state.totalByRZSku[rz] || {};
  const meta = state.metaByRZSku[rz]?.[sku] || {};
  return { sku, descricao: meta.descricao || '', qtd: tot[sku] || 0, precoMedio: meta.precoMedio };
}

export function dispatch(action){
  if (action?.type === 'REGISTRAR'){
    const { rz, sku, precoAjustado, observacao } = action;
    addConferido(rz, sku, { precoAjustado, observacao });
  }
}

const store = { state, dispatch, getSkuInRZ, isConferido, findInRZ, findConferido };

export default store;
