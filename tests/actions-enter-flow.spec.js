import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('../src/utils/ui.js', () => ({ renderCounts: vi.fn(), loadSettings: () => ({}), renderExcedentes: () => {} }));
import { initActionsPanel } from '../src/components/ActionsPanel.js';
import store from '../src/store/index.js';

let input, actions, elements;

describe('enter flow', () => {
  beforeEach(() => {
    elements = {};
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
    // stubs for product info elements
    elements['pi-sku'] = { textContent: '' };
    elements['pi-desc'] = { textContent: '' };
    elements['pi-qtd'] = { textContent: '' };
    elements['pi-preco'] = { textContent: '' };
    elements['pi-total'] = { textContent: '' };
    elements['pi-rz'] = { textContent: '' };
    elements['pi-ncm'] = { textContent: '' };
    elements['produto-info'] = { hidden: false };

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
    actions = initActionsPanel(() => {});
    input = elements['input-codigo-produto'];
  });


  it('Enter on code field triggers Consultar', () => {
    const spy = vi.spyOn(store, 'findInRZ').mockReturnValue(null);
    input.value = 'AAA';
    input.dispatchEvent({ type:'keydown', key:'Enter', preventDefault: () => {} });
    expect(spy).toHaveBeenCalled();
  });

  it('Ctrl+Enter triggers Registrar', () => {
    store.findInRZ = () => ({ qtd:1, precoMedio:10 });
    const spy = vi.spyOn(store, 'conferir').mockImplementation(() => {});
    input.value = 'AAA';
    elements['preco-ajustado'].value = '1';
    input.dispatchEvent({ type:'keydown', key:'Enter', ctrlKey:true, preventDefault: () => {} });
    expect(spy).toHaveBeenCalled();
  });

  it('Second Enter after consulta triggers Registrar', () => {
    store.findInRZ = () => ({ qtd:1, precoMedio:10 });
    const spy = vi.spyOn(store, 'conferir').mockImplementation(() => {});
    input.value = 'AAA';
    elements['preco-ajustado'].value = '1';
    // Primeiro Enter consulta
    input.dispatchEvent({ type:'keydown', key:'Enter', preventDefault: () => {} });
    // Segundo Enter registra
    input.dispatchEvent({ type:'keydown', key:'Enter', preventDefault: () => {} });
    expect(spy).toHaveBeenCalled();
  });
});
