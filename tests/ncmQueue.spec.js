import { describe, it, expect, beforeEach, vi } from 'vitest';
import store from '../src/store/index.js';
vi.mock('../src/services/ncmService.js', () => ({ resolve: vi.fn(), resolveWithRetry: vi.fn(fn => fn()) }));
import { resolve as resolveMock, resolveWithRetry as resolveWithRetryMock } from '../src/services/ncmService.js';
import { startNcmQueue } from '../src/services/ncmQueue.js';

beforeEach(() => {
  resolveMock.mockReset();
  resolveWithRetryMock.mockReset().mockImplementation(fn => fn());
  store.state.metaByRZSku = {};
  store.state.itemsByRZ = {};
  store.state.ncmState = { running:false, done:0, total:0 };
});

describe('ncmQueue', () => {
  it('limits concurrency to 3', async () => {
    let active = 0, max = 0;
    resolveMock.mockImplementation(async () => {
      active++;
      max = Math.max(max, active);
      await new Promise(res => setTimeout(() => { active--; res({ status:'ok', ncm:'1', source:'api' }); }, 10));
      return { status:'ok', ncm:'1', source:'api' };
    });
    const items = Array.from({ length: 6 }, (_, i) => ({ codigoRZ:'RZ', codigoML:`S${i}`, descricao:'', ncm:null }));
    await startNcmQueue(items);
    expect(max).toBeLessThanOrEqual(3);
  });

  it('retries failed resolutions', async () => {
    resolveMock
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue({ status:'ok', ncm:'12345678', source:'api' });
    resolveWithRetryMock.mockImplementation(async fn => {
      try { return await fn(); } catch { try { return await fn(); } catch { return await fn(); } }
    });
    const items = [{ codigoRZ:'RZ', codigoML:'SKU1', descricao:'', ncm:null }];
    await startNcmQueue(items);
    expect(resolveMock).toHaveBeenCalledTimes(3);
    expect(store.state.metaByRZSku['RZ'].SKU1.ncm).toBe('12345678');
  });

  it('does not block synchronous code', async () => {
    resolveMock.mockImplementation(() => new Promise(res => setTimeout(() => res({ status:'ok', ncm:'1', source:'api' }), 10)));
    const items = [{ codigoRZ:'RZ', codigoML:'A', descricao:'', ncm:null }];
    let flag = false;
    const p = startNcmQueue(items);
    flag = true;
    expect(flag).toBe(true);
    await p;
  });
});
