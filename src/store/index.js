// Simplified store for batch conference using only localStorage
const STORAGE_KEY = 'confApp.state.v1';

// estado básico do aplicativo
export const state = {
  currentRZ: null,
  rzList: [],
  itens: [],
  conferidos: [],
  excedentes: [],
  faltantes: []
};

// util interno para verificar safe mode (sempre usamos localStorage)
function isSafeMode() {
  try {
    const flagEnv = typeof import.meta !== 'undefined' &&
      import.meta.env && import.meta.env.VITE_SAFE_MODE === '1';
    const flagQuery = typeof window !== 'undefined' &&
      /[?&]safe=1/.test(window.location.search);
    return flagEnv || flagQuery;
  } catch {
    return false;
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('store.load falhou', err);
    return null;
  }
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('store.save falhou', err);
  }
}

export function init() {
  if (isSafeMode()) {
    const loaded = load();
    if (loaded) Object.assign(state, loaded);
  }
}

export function selectRZ(rzCode) {
  state.currentRZ = rzCode;
  if (!state.rzList.includes(rzCode)) {
    state.rzList.push(rzCode);
  }
  save();
}

export function conferir(codigoML) {
  const rz = state.currentRZ;
  if (!rz) return;
  const item = state.itens.find(
    it => it.rz === rz && String(it.codigoML).toUpperCase() === String(codigoML).toUpperCase()
  );
  if (item) {
    if (item.qtdConferida < item.qtdPlanejada) {
      item.qtdConferida += 1;
      if (item.qtdConferida === item.qtdPlanejada) {
        if (!state.conferidos.some(c => c.rz === rz && c.codigoML === item.codigoML)) {
          state.conferidos.push({ rz, codigoML: item.codigoML, descricao: item.descricao });
        }
      }
    }
  } else {
    const existente = state.excedentes.find(e => e.rz === rz && e.codigoML === codigoML);
    if (existente) {
      existente.qtd = (existente.qtd || 0) + 1;
    } else {
      state.excedentes.push({ rz, codigoML, descricaoManual: '', qtd: 1 });
    }
  }
  save();
}

export function progress() {
  const items = state.itens.filter(it => it.rz === state.currentRZ);
  const total = items.length;
  const done = items.filter(it => it.qtdConferida >= it.qtdPlanejada).length;
  return { done, total };
}

export function listarConferidos() {
  return state.itens.filter(
    it => it.rz === state.currentRZ && it.qtdConferida >= it.qtdPlanejada
  );
}

export function listarFaltantes() {
  return state.itens.filter(
    it => it.rz === state.currentRZ && it.qtdConferida < it.qtdPlanejada
  );
}

export function listarExcedentes() {
  return state.excedentes.filter(e => e.rz === state.currentRZ);
}

export function finalizeCurrent() {
  const faltantes = listarFaltantes().map(it => ({
    rz: state.currentRZ,
    codigoML: it.codigoML,
    descricao: it.descricao,
    faltante: it.qtdPlanejada - it.qtdConferida
  }));
  state.faltantes.push(...faltantes);
  save();
  return faltantes;
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
  save
};
