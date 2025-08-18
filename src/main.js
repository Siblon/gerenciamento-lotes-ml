// src/main.js
import { initApp } from './components/app.js';
import { initIndicators } from './components/Indicators.js';
import { initScannerUI } from './components/ScannerUI.js';

if (import.meta.env?.DEV) {
  window.__DEBUG_SCAN__ = true;
}

window.addEventListener('DOMContentLoaded', () => {
  initApp();
  initIndicators();
  initScannerUI();
});
