let Dexie;
try {
  ({ default: Dexie } = await import('dexie'));
} catch {}

// If IndexedDB isn't available (e.g. during tests), fall back to an in-memory store
let db;

if (Dexie && typeof indexedDB !== 'undefined') {
  // Browser/real environment
  db = new Dexie('ConfML');
  db.version(1).stores({
    lotes: '++id, rz, nome, criadoEm',
    itens: '++id, lotId, sku, descricao, precoML, qtd, byLot, bySku',
    conferidos: '++id, lotId, sku, ts',
    excedentes: '++id, lotId, sku, ts',
    prefs: 'key'
  });
} else {
  // Simple in-memory fallback used in Node tests
  const mem = { lotes: [], itens: [], conferidos: [], excedentes: [], prefs: [] };
  const nextId = (arr) => (arr.length ? Math.max(...arr.map((o) => o.id)) : 0) + 1;

  db = {
    lotes: {
      async add(obj) {
        obj.id = nextId(mem.lotes);
        mem.lotes.push(obj);
        return obj.id;
      },
      async toArray() { return mem.lotes.slice(); },
    },
    itens: {
      async bulkAdd(arr) {
        arr.forEach((it) => { it.id = nextId(mem.itens); mem.itens.push(it); });
      },
      where(query) {
        return typeof query === 'string'
          ? {
              equals(val) {
                const list = mem.itens.filter((it) => it[query] === val);
                return {
                  count: async () => list.length,
                  first: async () => list[0],
                  toArray: async () => list.slice(),
                };
              },
            }
          : {
              async first() {
                return mem.itens.find((it) => Object.keys(query).every((k) => it[k] === query[k]));
              },
            };
      },
    },
    conferidos: {
      async add(obj) {
        obj.id = nextId(mem.conferidos);
        mem.conferidos.push(obj);
        return obj.id;
      },
      where(field) {
        return {
          equals(val) {
            const list = mem.conferidos.filter((it) => it[field] === val);
            return {
              count: async () => list.length,
              toArray: async () => list.slice(),
            };
          },
        };
      },
    },
    excedentes: {
      async add(obj) {
        obj.id = nextId(mem.excedentes);
        mem.excedentes.push(obj);
        return obj.id;
      },
      where(field) {
        return {
          equals(val) {
            const list = mem.excedentes.filter((it) => it[field] === val);
            return {
              count: async () => list.length,
              toArray: async () => list.slice(),
            };
          },
        };
      },
    },
    prefs: {
      async put(obj) { mem.prefs = obj; },
    },
  };
}

export { db };

// Helpers
export async function createLote({ nome, rz }) {
  return db.lotes.add({ nome, rz, criadoEm: Date.now() });
}
export async function bulkAddItens(lotId, itens) {
  const payload = itens.map((it) => ({ ...it, lotId }));
  return db.itens.bulkAdd(payload);
}
export async function findItem(lotId, sku) {
  return db.itens.where({ lotId, sku }).first();
}
export async function addConferido(lotId, { sku, qtd, preco }) {
  return db.conferidos.add({ lotId, sku, qtd, preco, ts: Date.now() });
}
export async function addExcedente(lotId, reg) {
  return db.excedentes.add({ ...reg, lotId, ts: Date.now() });
}
export async function countKpis(lotId) {
  const [totItens, totConf, totExc] = await Promise.all([
    db.itens.where('lotId').equals(lotId).count(),
    db.conferidos.where('lotId').equals(lotId).count(),
    db.excedentes.where('lotId').equals(lotId).count(),
  ]);
  const pend = Math.max(totItens - totConf, 0);
  return { totItens, totConf, totExc, pend };
}

export default db;

