import { describe, it, expect, beforeEach } from 'vitest';
import store, { setDescarte, selectDescartes } from '../src/store/index.js';

beforeEach(() => {
  store.state.conferidosByRZSku = {};
  store.state.metaByRZSku = {};
});

describe('descartes', () => {
  it('limits quantity and exports list', () => {
    const id = 'RZ1:SKU1';
    store.state.conferidosByRZSku['RZ1'] = { SKU1: { qtd: 5 } };
    setDescarte(id, 10, 'muito');
    expect(store.state.conferidosByRZSku['RZ1'].SKU1.qtd_descarte).toBe(5);
    setDescarte(id, 3, 'ok');
    const list = selectDescartes();
    expect(list).toEqual([
      { rz: 'RZ1', sku: 'SKU1', descricao: '', qtd_descartada: 3, obs: 'ok' }
    ]);
  });
});
