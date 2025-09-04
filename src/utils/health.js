import db from '../store/db.js';

export async function checkIcons() {
  const nodes = [...document.querySelectorAll('use')];
  const okHref = nodes.every(u => (u.getAttribute('href') || '').startsWith('icons.svg#'));
  const iconsOk = await fetch('icons.svg', { cache: 'no-store' })
    .then(r => r.ok)
    .catch(() => false);
  return { ok: okHref && iconsOk, okHref, iconsOk };
}

export async function checkDexie() {
  const has = !!window.indexedDB;
  let opened = false, stores = [], error = null;
  if (has) {
    try {
      if (!db.isOpen()) await db.open();
      opened = true;
      stores = db.tables?.map(t => t.name) || [];
      db.close();
    } catch (e) {
      error = String(e);
    }
  }
  return { ok: has && opened && !error, has, opened, stores, error };
}

export async function resetStorage() {
  if (window.indexedDB?.databases) {
    const dbs = await indexedDB.databases();
    await Promise.all(
      dbs.map(d => new Promise(res => {
        const req = indexedDB.deleteDatabase(d.name);
        req.onsuccess = req.onerror = req.onblocked = () => res();
      }))
    );
  }
  localStorage.clear();
  sessionStorage.clear();
  if (window.caches?.keys) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  location.replace(location.pathname + '?nocache=1');
}

export async function runHealthChecks() {
  const [icons, dexie] = await Promise.all([
    checkIcons(),
    checkDexie()
  ]);
  const result = { icons, dexie };
  window.__HEALTH__ = result;
  console.log('window.__HEALTH__', result);
  return result;
}

if ('serviceWorker' in navigator) {
  if (location.search.includes('nocache=1')) {
    navigator.serviceWorker.getRegistrations().then(list => list.forEach(r => r.unregister()));
  } else {
    navigator.serviceWorker.register('sw.js');
  }
}

if (location.search.includes('nocache=1')) {
  console.log('HEALTH MODE');
  runHealthChecks();
}
