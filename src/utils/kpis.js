import { loadConferidos, loadExcedentes } from '../services/persist.js';
import store from '../store/index.js';

export async function refreshKpis() {
  try {
    const conferidos = (await loadConferidos()).length;
    const excedentes = (await loadExcedentes()).length;
    const total      = (typeof store?.selectAllImportedItems === 'function')
      ? (store.selectAllImportedItems() || []).length : 0;
    const pendentes  = Math.max(total - conferidos - excedentes, 0);

    document.getElementById('count-conferidos')?.replaceChildren(document.createTextNode(String(conferidos)));
    document.getElementById('excedentesCount')?.replaceChildren(document.createTextNode(String(excedentes)));
    document.getElementById('count-pendentes') ?.replaceChildren(document.createTextNode(String(pendentes)));
  } catch (e) { console.warn('refreshKpis', e); }
}
window.refreshKpis = refreshKpis;

