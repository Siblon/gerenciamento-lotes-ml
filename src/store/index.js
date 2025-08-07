const STORAGE_KEY = 'conferencia-state';

export const state = {
  expected: [],
  conferidos: [],
  excedentes: [],
  faltantes: [],
  total: 0,
};

export function init(codes) {
  state.expected = codes.slice();
  state.conferidos = [];
  state.excedentes = [];
  state.faltantes = [];
  state.total = codes.length;
  save();
}

export function conferir(codigo) {
  const idx = state.expected.indexOf(codigo);
  if (idx !== -1) {
    state.expected.splice(idx, 1);
    state.conferidos.push(codigo);
  } else if (!state.excedentes.includes(codigo)) {
    state.excedentes.push(codigo);
  }
  save();
}

export function marcarFaltante(codigo) {
  const idx = state.expected.indexOf(codigo);
  if (idx !== -1) {
    state.expected.splice(idx, 1);
    state.faltantes.push(codigo);
    save();
  }
}

export function progress() {
  return { done: state.conferidos.length, total: state.total };
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
    state.expected = data.expected || [];
    state.conferidos = data.conferidos || [];
    state.excedentes = data.excedentes || [];
    state.faltantes = data.faltantes || [];
    state.total = data.total || 0;
  }
}

export default {
  state,
  init,
  conferir,
  marcarFaltante,
  progress,
  save,
  load,
};
