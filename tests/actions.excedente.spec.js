import { describe, it, expect, beforeEach } from 'vitest';
import { initSimpleActionsPanel } from '../src/components/ActionsPanel.js';
import store from '../src/store/index.js';

describe('actions excedente (simple)', () => {
  let input, btn;
  beforeEach(() => {
    store.state.currentRZ = 'RZ-1';
    store.state.items = [];
    store.state.excedentes = {};

    const elements = {};
    function el(tag='input'){
      return {
        tagName: tag.toUpperCase(),
        value: '',
        addEventListener(type, fn){ this._l ||= {}; this._l[type] = fn; },
        click(){ this._l?.click?.({}); },
      };
    }
    elements['codigo-input'] = el('input');
    elements['btn-consultar'] = el('button');

    global.document = {
      body: { appendChild: () => {} },
      getElementById(id){ return elements[id] || null; },
      querySelector(sel){ return elements[sel.replace('#','')] || null; },
      createElement(){ return { className:'', setAttribute:()=>{}, remove:()=>{} }; }
    };

    initSimpleActionsPanel();
    input = elements['codigo-input'];
    btn = elements['btn-consultar'];
  });

  it('creates excedente with current RZ', () => {
    input.value = 'XYZ';
    btn.click();
    const exc = store.state.excedentes['RZ-1'][0];
    expect(exc.sku).toBe('XYZ');
  });
});
