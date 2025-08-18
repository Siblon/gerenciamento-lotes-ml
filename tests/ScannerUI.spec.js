import { describe, it, expect, vi } from 'vitest';

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

describe('ScannerUI component', () => {
  it('handles mode change and toggle', async () => {
    const card = { classList: classList() };
    const openBtn = { addEventListener: () => {} };
    const toggleBtn = { textContent: '', addEventListener: (e, fn) => (toggleBtn.fn = fn) };
    const modeSel = { value: 'wedge', addEventListener: (e, fn) => (modeSel.fn = fn) };
    const preview = { play: vi.fn(() => Promise.resolve()), pause: vi.fn(), srcObject: null };
    const boot = { firstChild: { nodeValue: '' }, innerHTML: '' };

    global.window = {};
    global.document = {
      getElementById: (id) => ({
        'card-scanner': card,
        'btn-open-scanner': openBtn,
        'btn-scan-toggle': toggleBtn,
        'scan-mode': modeSel,
        preview,
        'boot-status': boot,
      })[id],
    };
    global.navigator = {
      mediaDevices: {
        getUserMedia: vi.fn(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] })),
      },
    };

    initScannerUI();
    const ctrl = await import('../src/utils/scannerController.js');
    modeSel.value = 'camera';
    modeSel.fn();
    expect(ctrl.switchTo).toHaveBeenCalledWith('camera');

    await toggleBtn.fn();
    expect(card.classList.contains('is-on')).toBe(true);
    await toggleBtn.fn();
    expect(card.classList.contains('is-on')).toBe(false);
  });
});
