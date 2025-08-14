// src/components/ActionsPanel.js
import { exportarConferencia } from '../utils/excel.js';
import store, { findInRZ, findConferido, findEmOutrosRZ, moveItemEntreRZ, addExcedente } from '../store/index.js';

function toast(msg, type='info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
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

  inputSku?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnReg?.click();
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
        return { SKU: sku, Descrição: m.descricao || '', Qtd: qtd, 'Preço Médio (R$)': preco, 'Valor Total (R$)': qtd*preco, Observação: confMap[sku]?.observacao || '' };
      });
      const pendentes = Object.keys(tot).filter(sku => !confMap[sku]).map(sku => {
        const m = meta[sku] || {};
        const qtd = tot[sku] || 0;
        const preco = Number(m.precoMedio || 0);
        return { SKU: sku, Descrição: m.descricao || '', Qtd: qtd, 'Preço Médio (R$)': preco, 'Valor Total (R$)': qtd*preco };
      });
      const excedentes = (store.state.excedentes[rz] || []).map(it=>({ SKU: it.sku, Descrição: it.descricao || '', Qtd: it.qtd, 'Preço Médio (R$)': Number(it.preco || 0), 'Valor Total (R$)': Number(it.qtd||0) * Number(it.preco||0), Observação: it.obs || '' }));

      const sumQtd = arr => arr.reduce((s,it)=>s + Number(it.Qtd||0),0);
      const sumVal = arr => arr.reduce((s,it)=>s + Number(it['Valor Total (R$)']||0),0);
      const resumoRZ = [{
        RZ: rz,
        Conferidos: sumQtd(conferidos),
        Pendentes: sumQtd(pendentes),
        Excedentes: sumQtd(excedentes),
        'Valor Total (R$)': sumVal(conferidos) + sumVal(pendentes) + sumVal(excedentes),
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
  });

  document.addEventListener('keydown',(e)=>{
    if (e.ctrlKey && e.key.toLowerCase()==='k'){ e.preventDefault(); document.querySelector('#codigo-ml')?.focus(); }
    if (e.key==='Escape') document.getElementById('dlg-excedente')?.close();
  });

  return {
    consultar,
    setSku: (sku)=>{ if (inputSku) inputSku.value = sku; }
  };
}
