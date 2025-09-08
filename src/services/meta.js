const META_KEY = 'confApp.meta.v1';

export function saveMeta(partial) {
  const cur = loadMeta();
  const next = { ...cur, ...partial, savedAt: new Date().toISOString() };
  localStorage.setItem(META_KEY, JSON.stringify(next));
  return next;
}

export function loadMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '{}');
  } catch {
    return {};
  }
}

import store, { setCurrentRZ } from '../store/index.js';
const { state } = store;

export function hydrateRzSelect(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  for (const rz of state.rzList || []) {
    const opt = document.createElement('option');
    opt.value = rz;
    opt.textContent = rz;
    selectEl.appendChild(opt);
  }
  const meta = loadMeta();
  let value = meta.rz;
  if (!state.rzList.includes(value)) {
    value = state.rzList[0] || '';
  }
  if (value) {
    selectEl.value = value;
  }
  setCurrentRZ(value || null);
}

export function wireRzCapture(selectEl) {
  selectEl?.addEventListener('change', () => {
    const rz = selectEl.value || '';
    saveMeta({ rz });
    setCurrentRZ(rz);
  });
}
