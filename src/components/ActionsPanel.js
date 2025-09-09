// src/components/ActionsPanel.js
import { exportarConferencia } from '../utils/excel.js';
import store, { findConferido, findEmOutrosRZ, moveItemEntreRZ } from '../store/index.js';
import { loadFinanceConfig, saveFinanceConfig } from '../utils/finance.js';
import { loadPrefs, savePrefs } from '../utils/prefs.js';
import { toast } from '../utils/toast.js';
import { openExcedenteModal } from './ExcedenteModal.js';
import { updateBoot } from '../utils/boot.js';
import { renderCounts } from '../utils/ui.js';
import { saveConferido, saveExcedente } from '../services/persist.js';

// memória da última consulta
let lastLookup = {
  sku: null,
  okToRegister: false,
  item: null,
};

function setLastLookup(sku, ok, item) {
  lastLookup = { sku, okToRegister: !!ok, item: item || null };
}

function findItemBySku(sku) {
  if (!sku) return null;
  if (typeof store.findInRZ === 'function') {
    return store.findInRZ(store.state.rzAtual, sku);
  }
  if (typeof store.selectAllImportedItems === 'function') {
    const all = store.selectAllImportedItems() || [];
    return all.find(x => String(x.sku).trim().toUpperCase() === String(sku).trim().toUpperCase()) || null;
  }
  return null;
}

function setNcmCheckedForSku(sku, checked) {
  if (store.ncm?.setOk) {
    store.ncm.setOk(sku, !!checked);
    return;
  }
  const KEY = 'ncm.checked.map';
  let map = {};
  try { map = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
  map[sku] = !!checked;
  localStorage.setItem(KEY, JSON.stringify(map));
}

function getNcmCheckedForSku(sku) {
  if (store.ncm?.isOk) return !!store.ncm.isOk(sku);
  const KEY = 'ncm.checked.map';
  try {
    const map = JSON.parse(localStorage.getItem(KEY)) || {};
    return !!map[sku];
  } catch { return false; }
}

function ensureNcmToggleInCard(sku) {
  const card = document.getElementById('produto-info');
  if (!card || typeof card.querySelector !== 'function') return;

  let bar = card.querySelector('.ncm-inline-actions');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'ncm-inline-actions';
    bar.style.marginTop = '8px';
    card.querySelector('.card-body')?.appendChild(bar);
  } else {
    bar.innerHTML = '';
  }

  const lbl = document.createElement('label');
  lbl.style.display = 'inline-flex';
  lbl.style.alignItems = 'center';
  lbl.style.gap = '8px';

  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = getNcmCheckedForSku(sku);

  const span = document.createElement('span');
  span.textContent = 'NCM conferido';

  chk.addEventListener('change', () => {
    setNcmCheckedForSku(sku, chk.checked);
    updateBoot?.(chk.checked ? 'NCM marcado como conferido' : 'NCM desmarcado');
  });

  lbl.appendChild(chk);
  lbl.appendChild(span);
  bar.appendChild(lbl);
}

export { getNcmCheckedForSku, setNcmCheckedForSku };

