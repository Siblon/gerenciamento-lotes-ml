let Dexie; // cache local

export async function ensureDexie() {
  if (Dexie) return Dexie;
  const mod = await import('dexie');
  Dexie = mod.default ?? mod;
  return Dexie;
}

export async function openDb() {
  const DX = await ensureDexie();
  const db = new DX('conf-db');
  db.version(1).stores({
    items: '&sku, descricao, qtd, preco'
  });
  return db;
}
