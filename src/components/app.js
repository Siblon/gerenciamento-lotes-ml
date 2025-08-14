// src/components/app.js
// TODO: reduzir espaço do <video> do scanner quando inativo e evitar ocupar toda a largura
// TODO: agrupar inputs/botões em estruturas semânticas (fieldset, seções) para melhorar hierarquia
// TODO: garantir acessibilidade básica (rótulos consistentes, foco navegável, atributos aria)
import { iniciarLeitura, pararLeitura } from '../utils/scan.js';
import { processarPlanilha, exportarConferencia } from '../utils/excel.js';
import store, { getTotals, getConferidos, setCurrentRZ, findInRZ, findConferido, addExcedente, findEmOutrosRZ, moveItemEntreRZ } from '../store/index.js';

function toast(msg, type='info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
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

function mostrarProdutoInfo(item) {
  const $ = (sel) => document.querySelector(sel);
  $('#pi-sku').textContent = item.sku;
  $('#pi-desc').textContent = item.descricao || '';
  $('#pi-qtd').textContent = item.qtd ?? 0;
  $('#pi-preco').textContent = Number(item.precoMedio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  $('#pi-total').textContent = Number((item.qtd || 0) * (item.precoMedio || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  $('#pi-rz').textContent = store.state.rzAtual || '';
  document.getElementById('produto-info').hidden = false;
}

function updateToggleLabels() {
  document.querySelectorAll('button[id^="btn-recolher-"]').forEach(btn => {
    const sec = document.getElementById(btn.dataset.target);
    if (sec) btn.textContent = sec.classList.contains('collapsed') ? 'Expandir' : 'Recolher';
  });
}

function abrirModalExcedente(sku, fonte='manual'){
  const dlg = document.getElementById('dlg-excedente');
  if (!dlg) return;
  document.getElementById('exc-sku').value = sku;
  document.getElementById('exc-desc').value = '';
  document.getElementById('exc-qtd').value = 1;
  document.getElementById('exc-preco').value = '';
  document.getElementById('exc-obs').value = '';
  dlg.dataset.fonte = fonte;
  dlg.showModal();
  document.getElementById('exc-preco').focus();
}

async function onConsultarClick(fonte='manual') {
  const input = document.querySelector('#codigo-ml') || document.querySelector('#codigo-produto') || document.querySelector('input[placeholder="Código do produto"]');
  const sku = (input?.value || '').trim().toUpperCase();
  if (!sku) return toast('Informe o SKU', 'warn');
  const active = document.activeElement;
  const rz = store.state.rzAtual;
  const item = findInRZ?.(rz, sku) || findConferido?.(rz, sku);
  if (!item) {
    const outro = findEmOutrosRZ?.(sku);
    if (outro){
      if (confirm(`SKU pertence ao ${outro}. Mover para este RZ?`)){
        moveItemEntreRZ(outro, rz, sku, 1);
        toast('Item movido', 'info');
        render();
        return;
      }
    }
    abrirModalExcedente(sku, fonte);
    document.getElementById('produto-info').hidden = true;
    return false;
  }
  mostrarProdutoInfo(item);
  const precoInput = document.querySelector('#preco-ajustado');
  if (precoInput && !precoInput.value) precoInput.value = item.precoMedio ?? '';
  active?.focus?.();
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

function rowsExcedentes(rz){
  const list = store.state.excedentes[rz] || [];
  return list.map(it=>{
    const preco = Number(it.preco||0);
    return { sku: it.sku, descricao: it.descricao||'', qtd: it.qtd||0, preco, total: (it.qtd||0)*preco };
  }).sort((a,b)=> b.qtd - a.qtd);
}

function render(){
  const rz = store.state.rzAtual; if (!rz) return;
  const confRows = rowsConferidos(rz);
  const pendRows = rowsPendentes(rz);
  const tbConf = document.querySelector('#tbl-conferidos tbody');
  const tbPend = document.querySelector('#tbl-pendentes tbody');
  const tbExc  = document.querySelector('#excedentesTable');
  if (tbConf) {
    tbConf.innerHTML = confRows.length
      ? confRows.map(r=>`<tr data-sku="${r.sku}"><td class="sticky">${r.sku}</td><td>${r.descricao}</td><td class="num">${r.qtd}</td><td class="num">${r.preco.toFixed(2)}</td><td class="num">${r.total.toFixed(2)}</td></tr>`).join('')
      : `<tr><td colspan="5" style="text-align:center;color:#777">Nenhum item conferido</td></tr>`;
  }
  if (tbPend) {
    tbPend.innerHTML = pendRows.length
      ? pendRows.map(r=>`<tr data-sku="${r.sku}"><td class="sticky">${r.sku}</td><td>${r.descricao}</td><td class="num">${r.qtd}</td><td class="num">${r.preco.toFixed(2)}</td><td class="num">${r.total.toFixed(2)}</td></tr>`).join('')
      : `<tr><td colspan="5" style="text-align:center;color:#777">Sem pendências para este RZ</td></tr>`;
  }
  if (tbExc) {
    const excRows = rowsExcedentes(rz);
    tbExc.innerHTML = excRows.length
      ? excRows.map(r=>`<tr data-sku="${r.sku}"><td class="sticky">${r.sku}</td><td>${r.descricao}</td><td class="num">${r.qtd}</td><td class="num">${r.preco.toFixed(2)}</td><td class="num">${r.total.toFixed(2)}</td></tr>`).join('')
      : `<tr><td colspan="5" style="text-align:center;color:#777">Nenhum excedente</td></tr>`;
  }
  const cont = store.state.contadores[rz] || { conferidos:0, total:0 };
  const hdr = document.getElementById('hdr-conferidos');
  if (hdr) hdr.textContent = `Conferência de Lotes ${cont.conferidos} de ${cont.total} conferidos`;
  const bc = document.getElementById('count-conferidos'); if (bc) bc.textContent = cont.conferidos;
  const bp = document.getElementById('count-pendentes'); if (bp) bp.textContent = cont.total - cont.conferidos;
  const be = document.getElementById('excedentesCount'); if (be) be.textContent = cont.excedentes || 0;
  updateToggleLabels();
}

export function initApp(){
  console.log('[DEPLOY] Host:', location.host, '| HTTPS:', location.protocol === 'https:');
  const inputSku = document.querySelector('#codigo-produto') || document.querySelector('#codigo-ml') || document.querySelector('input[placeholder="Código do produto"]');
  const btnCons = document.querySelector('#btn-consultar') || Array.from(document.querySelectorAll('button')).find(b=>/consultar/i.test(b.textContent||''));
  const btnReg  = document.querySelector('#btn-registrar') || Array.from(document.querySelectorAll('button')).find(b=>/registrar/i.test(b.textContent||''));
  const btnFinal = document.querySelector('#finalizarBtn');
  const btnScan = document.querySelector('#btn-scan-toggle') || Array.from(document.querySelectorAll('button')).find(b=>/ler c[oó]digo/i.test(b.textContent||''));
  const btnOpenScanner = document.getElementById('btn-open-scanner');
  const scannerCard = document.getElementById('card-scanner');
  const videoEl = document.querySelector('#preview');
  const fileInput = document.querySelector('#input-arquivo');
  const rzSelect  = document.querySelector('#select-rz');

  function iniciarLeituraUI(){ btnScan?.click(); }

  document.querySelectorAll('button[id^="btn-recolher-"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.target;
      const sec = document.getElementById(id);
      sec.classList.toggle('collapsed');
      btn.textContent = sec.classList.contains('collapsed') ? 'Expandir' : 'Recolher';
    });
  });

  btnOpenScanner?.addEventListener('click', () => {
    scannerCard?.classList.toggle('collapsed');
  });

  btnCons?.addEventListener('click', ()=>onConsultarClick('manual'));

  btnReg?.addEventListener('click', async () => {
    try {
      const sku = (inputSku?.value || '').trim().toUpperCase();
      if (!sku) return toast('Informe o SKU', 'warn');
      const rz  = store.state.rzAtual;
      if (!store.getSkuInRZ(rz, sku)) return abrirModalExcedente(sku);
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

  btnFinal?.addEventListener('click', () => {
    try {
      const rz = store.state.rzAtual;
      const tot = store.state.totalByRZSku[rz] || {};
      const meta = store.state.metaByRZSku[rz] || {};
      const confMap = store.state.conferidosByRZSku[rz] || {};
      const conferidos = Object.keys(confMap).map(sku => {
        const m = meta[sku] || {};
        const qtd = tot[sku] || 0;
        const preco = Number(m.precoMedio || 0);
        return { SKU: sku, Descrição: m.descricao || '', Qtd: qtd, 'Preço Médio (R$)': preco, 'Valor Total (R$)': qtd*preco, 'Observação': confMap[sku]?.observacao || '' };
      });
      const pendentes = Object.keys(tot).filter(sku => !confMap[sku]).map(sku => {
        const m = meta[sku] || {};
        const qtd = tot[sku] || 0;
        const preco = Number(m.precoMedio || 0);
        return { SKU: sku, Descrição: m.descricao || '', Qtd: qtd, 'Preço Médio (R$)': preco, 'Valor Total (R$)': qtd*preco };
      });
      const excedentes = (store.state.excedentes[rz] || []).map(it=>({ SKU: it.sku, Descrição: it.descricao || '', Qtd: it.qtd, 'Preço Médio (R$)': Number(it.preco || 0), 'Valor Total (R$)': Number(it.qtd||0) * Number(it.preco||0), Observação: it.obs || '' }));
      exportarConferencia({ rz, conferidos, pendentes, excedentes });
      toast('Planilha exportada', 'info');
    } catch(e) {
      console.error(e); toast('Falha ao exportar', 'error');
    }
  });

  // Scanner toggle
  let scanning = false;
  btnScan?.addEventListener('click', async ()=>{
    try {
      if (!scanning) {
        const once = (fn, ms=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms);} };
        const onDecoded = once((code)=>{
          const sku = (code||'').trim().toUpperCase();
          if (inputSku) inputSku.value = sku;
          onConsultarClick('scanner');
        },350);
        await iniciarLeitura(videoEl, (texto)=>{ onDecoded(texto); });
        scanning = true; btnScan.textContent = 'Parar leitura';
        setBoot('Scanner ativo ▶️');
      } else {
        await pararLeitura(videoEl);
        scanning = false; btnScan.textContent = 'Ativar Scanner';
        setBoot('Scanner parado ⏹️');
      }
    } catch(err){
      console.error('Erro iniciarLeitura', err);
      setBoot('Falha ao iniciar scanner ❌ (veja Console)');
      scanning = false; btnScan.textContent = 'Ativar Scanner';
    }
  });

  rzSelect?.addEventListener('change', e=>{ setCurrentRZ(e.target.value || null); render(); });

  document.getElementById('exc-salvar')?.addEventListener('click', ()=>{
    const dlg = document.getElementById('dlg-excedente');
    const sku = document.getElementById('exc-sku').value.trim().toUpperCase();
    const desc = document.getElementById('exc-desc').value.trim();
    const qtd  = Number(document.getElementById('exc-qtd').value) || 1;
    const preco= Number(document.getElementById('exc-preco').value) || 0;
    const obs  = document.getElementById('exc-obs').value.trim();
    if (!sku || !desc || !preco) return;
    addExcedente(store.state.rzAtual, { sku, descricao: desc, qtd, preco, obs, fonte: dlg?.dataset.fonte||'manual' });
    dlg.close();
    toast('Excedente salvo', 'info');
    render();
  });

  document.addEventListener('keydown',(e)=>{
    if (e.ctrlKey && e.key.toLowerCase()==='k'){ e.preventDefault(); document.querySelector('#codigo-ml')?.focus(); }
    if (e.ctrlKey && e.key.toLowerCase()==='j'){ e.preventDefault(); iniciarLeituraUI(); }
    if (e.key==='Escape') document.getElementById('dlg-excedente')?.close();
  });

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
