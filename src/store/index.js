// src/store/index.js
const state = {
  currentRZ: null,

  // listas e dados brutos
  rzList: [],
  itemsByRZ: {},          // { RZ: [ { codigoML, descricao, qtd, valorUnit, ... } ] }

  // totais por RZ → SKU (vindo do Excel)
  totalByRZSku: {},       // { [rz]: { [sku]: qtdTotal } }

  // metadados por RZ → SKU (vindo do Excel)
  metaByRZSku: {},        // { [rz]: { [sku]: { descricao, precoMedio } } }

  // conferidos em runtime
  conferidosByRZSku: {},  // { [rz]: { [sku]: qtdConferida } }

  // eventos de conferência (para auditoria/finalizar)
  movimentos: [],         // [{ ts, rz, sku, delta, precoAjustado, observacao }]

  limits: {
    conferidos: 50,
    pendentes: 50,
  },
};

export function setCurrentRZ(rz){ state.currentRZ = rz; }
export function addMovimento(m){ state.movimentos.push(m); }
export function setLimits(part, v){ state.limits[part] = Number(v)||50; }

// Helpers de acesso seguro
export function getTotals(rz) {
  return store.state.totalByRZSku[rz] || {};
}

export function getConferidos(rz) {
  return store.state.conferidosByRZSku[rz] || {};
}

export function sumQuant(obj) {
  return Object.values(obj || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

export function totalPendentesCount(rz) {
  const tot = getTotals(rz);
  const conf = getConferidos(rz);
  const totalAll = sumQuant(tot);
  const doneAll = sumQuant(conf);
  return Math.max(0, totalAll - doneAll);
}

// nunca deixar negativo
export function addConferido(rz, sku, delta = 1) {
  const map = (state.conferidosByRZSku[rz] ||= {});
  map[sku] = Math.max(0, (Number(map[sku]) || 0) + (Number(delta) || 0));
}

const store = { state };

export default store;
