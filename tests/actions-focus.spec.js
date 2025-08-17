import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initActionsPanel } from '../src/components/ActionsPanel.js';
import { initImportPanel } from '../src/components/ImportPanel.js';
import store from '../src/store/index.js';

let elements, actions, input, rzSelect;

  function createEl(tag = 'input') {
    const el = {
      tagName: tag.toUpperCase(),
      value: '',
      classList: { add: () => {}, remove: () => {} },
      focus() { document.activeElement = this; },
      select() { this._selected = true; },
      addEventListener(type, fn) { (el._l ||= {})[type] = fn; },
      click() { el._l?.click?.({}); },
      dispatchEvent(ev) { el._l?.[ev.type]?.(ev); if(ev.bubbles) document.dispatchEvent(ev); },
      setAttribute: () => {},
      removeAttribute: () => {},
    };
    return el;
  }

describe('focus management', () => {
    beforeEach(() => {
      elements = {};
      elements['input-codigo-produto'] = createEl('input');
    elements['btn-consultar'] = createEl('button');
    elements['btn-registrar'] = createEl('button');
    elements['obs-preset'] = createEl('select');
    elements['preco-ajustado'] = createEl('input');
    elements['select-rz'] = createEl('select');
    elements['pi-sku'] = { textContent: '' };
    elements['pi-desc'] = { textContent: '' };
    elements['pi-qtd'] = { textContent: '' };
    elements['pi-preco'] = { textContent: '' };
    elements['pi-total'] = { textContent: '' };
    elements['pi-rz'] = { textContent: '' };
    elements['pi-ncm'] = { textContent: '' };
    elements['produto-info'] = { hidden: false };

      const docListeners = {};
      global.document = {
        body: { appendChild: () => {} },
        activeElement: null,
        getElementById: (id) => elements[id] || null,
        querySelector: (sel) => elements[sel.replace('#', '')] || null,
        querySelectorAll: () => [],
        addEventListener: (type, fn) => { (docListeners[type] ||= []).push(fn); },
        dispatchEvent: (ev) => { (docListeners[ev.type] || []).forEach(fn => fn(ev)); },
        createElement: () => ({ className: '', setAttribute: () => {}, textContent: '', remove: () => {} }),
      };
    global.window = { refreshIndicators: () => {}, scrollTo: () => {} };
    global.localStorage = { _s:{}, getItem(k){return this._s[k]||null;}, setItem(k,v){this._s[k]=String(v);}, removeItem(k){delete this._s[k];}, clear(){this._s={};} };

    store.state.rzAtual = 'R1';
    store.state.excedentes = {};

    actions = initActionsPanel(() => {});
    initImportPanel(() => {});
    input = elements['input-codigo-produto'];
    rzSelect = elements['select-rz'];
  });

    it('emits rz:changed after RZ change', () => {
      let fired = false;
      document.addEventListener('rz:changed', () => { fired = true; });
      rzSelect.value = 'R2';
      rzSelect.dispatchEvent({ type:'change', target: rzSelect, bubbles:true });
      expect(fired).toBe(true);
    });

  it('returns focus and selection after handleRegistrar', async () => {
    store.findInRZ = () => ({ qtd:1, precoMedio:10 });
    store.conferir = vi.fn();
    input.value = 'ABC';
    elements['preco-ajustado'].value = '5';
    await actions.handleRegistrar();
    expect(document.activeElement).toBe(input);
    expect(input._selected).toBe(true);
  });

  it('keyboard shortcuts trigger handlers', () => {
    const consSpy = vi.spyOn(store, 'findInRZ').mockReturnValue({ qtd:1, precoMedio:10 });
    const regSpy = vi.spyOn(store, 'conferir').mockImplementation(() => {});
    input.value = 'AAA';
    elements['preco-ajustado'].value = '1';
    input.dispatchEvent({ type:'keydown', key:'Enter', preventDefault: () => {} });
    input.dispatchEvent({ type:'keydown', key:'Enter', ctrlKey:true, preventDefault: () => {} });
    expect(consSpy).toHaveBeenCalled();
    expect(regSpy).toHaveBeenCalled();
  });
});
