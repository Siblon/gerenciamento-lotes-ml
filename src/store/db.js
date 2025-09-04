import Dexie from 'dexie';

export const db = new Dexie('conferenciaDB');
db.version(1).stores({
  lots: '++id, name',
  items: '++id, lotId, sku, status, [lotId+status], [lotId+sku]'
});

export async function ensureDbOpen(){
  if (!db.isOpen()) {
    await db.open();
  }
}

export async function addLot({ name, rz }){
  await ensureDbOpen();
  const filename = String(name || '').split(/[/\\]/).pop();
  const existing = await db.lots.where('name').equals(filename).first();
  if (existing) return existing.id;
  const id = await db.lots.add({ name: filename, rz, createdAt: new Date() });
  return id;
}

export async function getLots(){
  await ensureDbOpen();
  const lots = await db.lots.toArray();
  return lots.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
}

const CURRENT_KEY = 'confApp.currentLotId';
export function setCurrentLotId(id){
  try { localStorage.setItem(CURRENT_KEY, String(id)); } catch {}
}
export function getCurrentLotId(){
  try {
    const v = localStorage.getItem(CURRENT_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export async function clearAll(){
  await ensureDbOpen();
  await db.transaction('rw', db.items, db.lots, async () => {
    await db.items.clear();
    await db.lots.clear();
  });
}

export async function addItemsBulk(lotId, items){
  await ensureDbOpen();
  const rows = items.map(it => ({ ...it, lotId: it.lotId ?? lotId }));
  if (rows.length) await db.items.bulkAdd(rows);
}

export async function getItemsByLotAndStatus(lotId, status, {limit=50, offset=0}={}){
  await ensureDbOpen();
  return db.items.where('[lotId+status]').equals([lotId, status]).offset(offset).limit(limit).toArray();
}

export async function countByStatus(lotId){
  await ensureDbOpen();
  const [pending, checked, excedente] = await Promise.all([
    db.items.where('[lotId+status]').equals([lotId, 'pending']).count(),
    db.items.where('[lotId+status]').equals([lotId, 'checked']).count(),
    db.items.where('[lotId+status]').equals([lotId, 'excedente']).count(),
  ]);
  return { pending, checked, excedente };
}

// Legacy helpers kept for compatibility with existing code/tests
export async function resetAll(){
  return clearAll();
}
export async function setSetting(key, value){
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
export async function getSetting(key, def=null){
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : def;
  } catch {
    return def;
  }
}

export default db;
