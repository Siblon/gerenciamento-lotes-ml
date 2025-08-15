// src/main.js
import { initApp } from './components/app.js';
import store from './store/index.js';
import { loadFinanceConfig, loadMetricsPrefs, saveMetricsPrefs, computeItemFinance, computeAggregates } from './utils/finance.js';
import { loadPrefs, savePrefs } from './utils/prefs.js';

window.__DEBUG_SCAN__ = true;

function updateBoot(msg) {
  const el = document.getElementById('boot-status');
  if (el) el.firstChild.nodeValue = ''; // limpa texto anterior
  if (el) el.innerHTML = `<strong>Boot:</strong> ${msg} <button id="btn-debug" type="button" class="btn ghost">Debug</button>`;
}

function brl(n){ return (n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }

function applyFinanceVisibility(show){
  const panel = document.getElementById('finance-panel');
  panel?.classList.toggle('collapsed', !show);
}

function computeFinance(opts = {}){
  const { includeFrete = false } = opts;
  const cfg = loadFinanceConfig();
  const prefs = loadPrefs();
  const freteTotal = (prefs.calcFreteMode === 'ao_vivo' || includeFrete) ? cfg.frete_total : 0;
  const raw = store.selectAllImportedItems ? store.selectAllImportedItems() : [];
  const items = raw.map(it => ({ sku: it.sku, descricao: it.descricao, preco_ml_unit: Number(it.preco_ml_unit||0), qtd: Number(it.qtd||0) }));
  const totalQtd = items.reduce((s,it)=>s+it.qtd,0);
  const totalValor = items.reduce((s,it)=>s+it.preco_ml_unit*it.qtd,0);
  const ctx = { totalQtd, totalValor, frete_total: freteTotal, rateio_frete: cfg.rateio_frete };
  const byItem = items.map(it => ({
    sku: it.sku,
    descricao: it.descricao,
    qtd: it.qtd,
    preco_ml_unit: it.preco_ml_unit,
    ...computeItemFinance(it, { ...cfg, frete_total: freteTotal }, ctx)
  }));
  const aggregates = computeAggregates(items, { ...cfg, frete_total: freteTotal });
  return { byItem, aggregates, config: { ...cfg, frete_total: freteTotal } };
}
window.computeFinance = computeFinance;

function refreshIndicators(){
  try{
    const ui = loadPrefs();
    const metrics = loadMetricsPrefs();
    const sec = document.getElementById('indicators');
    if (sec) sec.classList.toggle('hidden', !ui.showIndicators);
    const grid = sec?.querySelector('.indicators-grid');
    if (!ui.showIndicators || !grid) return;
    grid.innerHTML = '';
    const { aggregates, config } = computeFinance();
    const mapping = [
      { key:'preco_medio_ml_palete', label:'Preço médio ML (palete)', value:aggregates.preco_medio_ml_palete, foot:null },
      { key:'custo_medio_pago_palete', label:'Custo pago médio (palete)', value:aggregates.custo_medio_pago_palete, foot:`pagamos ${Math.round(config.percent_pago_sobre_ml*100)}% do preço ML` },
      { key:'preco_venda_medio_palete', label:'Preço de venda médio (palete)', value:aggregates.preco_venda_medio_palete, foot:`baseado em desconto ${Math.round(config.desconto_venda_vs_ml*100)}% vs ML` },
      { key:'lucro_total_palete', label:'Lucro total (palete)', value:aggregates.lucro_total_palete, foot:null },
      { key:'rateio_frete', label:'Rateio do frete', value: config.rateio_frete === 'valor' ? 'por valor' : 'por quantidade', foot:null }
    ];
    mapping.forEach(m=>{
      if(!metrics.visible[m.key]) return;
      const card = document.createElement('article');
      card.className = 'metric-card';
      const lbl = document.createElement('div'); lbl.className='metric-label'; lbl.textContent=m.label; card.appendChild(lbl);
      const val = document.createElement('div'); val.className='metric-value'; val.textContent = m.key==='rateio_frete'? m.value : brl(m.value); card.appendChild(val);
      if(m.foot){ const fn=document.createElement('div'); fn.className='metric-footnote'; fn.textContent=m.foot; card.appendChild(fn); }
      grid.appendChild(card);
    });
  }catch(e){ console.warn('refreshIndicators', e); }
}
window.refreshIndicators = refreshIndicators;

function initIndicators(){
  const toggleBtn = document.getElementById('toggle-indicators');
  const configBtn = document.getElementById('config-indicators');
  const dialog = document.getElementById('dlg-indicators');
  const options = document.getElementById('metrics-options');
  const applyBtn = document.getElementById('apply-indicators');

  function updateToggle(){ const p = loadPrefs(); if(toggleBtn) toggleBtn.textContent = p.showIndicators ? 'Ocultar indicadores' : 'Mostrar indicadores'; }

  toggleBtn?.addEventListener('click', ()=>{ const p = loadPrefs(); p.showIndicators = !p.showIndicators; savePrefs(p); updateToggle(); refreshIndicators(); });

  configBtn?.addEventListener('click', ()=>{
    if(!dialog) return;
    const prefs = loadMetricsPrefs();
    options.innerHTML = '';
    const labels = {
      preco_medio_ml_palete:'Preço médio ML (palete)',
      custo_medio_pago_palete:'Custo pago médio (palete)',
      preco_venda_medio_palete:'Preço de venda médio (palete)',
      lucro_total_palete:'Lucro total (palete)',
      rateio_frete:'Rateio do frete'
    };
    Object.keys(prefs.visible).forEach(k=>{
      const id='chk-'+k;
      const div=document.createElement('div');
      const cb=document.createElement('input'); cb.type='checkbox'; cb.id=id; cb.checked=!!prefs.visible[k];
      const lb=document.createElement('label'); lb.htmlFor=id; lb.textContent=labels[k];
      div.appendChild(cb); div.appendChild(lb); options.appendChild(div);
    });
    dialog.showModal();
  });

  applyBtn?.addEventListener('click', ()=>{
    const prefs = loadMetricsPrefs();
    Object.keys(prefs.visible).forEach(k=>{ const cb=document.getElementById('chk-'+k); prefs.visible[k] = !!cb?.checked; });
    saveMetricsPrefs(prefs);
    dialog.close();
    refreshIndicators();
  });

  updateToggle();
  refreshIndicators();
}

initIndicators();


const SETTINGS_KEY = 'confApp.settings';

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
}
function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s||{}));
}
function applySettings() {
  const s = loadSettings();
  const scannerCard = document.getElementById('card-scanner');
  if (scannerCard) scannerCard.style.display = s.hideScanner ? 'none' : '';
  const selC = document.getElementById('limit-conferidos');
  const selP = document.getElementById('limit-pendentes');
  if (selC && s.pageSize) selC.value = String(s.pageSize);
  if (selP && s.pageSize) selP.value = String(s.pageSize);

  // Atualiza indicadores financeiros
  refreshIndicators();
}

