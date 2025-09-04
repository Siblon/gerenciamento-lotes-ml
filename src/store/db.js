import Dexie from 'dexie';

export const db = new Dexie('ml-conf-db');

// Versionar schema para permitir migrações futuras
db.version(1).stores({
  lots: '++id, name, rz, createdAt',          // um registro por planilha importada
  items: '++id, lotId, sku, status, desc',    // itens vinculados ao lotId
  settings: 'key'                              // pares chave-valor (ex: activeLotId)
});

// Helpers simples
export async function getSetting(key, def = null) {
  const row = await db.settings.get(key);
  return row ? row.value : def;
}
export async function setSetting(key, value) {
  return db.settings.put({ key, value });
}
