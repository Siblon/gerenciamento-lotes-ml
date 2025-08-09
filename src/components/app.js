// src/components/app.js
import { iniciarLeitura, pararLeitura } from '../utils/scan.js';
import { processarPlanilha } from '../utils/excel.js';
import store, { getTotals, getConferidos, setCurrentRZ } from '../store/index.js';

function toast(msg, type='info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  Object.assign(el.style, {
    position:'fixed', right:'16px', bottom:'16px', background:'#222', color:'#fff',
    padding:'10px 12px', borderRadius:'8px', fontSize:'14px', zIndex: 99999, opacity: 0.95
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function highlightRowBySKU(sku, tableId) {
  const row = document.querySelector(`#${tableId} tr[data-sku="${sku}"]`);
  if (!row) return false;
  row.classList.add('flash');
  row.scrollIntoView({ block:'center' });
  setTimeout(() => row.classList.remove('flash'), 1500);
  return true;
}

function rowsConferidos(rz){
  const conf = Object.keys(getConferidos(rz));
  const meta = store.state.metaByRZSku[rz] || {};
  const tot  = store.state.totalByRZSku[rz] || {};
  return conf.map(sku => {
    const m = meta[sku] || {};
    const qtd = tot[sku] || 0;
    const preco = Number(m.precoMedio||0);
    return { sku, descricao: m.descricao||'', qtd, preco, total: qtd*preco };
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

function render(){
  const rz = store.state.rzAtual; if (!rz) return;
  const confRows = rowsConferidos(rz);
  const pendRows = rowsPendentes(rz);
  const tbConf = document.querySelector('#tbl-conferidos tbody');
  const tbPend = document.querySelector('#tbl-pendentes tbody');
  if (tbConf) {
    tbConf.innerHTML = confRows.length ? confRows.map(r=>`<tr data-sku="${r.sku}"><td>${r.sku}</td><td>${r.descricao}</td><td style="text-align:right">${r.qtd}</td><td style="text-align:right">${r.preco.toFixed(2)}</td><td style="text-align:right">${r.total.toFixed(2)}</td></tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:#777">Nenhum item conferido</td></tr>`;
  }
  if (tbPend) {
    tbPend.innerHTML = pendRows.length ? pendRows.map(r=>`<tr data-sku="${r.sku}"><td>${r.sku}</td><td>${r.descricao}</td><td style="text-align:right">${r.qtd}</td><td style="text-align:right">${r.preco.toFixed(2)}</td><td style="text-align:right">${r.total.toFixed(2)}</td></tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:#777">Sem pendências para este RZ</td></tr>`;
  }
  const cont = store.state.contadores[rz] || { conferidos:0, total:0 };
  const hdr = document.getElementById('hdr-conferidos');
  if (hdr) hdr.textContent = `Conferência de Lotes ${cont.conferidos} de ${cont.total} conferidos`;
  const bc = document.getElementById('count-conferidos'); if (bc) bc.textContent = cont.conferidos;
  const bp = document.getElementById('count-pendentes'); if (bp) bp.textContent = cont.total - cont.conferidos;
}

function toggleSection(id){
  const s = document.getElementById(id);
  if (!s) return;
  s.classList.toggle('collapsed');
}

export function initApp(){
  const inputSku = document.querySelector('#codigo-produto') || document.querySelector('#codigo-ml') || document.querySelector('input[placeholder="Código do produto"]');
  const btnCons = document.querySelector('#btn-consultar') || Array.from(document.querySelectorAll('button')).find(b=>/consultar/i.test(b.textContent||''));
  const btnReg  = document.querySelector('#btn-registrar') || Array.from(document.querySelectorAll('button')).find(b=>/registrar/i.test(b.textContent||''));
  const btnCollapseConf = document.querySelector('#btn-recolher-conferidos');
  const btnCollapsePend = document.querySelector('#btn-recolher-pendentes');
  const btnScan = document.querySelector('#btn-scan-toggle') || Array.from(document.querySelectorAll('button')).find(b=>/ler c[oó]digo/i.test(b.textContent||''));
  const videoEl = document.querySelector('#preview');
  const fileInput = document.querySelector('#input-arquivo');
  const rzSelect  = document.querySelector('#select-rz');

  btnCons?.addEventListener('click', () => {
    const sku = (inputSku?.value || '').trim().toUpperCase();
    if (!sku) return toast('Informe o SKU', 'warn');
    const ok = highlightRowBySKU(sku, 'tbl-pendentes');
    if (!ok) toast('SKU fora do RZ', 'warn');
  });

  btnReg?.addEventListener('click', async () => {
    try {
      const sku = (inputSku?.value || '').trim().toUpperCase();
      if (!sku) return toast('Informe o SKU', 'warn');
      const rz  = store.state.rzAtual;
      if (!store.getSkuInRZ(rz, sku)) return toast('SKU fora do RZ', 'warn');
      if (store.isConferido(rz, sku))   return toast('SKU já conferido', 'warn');
      const preco = (document.querySelector('#preco-ajustado')?.value || '').trim();
      const obs   = (document.querySelector('#observacao')?.value || '').trim();
      store.dispatch({ type: 'REGISTRAR', rz, sku, precoAjustado: preco, observacao: obs });
      render();
      toast('Registrado!', 'info');
    } catch(e) {
      console.error(e); toast('Falha ao registrar', 'error');
    }
  });

  btnCollapseConf?.addEventListener('click', () => toggleSection('conferidosBloco'));
  btnCollapsePend?.addEventListener('click', () => toggleSection('faltantesBloco'));

  // Scanner toggle
  let scanning = false;
  btnScan?.addEventListener('click', async ()=>{
    try {
      if (!scanning) {
        await iniciarLeitura(videoEl, (texto)=>{
          const sku = (texto||'').trim().toUpperCase();
          if (inputSku) inputSku.value = sku;
          highlightRowBySKU(sku, 'tbl-pendentes');
        });
        scanning = true; btnScan.textContent = 'Parar leitura';
        setBoot('Scanner ativo ▶️');
      } else {
        await pararLeitura(videoEl);
        scanning = false; btnScan.textContent = 'Ler código';
        setBoot('Scanner parado ⏹️');
      }
    } catch(err){
      console.error('Erro iniciarLeitura', err);
      setBoot('Falha ao iniciar scanner ❌ (veja Console)');
      scanning = false; btnScan.textContent = 'Ler código';
    }
  });

  rzSelect?.addEventListener('change', e=>{ setCurrentRZ(e.target.value || null); render(); });

  fileInput?.addEventListener('change', async (e)=>{
    const f = e.target?.files?.[0];
    if (!f) return;
    const buf = (f.arrayBuffer ? await f.arrayBuffer() : f);
    const { rzList } = await processarPlanilha(buf);
    if (rzSelect){
      rzSelect.innerHTML = rzList.map(rz=>`<option value="${rz}">${rz}</option>`).join('');
      if (rzList.length){
        rzSelect.value = rzList[0];
        setCurrentRZ(rzList[0]);
      }
    } else {
      setCurrentRZ(rzList[0] || null);
    }
    render();
  });

  render();
}

function setBoot(msg){
  const st = document.getElementById('boot-status');
  if (st) st.textContent = `Boot: ${msg}`;
}
