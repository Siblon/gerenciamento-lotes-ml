// src/components/app.js
import { iniciarLeitura, pararLeitura } from '../utils/scan.js';
import { processarPlanilha } from '../utils/excel.js';
import store, { setCurrentRZ, addConferido, addMovimento, setLimits } from '../store/index.js';

const up = s => String(s||'').trim().toUpperCase();
const sum = o => Object.values(o||{}).reduce((a,b)=>a+(Number(b)||0),0);

function rowsConferidos(rz){
  const conf = store.state.conferidosByRZSku[rz] || {};
  const meta = store.state.metaByRZSku[rz] || {};
  return Object.entries(conf).map(([sku, qtd])=>{
    const m = meta[sku] || {};
    const preco = Number(m.precoMedio||0);
    return { sku, descricao: m.descricao||'', qtd, preco, total: qtd*preco };
  }).sort((a,b)=> b.qtd - a.qtd);
}

function rowsPendentes(rz){
  const tot = store.state.totalByRZSku[rz] || {};
  const conf= store.state.conferidosByRZSku[rz] || {};
  const meta= store.state.metaByRZSku[rz] || {};
  return Object.entries(tot).map(([sku, qtdTotal])=>{
    const done = Number(conf[sku]||0);
    const rest = Math.max(0, qtdTotal - done);
    if (rest <= 0) return null;
    const m = meta[sku] || {};
    const preco = Number(m.precoMedio||0);
    return { sku, descricao: m.descricao||'', qtd: rest, preco, total: rest*preco };
  }).filter(Boolean).sort((a,b)=> b.qtd - a.qtd);
}

function renderConferidos(){
  const rz = store.state.currentRZ; if (!rz) return;
  const limit = store.state.limits.conferidos || 50;
  const data = rowsConferidos(rz).slice(0, limit);
  const tb = document.querySelector('#tbl-conferidos tbody');
  document.getElementById('count-conferidos').textContent =
    String(sum(store.state.conferidosByRZSku[rz]||{}));
  if (!tb) return;
  tb.innerHTML = data.length ? data.map(r=>`
    <tr>
      <td>${r.sku}</td>
      <td>${r.descricao}</td>
      <td style="text-align:right">${r.qtd}</td>
      <td style="text-align:right">${r.preco.toFixed(2)}</td>
      <td style="text-align:right">${r.total.toFixed(2)}</td>
    </tr>`).join('') :
    `<tr><td colspan="5" style="text-align:center;color:#777">Nenhum item conferido</td></tr>`;
}

function renderPendentes(){
  const rz = store.state.currentRZ; if (!rz) return;
  const limit = store.state.limits.pendentes || 50;
  const tot = sum(store.state.totalByRZSku[rz]||{});
  const conf= sum(store.state.conferidosByRZSku[rz]||{});
  document.getElementById('count-pendentes').textContent = String(Math.max(0, tot-conf));
  const data = rowsPendentes(rz).slice(0, limit);
  const tb = document.querySelector('#tbl-pendentes tbody');
  if (!tb) return;
  tb.innerHTML = data.length ? data.map(r=>`
    <tr>
      <td>${r.sku}</td>
      <td>${r.descricao}</td>
      <td style="text-align:right">${r.qtd}</td>
      <td style="text-align:right">${r.preco.toFixed(2)}</td>
      <td style="text-align:right">${r.total.toFixed(2)}</td>
    </tr>`).join('') :
    `<tr><td colspan="5" style="text-align:center;color:#777">Sem pendências para este RZ</td></tr>`;
}

function refreshUI(){ renderConferidos(); renderPendentes(); }

function registrarCodigo(raw){
  const rz = store.state.currentRZ;
  const sku = up(raw);
  if (!rz || !sku) return;

  const tot = store.state.totalByRZSku[rz] || {};
  if (!tot[sku]) { console.info('[CONF] SKU fora do RZ:', sku); refreshUI(); return; }

  // incrementa
  addConferido(rz, sku, 1);

  // captura ajustes (se existirem na tela)
  const preco = Number(document.querySelector('#preco-ajustado')?.value || NaN);
  const obs   = String(document.querySelector('#observacao')?.value || '').trim();

  addMovimento({
    ts: Date.now(),
    rz, sku, delta: 1,
    precoAjustado: isNaN(preco) ? null : preco,
    observacao: obs || null,
  });

  refreshUI();
}

export function initApp(){
  const fileInput = document.querySelector('#input-arquivo');
  const rzSelect = document.querySelector('#select-rz');
  const inSku = document.querySelector('#codigo-ml') ||
    document.querySelector('input[placeholder="Código do produto"]');
  const btnReg = document.querySelector('#btn-registrar') ||
    Array.from(document.querySelectorAll('button')).find(b=>/registrar/i.test(b.textContent||''));
  const btnScan = document.querySelector('#btn-scan-toggle') ||
    Array.from(document.querySelectorAll('button')).find(b=>/ler c[oó]digo/i.test(b.textContent||''));
  const videoEl = document.querySelector('#preview');

  inSku?.addEventListener('keydown', e => {
    if (e.key === 'Enter'){ registrarCodigo(inSku.value); inSku.select(); }
  });
  btnReg?.addEventListener('click', () => { registrarCodigo(inSku?.value); inSku?.select(); });

  // Recolher conferidos/pendentes
  document.querySelector('#limit-conferidos')?.addEventListener('change', e=>{
    setLimits('conferidos', e.target.value); renderConferidos();
  });
  document.querySelector('#btn-recolher-conferidos')?.addEventListener('click', ()=>{
    const v = document.querySelector('#limit-conferidos')?.value; setLimits('conferidos', v); renderConferidos();
  });
  document.querySelector('#limit-pendentes')?.addEventListener('change', e=>{
    setLimits('pendentes', e.target.value); renderPendentes();
  });
  document.querySelector('#btn-recolher-pendentes')?.addEventListener('click', ()=>{
    const v = document.querySelector('#limit-pendentes')?.value; setLimits('pendentes', v); renderPendentes();
  });

  // Scanner toggle
  let scanning = false;
  btnScan?.addEventListener('click', async ()=>{
    try{
      if (!scanning){
        await iniciarLeitura(videoEl, (texto)=>{
          registrarCodigo(texto);
          if (inSku){ inSku.value = texto; inSku.select(); }
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

  // Ao trocar RZ → refresh completo
  document.querySelector('#select-rz')?.addEventListener('change', e=>{
    setCurrentRZ(e.target.value || null);
    refreshUI();
  });

  // upload planilha
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
    refreshUI();
  });

  refreshUI();
}

function setBoot(msg){
  const st = document.getElementById('boot-status'); if (st) st.textContent = `Boot: ${msg}`;
}

