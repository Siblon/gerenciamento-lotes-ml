import { describe, it, expect } from 'vitest';
import store from '../src/store/index.js';

describe('consultar', () => {
  it('encontra item pelo código dentro do RZ', () => {
    store.reset();
    store.setCurrentRZ('RZ-ABC');
    store.bulkUpsertItems([{ id: '1', codigo: 'XYZ', rz: 'RZ-ABC' }]);
    const found = store.state.items.find(
      (it) => it.codigo === 'XYZ' && it.rz === 'RZ-ABC',
    );
    expect(found?.id).toBe('1');
  });

  it('marca item como ok quando atingir quantidade', () => {
    store.reset();
    store.bulkUpsertItems([{ id: '1', codigo: 'ABC', rz: 'RZ-1', qtd: 2 }]);
    store.setCurrentRZ('RZ-1');
    let refresh = 0;
    store.on('refresh', () => refresh++);

    function consultar(code) {
      const it = store.state.items.find(
        (i) => (i.codigo === code || i.sku === code) && i.rz === store.state.currentRZ,
      );
      if (it) {
        const qtd = (it.qtdConferida || 0) + 1;
        const status = qtd >= (it.qtd || 0) ? 'ok' : 'partial';
        store.updateItem(it.id, { qtdConferida: qtd, status });
      }
    }

    consultar('ABC');
    consultar('ABC');

    const item = store.state.items[0];
    expect(item.qtdConferida).toBe(2);
    expect(item.status).toBe('ok');
    expect(refresh).toBeGreaterThanOrEqual(2);
  });
});

