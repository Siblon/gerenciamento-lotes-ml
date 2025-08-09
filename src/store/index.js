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
export function addConferido(rz, sku, delta=1){
  const map = (state.conferidosByRZSku[rz] ||= {});
  map[sku] = (map[sku]||0) + delta;
}
export function setLimits(part, v){ state.limits[part] = Number(v)||50; }

export default { state };
