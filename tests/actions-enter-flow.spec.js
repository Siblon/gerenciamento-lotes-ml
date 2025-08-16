import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initActionsPanel } from '../src/components/ActionsPanel.js';

let input, btnCons, btnReg;

describe('enter flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
    elements['codigo-produto'] = createEl('input');
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
    initActionsPanel(() => {});
    input = elements['codigo-produto'];
    btnCons = elements['btn-consultar'];
    btnReg = elements['btn-registrar'];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Enter on code field triggers Consultar', () => {
    const spy = vi.fn();
    btnCons.addEventListener('click', spy);
    input.dispatchEvent({ type:'keydown', key:'Enter', preventDefault: () => {} });
    vi.runAllTimers();
    expect(spy).toHaveBeenCalled();
  });

  it('Ctrl+Enter triggers Registrar', () => {
    const spy = vi.fn();
    btnReg.addEventListener('click', spy);
    input.dispatchEvent({ type:'keydown', key:'Enter', ctrlKey:true, preventDefault: () => {} });
    expect(spy).toHaveBeenCalled();
  });
});
