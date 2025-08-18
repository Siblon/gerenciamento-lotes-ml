import { describe, it, expect, beforeEach } from 'vitest';
import store, { totalPendentesCount, setItemNcm, setItemNcmStatus, selectAllItems } from '../src/store/index.js';
import { NCM_CACHE_KEY } from '../src/config/runtime.js';

describe('store state structure', () => {
  it('has basic keys', () => {
    expect(store.state).toMatchObject({
      rzList: [],
      itemsByRZ: {},
      totalByRZSku: {},
      conferidosByRZSku: {},
      currentRZ: null,
    });
  });
});

describe('totalPendentesCount', () => {
  it('counts remaining SKUs', () => {
    const rz = 'RZ_TEST';
    store.state.totalByRZSku[rz] = { A: 3, B: 2 };
    store.state.conferidosByRZSku[rz] = { A: { precoAjustado: null, observacao: null } };
    expect(totalPendentesCount(rz)).toBe(1);
    delete store.state.totalByRZSku[rz];
    delete store.state.conferidosByRZSku[rz];
  });
});

describe('NCM helpers', () => {
  beforeEach(() => {
    store.state.metaByRZSku = {};
    store.state.itemsByRZ = {};
    localStorage.clear();
  });

  it('setItemNcm saves data and cache', () => {
    const id = 'RZ1:SKU1';
    store.state.metaByRZSku['RZ1'] = { SKU1: { descricao: 'x' } };
    store.state.itemsByRZ['RZ1'] = [{ codigoML: 'SKU1' }];
    setItemNcm(id, '12345678', 'api');
    expect(store.state.metaByRZSku['RZ1'].SKU1).toMatchObject({ ncm: '12345678', ncm_source: 'api', ncm_status: 'ok', ncmMeta: { source:'api', status:'ok' } });
    expect(store.state.itemsByRZ['RZ1'][0]).toMatchObject({ ncm: '12345678', ncmMeta: { source:'api', status:'ok' } });
      const cache = JSON.parse(localStorage.getItem(NCM_CACHE_KEY));
    expect(cache).toHaveProperty('SKU1', '12345678');
  });

  it('setItemNcmStatus updates status', () => {
    const id = 'RZ1:SKU1';
    store.state.metaByRZSku['RZ1'] = { SKU1: { descricao:'x' } };
    store.state.itemsByRZ['RZ1'] = [{ codigoML:'SKU1' }];
    setItemNcmStatus(id, 'pendente');
    expect(store.state.metaByRZSku['RZ1'].SKU1.ncm_status).toBe('pendente');
    expect(store.state.itemsByRZ['RZ1'][0].ncmMeta.status).toBe('pendente');
  });

  it('selectAllItems merges arrays', () => {
    store.state.currentRZ = 'RZ1';
    store.state.totalByRZSku['RZ1'] = { SKU1: 1, SKU2: 2 };
    store.state.metaByRZSku['RZ1'] = { SKU1:{ descricao:'x' }, SKU2: { descricao: 'y' } };
    store.state.excedentes['RZ1'] = [{ sku: 'EX1', descricao: 'z', qtd: 1 }];
    const all = selectAllItems();
    const ids = all.map(it => it.id);
    expect(ids).toContain('RZ1:SKU1');
    expect(ids).toContain('RZ1:SKU2');
    expect(ids).toContain('RZ1:EX1');
  });
});
