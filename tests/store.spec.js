import { describe, it, expect } from 'vitest';
import store, { totalPendentesCount } from '../src/store/index.js';

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
