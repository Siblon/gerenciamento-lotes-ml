// src/components/ActionsPanel.js
import { exportarConferencia } from '../utils/excel.js';
import store, { findInRZ, findConferido, findEmOutrosRZ, moveItemEntreRZ, addExcedente } from '../store/index.js';
import { loadFinanceConfig, saveFinanceConfig } from '../utils/finance.js';
import { loadPrefs, savePrefs } from '../utils/prefs.js';
import { toast } from '../utils/toast.js';
import { installWedgeScanner } from '../utils/wedge.js';
import { getMode, onChange, afterRegister as scAfterRegister } from '../utils/scannerController.js';
import { openExcedenteModal } from './ExcedenteModal.js';

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

export function initActionsPanel(render){
  const inputSku = document.querySelector('#codigo-produto') || document.querySelector('#codigo-ml') || document.querySelector('input[placeholder="Código do produto"]');
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

  btnCons?.classList.add('btn','btn-primary');
  btnReg?.classList.add('btn','btn-primary');

  let excedenteObs = '';
  let enterTimer = null;

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
        inputSku?.focus();
        return;
      }
      excedenteObs = val || '';
      inputSku?.focus();
    } else {
      excedenteObs = '';
    }
  });

  inputSku?.focus();

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

  function consultar(fonte='manual') {
    const sku = normalizeSku(inputSku?.value || '');
    if (sku.length < 3) { toast('Código vazio', 'warn'); return false; }
    const active = document.activeElement;
    const rz = store.state.rzAtual;
    btnCons?.classList.add('loading');
    btnCons?.setAttribute?.('disabled','disabled');
    try {
      const item = findInRZ?.(rz, sku) || findConferido?.(rz, sku);
      if (!item) {
        const outro = findEmOutrosRZ?.(sku);
        if (outro){
          if (confirm(`SKU pertence ao ${outro}. Mover para este RZ?`)){
            moveItemEntreRZ(outro, rz, sku, 1);
            toast('Item movido', 'info');
            render();
            return true;
          }
        }
        toast('Produto não encontrado', 'warn');
        abrirModalExcedente(sku, fonte);
        document.getElementById('produto-info').hidden = true;
        return false;
      }
      mostrarProdutoInfo(item);
      if (precoInput && !precoInput.value) precoInput.value = item.precoMedio ?? '';
      active?.focus?.();
      return true;
    } finally {
      btnCons?.classList.remove?.('loading');
      btnCons?.removeAttribute?.('disabled');
    }
  }

  btnCons?.addEventListener('click', ()=>consultar('manual'));

  btnReg?.addEventListener('click', () => {
    const sku = normalizeSku(inputSku?.value || '');
    const priceStr = precoInput?.value || '';
    const obsPreset = obsSelect?.value || '';
    if (obsPreset !== 'excedente' && priceStr.trim() === '') {
      toast('Preço obrigatório', 'warn');
      return;
    }
    const price = priceStr.trim() === '' ? undefined : Number(priceStr);

    const pendente = Number(store.findInRZ?.(store.state.rzAtual, sku)?.qtd ?? 1);
    let qty = 1;
    if (pendente > 1) {
      const entrada = window.prompt(`Quantidade a registrar (restantes: ${pendente})`, '1');
      const n = parseInt(entrada || '1', 10);
      qty = Number.isFinite(n) ? Math.max(1, Math.min(pendente, n)) : 1;
    }

    const toExcedentes = obsPreset === 'excedente';
    const note = toExcedentes ? excedenteObs : '';

    try {
      if (toExcedentes && typeof store.registrarExcedente === 'function') {
        store.registrarExcedente({ sku, qty, price, note });
        toast.success('Excedente registrado');
      } else if (typeof store.conferir === 'function') {
        store.conferir(sku, { qty, price, note });
        toast.success(`Registrado ${qty} un. de ${sku}`);
      } else {
        console.warn('Ação de registro não disponível no store.');
      }
      render();
      window.refreshIndicators?.();
    } catch(e) {
      console.error(e); toast('Falha ao registrar', 'error');
    }
    if (obsSelect) obsSelect.value = '';
    if (precoInput) precoInput.value = '';
    excedenteObs = '';
    scAfterRegister();
  });

  inputSku?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      btnReg?.click();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(enterTimer);
      enterTimer = setTimeout(() => btnCons?.click(), 120);
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
        const p = it.preco === undefined || it.preco === null ? null : Number(it.preco);
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

  document.getElementById('exc-salvar')?.addEventListener('click', ()=>{
    const dlg = document.getElementById('dlg-excedente');
    const sku = document.getElementById('exc-sku').value.trim().toUpperCase();
    const desc = document.getElementById('exc-desc').value.trim();
    const qtd  = Number(document.getElementById('exc-qtd').value) || 1;
    const precoStr = document.getElementById('exc-preco').value;
    const preco = precoStr.trim() === '' ? undefined : Number(precoStr);
    const obs  = document.getElementById('exc-obs').value.trim();
    if (!sku || !desc) return;
    addExcedente(store.state.rzAtual, { sku, descricao: desc, qtd, preco, obs, fonte: dlg?.dataset.fonte||'manual' });
    dlg.close();
    toast('Excedente salvo', 'info');
    render();
    window.refreshIndicators?.();
  });

  document.addEventListener('keydown',(e)=>{
    if (e.ctrlKey && e.key.toLowerCase()==='k'){ e.preventDefault(); document.querySelector('#codigo-ml')?.focus(); }
    // Ctrl+Enter handled on inputSku for registro
    if (e.ctrlKey && e.key.toLowerCase()==='s'){
      const dlg = document.getElementById('dlg-excedente');
      if (dlg?.open) { e.preventDefault(); document.getElementById('exc-salvar')?.click(); }
    }
    if (e.key==='Escape') document.getElementById('dlg-excedente')?.close();
  });

  let detachWedge = null;
  function setupWedge(){
    detachWedge?.();
    if (getMode() !== 'wedge') return;
    detachWedge = installWedgeScanner({
      allowInput: inputSku,
      onScan: (code, term) => {
        const norm = normalizeSku(code);
        if (!norm || norm.length < 3) return;
        inputSku.value = norm;
        inputSku.focus();
        inputSku.select();
        if (term === 'Enter') {
          btnCons?.click();
        }
      }
    });
  }
  setupWedge();
  onChange(mode => { if (mode === 'wedge') setupWedge(); else detachWedge?.(); });

  return {
    consultar,
    setSku: (sku)=>{ if (inputSku) inputSku.value = sku; }
  };
}
