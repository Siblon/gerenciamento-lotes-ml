const state = {
  currentRZ: null,
  rzs: [],
  itens: [],
};

function normalizeArray(value) {
  if (!Array.isArray(value)) return [];

  const resultado = [];

  value.forEach((item) => {
    if (item == null) return;
    const normalizado = typeof item === 'string' ? item.trim() : item;
    if (normalizado === '') return;
    if (!resultado.includes(normalizado)) {
      resultado.push(normalizado);
    }
  });

  return resultado;
}

export function setRZs(rzs) {
  state.rzs = normalizeArray(rzs);
  console.log('[STORE] setRZs', state.rzs);

  if (!state.rzs.includes(state.currentRZ)) {
    state.currentRZ = state.rzs[0] ?? null;
    if (state.currentRZ != null) {
      console.log('[STORE] currentRZ ajustado', state.currentRZ);
    }
  }
}

export function setItens(itens) {
  state.itens = Array.isArray(itens) ? [...itens] : [];
  console.log('[STORE] setItens', state.itens.length);
}

export function setCurrentRZ(rz) {
  const normalizado = typeof rz === 'string' ? rz.trim() : rz;
  state.currentRZ = normalizado ?? null;
  console.log('[STORE] setCurrentRZ', state.currentRZ);

  if (state.currentRZ != null && !state.rzs.includes(state.currentRZ)) {
    state.rzs = normalizeArray([state.currentRZ, ...state.rzs]);
    console.log('[STORE] currentRZ adicionado à lista de RZs', state.rzs);
  }
}

export { state };
