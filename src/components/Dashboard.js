import { loadPrefs, savePrefs } from '../utils/prefs.js';

export function initDashboard() {
  // Local onde os KPIs devem aparecer
  let kpiHost = document.querySelector('.kpis');

  // Se ainda não existir o contêiner, criamos UM acima do card de importação,
  // sem remover nada do DOM.
  if (!kpiHost) {
    const importCard = document.getElementById('card-importacao');
    if (importCard) {
      importCard.insertAdjacentHTML('beforebegin', '<div class="kpis"></div>');
      kpiHost = importCard.previousElementSibling;
    } else {
      // fallback: adiciona no topo do main, mas sem limpar nada
      const main = document.querySelector('main .container, main') || document.body;
      const wrapper = document.createElement('div');
      wrapper.className = 'kpis';
      main.prepend(wrapper);
      kpiHost = wrapper;
    }
  }

  // NÃO toque no resto da página. Apenas preencha o grid de KPIs.
  const kpisHTML = `
    <div class="kpi" id="kpi-total">
      <svg class="ico" aria-hidden="true" focusable="false"><use href="icons.svg#box"></use></svg>
      <div>
        <div class="metric-label">Itens do lote</div>
        <div class="kpi-value"><span id="kpi-total-val">0</span></div>
      </div>
    </div>

    <div class="kpi" id="kpi-conf">
      <svg class="ico" aria-hidden="true" focusable="false"><use href="icons.svg#check"></use></svg>
      <div>
        <div class="metric-label">Conferidos</div>
        <div class="kpi-value"><span id="kpi-conf-val">0</span></div>
      </div>
    </div>

    <div class="kpi" id="kpi-exc">
      <svg class="ico" aria-hidden="true" focusable="false"><use href="icons.svg#alert"></use></svg>
      <div>
        <div class="metric-label">Excedentes</div>
        <div class="kpi-value"><span id="kpi-exc-val">0</span></div>
      </div>
    </div>

    <div class="kpi" id="kpi-pend">
      <svg class="ico" aria-hidden="true" focusable="false"><use href="icons.svg#scan"></use></svg>
      <div>
        <div class="metric-label">Pendentes</div>
        <div class="kpi-value"><span id="kpi-pend-val">0</span></div>
      </div>
    </div>
  `;

  // Renderiza os KPIs apenas dentro do host
  if (kpiHost) {
    kpiHost.innerHTML = kpisHTML;
  }

}

export default { initDashboard };
