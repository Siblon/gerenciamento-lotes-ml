const STORAGE_KEY = 'conferencia-state';

export const state = {
  pallets: {},
  currentRZ: null,
  ajustes: [],
  excedentes: new Map(),
  rzList: [],
  itemsByRZ: {},
  conferidosBySKU: {},
};

export function init(items = []) {
  state.pallets = {};
  state.ajustes = [];
  state.currentRZ = null;
  state.excedentes = new Map();
  items.forEach(it => {
    const { sku, rz, qtd, preco = 0, valorTotal = 0, descricao = '' } = it;
    if (!state.pallets[rz]) {
      state.pallets[rz] = { expected: {}, conferido: {} };
    }
    state.pallets[rz].expected[sku] = {
      qtd,
      precoOriginal: preco,
      precoAtual: preco,
      valorTotalOriginal: valorTotal || preco * qtd,
      descricao,
    };
  });
}

export function selectRZ(rz) {
  state.currentRZ = rz;
  if (!state.pallets[rz]) {
    state.pallets[rz] = { expected: {}, conferido: {} };
  }
}

export function findRZDeSKU(sku) {
  for (const [rz, pal] of Object.entries(state.pallets)) {
    if (pal.expected && pal.expected[sku]) return rz;
  }
  return null;
}

function getCurrent() {
  return state.pallets[state.currentRZ];
}

export function conferir(codigo) {
  const pallet = getCurrent();
  if (!pallet) return { status: 'no-rz' };
  const esperado = pallet.expected[codigo];
  if (esperado) {
    const conf = pallet.conferido[codigo] || 0;
    if (conf < esperado.qtd) {
      pallet.conferido[codigo] = conf + 1;
      return { status: 'ok', conferido: conf + 1, esperado: esperado.qtd };
    }
    return { status: 'full', conferido: conf, esperado: esperado.qtd };
  }
  return { status: 'not-found' };
}

export function registrarExcedente({ sku, descricao, qtd, precoUnit, obs }) {
  if (!state.currentRZ || !sku) return;
  const key = `${state.currentRZ}::${sku}`;
  const valorNovo = qtd * precoUnit;
  if (!state.excedentes.has(key)) {
    state.excedentes.set(key, {
      sku,
      rz: state.currentRZ,
      descricao,
      qtd,
      precoMedio: precoUnit,
      valorTotal: valorNovo,
      historico: [{ qtd, precoUnit, obs, ts: new Date().toISOString() }],
    });
  } else {
    const ex = state.excedentes.get(key);
    const qtdTot = ex.qtd + qtd;
    const valorTot = ex.valorTotal + valorNovo;
    ex.qtd = qtdTot;
    ex.precoMedio = valorTot / qtdTot;
    ex.valorTotal = valorTot;
    ex.descricao = ex.descricao || descricao;
    ex.historico?.push({ qtd, precoUnit, obs, ts: new Date().toISOString() });
  }
}

export function registrarAjuste({
  tipo = 'AJUSTE_PRECO',
  codigo,
  precoOriginal = 0,
  precoAjustado = 0,
  obs = '',
  qtd,
}) {
  state.ajustes.push({
    tipo,
    sku: codigo,
    rz: state.currentRZ,
    precoOriginal,
    precoAjustado,
    qtd,
    obs,
    timestamp: new Date().toISOString(),
  });
  const pallet = getCurrent();
  if (tipo === 'AJUSTE_PRECO' && pallet && pallet.expected[codigo]) {
    pallet.expected[codigo].precoAtual = precoAjustado;
  }
}

export function listarAjustes() {
  return state.ajustes;
}

export function progress() {
  const pallet = getCurrent();
  if (!pallet) return { done: 0, total: 0 };
  const total = Object.values(pallet.expected).reduce((s, it) => s + it.qtd, 0);
  const done = Object.entries(pallet.conferido).reduce(
    (s, [codigo, qtd]) => {
      const exp = pallet.expected[codigo];
      return s + Math.min(qtd, exp ? exp.qtd : 0);
    },
    0,
  );
  return { done, total };
}

