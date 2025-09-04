import { db } from '@/store/db';

export async function resetAllData() {
  try {
    await db.transaction('rw', db.itens, db.excedentes, db.meta, async () => {
      await db.itens.clear();
      await db.excedentes.clear();
      await db.meta.clear();
    });
  } catch {}
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
}
