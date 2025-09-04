// src/components/Results.js
function money(n){
  return Number(n || 0).toFixed(2);
}

export function renderPendentes(items){
  const tb = document.querySelector('#tbl-pendentes tbody');
  if (!tb) return;
  tb.innerHTML = '';
  for (const it of items){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="sticky">${it.sku}</td><td>${it.descricao||''}</td><td class="num">${it.qtd}</td><td class="num">${money(it.preco)}</td><td class="num">${money(it.qtd*it.preco)}</td><td><span class="badge">Pendente</span></td>`;
    tb.appendChild(tr);
  }
}

export function renderConferidos(items){
  const tb = document.querySelector('#tbl-conferidos tbody');
  if (!tb) return;
  tb.innerHTML = '';
  for (const it of items){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="sticky">${it.sku}</td><td>${it.descricao||''}</td><td class="num">${it.qtd}</td><td class="num">${money(it.preco)}</td><td class="num">${money(it.qtd*it.preco)}</td><td><span class="badge badge-conferido">Conferido</span></td>`;
    tb.appendChild(tr);
  }
}

export function renderExcedentes(items){
  const tb = document.querySelector('#excedentesTable');
  if (!tb) return;
  tb.innerHTML = '';
  for (const it of items){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="sticky">${it.sku}</td><td>${it.descricao||''}</td><td class="num">${it.qtd}</td><td class="num">${money(it.preco)}</td><td class="num">${money(it.qtd*it.preco)}</td><td><span class="badge badge-excedente">Excedente</span></td>`;
    tb.appendChild(tr);
  }
}
