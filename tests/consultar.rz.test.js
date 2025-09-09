import { describe, it, expect } from 'vitest';
import store from '../src/store/index.js';

// garante que buscar por código no RZ atual marca item como conferido

describe('consulta e conferência por código', () => {
  it('encontra item no RZ e incrementa conferido', () => {
    store.reset();
    store.setCurrentRZ('RZ1');
    store.upsertItem({ id:'1', codigo:'ABC', rz:'RZ1', qtd:1, qtdConferida:0, status:'pending' });

    const it = store.state.items.find(i => i.codigo === 'ABC' && i.rz === 'RZ1');
    expect(it).toBeTruthy();

    const qtd = Number(it.qtdConferida || 0) + 1;
    const alvo = Number(it.qtd) || 1;
    const done = qtd >= alvo;
    store.updateItem(it.id, { qtdConferida:qtd, status: done ? 'ok' : 'parcial' });

    const stored = store.state.items.find(i => i.id === '1');
    expect(stored.qtdConferida).toBe(1);
    expect(stored.status).toBe('ok');
  });
});
