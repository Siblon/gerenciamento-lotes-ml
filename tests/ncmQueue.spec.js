import { describe, it, expect, beforeEach, vi } from 'vitest';
import store from '../src/store/index.js';
vi.mock('../src/services/ncmApi.js', () => ({ resolveNcmByDescription: vi.fn() }));
import { resolveNcmByDescription } from '../src/services/ncmApi.js';
import { startNcmQueue } from '../src/services/ncmQueue.js';

beforeEach(() => {
  resolveNcmByDescription.mockReset();
  store.state.metaByRZSku = {};
  store.state.itemsByRZ = {};
  store.state.ncmState = { running:false, done:0, total:0 };
});

describe('ncmQueue', () => {
  it('limits concurrency to 3', async () => {
    let active = 0, max = 0;
    resolveNcmByDescription.mockImplementation(async () => {
      active++;
      max = Math.max(max, active);
      await new Promise(res => setTimeout(() => { active--; res({ ncm:'1', status:'ok' }); }, 10));
      return { ncm:'1', status:'ok' };
    });
    const items = Array.from({ length: 6 }, (_, i) => ({ codigoRZ:'RZ', codigoML:`S${i}`, descricao:'', ncm:null }));
    await startNcmQueue(items);
    expect(max).toBeLessThanOrEqual(3);
  });

  it('does not block synchronous code', async () => {
    resolveNcmByDescription.mockImplementation(() => new Promise(res => setTimeout(() => res({ ncm:'1', status:'ok' }), 10)));
    const items = [{ codigoRZ:'RZ', codigoML:'A', descricao:'', ncm:null }];
    let flag = false;
    const p = startNcmQueue(items);
    flag = true;
    expect(flag).toBe(true);
    await p;
  });

  it('skips items without identifiers', async () => {
    resolveNcmByDescription.mockResolvedValue({ ncm:'1', status:'ok' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const items = [
      { codigoRZ:'RZ', codigoML:'A', descricao:'', ncm:null },
      { codigoRZ:'', codigoML:'B', descricao:'', ncm:null },
      { codigoRZ:'RZ', codigoML:'', descricao:'', ncm:null },
    ];
    await startNcmQueue(items);
    expect(resolveNcmByDescription).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
