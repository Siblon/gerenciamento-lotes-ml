const state = {
  currentRZ: null,
  rzs: [],
  itens: [],
};

const listeners = new Map();

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

function emit(eventName, payload) {
  const handlers = listeners.get(eventName);
  if (!handlers) return;

  handlers.forEach((handler) => {
    try {
      handler(payload);
    } catch (error) {
      console.error(`[STORE] Erro ao executar listener para "${eventName}"`, error);
    }
  });
}

export function on(eventName, handler) {
  if (typeof handler !== 'function') return () => {};

  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set());
  }

  const handlers = listeners.get(eventName);
  handlers.add(handler);

  return () => off(eventName, handler);
}

export function off(eventName, handler) {
  const handlers = listeners.get(eventName);
  if (!handlers) return;

  handlers.delete(handler);

  if (handlers.size === 0) {
    listeners.delete(eventName);
  }
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
  console.debug('[DEBUG] Itens carregados', state.itens.length);
  emit('itens:update', { itens: state.itens });
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
