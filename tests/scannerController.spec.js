import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/utils/platform.js', () => ({
  isDesktop: vi.fn(),
  isMobile: vi.fn(),
}));

import { getMode, switchTo, afterRegister, attachWedgeCapture } from '../src/utils/scannerController.js';
import { loadPrefs, savePrefs } from '../src/utils/prefs.js';
import * as platform from '../src/utils/platform.js';
import toast from '../src/utils/toast.js';

beforeEach(() => {
  localStorage.clear();
  platform.isDesktop.mockReturnValue(false);
  switchTo('wedge');
  global.document = { getElementById: () => null, querySelector: () => null };
});

describe('scannerController', () => {
  it('defaults to wedge mode on desktop', async () => {
    platform.isDesktop.mockReturnValue(true);
    vi.resetModules();
    const sc = await import('../src/utils/scannerController.js');
    expect(sc.getMode()).toBe('wedge');
  });

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

  it('afterRegister focuses code input', () => {
    const el = { focus: vi.fn(), select: vi.fn() };
    global.document = { getElementById: () => el, querySelector: () => el };
    afterRegister();
    expect(el.focus).toHaveBeenCalled();
  });
});

describe('attachWedgeCapture', () => {
  let input;
  let now;

  beforeEach(() => {
    localStorage.clear();
    now = 0;
    global.performance = { now: () => now };
    input = {
      value: '',
      _l: {},
      addEventListener(type, fn) { this._l[type] = fn; },
      setAttribute: () => {},
      dispatch(ev) { this._l[ev.type]?.(ev); },
    };
  });

  it('detects fast burst as scan', () => {
    const onScan = vi.fn();
    attachWedgeCapture(input, onScan);
    const handler = input._l.keydown;
    function send(key, diff) {
      now += diff;
      handler({ key, preventDefault: () => {} });
    }
    send('A', 0);
    send('B', 10);
    send('C', 10);
    send('1', 10);
    send('Enter', 10);
    expect(onScan).toHaveBeenCalledWith('ABC1');
  });

  it('blocks slow manual typing', () => {
    const onScan = vi.fn();
    const warnSpy = vi.spyOn(toast, 'warn').mockImplementation(() => {});
    attachWedgeCapture(input, onScan);
    const handler = input._l.keydown;
    function send(key, diff) {
      now += diff;
      handler({ key, preventDefault: () => {} });
    }
    send('A', 0);
    send('B', 100);
    send('C', 100);
    send('Enter', 100);
    expect(onScan).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });
});
