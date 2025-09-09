// src/components/ScannerUI.js
import { hideBoot } from '../utils/boot.js';
import { getMode, switchTo } from '../utils/scannerController.js';

let stream = null;

async function startScanner() {
  const video = document.getElementById('preview');
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia não suportado');
  }
  const constraints = { video: { facingMode: 'environment' } };
  stream = await navigator.mediaDevices.getUserMedia(constraints);
  if (video) {
    video.srcObject = stream;
    await video.play();
  }
}

function stopScanner() {
  try {
    stream?.getTracks()?.forEach((t) => t.stop());
    stream = null;
  } catch {}
  const video = document.getElementById('preview');
  if (video) {
    try {
      video.pause?.();
    } catch {}
    video.srcObject = null;
  }
}

export function initScannerUI() {
  const card = document.getElementById('card-scanner');
  const openBtn = document.getElementById('btn-open-scanner');
  const toggleBtn = document.getElementById('btn-scan-toggle');
  const modeSel = document.getElementById('scan-mode');

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
        hideBoot();
      } catch (e) {
        console.error('[SCAN] falha ao iniciar', e);
        hideBoot();
        card.classList.remove('is-on');
        toggleBtn.textContent = 'Ativar Scanner';
      }
    } else {
      stopScanner();
      card.classList.remove('is-on');
      toggleBtn.textContent = 'Ativar Scanner';
      hideBoot();
    }
  });

  if (modeSel) {
    modeSel.value = getMode();
    modeSel.addEventListener('change', () => {
      switchTo(modeSel.value);
    });
  }
}
