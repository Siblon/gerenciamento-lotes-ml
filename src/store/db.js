import Dexie from 'dexie';

const DB_NAME = 'confDb';
const DB_VERSION = 2; // bump version

export const db = new Dexie(DB_NAME);

// v2: duas stores: lots e items
// lots: id auto, name e rz livre
// items: índices compostos para consultas por lote/status e lote/sku
// eslint-disable-next-line spellcheck/spell-checker
// (dexie handles indexes by string)
db.version(DB_VERSION).stores({
  lots: '++id,name,rz,createdAt',
  items: '++id, lotId, sku, status, [lotId+status], [lotId+sku]'
});

// fallback: if schema mismatch occurs, delete and recreate
export async function ensureDbOpen() {
  try {
    if (!db.isOpen()) await db.open();
  } catch (err) {
    console.warn('ensureDbOpen: reset DB due to schema mismatch', err);
    await Dexie.delete(DB_NAME);
    await db.open();
  }
}

// helpers -------------------------------------------------------------
export async function addLot({ name, rz }) {
  await ensureDbOpen();
  const id = await db.lots.add({ name, rz, createdAt: new Date() });
  return id;
}

export async function getLots() {
  await ensureDbOpen();
  return db.lots.orderBy('createdAt').reverse().toArray();
}

const CUR_KEY = 'confApp.currentLotId';
export function setCurrentLotId(id) { localStorage.setItem(CUR_KEY, String(id)); }
export function getCurrentLotId() { return Number(localStorage.getItem(CUR_KEY) || '0'); }

export async function clearAll() {
  await ensureDbOpen();
  await db.transaction('readwrite', db.lots, db.items, async () => {
    await db.items.clear();
    await db.lots.clear();
  });
  localStorage.removeItem(CUR_KEY);
}

export async function addItemsBulk(lotId, items) {
  await ensureDbOpen();
  const rows = items.map(it => ({ ...it, lotId }));
  if (rows.length) await db.items.bulkAdd(rows);
}

export async function countByStatus(lotId) {
  await ensureDbOpen();
  const pending = db.items.where({ lotId, status: 'pending' }).count();
  const excedente = db.items.where({ lotId, status: 'excedente' }).count();
  const total = db.items.where({ lotId }).count();
  // Compatibilidade: aceita registros legados com status "conferido"
  const checked = db.items
    .where({ lotId })
    .filter(it => it.status === 'checked' || it.status === 'conferido')
    .count();
  const [p, c, e, t] = await Promise.all([pending, checked, excedente, total]);
  return { pending: p, checked: c, excedente: e, total: t };
}

export async function getItemsByLotAndStatus(lotId, status, { limit = 50, offset = 0 } = {}) {
  await ensureDbOpen();
  if (status === 'checked') {
    // inclui registros com status antigo "conferido"
    return db.items
      .where({ lotId })
      .filter(it => it.status === 'checked' || it.status === 'conferido')
      .offset(offset)
      .limit(limit)
      .toArray();
  }
  return db.items.where({ lotId, status }).offset(offset).limit(limit).toArray();
}

// Legacy helpers kept for compatibility with existing code/tests
export async function resetAll() { return clearAll(); }
export async function setSetting(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
export async function getSetting(key, def = null) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : def;
  } catch {
    return def;
  }
}

export default db;