export function listarConferidos() {
  const pallet = getCurrent();
  if (!pallet) return [];
  return Object.keys(pallet.conferido).map(codigo => ({
    codigo,
    conferido: pallet.conferido[codigo],
    esperado: pallet.expected[codigo]?.qtd || 0,
  }));
}

export function listarFaltantes() {
  const pallet = getCurrent();
  if (!pallet) return [];
  const faltantes = [];
  Object.keys(pallet.expected).forEach(codigo => {
    const esperado = pallet.expected[codigo].qtd;
    const conf = pallet.conferido[codigo] || 0;
    if (conf < esperado) {
      faltantes.push({
        codigo,
        quantidade: esperado - conf,
        esperado,
        conferido: conf,
      });
    }
  });
  return faltantes;
}

export function listarExcedentes() {
  if (!state.currentRZ) return [];
  return Array.from(state.excedentes.values()).filter(e => e.rz === state.currentRZ);
}

export function finalizeCurrent() {
  const pallet = getCurrent();
  if (!pallet)
    return {
      conferidos: [],
      faltantes: [],
      excedentes: [],
      ajustes: state.ajustes,
    };
  const conferidos = [];
  Object.keys(pallet.expected).forEach(codigo => {
    const esperado = pallet.expected[codigo].qtd;
    const conf = pallet.conferido[codigo] || 0;
    const qtde = Math.min(conf, esperado);
    if (qtde > 0) {
      conferidos.push({ codigo, quantidade: qtde });
    }
  });
  const faltantes = listarFaltantes().map(f => ({ codigo: f.codigo, quantidade: f.quantidade }));
  const excedentes = listarExcedentes();
  return { conferidos, faltantes, excedentes, ajustes: state.ajustes };
}

export function calcResumoRZ(rz) {
  const pallet = state.pallets[rz];
  if (!pallet)
    return { totalOriginal: 0, totalAjustado: 0, delta: 0, deltaPct: 0 };
  let totalOriginal = 0;
  let totalAjustado = 0;
  Object.values(pallet.expected).forEach(it => {
    totalOriginal += it.valorTotalOriginal;
    totalAjustado += it.precoAtual * it.qtd;
  });
  const delta = totalAjustado - totalOriginal;
  const deltaPct = totalOriginal ? delta / totalOriginal : 0;
  return { totalOriginal, totalAjustado, delta, deltaPct };
}

export function calcResumoGeral() {
  let totalOriginal = 0;
  let totalAjustado = 0;
  Object.keys(state.pallets).forEach(rz => {
    const r = calcResumoRZ(rz);
    totalOriginal += r.totalOriginal;
    totalAjustado += r.totalAjustado;
  });
  const delta = totalAjustado - totalOriginal;
  const deltaPct = totalOriginal ? delta / totalOriginal : 0;
  return { totalOriginal, totalAjustado, delta, deltaPct };
}

export function save() {
  if (typeof localStorage !== 'undefined') {
    const data = {
      pallets: state.pallets,
      currentRZ: state.currentRZ,
      ajustes: state.ajustes,
      excedentes: Array.from(state.excedentes.values()),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export function load() {
  if (typeof localStorage === 'undefined') return;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const data = JSON.parse(saved);
    state.pallets = data.pallets || {};
    state.currentRZ = data.currentRZ || null;
    state.ajustes = data.ajustes || [];
    state.excedentes = new Map(
      (data.excedentes || []).map(e => [`${e.rz}::${e.sku}`, e]),
    );
  }
}

export default {
  state,
  init,
  selectRZ,
  conferir,
  progress,
  findRZDeSKU,
  listarConferidos,
  listarFaltantes,
  listarExcedentes,
  listarAjustes,
  finalizeCurrent,
  registrarExcedente,
  registrarAjuste,
  calcResumoRZ,
  calcResumoGeral,
  save,
  load,
};

