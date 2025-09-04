import Dexie from 'dexie';

export const db = new Dexie('conferenciaDB');
db.version(1).stores({
  itens: '++id, sku, rz, lote, status',  // dados da conferência
  excedentes: '++id, sku, descricao, qtd, preco, rz, lote',
  meta: '&key',                          // chave-valor (rz, loteName, etc.)
  lots: '++id, name, rz, createdAt'
});

/** Salva metadado arbitrário */
export async function setMeta(key, value) {
  try {
    await db.meta?.put({ key, value });
  } catch {}
}

/** Lê metadado; retorna defaultVal se inexistente */
export async function getMeta(key, defaultVal = null) {
  try {
    const row = await db.meta?.get(key);
    return row ? row.value : defaultVal;
  } catch {
    return defaultVal;
  }
}

/** Reseta todo o banco: drop + recria + limpa qualquer cache relacionado. */
export async function resetDb() {
  try {
    await db.delete();
    await db.open(); // reabre vazio com o mesmo schema
      await db.version(1).stores({
        itens: '++id, sku, rz, lote, status',
        excedentes: '++id, sku, descricao, qtd, preco, rz, lote',
        meta: '&key',
        lots: '++id, name, rz, createdAt'
      });
  } catch {}
  // caches auxiliares
  try {
    localStorage.removeItem('confApp.settings');
    localStorage.removeItem('confApp.metrics');
    localStorage.removeItem('confApp.prefs');
  } catch {}
}

// Compatibilidade: novos utilitários de configuração
export async function getSetting(key, defaultVal = null) {
  return getMeta(key, defaultVal);
}

export async function setSetting(key, value) {
  return setMeta(key, value);
}

export async function resetAll() {
  return resetDb();
}

export default db;

