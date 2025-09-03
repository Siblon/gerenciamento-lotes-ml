import store from '../store/index.js';
import { loadPrefs, savePrefs } from '../utils/prefs.js';
import { startNcmQueue } from '../services/ncmQueue.js';

export function initDashboard() {
  const pst = document.querySelector('[data-panel="home"]') || document.querySelector('.dashboard') || document.body;
  if (!pst) return;

  const prefs = loadPrefs?.() || { ncmEnabled: true };

  pst.innerHTML = `
    <div class="dashboard-header">
      <h2 class="section-title">Conferência</h2>

      <label class="switch">
        <input type="checkbox" id="dash-ncm" ${prefs.ncmEnabled ? 'checked' : ''} />
        <span>Resolver NCM</span>
      </label>
    </div>

    <div class="kpis">
      <div class="kpi" id="kpi-total">
        <svg class="ico" aria-hidden="true" focusable="false">
          <use href="/icons.svg#box"></use>
        </svg>
        <div>
          <div class="kpi-label">Itens do lote</div>
          <div class="kpi-value"><span id="kpi-total-val">0</span></div>
        </div>
      </div>

      <div class="kpi" id="kpi-conf">
        <svg class="ico" aria-hidden="true" focusable="false">
          <use href="/icons.svg#check"></use>
        </svg>
        <div>
          <div class="kpi-label">Conferidos</div>
          <div class="kpi-value"><span id="kpi-conf-val">0</span></div>
        </div>
      </div>

      <div class="kpi" id="kpi-exc">
        <svg class="ico" aria-hidden="true" focusable="false">
          <use href="/icons.svg#alert"></use>
        </svg>
        <div>
          <div class="kpi-label">Excedentes</div>
          <div class="kpi-value"><span id="kpi-exc-val">0</span></div>
        </div>
      </div>

      <div class="kpi" id="kpi-pend">
        <svg class="ico" aria-hidden="true" focusable="false">
          <use href="/icons.svg#scan"></use>
        </svg>
        <div>
          <div class="kpi-label">Pendentes</div>
          <div class="kpi-value"><span id="kpi-pend-val">0</span></div>
        </div>
      </div>
    </div>

    <div class="quick-actions">
      <button id="dash-finalizar" class="btn btn-primary" type="button">Finalizar Conferência</button>
      <button id="dash-export" class="btn btn-ghost" type="button">Exportar Excel</button>
    </div>
  `;

  // (se já existirem handlers antigos, preserve-os fora desta função ou readicione aqui)
  const chk = document.getElementById('dash-ncm');
  if (chk) {
    chk.addEventListener('change', (e) => {
      const p = typeof loadPrefs === 'function' ? loadPrefs() : {};
      p.ncmEnabled = !!e.target.checked;
      if (typeof savePrefs === 'function') savePrefs(p);
    });
  }
}

export default { initDashboard };
