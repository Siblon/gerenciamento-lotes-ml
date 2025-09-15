import { describe, it, expect, beforeEach } from 'vitest';
import store, { totalPendentesCount, selectAllItems } from '../src/store/index.js';

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

describe('selectAllItems', () => {
  it('merges arrays', () => {
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
