import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderResults } from '../src/components/ResultsPanel.js';
import store from '../src/store/index.js';

const baseState = JSON.parse(JSON.stringify(store.state));

describe('renderResults row classes', () => {
  let tbConf, tbPend, tbExc, byId;
  beforeEach(() => {
    tbConf = { innerHTML: '' };
    tbPend = { innerHTML: '' };
    tbExc = { innerHTML: '' };
    byId = {
      'hdr-conferidos': { textContent: '' },
      'count-conferidos': { textContent: '' },
      'count-pendentes': { textContent: '' },
      'excedentesCount': { textContent: '' },
    };
    global.document = {
      querySelector: (sel) => {
        if (sel === '#tbl-conferidos tbody') return tbConf;
        if (sel === '#tbl-pendentes tbody') return tbPend;
        if (sel === '#excedentesTable') return tbExc;
        return null;
      },
      getElementById: (id) => byId[id] || null,
      querySelectorAll: () => ([]),
    };
    global.window = { refreshIndicators: () => {} };
    Object.keys(store.state).forEach(k => {
      store.state[k] = JSON.parse(JSON.stringify(baseState[k]));
    });
    store.state.rzAtual = 'R1';
    store.state.totalByRZSku = { R1: { A:1, B:1 } };
    store.state.conferidosByRZSku = { R1: { A: { qtd:1 } } };
    store.state.metaByRZSku = { R1: { A:{ descricao:'A', precoMedio:0 }, B:{ descricao:'B', precoMedio:0 } } };
    store.state.excedentes = { R1: [ { sku:'E1', descricao:'Ex', qtd:1, preco:0 } ] };
    store.state.contadores = { R1: { conferidos:1, total:2, excedentes:1 } };
  });

  afterEach(() => {
    Object.keys(store.state).forEach(k => {
      store.state[k] = JSON.parse(JSON.stringify(baseState[k]));
    });
    delete global.document;
    delete global.window;
  });

  it('applies status classes to rows', () => {
    renderResults();
    expect(tbConf.innerHTML).toContain('row-conferido');
    expect(tbPend.innerHTML).toContain('row-pendente');
    expect(tbExc.innerHTML).toContain('row-excedente');
  });
});
