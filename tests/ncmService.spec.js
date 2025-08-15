import { describe, it, expect, vi } from 'vitest';
import { normalizeNCM, createQueue, resolveWithRetry, resolve } from '../src/services/ncmService.js';

describe('normalizeNCM', () => {
  it('ensures 8 digits', () => {
    expect(normalizeNCM('12.345.678')).toBe('12345678');
    expect(normalizeNCM('abc')).toBeNull();
  });
});

describe('cache and resolve', () => {
  it('uses cache after first resolution', async () => {
    localStorage.clear();
    const r1 = await resolve({ sku:'A', ncmPlanilha:'12345678' });
    expect(r1).toMatchObject({ ok:true, ncm:'12345678', source:'row' });
    const r2 = await resolve({ sku:'A' });
    expect(r2).toMatchObject({ ok:true, ncm:'12345678', source:'cache' });
  });

  it('resolves using local map', async () => {
    localStorage.clear();
    global.fetch = vi.fn((url)=> {
      if(String(url).includes('/data/ncm.json')) return Promise.resolve({ ok:true, json:async()=>({ 'B': '87654321' }) });
      return Promise.resolve({ ok:false, status:404 });
    });
    const r = await resolve({ sku:'B', descricao:'desc B' });
    expect(r).toMatchObject({ ok:true, ncm:'87654321', source:'map' });
  });
});

describe('createQueue', () => {
  it('limits concurrency', async () => {
    const enqueue = createQueue(2);
    let active = 0, max = 0;
    const task = (ms) => enqueue(()=> new Promise(res => { active++; max=Math.max(max,active); setTimeout(()=>{ active--; res(); }, ms); }));
    await Promise.all([task(20), task(20), task(20)]);
    expect(max).toBeLessThanOrEqual(2);
  });
});

describe('resolveWithRetry', () => {
  it('retries failing function', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('ok');
    const res = await resolveWithRetry(fn,3,10);
    expect(res).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('resolve error cases', () => {
  it('handles http error', async () => {
    localStorage.clear();
    global.fetch = vi.fn((url)=> {
      if(String(url).includes('/data/ncm.json')) return Promise.resolve({ ok:true, json:async()=>({}) });
      return Promise.resolve({ ok:false, status:403 });
    });
    const r = await resolve({ sku:'X', descricao:'x' });
    expect(r).toMatchObject({ ok:false, error:true, source:'api' });
  });

  it('handles api without ncm', async () => {
    localStorage.clear();
    global.fetch = vi.fn((url)=> {
      if(String(url).includes('/data/ncm.json')) return Promise.resolve({ ok:true, json:async()=>({}) });
      return Promise.resolve({ ok:true, json:async()=>[] });
    });
    const r = await resolve({ sku:'Y', descricao:'y' });
    expect(r).toMatchObject({ ok:false, error:true, source:'api' });
  });

  it('handles api timeout', async () => {
    localStorage.clear();
    vi.useFakeTimers();
    global.fetch = vi.fn((url, opts)=> {
      if(String(url).includes('/data/ncm.json')) return Promise.resolve({ ok:true, json:async()=>({}) });
      return new Promise((_, reject)=>{
        opts.signal.addEventListener('abort', ()=>reject(new Error('aborted')));
      });
    });
    const p = resolve({ sku:'Z', descricao:'zzz' });
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r).toMatchObject({ ok:false, error:true, source:'api' });
    vi.useRealTimers();
  });
});
