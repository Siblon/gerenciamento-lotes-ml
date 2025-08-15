import { describe, it, expect, beforeEach } from 'vitest';
import { getMode, switchTo, afterRegister } from '../src/utils/scannerController.js';
import { loadPrefs, savePrefs } from '../src/utils/prefs.js';

beforeEach(() => {
  localStorage.clear();
  switchTo('wedge');
});

describe('scannerController', () => {
  it('switches mode and persists', () => {
    switchTo('camera');
    expect(getMode()).toBe('camera');
    expect(loadPrefs().scannerMode).toBe('camera');
  });

  it('returns to auto after register unless locked', () => {
    switchTo('camera');
    let prefs = loadPrefs();
    prefs.lockScannerMode = false;
    savePrefs(prefs);
    afterRegister();
    expect(getMode()).toBe('wedge');

    switchTo('camera');
    prefs = loadPrefs();
    prefs.lockScannerMode = true;
    savePrefs(prefs);
    afterRegister();
    expect(getMode()).toBe('camera');
  });
});
