// src/store/rzMeta.js
// Abstração mínima de meta: get/set do currentRZ.
// Se já existir Dexie configurado, reutilize; caso contrário, crie fallback em localStorage.

let hasDexie = false;
let db;

try {
  // tente reaproveitar Dexie/db já existente
  // adapte o import conforme o projeto (ex.: import { db } from './db.js')
  // Se não existir, ficará em modo localStorage.
  // eslint-disable-next-line no-undef
  if (typeof Dexie !== 'undefined' || window.Dexie) hasDexie = true;
} catch {}

export async function loadCurrentRZ() {
  try {
    const val = localStorage.getItem('meta.currentRZ');
    return val || null;
  } catch { return null; }
}

export async function saveCurrentRZ(rz) {
  try {
    if (rz == null) localStorage.removeItem('meta.currentRZ');
    else localStorage.setItem('meta.currentRZ', rz);
  } catch {}
}
