import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('../src/utils/ui.js', () => ({ renderCounts: vi.fn(), loadSettings: () => ({}), renderExcedentes: () => {} }));
import { initActionsPanel } from '../src/components/ActionsPanel.js';
import store from '../src/store/index.js';

let elements;
let input, btnCons, btnReg, obsSelect, preco, actions;

function createEl(tag = 'input') {
  const el = {
    tagName: tag.toUpperCase(),
    value: '',
    classList: { add: () => {}, remove: () => {} },
    focus() { document.activeElement = this; },
    select() {},
    addEventListener(type, fn) { (el._l ||= {})[type] = fn; },
    click() { el._l?.click?.({}); },
    dispatchEvent(ev) { el._l?.[ev.type]?.(ev); },
    setAttribute: () => {},
    removeAttribute: () => {},
  };
  return el;
}

beforeEach(() => {
  elements = {};
  elements['input-codigo-produto'] = createEl('input');
  elements['btn-consultar'] = createEl('button');
  elements['btn-registrar'] = createEl('button');
  elements['obs-preset'] = createEl('select');
  elements['preco-ajustado'] = createEl('input');
  elements['pi-sku'] = { textContent: '' };
  elements['pi-desc'] = { textContent: '' };
  elements['pi-qtd'] = { textContent: '' };
  elements['pi-preco'] = { textContent: '' };
  elements['pi-total'] = { textContent: '' };
  elements['pi-rz'] = { textContent: '' };
  elements['produto-info'] = { hidden: false };

  global.document = {
    body: { appendChild: () => {} },
    activeElement: null,
    getElementById: (id) => elements[id] || null,
    querySelector: (sel) => elements[sel.replace('#', '')] || null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: () => ({ className: '', setAttribute: () => {}, textContent: '', remove: () => {} }),
  };
  global.window = { refreshIndicators: () => {}, scrollTo: () => {} };

  store.state.currentRZ = 'R1';
  store.state.totalByRZSku = { R1: { ABC: 1 } };
  store.state.metaByRZSku = { R1: { ABC: { descricao: '', precoMedio: 10 } } };
  store.state.conferidosByRZSku = {};
  store.state.excedentes = {};

  actions = initActionsPanel(() => {});
  input = elements['input-codigo-produto'];
  btnCons = elements['btn-consultar'];
  btnReg = elements['btn-registrar'];
  obsSelect = elements['obs-preset'];
  preco = elements['preco-ajustado'];
});

afterEach(() => {});

describe('actions flow', () => {
  it('focus returns to code after register', () => {
    input.value = 'ABC';
    preco.value = '5';
    btnReg.click();
    expect(document.activeElement).toBe(input);
  });

  it('product not found registers without price', () => {
    input.value = 'ZZZ';
    preco.value = '';
    btnReg.click();
    const exc = store.state.excedentes['R1'][0];
    expect(exc.sku).toBe('ZZZ');
    expect(exc.preco_unit).toBeUndefined();
  });

  it('excedente registers without price', () => {
    input.value = 'YYY';
    obsSelect.value = 'excedente';
    preco.value = '';
    btnReg.click();
    const exc = store.state.excedentes['R1'][0];
    expect(exc.preco_unit).toBeUndefined();
  });

  it('Enter consults and Ctrl+Enter registers', () => {
    const consSpy = vi.spyOn(store, 'findInRZ');
    const regSpy = vi.spyOn(store, 'conferir');
    input.value = 'ABC';
    preco.value = '5';
    input.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault: () => {} });
    input.dispatchEvent({ type: 'keydown', key: 'Enter', ctrlKey: true, preventDefault: () => {} });
    expect(consSpy).toHaveBeenCalled();
    expect(regSpy).toHaveBeenCalled();
  });
});
