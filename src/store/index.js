// src/store/index.js
const state = {
  rzList: [],
  itemsByRZ: {},          // { RZ: [ { codigoML, descricao, qtd, valorUnit, ... } ] }
  totalByRZSku: {},       // { RZ: { SKU: totalQtd } }
  conferidosByRZSku: {},  // { RZ: { SKU: qtdConferida } }
  currentRZ: null,
};

export default { state };
