import store from '@/store';

const icons = {
  box: `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M12 2l8 4v12l-8 4-8-4V6l8-4zm0 2.2L6 6.8v10.5l6 3 6-3V6.8l-6-2.6z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M9 16.2l-3.5-3.5-1.4 1.4L9 19 20 8l-1.4-1.4z"/></svg>`,
  warn: `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`,
  pending: `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11H7v-2h4V7h2v6z"/></svg>`,
};

function card({ icon, label, value, id }) {
  return `
    <article class="kpi-card" data-id="${id}">
      <div class="kpi-icon">${icon}</div>
      <div class="kpi-body">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">${value}</div>
      </div>
    </article>
  `;
}

export function mountKpis(container) {
  if (!container) return;

  const render = () => {
    const { total, conferidos, excedentes, pendentes } = store.selectCounts
      ? store.selectCounts()
      : { total: 0, conferidos: 0, excedentes: 0, pendentes: 0 };

    container.innerHTML = `
      <section class="kpis">
        ${card({ id: 'total', icon: icons.box, label: 'Itens do lote', value: total })}
        ${card({ id: 'conf', icon: icons.check, label: 'Conferidos', value: conferidos })}
        ${card({ id: 'exc', icon: icons.warn, label: 'Excedentes', value: excedentes })}
        ${card({ id: 'pend', icon: icons.pending, label: 'Pendentes', value: pendentes })}
      </section>
    `;
  };

  render();
  // Reagir a mudanças
  if (store.subscribeCounts) {
    store.subscribeCounts(() => {
      // Atualiza apenas os números
      const { total, conferidos, excedentes, pendentes } = store.selectCounts();
      container
        .querySelector('[data-id="total"] .kpi-value')
        ?.replaceChildren(document.createTextNode(total));
      container
        .querySelector('[data-id="conf"] .kpi-value')
        ?.replaceChildren(document.createTextNode(conferidos));
      container
        .querySelector('[data-id="exc"] .kpi-value')
        ?.replaceChildren(document.createTextNode(excedentes));
      container
        .querySelector('[data-id="pend"] .kpi-value')
        ?.replaceChildren(document.createTextNode(pendentes));
    });
  }
}

