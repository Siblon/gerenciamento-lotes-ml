import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

vi.mock('../src/utils/scannerController.js', () => ({
  getMode: vi.fn(() => 'wedge'),
  switchTo: vi.fn(),
}));

import { initScannerUI } from '../src/components/ScannerUI.js';

function classList() {
  const set = new Set();
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    contains: (c) => set.has(c),
  };
}

/**
 * Stub seguro para navigator.mediaDevices.getUserMedia
 * — NÃO reatribui navigator (que é só-leitura no jsdom).
 */
const originalNavigator = globalThis.navigator;

beforeAll(() => {
  const getUserMediaMock = vi.fn(() =>
    Promise.resolve({
      getTracks: () => [{ stop: vi.fn() }],
    })
  );

  const mediaDevices = {
    ...(originalNavigator?.mediaDevices ?? {}),
    getUserMedia: getUserMediaMock,
  };

  Object.defineProperty(globalThis, 'navigator', {
    value: { ...originalNavigator, mediaDevices },
    configurable: true,
  });
});

afterAll(() => {
  Object.defineProperty(globalThis, 'navigator', {
    value: originalNavigator,
    configurable: true,
  });
});

describe('ScannerUI component', () => {
  it('handles mode change and toggle', async () => {
    const card = { classList: classList() };
    const openBtn = { addEventListener: () => {} };
    const toggleBtn = { textContent: '', addEventListener: (e, fn) => (toggleBtn.fn = fn) };
    const modeSel = { value: 'wedge', addEventListener: (e, fn) => (modeSel.fn = fn) };
    const preview = { play: vi.fn(() => Promise.resolve()), pause: vi.fn(), srcObject: null };
    const boot = { firstChild: { nodeValue: '' }, innerHTML: '' };

    // pode existir window em jsdom; se não houver, usa objeto simples
    global.window = global.window || {};
    global.document = {
      getElementById: (id) =>
        ({
          'card-scanner': card,
          'btn-open-scanner': openBtn,
          'btn-scan-toggle': toggleBtn,
          'scan-mode': modeSel,
          preview,
          'boot-status': boot,
        })[id],
    };

    initScannerUI();

    // muda modo -> deve chamar switchTo('camera')
    const ctrl = await import('../src/utils/scannerController.js');
    modeSel.value = 'camera';
    modeSel.fn();
    expect(ctrl.switchTo).toHaveBeenCalledWith('camera');

    // toggle liga/desliga
    await toggleBtn.fn();
    expect(card.classList.contains('is-on')).toBe(true);
    await toggleBtn.fn();
    expect(card.classList.contains('is-on')).toBe(false);
  });
});
