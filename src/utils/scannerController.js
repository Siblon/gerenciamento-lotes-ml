import { loadPrefs, savePrefs } from './prefs.js';

let currentMode = 'wedge';
const listeners = new Set();

function init() {
  const prefs = loadPrefs();
  currentMode = prefs.scannerMode || 'wedge';
}

init();

export function getMode() {
  return currentMode;
}

export function switchTo(mode = 'wedge') {
  currentMode = mode === 'camera' ? 'camera' : 'wedge';
  const prefs = loadPrefs();
  prefs.scannerMode = currentMode;
  savePrefs(prefs);
  listeners.forEach((fn) => fn(currentMode));
}

export function afterRegister() {
  const prefs = loadPrefs();
  if (prefs.lockScannerMode) {
    return;
  }
  switchTo('wedge');
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

