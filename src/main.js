// src/main.js
import { initApp } from './components/app.js';
import store from './store/index.js';

window.__DEBUG_SCAN__ = true;

function updateBoot(msg) {
  const el = document.getElementById('boot-status');
  if (el) el.firstChild.nodeValue = ''; // limpa texto anterior
  if (el) el.innerHTML = `<strong>Boot:</strong> ${msg} <button id="btn-debug" type="button" class="btn ghost">Debug</button>`;
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

  // Scanner UI controls
  const scannerCard = document.getElementById('card-scanner');
  const openScannerBtn = document.getElementById('btn-open-scanner');
  const scanToggleBtn = document.getElementById('btn-scan-toggle');
  const preview = document.getElementById('preview');

  if (scannerCard && openScannerBtn && scanToggleBtn) {
    openScannerBtn.addEventListener('click', () => {
      scannerCard.classList.remove('collapsed');
      openScannerBtn.setAttribute('aria-expanded', 'true');
      scanToggleBtn.focus();
    });

    scanToggleBtn.addEventListener('click', () => {
      const isOn = scannerCard.classList.toggle('is-on');
      scanToggleBtn.textContent = isOn ? 'Parar Scanner' : 'Ativar Scanner';
      scanToggleBtn.setAttribute('aria-pressed', String(isOn));
      if (!isOn && preview) {
        if (typeof preview.pause === 'function') preview.pause();
        preview.srcObject = null;
      }
    });
  }
});

// para testar no Console
window.__appPing = () => console.log('pong from app');
