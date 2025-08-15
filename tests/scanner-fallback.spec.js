import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    static async listVideoInputDevices() { return []; }
    async decodeFromVideoDevice() { throw new Error('fail'); }
    reset() { /* no-op */ }
  }
}));

vi.mock('@zxing/library', () => ({
  BarcodeFormat: { EAN_13: 'ean_13' },
  DecodeHintType: { POSSIBLE_FORMATS: 'POSSIBLE_FORMATS' }
}));

import { toast } from '../src/utils/toast.js';

let iniciarLeitura;
let warnSpy;

beforeEach(async () => {
  warnSpy = vi.spyOn(toast, 'warn').mockImplementation(() => {});
  const mod = await import('../src/utils/scan.js');
  iniciarLeitura = mod.iniciarLeitura;
});

describe.skip('scanner fallback', () => {
  it('falls back to wedge on camera error', async () => {
    const video = {};
    await expect(iniciarLeitura(video, () => {})).rejects.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });
});
