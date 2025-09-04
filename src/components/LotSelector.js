// src/components/LotSelector.js
import store from '@/store';

export function initLotSelector() {
  const host = document.getElementById('lot-selector-host');
  if (!host) return;

  const lotes = store.selectLotes ? store.selectLotes() : [];
  const current = store.selectLote?.() || lotes[0] || '';

  if (lotes.length <= 1) {
    host.innerHTML = `<input type="hidden" id="select-lote" value="${current}">`;
    return;
  }

  host.innerHTML = `
    <select id="select-lote" class="input">
      ${lotes.map(l => `<option ${l===current?'selected':''}>${l}</option>`).join('')}
    </select>
  `;
}

export function setCurrentLote(filename) {
  const el = document.getElementById('select-lote');
  if (el) el.value = filename;
  if (store.setLote) store.setLote(filename);
}
