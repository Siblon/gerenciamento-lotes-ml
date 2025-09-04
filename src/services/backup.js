// src/services/backup.js
// Backup automático simples (sem plugin): serializa as tabelas e guarda em localStorage.
// Também expõe um método para baixar .json manualmente.

const LS_KEY = 'confApp.dexieBackup.v1';
const DEFAULT_INTERVAL_MS = 30_000;

function safeStringify(obj) {
  try { return JSON.stringify(obj); } catch { return '{}'; }
}

export async function takeSnapshot(db) {
  // Ajuste os nomes das tabelas conforme seu db (lotes, itens, excedentes, pendentes, metas etc.)
  const dump = {};
  for (const table of db.tables) {
    dump[table.name] = await table.toArray();
  }
  return {
    takenAt: new Date().toISOString(),
    schema: db.tables.map(t => t.name),
    dump,
  };
}

export async function saveSnapshotToLocalStorage(db) {
  const snap = await takeSnapshot(db);
  localStorage.setItem(LS_KEY, safeStringify(snap));
  return snap;
}

export function getLastSnapshot() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || 'null');
  } catch {
    return null;
  }
}

export async function downloadSnapshot(db, filename = 'backup-lotes.json') {
  const snap = await takeSnapshot(db);
  const blob = new Blob([safeStringify(snap)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

let intervalId = null;

export function startAutoBackup(db, { intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  stopAutoBackup();
  intervalId = setInterval(() => { saveSnapshotToLocalStorage(db); }, intervalMs);
  // Flush em navegação/fechamento
  window.addEventListener('beforeunload', onBeforeUnload);
  async function onBeforeUnload() { try { await saveSnapshotToLocalStorage(db); } catch {} }
}

export function stopAutoBackup() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  window.removeEventListener('beforeunload', () => {});
}

