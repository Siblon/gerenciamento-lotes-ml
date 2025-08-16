// src/components/ActionsPanel.js
import { exportarConferencia } from '../utils/excel.js';
import store, { findInRZ, findConferido, findEmOutrosRZ, moveItemEntreRZ, addExcedente } from '../store/index.js';
import { loadFinanceConfig, saveFinanceConfig } from '../utils/finance.js';
import { loadPrefs, savePrefs } from '../utils/prefs.js';
import { toast } from '../utils/toast.js';

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
  const rngPercent = document.getElementById('fin-percent');
  const rngDesconto = document.getElementById('fin-desconto');
  const inpFrete = document.getElementById('fin-frete');
  const selRateio = document.getElementById('fin-rateio');
  const selMode   = document.getElementById('fin-mode');

  btnCons?.classList.add('btn','btn-primary');
  btnReg?.classList.add('btn','btn-primary');

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
    const sku = (inputSku?.value || '').trim().toUpperCase();
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

  btnCons?.addEventListener('click', ()=>consultar('manual'));

  btnReg?.addEventListener('click', () => {
    const sku = (inputSku?.value || '').trim().toUpperCase();
    const price = parseFloat(document.getElementById('preco-ajustado')?.value || '') || undefined;
    const obsPreset = document.getElementById('obs-preset')?.value || '';

    const pendente = Number(store.findInRZ?.(store.state.rzAtual, sku)?.qtd ?? 1);
    let qty = 1;
    if (pendente > 1) {
      const entrada = window.prompt(`Quantidade a registrar (restantes: ${pendente})`, '1');
      const n = parseInt(entrada || '1', 10);
      qty = Number.isFinite(n) ? Math.max(1, Math.min(pendente, n)) : 1;
    }

    const toExcedentes = obsPreset === 'excedente';
    const isAvaria = obsPreset === 'avaria';

    const note = [
      obsPreset === 'excedente' ? 'Excedente: não listado' :
      obsPreset === 'avaria' ? 'Avaria grave: descartar' :
      obsPreset === 'nao_encontrado' ? 'Não encontrado no RZ' : null,
    ].filter(Boolean).join(' | ');

    try {
      if (toExcedentes && typeof store.registrarExcedente === 'function') {
        store.registrarExcedente({ sku, qty, price, note });
        toast(`Excedente registrado (${qty} un.)`, 'info');
      } else if (typeof store.conferir === 'function') {
        store.conferir(sku, { qty, price, note, avaria: isAvaria });
        toast(`Registrado ${qty} un. de ${sku}`, 'info');
      } else {
        console.warn('Ação de registro não disponível no store.');
      }
      render();
      window.refreshIndicators?.();
    } catch(e) {
      console.error(e); toast('Falha ao registrar', 'error');
    }
    inputSku?.focus();
  });

  inputSku?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      btnReg?.click();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      btnCons?.click();
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
      const excedentes = (store.state.excedentes[rz] || []).map(it => ({
        SKU: it.sku,
        Descrição: it.descricao || '',
        Qtd: it.qtd,
        'Preço Médio (R$)': Number(it.preco || 0),
        'Valor Total (R$)': Number(it.qtd || 0) * Number(it.preco || 0),
        NCM: it.ncm || '',
        Observação: it.obs || ''
      }));

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
    const preco= Number(document.getElementById('exc-preco').value) || 0;
    const obs  = document.getElementById('exc-obs').value.trim();
    if (!sku || !desc || !preco) return;
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

  return {
    consultar,
    setSku: (sku)=>{ if (inputSku) inputSku.value = sku; }
  };
}
