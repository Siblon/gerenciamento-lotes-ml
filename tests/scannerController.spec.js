import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/utils/platform.js', () => ({
  isDesktop: vi.fn(),
  isMobile: vi.fn(),
}));

import { getMode, switchTo, afterRegister } from '../src/utils/scannerController.js';
import { loadPrefs, savePrefs } from '../src/utils/prefs.js';
import * as platform from '../src/utils/platform.js';

beforeEach(() => {
  localStorage.clear();
  platform.isDesktop.mockReturnValue(false);
  switchTo('wedge');
});

describe('scannerController', () => {
  it('switches mode and persists on mobile', () => {
    platform.isDesktop.mockReturnValue(false);
    switchTo('camera');
    expect(getMode()).toBe('camera');
    expect(loadPrefs().scannerMode).toBe('camera');
  });

  it('ignores camera mode on desktop', () => {
    platform.isDesktop.mockReturnValue(true);
    switchTo('camera');
    expect(getMode()).toBe('wedge');
  });

  it('returns to auto after register unless locked', () => {
    platform.isDesktop.mockReturnValue(false);
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
