// src/components/ResultsPanel.js
import store, { getTotals, getConferidos } from '../store/index.js';

function rowsConferidos(rz){
  const conf = Object.keys(getConferidos(rz));
  const meta = store.state.metaByRZSku[rz] || {};
  const tot  = store.state.totalByRZSku[rz] || {};
  return conf.map(sku => {
    const m = meta[sku] || {};
    const qtd = tot[sku] || 0;
    const preco = Number(m.precoMedio||0);
    const status = store.state.conferidosByRZSku[rz]?.[sku]?.status;
    return { sku, descricao: m.descricao||'', qtd, preco, total: qtd*preco, status };
  }).sort((a,b)=> b.qtd - a.qtd);
}

function rowsPendentes(rz){
  const tot = getTotals(rz);
  const conf = getConferidos(rz);
  const meta = store.state.metaByRZSku[rz] || {};
  return Object.entries(tot).filter(([sku])=>!conf[sku]).map(([sku,qtd])=>{
    const m = meta[sku] || {};
    const preco = Number(m.precoMedio||0);
    return { sku, descricao: m.descricao||'', qtd, preco, total: qtd*preco };
  }).sort((a,b)=> b.qtd - a.qtd);
}

function rowsExcedentes(rz){
  const list = store.state.excedentes[rz] || [];
  return list.map(it=>{
    const preco = Number(it.preco||0);
    return { sku: it.sku, descricao: it.descricao||'', qtd: it.qtd||0, preco, total: (it.qtd||0)*preco };
  }).sort((a,b)=> b.qtd - a.qtd);
}

function updateToggleLabels() {
  document.querySelectorAll('button[id^="btn-recolher-"]').forEach(btn => {
    const sec = document.getElementById(btn.dataset.target);
    if (sec) btn.textContent = sec.classList.contains('collapsed') ? 'Expandir' : 'Recolher';
  });
}

export function renderResults(){
  const rz = store.state.rzAtual; if (!rz) return;
  const confRows = rowsConferidos(rz);
  const pendRows = rowsPendentes(rz);
  const tbConf = document.querySelector('#tbl-conferidos tbody');
  const tbPend = document.querySelector('#tbl-pendentes tbody');
  const tbExc  = document.querySelector('#excedentesTable');
    if (tbConf) {
      tbConf.innerHTML = confRows.length
        ? confRows.map(r=>{
            const badgeCls = r.status === 'avariado' ? 'badge-excedente' : 'badge-conferido';
            const label = r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : 'Conferido';
            return `<tr data-sku="${r.sku}" class="row-conferido${r.status==='avariado'?' avariado':''}"><td class="sticky">${r.sku}</td><td>${r.descricao}</td><td class="num">${r.qtd}</td><td class="num">${r.preco.toFixed(2)}</td><td class="num">${r.total.toFixed(2)}</td><td><span class="badge ${badgeCls}">${label}</span></td></tr>`;
          }).join('')
        : `<tr><td colspan="6" style="text-align:center;color:#777">Nenhum item conferido</td></tr>`;
    }
    if (tbPend) {
      tbPend.innerHTML = pendRows.length
        ? pendRows.map(r=>`<tr data-sku="${r.sku}" class="row-pendente"><td class="sticky">${r.sku}</td><td>${r.descricao}</td><td class="num">${r.qtd}</td><td class="num">${r.preco.toFixed(2)}</td><td class="num">${r.total.toFixed(2)}</td><td><span class="badge">Pendente</span></td></tr>`).join('')
        : `<tr><td colspan="6" style="text-align:center;color:#777">Sem pendências para este RZ</td></tr>`;
    }
    if (tbExc) {
      const excRows = rowsExcedentes(rz);
      tbExc.innerHTML = excRows.length
        ? excRows.map(r=>`<tr data-sku="${r.sku}" class="row-excedente"><td class="sticky">${r.sku}</td><td>${r.descricao}</td><td class="num">${r.qtd}</td><td class="num">${r.preco.toFixed(2)}</td><td class="num">${r.total.toFixed(2)}</td><td><span class="badge badge-excedente">Excedente</span></td></tr>`).join('')
        : `<tr><td colspan="6" style="text-align:center;color:#777">Nenhum excedente</td></tr>`;
    }
  const cont = store.state.contadores[rz] || { conferidos:0, total:0 };
  const hdr = document.getElementById('hdr-conferidos');
  if (hdr) hdr.textContent = `${cont.conferidos} de ${cont.total} conferidos`;
  const bc = document.getElementById('count-conferidos'); if (bc) bc.textContent = cont.conferidos;
  const bp = document.getElementById('count-pendentes'); if (bp) bp.textContent = cont.total - cont.conferidos;
  const be = document.getElementById('excedentesCount'); if (be) be.textContent = cont.excedentes || 0;
  updateToggleLabels();
  window.refreshIndicators?.();
}
