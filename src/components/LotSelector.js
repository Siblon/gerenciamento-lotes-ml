// src/components/LotSelector.js
import { getLots, getCurrentLotId, setCurrentLotId } from '../store/db.js';

export async function initLotSelector(){
  const host = document.getElementById('lot-selector-host');
  if (!host) return;
  const lots = await getLots();
  const current = getCurrentLotId();
  if (!lots.length){
    host.innerHTML = '<select id="select-lote" class="input" disabled></select>';
    return;
  }
  host.innerHTML = `<select id="select-lote" class="input" title="Cada planilha importada vira um lote. Use este seletor para alternar entre lotes">${lots.map(l=>`<option value="${l.id}" ${l.id===current?'selected':''}>${l.name}</option>`).join('')}</select>`;
  const sel = host.querySelector('select');
  sel.addEventListener('change', e=>{
    const id = Number(e.target.value);
    setCurrentLotId(id);
    window.refreshAll?.();
  });
}
