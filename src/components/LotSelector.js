// src/components/LotSelector.js
import { db, setSetting, getSetting } from '../store/db.js';

export async function initLotSelector() {
  const sel = document.getElementById('select-lot'); // adicione <select id="select-lot"></select> no HTML
  if (!sel) return;

  const lots = await db.lots.orderBy('createdAt').reverse().toArray();
  sel.innerHTML = lots.map(l => `<option value="${l.id}">${l.name} — ${l.rz || 'RZ ?'}</option>`).join('');

  const active = await getSetting('activeLotId', lots[0]?.id);
  if (active) sel.value = String(active);

  sel.addEventListener('change', async () => {
    await setSetting('activeLotId', Number(sel.value));
    location.reload(); // simples e robusto — recarrega o app já pegando o novo lotId
  });
}
