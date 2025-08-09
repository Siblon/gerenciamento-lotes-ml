import { describe, it, expect, beforeEach } from 'vitest';
import store, {
  init,
  selectRZ,
  conferir,
  progress,
  finalizeCurrent,
  save,
  registrarExcedente,
  registrarAjuste,
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
    init([
      { sku: 'A', rz: 'RZ1', qtd: 1, preco: 0, valorTotal: 0, descricao: '' },
      { sku: 'B', rz: 'RZ1', qtd: 1, preco: 0, valorTotal: 0, descricao: '' },
    ]);
    selectRZ('RZ1');
  });

  it('conferir incrementa conferido', () => {
    conferir('A');
    expect(progress()).toEqual({ done: 1, total: 2 });
  });

  it('código desconhecido vai para excedentes após registrar', () => {
    const r = conferir('X');
    expect(r.status).toBe('not-found');
    registrarExcedente({
      sku: 'X',
      descricao: 'Produto X',
      qtd: 1,
      precoUnit: 10,
      obs: '',
    });
    registrarAjuste({
      tipo: 'EXCEDENTE',
      codigo: 'X',
      precoOriginal: 0,
      precoAjustado: 10,
      qtd: 1,
      obs: '',
    });
    const res = finalizeCurrent();
    expect(res.excedentes).toMatchObject([
      { sku: 'X', rz: 'RZ1', descricao: 'Produto X', qtd: 1, precoMedio: 10, valorTotal: 10 },
    ]);
    expect(res.ajustes).toHaveLength(1);
  });

  it('salva estado no localStorage', () => {
    conferir('A');
    save();
    const saved = JSON.parse(localStorage.getItem('conferencia-state'));
    expect(saved.pallets.RZ1.conferido.A).toBe(1);
  });
});

