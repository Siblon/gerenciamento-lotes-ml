import { describe, it, expect, beforeEach } from 'vitest';
import store, {
  init,
  selectRZ,
  conferir,
  progress,
  finalizeCurrent,
  save,
  registrarExcedente,
} from '../src/store/index.js';

describe('store de conferência com RZ', () => {
  beforeEach(() => {
    const storage = {};
    global.localStorage = {
      getItem: key => (key in storage ? storage[key] : null),
      setItem: (key, value) => { storage[key] = value; },
      removeItem: key => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
    };
    init({ RZ1: { A: 1, B: 1 } }, { A: { descricao: '', preco: 0 }, B: { descricao: '', preco: 0 } });
    selectRZ('RZ1');
  });

  it('conferir incrementa conferido', () => {
    conferir('A');
    expect(progress()).toEqual({ done: 1, total: 2 });
  });

  it('código desconhecido vai para excedentes após registrar', () => {
    const r = conferir('X');
    expect(r.status).toBe('not-found');
    registrarExcedente('X');
    const res = finalizeCurrent();
    expect(res.excedentes).toEqual([{ codigo: 'X', quantidade: 1 }]);
  });

  it('salva estado no localStorage', () => {
    conferir('A');
    save();
    const saved = JSON.parse(localStorage.getItem('conferencia-state'));
    expect(saved.pallets.RZ1.conferido.A).toBe(1);
  });
});

