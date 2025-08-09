// src/components/app.js
import { iniciarLeitura, pararLeitura } from '../utils/scan.js';
import { processarPlanilha } from '../utils/excel.js';
import store from '../store/index.js';

// normalizadores/helpers
const up = s => String(s||'').trim().toUpperCase();
const sum = o => Object.values(o||{}).reduce((a,b)=>a+(Number(b)||0),0);

function groupPendentes(rz){
  const items  = store.state.itemsByRZ?.[rz] || [];
  const totals = store.state.totalByRZSku?.[rz] || {};
  const confs  = store.state.conferidosByRZSku?.[rz] || {};
  const map = {};
  for (const it of items){
    const sku = up(it.codigoML); if (!sku) continue;
    const pend = (totals[sku]||0) - (confs[sku]||0);
    if (pend <= 0) continue;
    const r = (map[sku] ||= { sku, descricao: it.descricao, qtd: pend, vSum:0, qSum:0 });
    const q = Number(it.qtd)||0;
    r.vSum += (Number(it.valorUnit)||0) * q;
    r.qSum += q;
  }
  return Object.values(map).map(r=>{
    const pm = r.qSum ? r.vSum/r.qSum : 0;
    return { sku:r.sku, descricao:r.descricao, qtd:r.qtd, precoMedio:pm, valorTotal:r.qtd*pm };
  });
}

function renderPendentes(){
  const rz = store.state.currentRZ;
  const limit = Number(document.querySelector('#limit-pendentes')?.value || 50);
  const rows = groupPendentes(rz).slice(0, limit);
  const tb = document.querySelector('#tbl-pendentes tbody');
  if (!tb) return;
  tb.innerHTML = rows.length ? rows.map(r=>`
    <tr>
      <td>${r.sku}</td>
      <td>${r.descricao||''}</td>
      <td style="text-align:right">${r.qtd}</td>
      <td style="text-align:right">${r.precoMedio.toFixed(2)}</td>
      <td style="text-align:right">${r.valorTotal.toFixed(2)}</td>
    </tr>`).join('') :
    `<tr><td colspan="5" style="text-align:center;color:#777">Sem pendências para este RZ</td></tr>`;
}

function refreshUI(){
  const rz = store.state.currentRZ;
  const total = sum(store.state.totalByRZSku?.[rz] || {});
  const conf  = sum(store.state.conferidosByRZSku?.[rz] || {});
  const pend  = Math.max(0, total - conf);
  (document.getElementById('count-conferidos')||{}).textContent = String(conf);
  (document.getElementById('count-pendentes')||{}).textContent = String(pend);
  renderPendentes();
}

function registrarCodigo(raw){
  const rz = store.state.currentRZ;
  const sku = up(raw);
  if (!rz || !sku) return;

  const totals = store.state.totalByRZSku?.[rz] || {};
  const confs  = (store.state.conferidosByRZSku[rz] ||= {});

  if (!totals[sku]) { console.info('[CONF] SKU fora do RZ:', sku); refreshUI(); return; }
  const atual = Number(confs[sku]||0);
  const max   = Number(totals[sku]||0);
  if (atual >= max) { console.info('[CONF] SKU completo', sku, `${atual}/${max}`); refreshUI(); return; }

  confs[sku] = atual + 1;
  refreshUI();
}

export function initApp(){
  const fileInput = document.querySelector('#input-arquivo');
  const rzSelect = document.querySelector('#select-rz');
  const input =
    document.querySelector('#codigo-ml') ||
    document.querySelector('input[placeholder="Código do produto"]');
  const btnReg = document.querySelector('#btn-registrar') ||
    Array.from(document.querySelectorAll('button')).find(b=>/registrar/i.test(b.textContent||''));
  const btnScan = document.querySelector('#btn-scan-toggle') ||
    Array.from(document.querySelectorAll('button')).find(b=>/ler c[oó]digo/i.test(b.textContent||''));
  const limitSel = document.querySelector('#limit-pendentes');
  const btnRecolher = document.querySelector('#btn-recolher') ||
    Array.from(document.querySelectorAll('button')).find(b=>/recolher/i.test(b.textContent||''));
  const videoEl = document.querySelector('#preview');

  input?.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter'){ registrarCodigo(input.value); input.select(); }
  });
  btnReg?.addEventListener('click', ()=>{ registrarCodigo(input?.value); input?.select(); });

  limitSel?.addEventListener('change', renderPendentes);
  btnRecolher?.addEventListener('click', renderPendentes);

  let scanning = false;
  btnScan?.addEventListener('click', async ()=>{
    try{
      if (!scanning){
        await iniciarLeitura(videoEl, (texto)=>{
          registrarCodigo(texto);
          if (input){ input.value = texto; input.select(); }
        });
        scanning = true; btnScan.textContent = 'Parar leitura';
        setBoot('Scanner ativo ▶️');
      } else {
        await pararLeitura(videoEl);
        scanning = false; btnScan.textContent = 'Ler código';
        setBoot('Scanner parado ⏹️');
      }
    } catch (err){
      console.error('Erro iniciarLeitura', err);
      setBoot('Falha ao iniciar scanner ❌ (veja Console)');
      scanning = false; btnScan.textContent = 'Ler código';
    }
  });

  rzSelect?.addEventListener('change', ()=> refreshUI());

  // upload planilha
  fileInput?.addEventListener('change', async (e)=>{
    const f = e.target?.files?.[0];
    if (!f) return;
    const buf = (f.arrayBuffer ? await f.arrayBuffer() : f);
    const { rzList } = await processarPlanilha(buf);
    if (rzSelect){
      rzSelect.innerHTML = rzList.map(rz=>`<option value="${rz}">${rz}</option>`).join('');
      if (rzList.length){ rzSelect.value = rzList[0]; store.state.currentRZ = rzList[0]; }
    } else {
      store.state.currentRZ = rzList[0] || null;
    }
    refreshUI();
  });

  refreshUI();
}

function setBoot(msg){
  const st = document.getElementById('boot-status'); if (st) st.textContent = `Boot: ${msg}`;
}

