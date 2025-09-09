import { describe, it, expect } from 'vitest';
import store from '../src/store/index.js';

describe('consulta por código no RZ atual', () => {
  it('encontra item pelo código dentro do RZ', () => {
    store.reset();
    store.setCurrentRZ('RZ-ABC');
    store.bulkUpsertItems([{ id:'1', codigo:'XYZ', rz:'RZ-ABC' }]);
    const found = store.state.items.find(it => it.codigo === 'XYZ' && it.rz === 'RZ-ABC');
    expect(found?.id).toBe('1');
  });
});
