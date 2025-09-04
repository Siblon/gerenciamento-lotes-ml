import store from '../store/index.js';

const SETTINGS_KEY = 'confApp.settings';

export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s || {}));
}

export function applyNcmToggleToUI(enabled) {
  const card = document.getElementById('card-ncm');
  if (card) card.classList.toggle('collapsed', !enabled);
  document.body?.classList.toggle('ncm-disabled', !enabled);
}

export function wireNcmToggle() {
  const chkPrimary = document.getElementById('resolve-ncm');
  const chkAlt = document.getElementById('dash-ncm');
  const s = loadSettings();
  const cur = !!s.resolveNcm;
  if (chkPrimary) chkPrimary.checked = cur;
  if (chkAlt) chkAlt.checked = cur;
  applyNcmToggleToUI(cur);

  const onChange = (v) => {
    const s2 = loadSettings();
    s2.resolveNcm = !!v;
    saveSettings(s2);
    applyNcmToggleToUI(!!v);
    document.dispatchEvent(new CustomEvent('ncm-pref-changed', { detail: { enabled: !!v } }));
  };

  chkPrimary?.addEventListener('change', () => onChange(chkPrimary.checked));
  chkAlt?.addEventListener('change', () => onChange(chkAlt.checked));
}

export function getExcedentes() {
  if (typeof store?.state?.rzAtual !== 'undefined') {
    return store.state.excedentes?.[store.state.rzAtual] || [];
  }
  const KEY = 'confApp.excedentes';
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export function renderExcedentes() {
  const tbody = document.getElementById('excedentesTable');
  if (!tbody) return;
  const data = getExcedentes();

  tbody.innerHTML = '';
  data.forEach(ex => {
    const tr = document.createElement('tr');

    const tdSku = document.createElement('td');
    tdSku.textContent = ex.sku || '—';

    const tdDesc = document.createElement('td');
    tdDesc.textContent = ex.descricao || '—';

    const tdQtd = document.createElement('td');
    tdQtd.className = 'num';
    tdQtd.textContent = String(ex.qtd ?? 0);

    const tdPreco = document.createElement('td');
    tdPreco.className = 'num';
    tdPreco.textContent = ex.preco_unit == null ? '—' :
      Number(ex.preco_unit).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const tdTotal = document.createElement('td');
    tdTotal.className = 'num';
    const tot = ex.preco_unit == null ? null : Number(ex.preco_unit) * Number(ex.qtd || 0);
    tdTotal.textContent = tot == null ? '—' :
      Number(tot).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const tdStatus = document.createElement('td');
    tdStatus.textContent = ex.status || 'Excedente';

    tr.appendChild(tdSku);
    tr.appendChild(tdDesc);
    tr.appendChild(tdQtd);
    tr.appendChild(tdPreco);
    tr.appendChild(tdTotal);
    tr.appendChild(tdStatus);
    tbody.appendChild(tr);
  });
}

export function getAllItems() {
  if (typeof store?.selectAllImportedItems === 'function') return store.selectAllImportedItems() || [];
  return [];
}

export function getConfirmedItems() {
  const items = [];
  for (const [, map] of Object.entries(store.state.conferidosByRZSku || {})) {
    for (const sku of Object.keys(map || {})) {
      items.push({ sku });
    }
  }
  return items;
}

export function getPendentesItems() {
  const all = getAllItems();
  const conf = new Set(getConfirmedItems().map(x => x.sku));
  const exc = new Set(getExcedentes().map(x => x.sku));
  return all.filter(x => !conf.has(x.sku) && !exc.has(x.sku));
}

function setText(el, value) { if (el) el.textContent = String(value); }

export function renderCounts() {
  const total = getAllItems().length;
  const conferidos = getConfirmedItems().length;
  const excedentes = getExcedentes().length;
  const pend = getPendentesItems().length;

  const kpiItens = document.querySelector('#card-importacao')?.closest('main')?.querySelector?.('.kpi-itens') || document.getElementById('count-itens');
  setText(kpiItens, total);

  setText(document.getElementById('count-conferidos'), conferidos);

  const kpiExc = document.getElementById('excedentesCount') || document.getElementById('count-excedentes');
  setText(kpiExc, excedentes);

  const kpiPend = document.getElementById('count-pendentes') || document.getElementById('count-pend');
  setText(kpiPend, pend);

  const hdr = document.getElementById('hdr-conferidos');
  if (hdr) hdr.textContent = `${conferidos} de ${total} conferidos`;
}
