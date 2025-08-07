import { describe, it, expect, beforeEach } from 'vitest';
import store, { init, conferir, marcarFaltante, progress, save } from '../src/store/index.js';

describe('store de conferência', () => {
  beforeEach(() => {
    const storage = {};
    global.localStorage = {
      getItem: key => (key in storage ? storage[key] : null),
      setItem: (key, value) => { storage[key] = value; },
      removeItem: key => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
    };
    init(['A', 'B']);
  });

  it('conferir move código para conferidos', () => {
    conferir('A');
    expect(store.state.conferidos).toEqual(['A']);
    expect(progress()).toEqual({ done: 1, total: 2 });
  });

  it('código desconhecido vai para excedentes', () => {
    conferir('X');
    expect(store.state.excedentes).toEqual(['X']);
  });

  it('marcar faltante move código para faltantes', () => {
    marcarFaltante('B');
    expect(store.state.faltantes).toEqual(['B']);
  });

  it('salva estado no localStorage', () => {
    conferir('A');
    save();
    const saved = JSON.parse(localStorage.getItem('conferencia-state'));
    expect(saved.conferidos).toEqual(['A']);
  });
});
