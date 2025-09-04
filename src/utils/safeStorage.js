// src/utils/safeStorage.js
const mem = new Map();

function warnOnce(msg) {
  if (!warnOnce._set) warnOnce._set = new Set();
  if (!warnOnce._set.has(msg)) { console.warn(msg); warnOnce._set.add(msg); }
}

export function getJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return mem.has(key) ? mem.get(key) : fallback;
    return JSON.parse(raw);
  } catch (e) {
    warnOnce('[safeStorage] getJSON falhou, usando memória.');
    return mem.has(key) ? mem.get(key) : fallback;
  }
}

export function setJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    mem.delete(key); // preferimos o LS quando deu certo
    return true;
  } catch (e) {
    warnOnce('[safeStorage] setJSON: quota/erro → usando memória.');
    mem.set(key, value);
    return false;
  }
}

export function updateArray(key, updater) {
  const curr = getJSON(key, []);
  const next = updater(Array.isArray(curr) ? curr.slice() : []);
  setJSON(key, next);
  return next;
}