function mostrarProdutoInfo(item) {
  const $ = (sel) => document.querySelector(sel);
  $('#pi-sku').textContent = item.sku;
  $('#pi-desc').textContent = item.descricao || '';
  $('#pi-qtd').textContent = item.qtd ?? 0;
  $('#pi-preco').textContent = Number(item.precoMedio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  $('#pi-total').textContent = Number((item.qtd || 0) * (item.precoMedio || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  $('#pi-rz').textContent = store.state.rzAtual || '';
  document.getElementById('pi-ncm').textContent = item?.ncm || '—';
  document.getElementById('produto-info').hidden = false;
  ensureNcmToggleInCard(item.sku);
  document.getElementById('produto-info').scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
}

function abrirModalExcedente(sku, fonte='manual'){
  const dlg = document.getElementById('dlg-excedente');
  if (!dlg) return;
  const inpSku   = document.getElementById('exc-sku');
  const inpDesc  = document.getElementById('exc-desc');
  const inpQtd   = document.getElementById('exc-qtd');
  const inpPreco = document.getElementById('exc-preco');
  const inpObs   = document.getElementById('exc-obs');

  if (inpSku)   inpSku.value = sku;
  if (inpDesc)  inpDesc.value = '';
  if (inpQtd)   inpQtd.value = 1;
  if (inpPreco) inpPreco.value = '';
  if (inpObs)   inpObs.value = '';

  dlg.dataset.fonte = fonte;
  dlg.showModal?.();
  if (inpDesc) setTimeout(() => inpDesc.focus(), 0);
}

export function initActionsPanel(render){
  const codigoInput = document.getElementById('input-codigo-produto')
    || document.getElementById('codigo-produto')
    || document.getElementById('in-sku');
  const btnCons = document.querySelector('#btn-consultar') || Array.from(document.querySelectorAll('button')).find(b=>/consultar/i.test(b.textContent||''));
  const btnReg  = document.querySelector('#btn-registrar') || Array.from(document.querySelectorAll('button')).find(b=>/registrar/i.test(b.textContent||''));
  const btnFinal = document.querySelector('#finalizarBtn');
  const obsSelect = document.getElementById('obs-preset');
  const precoInput = document.getElementById('preco-ajustado');
  const rngPercent = document.getElementById('fin-percent');
  const rngDesconto = document.getElementById('fin-desconto');
  const inpFrete = document.getElementById('fin-frete');
  const selRateio = document.getElementById('fin-rateio');
  const selMode   = document.getElementById('fin-mode');

  // estadoConsulta controla qual etapa será disparada ao pressionar Enter
  // true  -> próxima tecla Enter consulta o SKU
  // false -> próxima tecla Enter registra o item
  let estadoConsulta = true;

  btnCons?.classList.add('btn','btn-primary');
  btnReg?.classList.add('btn','btn-primary');

  function exigeLoteAtual(){
    const sel = document.getElementById('select-lote');
    if (!sel) return 1;
    const lotId = Number(sel.value);
    if (!lotId){
      window.updateBoot?.('Selecione um lote antes de consultar/registrar ⚠️');
      return null;
    }
    return lotId;
  }

  let excedenteObs = '';

  function normalizeSku(v=''){
    return String(v).replace(/[^\x20-\x7E]/g,'').trim().toUpperCase();
  }

  if (obsSelect) {
    obsSelect.innerHTML = '<option value="">— Nenhuma —</option><option value="excedente">Produto excedente (não listado)</option>';
  }

  function updatePricePlaceholder(){
    if (!precoInput) return;
    if (obsSelect?.value === 'excedente') precoInput.placeholder = 'Preço (opcional para excedente)';
    else precoInput.placeholder = 'Preço';
  }

  updatePricePlaceholder();

  obsSelect?.addEventListener('change', async ()=>{
    updatePricePlaceholder();
    if (obsSelect.value === 'excedente') {
      const val = await openExcedenteModal({ defaultValue: '' });
      if (val === null) {
        obsSelect.value = '';
        excedenteObs = '';
        updatePricePlaceholder();
        codigoInput?.focus();
        return;
      }
      excedenteObs = val || '';
      codigoInput?.focus();
    } else {
      excedenteObs = '';
    }
  });

  codigoInput?.focus();
  renderCounts();

  const cfg = loadFinanceConfig();
  const prefs = loadPrefs();
  if (rngPercent) { rngPercent.value = String((cfg.percent_pago_sobre_ml||0)*100); document.getElementById('fin-percent-val').textContent = `${rngPercent.value}%`; }
  if (rngDesconto) { rngDesconto.value = String((cfg.desconto_venda_vs_ml||0)*100); document.getElementById('fin-desconto-val').textContent = `${rngDesconto.value}%`; }
  if (inpFrete) inpFrete.value = String(cfg.frete_total || 0);
  if (selRateio) selRateio.value = cfg.rateio_frete || 'valor';
  if (selMode) selMode.value = prefs.calcFreteMode || 'finalizar';

  function saveFinance() {
    const current = loadFinanceConfig();
    current.percent_pago_sobre_ml = Number(rngPercent?.value || 0) / 100;
    current.desconto_venda_vs_ml = Number(rngDesconto?.value || 0) / 100;
    current.frete_total = parseFloat(inpFrete?.value || '0');
    current.rateio_frete = selRateio?.value || 'valor';
    saveFinanceConfig(current);
    window.refreshIndicators?.();
  }

  rngPercent?.addEventListener('input', ()=>{ document.getElementById('fin-percent-val').textContent = `${rngPercent.value}%`; saveFinance(); });
  rngDesconto?.addEventListener('input', ()=>{ document.getElementById('fin-desconto-val').textContent = `${rngDesconto.value}%`; saveFinance(); });
  inpFrete?.addEventListener('change', saveFinance);
  selRateio?.addEventListener('change', saveFinance);
  selMode?.addEventListener('change', ()=>{ const p = loadPrefs(); p.calcFreteMode = selMode.value; savePrefs(p); window.refreshIndicators?.(); });

  // Dispara a consulta do SKU. Retorna true se item foi encontrado.
  function handleConsultar(fonte='manual') {
    const lotId = exigeLoteAtual();
    if (!lotId) return false;
    const sku = normalizeSku(codigoInput?.value || '');
    if (sku.length < 3) { toast('Código vazio', 'warn'); return false; }
    const active = document.activeElement;
    const rz = store.state.rzAtual;
    btnCons?.classList.add('loading');
    btnCons?.setAttribute?.('disabled','disabled');
    try {
      const item = findItemBySku(sku) || store.findInRZ?.(rz, sku) || findConferido?.(rz, sku);
      if (!item) {
        setLastLookup(sku, false, null);
        const outro = findEmOutrosRZ?.(sku);
        if (outro){
          if (confirm(`SKU pertence ao ${outro}. Mover para este RZ?`)){
            moveItemEntreRZ(outro, rz, sku, 1);
            toast('Item movido', 'info');
            render();
            estadoConsulta = false;
            return true;
          }
        }
        toast('Este SKU não está no RZ atual. Você pode registrá-lo como Excedente.', 'warn');
        abrirModalExcedente(sku, fonte);
        document.getElementById('produto-info').hidden = true;
        return false;
      }
      mostrarProdutoInfo(item);
      if (precoInput && !precoInput.value) precoInput.value = item.precoMedio ?? '';
      setLastLookup(sku, true, item);
      updateBoot?.('Consulta OK — pressione Enter novamente para registrar');
      active?.focus?.();
      // após consulta bem sucedida, próxima tecla Enter irá registrar
      estadoConsulta = false;
      return true;
    } finally {
      btnCons?.classList.remove?.('loading');
      btnCons?.removeAttribute?.('disabled');
      renderCounts();
    }
  }

  // clique manual também dispara a consulta
  btnCons?.addEventListener('click', () => { handleConsultar('manual'); });

  async function handleRegistrar() {
    const lotId = exigeLoteAtual();
    if (!lotId) return;
    const sku = normalizeSku(codigoInput?.value || '');
    const priceStr = precoInput?.value || '';
    const obsPreset = obsSelect?.value || '';
    const item = store.findInRZ?.(store.state.rzAtual, sku);
    const toExcedentes = obsPreset === 'excedente' || !item;
    if (!toExcedentes && (!lastLookup.okToRegister || lastLookup.sku !== sku)) {
      if (item) setLastLookup(sku, true, item);
      else { toast('Consulte um produto antes de registrar.', 'warn'); return; }
    }
    if (!toExcedentes && priceStr.trim() === '') {
      toast('Preço obrigatório', 'warn');
      return;
    }
    const price = priceStr.trim() === '' ? undefined : Number(priceStr);

    const pendente = Number(item?.qtd ?? 1);
    let qty = 1;
    if (pendente > 1) {
      const entrada = window.prompt(`Quantidade a registrar (restantes: ${pendente})`, '1');
      const n = parseInt(entrada || '1', 10);
      qty = Number.isFinite(n) ? Math.max(1, Math.min(pendente, n)) : 1;
    }

    const note = toExcedentes ? excedenteObs : '';

    try {
      if (toExcedentes && typeof store.registrarExcedente === 'function') {
        store.registrarExcedente({ sku, qty, price, note });
        saveExcedente({ sku, descricao: '', qtd: qty, preco_unit: price, obs: note });
      } else if (typeof store.conferir === 'function') {
        store.conferir(sku, { qty, price, note });
        saveConferido({ sku, descricao: item?.descricao || '', qtd: qty, preco: price, obs: note });
      } else {
        console.warn('Ação de registro não disponível no store.');
      }
      store.emit?.('refresh');
      render();
      window.refreshIndicators?.();
      renderCounts();
      window.dispatchEvent?.(new CustomEvent('app:changed', { detail: { type: 'conferido:add', sku } }));
      toast.success('Item registrado');
      if (!toExcedentes) updateBoot(`Conferido: ${sku} • ${item?.descricao || ''}`);
      if (typeof window.refreshKpis === 'function') window.refreshKpis();
      window.refreshAll?.();
      setLastLookup(null, false, null);
    } catch(e) {
      console.error(e); toast('Falha ao registrar', 'error');
    }
    if (obsSelect) obsSelect.value = '';
    if (precoInput) precoInput.value = '';
    excedenteObs = '';

    codigoInput?.focus();
    codigoInput?.select();
    // após registrar, próxima tecla Enter volta a consultar
    estadoConsulta = true;
  }

  // clique manual também dispara o registro
  btnReg?.addEventListener('click', () => { handleRegistrar(); });

  // Listener principal: alterna entre consultar e registrar a cada Enter
  codigoInput?.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    ev.stopPropagation?.();
    if (ev.ctrlKey) {
      handleRegistrar();
      return;
    }
    if (estadoConsulta) handleConsultar('enter');
    else handleRegistrar();
  });

  // Atalho global: permite usar Enter fora do campo de SKU
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    if (document.activeElement === codigoInput) return;
    if (estadoConsulta) handleConsultar('enter');
    else handleRegistrar();
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
        return {
          SKU: sku,
          Descrição: m.descricao || '',
          Qtd: qtd,
          'Preço Médio (R$)': preco,
          'Valor Total (R$)': qtd * preco,
          NCM: m.ncm || '',
          Observação: confMap[sku]?.observacao || ''
        };
      });
      const pendentes = Object.keys(tot).filter(sku => !confMap[sku]).map(sku => {
        const m = meta[sku] || {};
        const qtd = tot[sku] || 0;
        const preco = Number(m.precoMedio || 0);
        return {
          SKU: sku,
          Descrição: m.descricao || '',
          Qtd: qtd,
          'Preço Médio (R$)': preco,
          'Valor Total (R$)': qtd * preco,
          NCM: m.ncm || ''
        };
      });
      const excedentes = (store.state.excedentes[rz] || []).map(it => {
        const p = it.preco_unit === undefined || it.preco_unit === null ? null : Number(it.preco_unit);
        return {
          SKU: it.sku,
          Descrição: it.descricao || '',
          Qtd: it.qtd,
          'Preço Médio (R$)': p ?? '',
          'Valor Total (R$)': p != null ? Number(it.qtd || 0) * p : '',
          NCM: it.ncm || '',
          Observação: it.obs || ''
        };
      });

      const sumQtd = arr => arr.reduce((s,it)=>s + Number(it.Qtd||0),0);
      const sumVal = arr => arr.reduce((s,it)=>s + Number(it['Valor Total (R$)']||0),0);
      const resumoRZ = [{
        rz,
        conferidos: sumQtd(conferidos),
        pendentes: sumQtd(pendentes),
        excedentes: sumQtd(excedentes),
        valorTotal: sumVal(conferidos) + sumVal(pendentes) + sumVal(excedentes),
      }];

      exportarConferencia({ conferidos, pendentes, excedentes, resumoRZ });
      toast('Conferência finalizada', 'info');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch(e) {
      console.error(e); toast('Falha ao exportar', 'error');
    }
  });

  document.addEventListener('keydown',(e)=>{
    if (e.ctrlKey && e.key.toLowerCase()==='k'){ e.preventDefault(); document.querySelector('#input-codigo-produto')?.focus(); }
    // Ctrl+Enter handled on codigoInput for registro
    if (e.ctrlKey && e.key.toLowerCase()==='s'){
      const dlg = document.getElementById('dlg-excedente');
      if (dlg?.open) { e.preventDefault(); document.getElementById('form-exc')?.requestSubmit(); }
    }
    if (e.key==='Escape') document.getElementById('dlg-excedente')?.close();
  });

  return {
    handleConsultar,
    handleRegistrar,
    setSku: (sku)=>{ if (codigoInput) codigoInput.value = sku; }
  };
}

// Implementação simplificada utilizada em modos de desenvolvimento
export function initSimpleActionsPanel(){
  const input = document.getElementById('codigo-input') || document.getElementById('input-codigo-produto');
  const btn = document.getElementById('btn-consultar');

  btn?.addEventListener('click', () => {
    const code = (input?.value || '').trim();
    if (!code) return;

    const rz = store.state.currentRZ;
    const found = store.state.items?.find(it => (it.codigo === code || it.sku === code) && it.rz === rz);
    if (found) {
      store.conferir?.(found.id || found.sku);
      store.emit?.('refresh');
      toast(`OK: ${found.descricao || found.sku}`);
    } else {
      store.registrarExcedente?.({ codigo: code, rz });
      store.emit?.('refresh');
      toast(`Excedente registrado: ${code}`);
    }
  });
}
