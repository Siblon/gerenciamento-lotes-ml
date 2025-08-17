import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initActionsPanel } from '../src/components/ActionsPanel.js';
import store from '../src/store/index.js';

describe('ActionsPanel behaviors', () => {
  let input, btnCons, btnReg, obsSelect;

  beforeEach(() => {
    const listeners = {};
    const elements = {};
    function createEl(tag='input') {
      const el = {
        tagName: tag.toUpperCase(),
        value: '',
        classList: { add: () => {} },
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
    elements['codigo-produto'] = createEl('input');
    elements['btn-consultar'] = createEl('button');
    elements['obs-preset'] = createEl('select');
    elements['preco-ajustado'] = createEl('input');
    elements['btn-registrar'] = createEl('button');

    global.document = {
      body: { appendChild: () => {} },
      activeElement: null,
      getElementById: (id) => elements[id] || null,
      querySelector: (sel) => elements[sel.replace('#','')] || null,
      querySelectorAll: () => [],
      addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
      removeEventListener: (type, fn) => { listeners[type] = (listeners[type]||[]).filter(f=>f!==fn); },
      dispatchEvent: (ev) => { (listeners[ev.type] || []).forEach(fn => fn(ev)); },
      createElement: () => ({ className:'', setAttribute:()=>{}, textContent:'', remove:()=>{} }),
    };
    global.window = { refreshIndicators: () => {}, scrollTo: () => {} };
    global.localStorage = {
      _s:{}, getItem(k){return this._s[k]||null;}, setItem(k,v){this._s[k]=String(v);}, removeItem(k){delete this._s[k];}, clear(){this._s={};}
    };
    store.state.rzAtual = 'R1';
    store.state.excedentes = {};
    initActionsPanel(()=>{});
    input = elements['codigo-produto'];
    btnCons = elements['btn-consultar'];
    btnReg = elements['btn-registrar'];
    obsSelect = elements['obs-preset'];
  });

  it('registers excedente without price', () => {
    input.value = 'ABC';
    obsSelect.value = 'excedente';
    btnReg.click();
    const exc = store.state.excedentes['R1'][0];
    expect(exc.sku).toBe('ABC');
    expect(exc.preco).toBeUndefined();
  });

  it('focus returns to input after register', () => {
    input.value = 'XYZ';
    obsSelect.value = 'excedente';
    btnReg.click();
    expect(document.activeElement).toBe(input);
  });
});
