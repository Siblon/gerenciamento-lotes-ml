// src/main.js
import { initApp } from './components/app.js';
import store from './store/index.js';

window.__DEBUG_SCAN__ = true;

function updateBoot(msg) {
  const el = document.getElementById('boot-status');
  if (el) el.firstChild.nodeValue = ''; // limpa texto anterior
  if (el) el.innerHTML = `<strong>Boot:</strong> ${msg} <button id="btn-debug" type="button" class="btn ghost">Debug</button>`;
}

function formatBR(n){ return (n||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }

function updateChipPalete() {
  try {
    const rz = window.store?.state?.rzAtual;
    const itens = window.store?.state?.itemsByRZ?.[rz] || [];
    const totQ = itens.reduce((s, it)=> s + Number(it.qtd||0), 0);
    const totV = itens.reduce((s, it)=> s + Number(it.valorUnit||0) * Number(it.qtd||0), 0);
    const media = totQ > 0 ? (totV / totQ) : 0;

    const chip = document.getElementById('chip-palete');
    const val = document.getElementById('val-palete');
    if (chip && val) {
      val.textContent = formatBR(media);
      chip.hidden = false;
    }
  } catch (e) {
    console.warn('updateChipPalete', e);
  }
}
window.updateChipPalete = updateChipPalete;

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
}

function wireSettingsUI() {
  const btn = document.getElementById('btn-settings');
  const dlg = document.getElementById('dlg-settings');
  const chkHide = document.getElementById('cfg-hide-scanner');
  const selSize = document.getElementById('cfg-page-size');

  btn?.addEventListener('click', ()=> {
    const s = loadSettings();
    chkHide.checked = !!s.hideScanner;
    selSize.value = String(s.pageSize || 50);
    dlg.showModal();
  });

  dlg?.addEventListener('close', ()=> {
    if (dlg.returnValue === 'default') {
      const s = loadSettings();
      s.hideScanner = chkHide.checked;
      s.pageSize = parseInt(selSize.value, 10);
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
    const regBtn = document.getElementById('btn-registrar');
    regBtn?.addEventListener('click', () => {
      const sku = (document.getElementById('codigo-ml')?.value || '').trim();
      const price = parseFloat(document.getElementById('preco-ajustado')?.value || '') || undefined;
      const noteFree = document.getElementById('observacao')?.value || '';
      const obsPreset = document.getElementById('obs-preset')?.value || '';

      const pendente = Number(window.store?.findInRZ?.(window.store.state.rzAtual, sku)?.qtd ?? 1);
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
        noteFree || null,
      ].filter(Boolean).join(' | ');

      try {
        if (toExcedentes && typeof window.store?.registrarExcedente === 'function') {
          window.store.registrarExcedente({ sku, qty, price, note });
          updateBoot(`Excedente registrado (${qty} un.) ✅`);
        } else if (typeof window.store?.conferir === 'function') {
          window.store.conferir(sku, { qty, price, note, avaria: isAvaria });
          updateBoot(`Registrado ${qty} un. de ${sku} ✅`);
        } else {
          console.warn('Ação de registro não disponível no store.');
        }
      } catch (e) {
        console.error('[REG] falha', e);
        updateBoot('Falha ao registrar ❌ (veja Console)');
      }
    });

    applySettings();
    wireSettingsUI();
    updateChipPalete();
  });

// para testar no Console
window.__appPing = () => console.log('pong from app');
