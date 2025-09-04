import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../src/utils/ui.js', () => ({ renderCounts: vi.fn(), loadSettings: () => ({}), renderExcedentes: () => {} }));
import { initActionsPanel } from '../src/components/ActionsPanel.js';
import store from '../src/store/index.js';

describe('actions excedente', () => {
  let input, btnReg, obsSelect, preco;

  beforeEach(() => {
    const elements = {};
    function createEl(tag='input') {
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
    elements['input-codigo-produto'] = createEl('input');
    elements['btn-consultar'] = createEl('button');
    elements['btn-registrar'] = createEl('button');
    elements['obs-preset'] = createEl('select');
    elements['preco-ajustado'] = createEl('input');

    global.document = {
      body: { appendChild: () => {} },
      activeElement: null,
      getElementById: (id) => elements[id] || null,
      querySelector: (sel) => elements[sel.replace('#','')] || null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      createElement: () => ({ className:'', setAttribute:()=>{}, textContent:'', remove:()=>{} }),
    };
    global.window = { refreshIndicators: () => {}, scrollTo: () => {} };
    global.localStorage = { _s:{}, getItem(k){return this._s[k]||null;}, setItem(k,v){this._s[k]=String(v);}, removeItem(k){delete this._s[k];}, clear(){this._s={};} };
    store.state.rzAtual = 'R1';
    store.state.excedentes = {};
    initActionsPanel(() => {});
    input = elements['input-codigo-produto'];
    btnReg = elements['btn-registrar'];
    obsSelect = elements['obs-preset'];
    preco = elements['preco-ajustado'];
  });

  it('registers excedente without price', () => {
    input.value = 'ABC';
    obsSelect.value = 'excedente';
    preco.value = '';
    btnReg.click();
    const exc = store.state.excedentes['R1'][0];
    expect(exc.preco_unit).toBeUndefined();
    expect(obsSelect.value).toBe('');
    expect(preco.value).toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('registers excedente with price', () => {
    input.value = 'XYZ';
    obsSelect.value = 'excedente';
    preco.value = '10';
    btnReg.click();
    const exc = store.state.excedentes['R1'][0];
    expect(exc.preco_unit).toBe(10);
  });
});
