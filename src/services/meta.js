// Chave para localStorage
const META_KEY = 'confApp.meta.v1';

// Carrega metadados salvos
export function loadMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '{}');
  } catch {
    return {};
  }
}

// Salva novos dados no localStorage, mesclando com os existentes
export function saveMeta(partial) {
  const cur = loadMeta();
  const next = { ...cur, ...partial, savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('Falha ao salvar meta:', err);
  }
  return next;
}

import { store } from '../store/index.js';
const { state, setCurrentRZ } = store;

/**
 * Preenche o <select> com os valores de state.rzList
 * e restaura o valor salvo, se estiver presente e válido.
 */
export function hydrateRzSelect(selectEl) {
  if (!selectEl) return;

  const rzList = state.rzList || [];
  const meta = loadMeta();
  let restored = meta.rz || '';

  // Limpa opções anteriores
  selectEl.innerHTML = '';

  if (rzList.length === 0) {
    // Exibe placeholder se lista estiver vazia
    const opt = document.createElement('option');
    opt.textContent = 'Nenhum RZ disponível';
    opt.disabled = true;
    selectEl.appendChild(opt);
    return;
  }

  // Cria opções válidas
  for (const rz of rzList) {
    const opt = document.createElement('option');
    opt.value = rz;
    opt.textContent = rz;
    selectEl.appendChild(opt);
  }

  // Aplica valor restaurado, se existir na lista
  if (!rzList.includes(restored)) {
    restored = rzList[0]; // Usa o primeiro RZ como fallback
  }

  selectEl.value = restored;
  setCurrentRZ(restored);
}

/**
 * Escuta mudanças no <select> e salva o valor escolhido
 */
export function wireRzCapture(selectEl) {
  selectEl?.addEventListener('change', () => {
    const rz = selectEl.value || '';
    saveMeta({ rz });
    setCurrentRZ(rz);
  });
}
