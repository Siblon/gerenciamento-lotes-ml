import { describe, it, expect } from 'vitest';
import store from '../src/store/index.js';

describe('consultar incrementa conferência', () => {
  it('marca item como ok quando atingir quantidade', () => {
    store.reset?.();
    store.bulkUpsertItems([{ id: '1', codigo: 'ABC', rz: 'RZ-1', qtd: 2 }]);
    store.setCurrentRZ('RZ-1');
    let refresh = 0;
    store.on('refresh', () => refresh++);

    function consultar(code) {
      const it = store.state.items.find(i => (i.codigo === code || i.sku === code) && i.rz === store.state.currentRZ);
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