function wireSettingsUI() {
  const btn = document.getElementById('btn-settings');
  const dlg = document.getElementById('dlg-settings');
  const chkHide = document.getElementById('cfg-hide-scanner');
  const selSize = document.getElementById('cfg-page-size');

  const inDiscount   = document.getElementById('cfg-discount');
  const inAuctionFee = document.getElementById('cfg-auction-fee');
  const inFreight    = document.getElementById('cfg-freight');
  const selFreight   = document.getElementById('cfg-freight-mode');

  btn?.addEventListener('click', ()=> {
    const s = loadSettings();
    chkHide.checked = !!s.hideScanner;
    selSize.value = String(s.pageSize || 50);
    inDiscount.value  = String(s.discountPct ?? 25);
    inAuctionFee.value= String(s.auctionFeePct ?? 8);
    inFreight.value   = String(s.freightTotal ?? 0);
    selFreight.value  = String(s.freightMode ?? 'por_unidade');
    dlg.showModal();
  });

  dlg?.addEventListener('close', ()=> {
    if (dlg.returnValue === 'default') {
      const s = loadSettings();
      s.hideScanner = chkHide.checked;
      s.pageSize = parseInt(selSize.value, 10);
       s.discountPct   = Math.max(0, Number(inDiscount.value || 0));
       s.auctionFeePct = Math.max(0, Number(inAuctionFee.value || 0));
       s.freightTotal  = Math.max(0, Number(inFreight.value || 0));
       s.freightMode   = selFreight.value;
      saveSettings(s);
      applySettings();
      updateBoot('Configurações salvas ⚙️');
    }
  });
}

