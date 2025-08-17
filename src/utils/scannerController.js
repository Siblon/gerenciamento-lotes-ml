import { loadPrefs, savePrefs } from './prefs.js';
import { isDesktop } from './platform.js';

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
  const el = document.getElementById('codigo-produto') || document.querySelector('input[placeholder="Código do produto"]');
  el?.focus?.();
  if (currentMode === 'wedge') el?.select?.();
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

