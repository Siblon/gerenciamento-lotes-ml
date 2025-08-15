import { describe, it, expect, beforeEach } from 'vitest';
import { getMode, switchTo, afterRegister } from '../src/utils/scannerController.js';
import { loadPrefs, savePrefs } from '../src/utils/prefs.js';

beforeEach(() => {
  localStorage.clear();
  switchTo('auto');
});

describe('scannerController', () => {
  it('switches mode and persists', () => {
    switchTo('manual');
    expect(getMode()).toBe('manual');
    expect(loadPrefs().scannerMode).toBe('manual');
  });

  it('returns to auto after register unless locked', () => {
    switchTo('manual');
    let prefs = loadPrefs();
    prefs.lockManualScanner = false;
    savePrefs(prefs);
    afterRegister();
    expect(getMode()).toBe('auto');

    switchTo('manual');
    prefs = loadPrefs();
    prefs.lockManualScanner = true;
    savePrefs(prefs);
    afterRegister();
    expect(getMode()).toBe('manual');
  });
});
