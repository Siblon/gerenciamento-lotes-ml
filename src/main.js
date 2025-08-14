// src/main.js
import { initApp } from './components/app.js';
import store from './store/index.js';

window.__DEBUG_SCAN__ = true;

function updateBoot(msg) {
  const el = document.getElementById('boot-status');
  if (el) el.firstChild.nodeValue = ''; // limpa texto anterior
  if (el) el.innerHTML = `<strong>Boot:</strong> ${msg} <button id="btn-debug" type="button" class="btn ghost">Debug</button>`;
}

function brl(n){ return (n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }

function getAllItemsCurrentRZ(){
  const rz = window.store?.state?.rzAtual;
  const totals = window.store?.state?.totalByRZSku?.[rz] || {};
  const meta = window.store?.state?.metaByRZSku?.[rz] || {};
  const conf = window.store?.state?.conferidosByRZSku?.[rz] || {};
  const exc  = window.store?.state?.excedentes?.[rz] || [];
  const items = Object.keys(totals).map(sku => ({
    sku,
    descricao: meta[sku]?.descricao || '',
    qtd: totals[sku],
    precoMedioML: meta[sku]?.precoMedio,
    conferidos: conf[sku]?.qtd || 0,
    avariados: conf[sku]?.avariados || 0,
    excedentes: 0,
  }));
  const map = Object.fromEntries(items.map(it=>[it.sku,it]));
  exc.forEach(it=>{
    if(map[it.sku]){
      map[it.sku].excedentes = (map[it.sku].excedentes||0) + Number(it.qtd||0);
    } else {
      items.push({ sku: it.sku, descricao: it.descricao||'', qtd: 0, precoMedioML: Number(it.preco||0), conferidos: 0, avariados: 0, excedentes: Number(it.qtd||0) });
    }
  });
  return items;
}

function computeFinancials(){
  const s = loadSettings();
  const items = getAllItemsCurrentRZ();

  const discount = (s.discountPct ?? 25) / 100;
  const auction  = (s.auctionFeePct ?? 8) / 100;
  const freight  = Number(s.freightTotal ?? 0);
  const freightMode = s.freightMode || 'por_unidade';

  const totalUnits = items.reduce((sum,it)=> sum + Number(it.qtd||0), 0);
  const totalValor = items.reduce((sum,it)=> sum + Number(it.precoMedioML||0) * Number(it.qtd||0), 0);

  let sumRevenue = 0, sumCost = 0, sumUnitsVendaveis = 0, sumMLValor = 0, sumMLUnits = 0;

  const byItem = items.map((it)=>{
    const q = Number(it.qtd||0);
    const ml = Number(it.precoMedioML||0);
    const conferidos = Number(it.conferidos||0);
    const avariados  = Number(it.avariados||0);
    const excedentes = Number(it.excedentes||0);

    const unitsVend = Math.max(0, conferidos + excedentes - avariados);
    const target = ml * (1 - discount);
    const costAuctionUnit = ml * auction;

    let costFreightUnit = 0;
    if (freight > 0) {
      if (freightMode === 'por_valor' && totalValor > 0) {
        const pesoValor = (ml * q) / totalValor;
        costFreightUnit = (freight * pesoValor) / Math.max(1, q);
      } else {
        costFreightUnit = freight / Math.max(1, totalUnits);
      }
    }

    const unitCost = costAuctionUnit + costFreightUnit;
    const revenue  = target * unitsVend;
    const cost     = unitCost * unitsVend;
    const profit   = revenue - cost;

    sumUnitsVendaveis += unitsVend;
    sumRevenue += revenue;
    sumCost += cost;
    sumMLValor += ml * q;
    sumMLUnits += q;

    return { sku: it.sku, descricao: it.descricao, ml, target, unitCost, unitsVend, revenue, cost, profit };
  });

  const paleteMLavg   = sumMLUnits > 0 ? sumMLValor / sumMLUnits : 0;
  const paleteTarget  = paleteMLavg * (1 - (loadSettings().discountPct ?? 25)/100);
  const lucroPrevisto = sumRevenue - sumCost;

  return { byItem, totals: { paleteMLavg, paleteTarget, revenue: sumRevenue, cost: sumCost, lucroPrevisto } };
}
window.computeFinancials = computeFinancials;

function refreshFinancialChips(){
  try{
    const f = computeFinancials();
    const chipML = document.getElementById('chip-palete');
    const chipTg = document.getElementById('chip-palete-target');
    const chipLu = document.getElementById('chip-lucro');
    const chipFm = document.getElementById('chip-frete-mode');

    const vML = document.getElementById('val-palete');
    const vTG = document.getElementById('val-palete-target');
    const vLU = document.getElementById('val-lucro');
    const vFM = document.getElementById('val-frete-mode');

    if (chipML && vML) { vML.textContent = brl(f.totals.paleteMLavg); chipML.hidden = false; }
    if (chipTg && vTG) { vTG.textContent = brl(f.totals.paleteTarget); chipTg.hidden = false; }
    if (chipLu && vLU) { vLU.textContent = brl(f.totals.lucroPrevisto); chipLu.hidden = false; }
    if (chipFm && vFM) {
      const s = loadSettings();
      vFM.textContent = s.freightMode === 'por_valor' ? 'por valor' : 'por unidade';
      chipFm.hidden = false;
    }
  }catch(e){ console.warn('refreshFinancialChips', e); }
}
window.refreshFinancialChips = refreshFinancialChips;

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

  // Atualiza chips financeiros
  refreshFinancialChips();
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
    refreshFinancialChips();
  });

// para testar no Console
window.__appPing = () => console.log('pong from app');
