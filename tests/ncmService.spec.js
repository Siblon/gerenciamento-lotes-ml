import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeNCM, resolve, __reset, cacheGet, cacheSet } from '../src/services/ncmService.js';

beforeEach(() => {
  __reset();
});

describe('normalizeNCM', () => {
  it('ensures 8 digits', () => {
    expect(normalizeNCM('12.345.678')).toBe('12345678');
    expect(normalizeNCM('abc')).toBeNull();
  });
});

describe('ncm resolution flow', () => {
  it('uses cache after first resolution', async () => {
    localStorage.clear();
    global.fetch = vi.fn(url => {
      if(String(url).includes('/data/ncm.json')) return Promise.resolve({ ok:true, json:async()=>({}) });
      return Promise.resolve({ ok:true, json:async()=>({ codigo:'12345678', descricao:'Produto X teste' }) });
    });
    const r1 = await resolve('produto x');
    expect(r1).toMatchObject({ ncm:'12345678', source:'api', status:'ok' });
    const r2 = await resolve('produto x');
    expect(r2).toMatchObject({ ncm:'12345678', source:'cache', status:'ok' });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('resolves using local map', async () => {
    localStorage.clear();
    global.fetch = vi.fn((url)=> {
      if(String(url).includes('/data/ncm.json')) return Promise.resolve({ ok:true, json:async()=>({ 'sku1':'87654321' }) });
      return Promise.resolve({ ok:false, status:404 });
    });
    const r = await resolve({ sku:'sku1', descricao:'desc' });
    expect(r).toMatchObject({ ncm:'87654321', source:'map', status:'ok' });
  });

  it('resolves via API', async () => {
    localStorage.clear();
    global.fetch = vi.fn(url => {
      if(String(url).includes('/data/ncm.json')) return Promise.resolve({ ok:true, json:async()=>({}) });
      return Promise.resolve({ ok:true, json:async()=>({ codigo:'11112222', descricao:'qualquer prod item' }) });
    });
    const r = await resolve('qualquer prod');
    expect(r).toMatchObject({ ncm:'11112222', source:'api', status:'ok' });
  });

  it('handles api 5xx failure', async () => {
    localStorage.clear();
    global.fetch = vi.fn(url => {
      if(String(url).includes('/data/ncm.json')) return Promise.resolve({ ok:true, json:async()=>({}) });
      return Promise.resolve({ ok:false, status:500 });
    });
    const r = await resolve('foo');
    expect(r).toMatchObject({ ncm:null, source:'api', status:'falha' });
  });

  it('handles api timeout', async () => {
    localStorage.clear();
    vi.useFakeTimers();
    global.fetch = vi.fn((url, opts) => {
      if(String(url).includes('/data/ncm.json')) return Promise.resolve({ ok:true, json:async()=>({}) });
      return new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    const p = resolve('bar');
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r).toMatchObject({ ncm:null, source:'api', status:'falha' });
    vi.useRealTimers();
  });

  it('deduplicates concurrent terms', async () => {
    localStorage.clear();
    const apiResp = { codigo:'22223333', descricao:'Produto y teste' };
    global.fetch = vi.fn(url => {
      if(String(url).includes('/data/ncm.json')) return Promise.resolve({ ok:true, json:async()=>({}) });
      return new Promise(res => setTimeout(()=>res({ ok:true, json:async()=>apiResp }), 10));
    });
    const p1 = resolve('produto y');
    const p2 = resolve('produto y');
    const [r1,r2] = await Promise.all([p1,p2]);
    expect(r1).toMatchObject({ ncm:'22223333', source:'api', status:'ok' });
    expect(r2).toEqual(r1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('cache error handling', () => {
  it('logs and returns null on cacheGet failure', () => {
    localStorage.clear();
    const err = new Error('fail get');
    const warn = vi.spyOn(console, 'warn').mockImplementation(()=>{});
    const origGet = localStorage.getItem;
    localStorage.getItem = () => { throw err; };
    const r = cacheGet('foo');
    expect(r).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ key:'foo', err }));
    warn.mockRestore();
    localStorage.getItem = origGet;
  });

  it('logs and keeps memory on cacheSet failure', () => {
    localStorage.clear();
    const err = new Error('fail set');
    const warn = vi.spyOn(console, 'warn').mockImplementation(()=>{});
    const origSet = localStorage.setItem;
    localStorage.setItem = () => { throw err; };
    cacheSet('foo', { ncm:'123' });
    expect(warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ key:'foo', err }));
    warn.mockRestore();
    localStorage.setItem = origSet;
    const v = cacheGet('foo');
    expect(v).toEqual({ ncm:'123' });
  });
});

