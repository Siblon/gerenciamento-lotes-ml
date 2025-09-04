// src/services/loteDb.js
import { db, getSetting } from '../store/db.js';

export async function markAsConferido(sku, patch = {}) {
  const lotId = await getSetting('activeLotId', null);
  if (!lotId) return;

  const row = await db.items.where({ lotId, sku }).first();
  if (!row) return;

  await db.items.update(row.id, { status: 'conferido', ...patch });
}

export async function addExcedente({ sku, descricao, qtd, preco }) {
  const lotId = await getSetting('activeLotId', null);
  if (!lotId) return;
  await db.items.add({
    lotId,
    sku,
    desc: descricao || '',
    qtd: Number(qtd || 1),
    precoMedio: Number(preco || 0),
    valorTotal: Number((preco || 0) * (qtd || 1)),
    status: 'excedente'
  });
}
