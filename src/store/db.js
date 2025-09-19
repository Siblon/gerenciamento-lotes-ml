// src/store/db.js
// Implementação simplificada sem Dexie
// Armazena dados em memória + localStorage (fallback)

const CUR_KEY = 'confApp.currentLotId';
const LOTS_KEY = 'confApp.lots';
const ITEMS_KEY = 'confApp.items';

function load(key, def = []) {
  try {
    return JSON.parse(localStorage.getItem(key)) || def;
  } catch {
    return def;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// Estado em memória (sincronizado com localStorage)
let lots = load(LOTS_KEY);
let items = load(ITEMS_KEY);

export async function addLot({ name, rz }) {
  const id = Date.now(); // id simples baseado em timestamp
  const lot = { id, name, rz, createdAt: new Date().toISOString() };
  lots.push(lot);
  save(LOTS_KEY, lots);
  return id;
}

export async function getLots() {
  return lots.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function setCurrentLotId(id) {
  localStorage.setItem(CUR_KEY, String(id));
}

export function getCurrentLotId() {
  return Number(localStorage.getItem(CUR_KEY) || '0');
}

export async function clearAll() {
  lots = [];
  items = [];
  save(LOTS_KEY, lots);
  save(ITEMS_KEY, items);
  localStorage.removeItem(CUR_KEY);
}

export async function addItemsBulk(lotId, newItems) {
  const rows = newItems.map(it => ({ ...it, lotId }));
  items.push(...rows);
  save(ITEMS_KEY, items);
}

export async function countByStatus(lotId) {
  const filtered = items.filter(it => it.lotId === lotId);
  const pending = filtered.filter(it => it.status === 'pending').length;
  const excedente = filtered.filter(it => it.status === 'excedente').length;
  const total = filtered.length;
  const checked = filtered.filter(
    it => it.status === 'checked' || it.status === 'conferido'
  ).length;
  return { pending, checked, excedente, total };
}

export async function getItemsByLotAndStatus(lotId, status, { limit = 50, offset = 0 } = {}) {
  let filtered = items.filter(it => it.lotId === lotId);
  if (status === 'checked') {
    filtered = filtered.filter(it => it.status === 'checked' || it.status === 'conferido');
  } else {
    filtered = filtered.filter(it => it.status === status);
  }
  return filtered.slice(offset, offset + limit);
}

// Helpers de compatibilidade
export async function resetAll() {
  return clearAll();
}

export async function setSetting(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function getSetting(key, def = null) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : def;
  } catch {
    return def;
  }
}

// Export default como objeto "db" (compatível)
export const db = {
  lots,
  items
};

export default db;
