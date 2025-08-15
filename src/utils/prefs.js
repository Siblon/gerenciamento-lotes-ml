// src/utils/prefs.js
// Helper de persistência simples para preferências de UI

export const UIPREFS_KEY = 'ui:prefs:v3';

// Valores padrão das preferências da interface
// Mantém chaves antigas por compatibilidade com código existente
const DEFAULT_PREFS = {
  showFinance: false,
  showIndicators: false,
  calcFreteMode: 'finalizar',
  scannerMode: 'wedge',      // 'wedge' | 'camera'
  lockScannerMode: true,
  predefineExcedente: false,
  askDiscardOnFinalize: true,
};

export function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(UIPREFS_KEY) || '{}');
    return { ...DEFAULT_PREFS, ...saved };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(v) {
  localStorage.setItem(UIPREFS_KEY, JSON.stringify(v || {}));
}

