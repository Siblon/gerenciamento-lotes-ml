// src/store/index.js
const state = {
  rzList: [],
  itemsByRZ: {},          // { RZ-xxxxx: [ { codigoML, codigoRZ, qtd, valorUnit, ... } ] }
  totalByRZSku: {},       // { RZ-xxxxx: { SKU: totalQtd } }  // preenchido no parse
  conferidosByRZSku: {},  // { RZ-xxxxx: { SKU: qtdConferida } }
  currentRZ: null,
};

export default { state };
