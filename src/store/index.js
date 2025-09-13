// src/store/index.js
// Simplified store with optional DB integration and safe-mode fallback.

const STORAGE_KEY = 'confApp.store.v1';

export const state = {
  currentRZ: null,
  rzList: [],
  itens: [],
  conferidos: [],
  excedentes: [],
  faltantes: [],
};

// Map of excedentes by RZ kept outside public state
let excedentesMap = {};
let db = null;

function isSafeMode() {
  if (import.meta.env?.VITE_SAFE_MODE === '1') return true;
  try {
    return new URLSearchParams(window.location.search).get('safe') === '1';
  } catch {
    return false;
  }
}

function updateLists() {
  const current = state.itens.filter(it => it.codigoRZ === state.currentRZ);
  state.conferidos = current.filter(it => (it.qtdConferida || 0) >= Number(it.qtdPlanejada || 0));
  state.faltantes = current.filter(it => (it.qtdConferida || 0) < Number(it.qtdPlanejada || 0));
  state.excedentes = excedentesMap[state.currentRZ] || [];
}

export async function init(initialItems = []) {
  // load persisted state
  const saved = load();
  if (saved) {
    const { _excedentesMap = {}, ...rest } = saved;
    Object.assign(state, rest);
    excedentesMap = _excedentesMap;
  } else {
    Object.assign(state, {
      currentRZ: null,
      rzList: [],
      itens: Array.isArray(initialItems) ? initialItems : [],
      conferidos: [],
      excedentes: [],
      faltantes: [],
    });
  }

  if (initialItems.length) {
    state.itens = initialItems.map(it => ({ ...it, qtdConferida: Number(it.qtdConferida || 0) }));
  }

  state.rzList = Array.from(new Set(state.itens.map(it => it.codigoRZ)));
  if (!state.currentRZ && state.rzList.length) state.currentRZ = state.rzList[0];
  updateLists();

  if (!isSafeMode()) {
    try {
      db = await import('./db.js');
      await db?.init?.();
    } catch (err) {
      console.warn('DB init skipped:', err);
    }
  }
  save();
}

export function selectRZ(rzCode) {
  state.currentRZ = rzCode;
  updateLists();
  save();
}

export function conferir(codigoML) {
  const sku = String(codigoML || '').trim();
  if (!sku || !state.currentRZ) return;

  const item = state.itens.find(
    it => it.codigoRZ === state.currentRZ && String(it.codigoML).trim() === sku,
  );

  if (item) {
    const planejada = Number(item.qtdPlanejada || 0);
    const atual = Number(item.qtdConferida || 0);
    item.qtdConferida = Math.min(atual + 1, planejada);
  } else {
    const list = (excedentesMap[state.currentRZ] ||= []);
    let exc = list.find(e => e.codigoML === sku);
    if (exc) {
      exc.qtd = (exc.qtd || 0) + 1;
    } else {
      exc = { codigoML: sku, qtd: 1, descricaoManual: '' };
      list.push(exc);
    }
  }
  updateLists();
  save();

  try {
    Promise.resolve(db?.conferir?.(state.currentRZ, sku)).catch(err => console.warn('DB conferir falhou', err));
  } catch (err) {
    console.warn('DB conferir falhou', err);
  }
}

export function progress() {
  const total = state.conferidos.length + state.faltantes.length;
  return { done: state.conferidos.length, total };
}

export function listarConferidos() {
  return state.conferidos;
}

export function listarFaltantes() {
  return state.faltantes;
}

export function listarExcedentes() {
  return state.excedentes;
}

export function finalizeCurrent() {
  updateLists();
  save();
  return {
    conferidos: state.conferidos,
    excedentes: state.excedentes,
    faltantes: state.faltantes,
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('store load falhou', err);
    return null;
  }
}

export function save() {
  try {
    const payload = { ...state, _excedentesMap: excedentesMap };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('store save falhou', err);
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
  load,
  save,
};

