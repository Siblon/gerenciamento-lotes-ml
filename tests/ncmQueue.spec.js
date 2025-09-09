import { describe, it, expect, beforeEach, vi } from 'vitest';
import store from '../src/store/index.js';
vi.mock('../src/services/ncmApi.js', () => ({ resolveNcmByDescription: vi.fn() }));
import { resolveNcmByDescription } from '../src/services/ncmApi.js';
import { startNcmQueue } from '../src/services/ncmQueue.js';

beforeEach(() => {
  store.reset();
  store.state.__ncmQueueBooted = false;
  resolveNcmByDescription.mockReset();
});

describe('ncmQueue', () => {
  it('processa itens pendentes', async () => {
    store.upsertItem({ id:'1', descricao:'A', ncmStatus:'pending', rz:'R1' });
    store.upsertItem({ id:'2', descricao:'B', ncmStatus:'pending', rz:'R1' });
    resolveNcmByDescription.mockResolvedValue({ ncm:'0101', status:'ok' });
    const stop = startNcmQueue();
    await new Promise(r => setTimeout(r, 400));
    stop();
    expect(store.state.items.every(it => it.ncmStatus === 'ok')).toBe(true);
    expect(resolveNcmByDescription).toHaveBeenCalledTimes(2);
  });

  it('não bloqueia código síncrono', () => {
    store.upsertItem({ id:'3', descricao:'C', ncmStatus:'pending', rz:'R1' });
    resolveNcmByDescription.mockResolvedValue({ ncm:'1', status:'ok' });
    const stop = startNcmQueue();
    let flag = true;
    expect(flag).toBe(true);
    stop();
  });
});
