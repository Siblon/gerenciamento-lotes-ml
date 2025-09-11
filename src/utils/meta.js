// src/utils/meta.js
// Helpers for storing lightweight metadata in localStorage.

const META_KEY = 'confApp.meta.v1';

export function loadMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '{}');
  } catch (err) {
    console.warn('loadMeta falhou', err);
    return {};
  }
}

export function saveMeta(partial) {
  const cur = loadMeta();
  const next = { ...cur, ...partial, savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('saveMeta falhou', err);
  }
  return next;
}

export default { loadMeta, saveMeta };

