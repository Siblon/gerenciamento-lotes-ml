import { loadPrefs, savePrefs } from './prefs.js';
import { isDesktop } from './platform.js';
import toast from './toast.js';

let currentMode = 'wedge';
const listeners = new Set();

function init() {
  const prefs = loadPrefs();
  currentMode = isDesktop() ? 'wedge' : (prefs.scannerMode || 'wedge');
}

init();

export function getMode() {
  return currentMode;
}

export function isWedgeMode() {
  return currentMode === 'wedge';
}

export function switchTo(mode = 'wedge') {
  if (mode === 'camera' && isDesktop()) mode = 'wedge';
  currentMode = mode === 'camera' ? 'camera' : 'wedge';
  const prefs = loadPrefs();
  prefs.scannerMode = currentMode;
  savePrefs(prefs);
  listeners.forEach((fn) => fn(currentMode));
}

export function afterRegister() {
  const prefs = loadPrefs();
  if (!prefs.lockScannerMode) {
    switchTo('wedge');
  }
  const el = document.getElementById('input-codigo-produto') || document.querySelector('input[placeholder="Código do produto"]');
  el?.focus?.();
  if (currentMode === 'wedge') el?.select?.();
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Heurística de captura de "bipes" de leitor wedge
// Quando a preferência lockScannerMode estiver ativada, bloqueia digitação
// manual e só permite sequências rápidas finalizadas com Enter.
export function attachWedgeCapture(inputEl, onScan) {
  if (!inputEl) return;
  let buf = '';
  let lastTs = 0;
  let times = [];
  const prefs = loadPrefs();
  const isLocked = !!prefs.lockScannerMode;

  if (isLocked) {
    inputEl.addEventListener('paste', (e) => e.preventDefault());
    inputEl.addEventListener('contextmenu', (e) => e.preventDefault());
    inputEl.setAttribute('autocomplete', 'off');
    inputEl.setAttribute('inputmode', 'none');
  }

  inputEl.addEventListener('keydown', (e) => {
    if (!isLocked) return;

    if (e.key === 'Escape') {
      buf = '';
      times = [];
      inputEl.value = '';
      lastTs = 0;
      return;
    }

    const now = performance.now();
    if (lastTs) times.push(now - lastTs);
    lastTs = now;

    if (e.key.length === 1) {
      buf += e.key;
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const avg = times.length
        ? times.reduce((a, b) => a + b, 0) / times.length
        : 999;
      const looksLikeScanner = avg < 35 && buf.length >= 3;
      const text = buf.trim();
      buf = '';
      times = [];
      lastTs = 0;
      if (looksLikeScanner) {
        onScan?.(text);
      } else {
        toast.warn('Entrada manual bloqueada (modo bipe travado).');
      }
    }
  });
}

