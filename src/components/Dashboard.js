import store from '../store/index.js';
import { loadPrefs, savePrefs } from '../utils/prefs.js';
import { startNcmQueue } from '../services/ncmQueue.js';

export function initDashboard(){
  const host = document.getElementById('dashboard');
  if(!host) return;
  const prefs = loadPrefs();
  host.innerHTML = `
    <div class="dashboard-header">
      <h2 class="section-title">Conferência</h2>
      <label class="switch">
        <input type="checkbox" id="dash-ncm" ${prefs.ncmEnabled ? 'checked' : ''} />
        <span>Resolver NCM</span>
      </label>
    </div>
    <div class="kpis">
      <div class="kpi"><svg class="ico"><use href="/icons.svg#box"></use></svg><div><div id="kpi-total">0</div><small class="subtle">Itens do lote</small></div></div>
      <div class="kpi"><svg class="ico"><use href="/icons.svg#check"></use></svg><div><div id="kpi-conf">0</div><small class="subtle">Conferidos</small></div></div>
      <div class="kpi"><svg class="ico"><use href="/icons.svg#alert"></use></svg><div><div id="kpi-exc">0</div><small class="subtle">Excedentes</small></div></div>
      <div class="kpi"><svg class="ico"><use href="/icons.svg#scan"></use></svg><div><div id="kpi-pend">0</div><small class="subtle">Pendentes</small></div></div>
    </div>
    <div class="quick-actions">
      <button id="dash-finalizar" class="btn btn-primary" type="button">Finalizar Conferência</button>
      <button id="dash-export" class="btn btn-ghost" type="button">Exportar Excel</button>
    </div>
  `;

  const tgl = document.getElementById('dash-ncm');
  tgl?.addEventListener('change', () => {
    const p = loadPrefs();
    p.ncmEnabled = tgl.checked;
    savePrefs(p);
    document.dispatchEvent(new CustomEvent('ncm-pref-changed',{detail:{enabled:tgl.checked}}));
    if (tgl.checked) {
      const items = store.selectAllImportedItems ? store.selectAllImportedItems() : [];
      startNcmQueue(items);
    } else {
      document.dispatchEvent(new Event('ncm-cancel'));
    }
  });

  document.getElementById('dash-finalizar')?.addEventListener('click', () => {
    document.getElementById('finalizarBtn')?.click();
  });
  document.getElementById('dash-export')?.addEventListener('click', () => {
    document.getElementById('btn-finalizar')?.click();
  });

  function update(){
    const rz = store.state.rzAtual;
    const c = store.state.contadores[rz] || { total:0, conferidos:0, excedentes:0 };
    const pend = c.total - c.conferidos;
    const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
    set('kpi-total', c.total);
    set('kpi-conf', c.conferidos);
    set('kpi-exc', c.excedentes||0);
    set('kpi-pend', pend);
  }
  update();
  window.updateDashboard = update;
}

export default { initDashboard };
