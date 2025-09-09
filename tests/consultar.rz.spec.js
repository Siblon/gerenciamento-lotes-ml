import { describe, it, expect } from 'vitest';
import store from '../src/store/index.js';

describe('consultar com RZ', () => {
  it('marca item como ok após duas consultas', () => {
    store.reset();
    store.bulkUpsertItems([{ id: '1', codigo: 'ABC', rz: 'RZ-1', qtd: 2 }]);
    store.setCurrentRZ('RZ-1');
    function consultar(code) {
      const it = store.state.items.find(
        (i) => i.rz === store.state.currentRZ && (i.codigo === code || i.sku === code || i.mlCode === code),
      );
      if (it) {
        const qtd = (it.qtdConferida || 0) + 1;
        const status = qtd >= (it.qtd || 0) ? 'ok' : 'partial';
        store.updateItem(it.id, { qtdConferida: qtd, status });
      } else {
        store.addExcedente(store.state.currentRZ, { sku: code, descricao: '', qtd: 1 });
      }
      store.emit('refresh');
    }
    consultar('ABC');
    consultar('ABC');
    const item = store.state.items[0];
    expect(item.status).toBe('ok');
  });

  it('cria excedente no RZ atual quando código não existe', () => {
    store.reset();
    store.setCurrentRZ('RZ-1');
    function consultar(code) {
      const it = store.state.items.find(
        (i) => i.rz === store.state.currentRZ && (i.codigo === code || i.sku === code || i.mlCode === code),
      );
      if (it) {
        store.updateItem(it.id, { qtdConferida: (it.qtdConferida || 0) + 1 });
      } else {
        store.addExcedente(store.state.currentRZ, { sku: code, descricao: '', qtd: 1 });
      }
      store.emit('refresh');
    }
    consultar('XYZ');
    const exc = store.state.excedentes['RZ-1']?.[0];
    expect(exc?.sku).toBe('XYZ');
  });
});