// ---- SCANNER: controle de UI + getUserMedia ----
let __stream = null;

async function startScanner() {
  const video = document.getElementById('preview');
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia não suportado');
  }
  const constraints = { video: { facingMode: 'environment' } };
  __stream = await navigator.mediaDevices.getUserMedia(constraints);
  if (video) {
    video.srcObject = __stream;
    await video.play();
  }
}

function stopScanner() {
  try {
    __stream?.getTracks()?.forEach(t => t.stop());
    __stream = null;
  } catch {}
  const video = document.getElementById('preview');
  if (video) {
    try { video.pause?.(); } catch {}
    video.srcObject = null;
  }
}

function wireScannerUI() {
  const card = document.getElementById('card-scanner');
  const openBtn = document.getElementById('btn-open-scanner');
  const toggleBtn = document.getElementById('btn-scan-toggle');

  openBtn?.addEventListener('click', () => {
    card?.classList.remove('collapsed');
    toggleBtn?.focus();
  });

  toggleBtn?.addEventListener('click', async () => {
    if (!card) return;
    const willTurnOn = !card.classList.contains('is-on');
    if (willTurnOn) {
      try {
        await startScanner();
        card.classList.add('is-on');
        toggleBtn.textContent = 'Parar Scanner';
        updateBoot('Scanner ligado ✅');
      } catch (e) {
        console.error('[SCAN] falha ao iniciar', e);
        updateBoot('Falha ao iniciar scanner ❌ (veja Console)');
        card.classList.remove('is-on');
        toggleBtn.textContent = 'Ativar Scanner';
      }
    } else {
      stopScanner();
      card.classList.remove('is-on');
      toggleBtn.textContent = 'Ativar Scanner';
      updateBoot('Scanner desligado ⏹️');
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('[BOOT] DOM pronto → initApp()');
  updateBoot('DOM pronto, iniciando app…');
  try {
    initApp();
    updateBoot('App iniciado ✅');
  } catch (e) {
    console.error('[BOOT] falha initApp', e);
    updateBoot('Falhou iniciar ❌ (veja Console)');
  }

  window.store = store;
  window.__dumpRZ = () => {
    try {
      const list = (window.store?.state?.rzList) || [];
      console.log('[DEBUG] rzList:', list.length, list);
      return list;
    } catch (e) {
      console.warn('dumpRZ falhou', e);
      return [];
    }
  };

  // botão Debug (permite testar ZXing e permissões)
  const dbgBtn = document.getElementById('btn-debug');
  if (dbgBtn) {
    dbgBtn.addEventListener('click', async () => {
      console.log('[DEBUG] Click: checando navegador e ZXing CDN');
      try {
        const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
        console.log('[DEBUG] BarcodeDetector?', 'BarcodeDetector' in window, 'Câmeras:', cams);
      } catch (e) {
        console.warn('[DEBUG] enumerateDevices falhou', e);
      }
      try {
        const zUrl = 'https://cdn.jsdelivr.net/npm/' + '@zxing' + '/browser@0.1.4/+esm';
        const m = await import(/* @vite-ignore */ zUrl);
        console.log('[DEBUG] ZXing CDN carregado:', Object.keys(m).slice(0,5));
      } catch (e) {
        console.error('[DEBUG] Falha import ZXing CDN', e);
      }
    });
  }

  wireScannerUI();

  const prefs = loadPrefs();
  applyFinanceVisibility(prefs.showFinance);
  const finTgl = document.getElementById('toggle-finance');
  if (finTgl) {
    finTgl.checked = prefs.showFinance;
    finTgl.addEventListener('change', (e)=>{
      const p = loadPrefs();
      p.showFinance = e.target.checked;
      savePrefs(p);
      applyFinanceVisibility(p.showFinance);
    });
  }

  // ---- Delegação para "Recolher/Expandir" ----
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-target]');
    if (!btn) return;
    const targetId = btn.getAttribute('data-target');
    const sec = document.getElementById(targetId);
    if (!sec) return;
    sec.classList.toggle('collapsed');
    btn.textContent = sec.classList.contains('collapsed') ? 'Expandir' : 'Recolher';
  });

  // ---- Registrar com quantidade e observações ----
  applySettings();
  wireSettingsUI();
  refreshIndicators();
  });

// para testar no Console
window.__appPing = () => console.log('pong from app');
