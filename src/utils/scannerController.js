import { loadPrefs, savePrefs } from './prefs.js';

let currentMode = 'auto';
const listeners = new Set();

function init() {
  const prefs = loadPrefs();
  currentMode = prefs.scannerMode || 'auto';
}

init();

export function getMode() {
  return currentMode;
}

export function switchTo(mode = 'auto') {
  currentMode = mode === 'manual' ? 'manual' : 'auto';
  const prefs = loadPrefs();
  prefs.scannerMode = currentMode;
  savePrefs(prefs);
  listeners.forEach((fn) => fn(currentMode));
}

export function afterRegister() {
  const prefs = loadPrefs();
  if (prefs.lockManualScanner) {
    // mantém modo manual se fixado
    return;
  }
  currentMode = 'auto';
  prefs.scannerMode = 'auto';
  savePrefs(prefs);
  listeners.forEach((fn) => fn(currentMode));
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

