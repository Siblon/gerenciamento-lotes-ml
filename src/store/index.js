const STORAGE_KEY = 'conferencia-state';

// Estrutura principal do estado:
// pallets: { RZ: { expected:{codigo:qtde}, conferido:{codigo:qtde}, excedentes:{codigo:qtde} } }
// currentRZ: RZ atualmente selecionado para conferência
export const state = {
  pallets: {},
  currentRZ: null,
};

export function init(pallets) {
  state.pallets = {};
  Object.keys(pallets).forEach(rz => {
    state.pallets[rz] = {
      expected: { ...pallets[rz] },
      conferido: {},
      excedentes: {},
    };
  });
  state.currentRZ = null;
  save();
}

export function selectRZ(rz) {
  state.currentRZ = rz;
  if (!state.pallets[rz]) {
    state.pallets[rz] = { expected: {}, conferido: {}, excedentes: {} };
  }
  save();
}

function getCurrent() {
  return state.pallets[state.currentRZ];
}

export function conferir(codigo) {
  const pallet = getCurrent();
  if (!pallet) return;
  const esperado = pallet.expected[codigo];
  if (esperado) {
    pallet.conferido[codigo] = (pallet.conferido[codigo] || 0) + 1;
    if (pallet.conferido[codigo] > esperado) {
      pallet.excedentes[codigo] = (pallet.excedentes[codigo] || 0) + 1;
    }
  } else {
    pallet.excedentes[codigo] = (pallet.excedentes[codigo] || 0) + 1;
  }
  save();
}

export function progress() {
  const pallet = getCurrent();
  if (!pallet) return { done: 0, total: 0 };
  const total = Object.values(pallet.expected).reduce((s, q) => s + q, 0);
  const done = Object.entries(pallet.conferido).reduce(
    (s, [codigo, qtd]) => s + Math.min(qtd, pallet.expected[codigo] || 0),
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
    esperado: pallet.expected[codigo] || 0,
  }));
}

export function listarFaltantes() {
  const pallet = getCurrent();
  if (!pallet) return [];
  const faltantes = [];
  Object.keys(pallet.expected).forEach(codigo => {
    const esperado = pallet.expected[codigo];
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
  const pallet = getCurrent();
  if (!pallet) return [];
  return Object.keys(pallet.excedentes).map(codigo => ({
    codigo,
    quantidade: pallet.excedentes[codigo],
  }));
}

export function finalizeCurrent() {
  const pallet = getCurrent();
  if (!pallet) return { conferidos: [], faltantes: [], excedentes: [] };
  const conferidos = [];
  Object.keys(pallet.expected).forEach(codigo => {
    const esperado = pallet.expected[codigo];
    const conf = pallet.conferido[codigo] || 0;
    const qtde = Math.min(conf, esperado);
    if (qtde > 0) {
      conferidos.push({ codigo, quantidade: qtde });
    }
  });
  const faltantes = listarFaltantes().map(f => ({ codigo: f.codigo, quantidade: f.quantidade }));
  const excedentes = listarExcedentes();
  return { conferidos, faltantes, excedentes };
}

export function save() {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

export function load() {
  if (typeof localStorage === 'undefined') return;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const data = JSON.parse(saved);
    state.pallets = data.pallets || {};
    state.currentRZ = data.currentRZ || null;
  }
}

export default {
  state,
  init,
  selectRZ,
  conferir,
  progress,
  listarConferidos,
  listarFaltantes,
  listarExcedentes,
  finalizeCurrent,
  save,
  load,
};

