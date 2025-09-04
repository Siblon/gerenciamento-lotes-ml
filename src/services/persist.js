import { addConferido, addExcedente, db } from '../db/indexed.js';
import { updateBoot } from '../utils/boot.js';

// Conferidos
export async function saveConferido(item) {
  if (typeof window?.currentLotId !== 'number') return;
  await addConferido(window.currentLotId, item);
  updateBoot?.('Produto registrado com sucesso');
}

// Excedentes (SKU, descricao, qtd, preco_unit?, obs?)
export async function saveExcedente(reg) {
  if (typeof window?.currentLotId !== 'number') return;
  await addExcedente(window.currentLotId, reg);
  updateBoot?.('Produto registrado com sucesso');
}

// Leitura
export async function loadConferidos() {
  if (typeof window?.currentLotId !== 'number') return [];
  return await db.conferidos.where('lotId').equals(window.currentLotId).toArray();
}
export async function loadExcedentes() {
  if (typeof window?.currentLotId !== 'number') return [];
  return await db.excedentes.where('lotId').equals(window.currentLotId).toArray();
}

