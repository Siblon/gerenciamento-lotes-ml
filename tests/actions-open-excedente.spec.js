import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initActionsPanel } from '../src/components/ActionsPanel.js';
import store from '../src/store/index.js';

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

describe('consultar opens excedente when SKU missing', () => {
  let elements, input, btnCons, dlg, excSku;

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
    elements['pi-ncm'] = { textContent: '' };
    elements['produto-info'] = { hidden: false };

    dlg = { open: false, dataset: {}, showModal: vi.fn(function(){ this.open = true; }), close: () => {} };
    elements['dlg-excedente'] = dlg;
    excSku = createEl('input');
    elements['exc-sku'] = excSku;
    elements['exc-desc'] = createEl('input');
    elements['exc-qtd'] = createEl('input');
    elements['exc-preco'] = createEl('input');
    elements['exc-obs'] = createEl('input');

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
    global.localStorage = { _s:{}, getItem(k){return this._s[k]||null;}, setItem(k,v){this._s[k]=String(v);}, removeItem(k){delete this._s[k];}, clear(){this._s={};} };

    store.state.rzAtual = 'R1';
    store.state.totalByRZSku = {};
    store.state.metaByRZSku = {};
    store.state.conferidosByRZSku = {};
    store.state.excedentes = {};

    initActionsPanel(() => {});
    input = elements['input-codigo-produto'];
    btnCons = elements['btn-consultar'];
  });

  it('prefills SKU and shows modal when item not found', () => {
    input.value = 'NAOEXISTE';
    btnCons.click();
    expect(excSku.value).toBe('NAOEXISTE');
    expect(dlg.showModal).toHaveBeenCalled();
  });
});

