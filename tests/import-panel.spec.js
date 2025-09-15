import { describe, it, beforeEach, expect, vi } from 'vitest';
vi.mock('../src/services/planilha.js', () => ({ processarPlanilha: vi.fn() }));
vi.mock('../src/utils/ui.js', () => ({ loadSettings: () => ({}), renderCounts: vi.fn(), renderExcedentes: vi.fn() }));
import { initImportPanel } from '../src/components/ImportPanel.js';
import { processarPlanilha } from '../src/services/planilha.js';
import store from '../src/store/index.js';
import { toast } from '../src/utils/toast.js';

describe('ImportPanel error handling', () => {
  let fileEl;

  beforeEach(() => {
    store.state.rzList = [];
    store.state.itemsByRZ = {};
    store.state.currentRZ = null;

    const elements = {};
    function createEl(tag = 'input') {
      return {
        tagName: tag.toUpperCase(),
        textContent: '',
        title: '',
        value: '',
        classList: { add: () => {} },
        addEventListener(type, fn) { (this._l ||= {})[type] = fn; },
      };
    }
    elements['file'] = createEl('input');

    global.document = {
      body: { appendChild: () => {} },
      createElement: () => ({ remove: () => {}, setAttribute: () => {}, className: '', textContent: '' }),
      getElementById: (id) => elements[id] || null,
      addEventListener: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
    };

    initImportPanel(() => {});
    fileEl = elements['file'];
  });

  it('emits toast.error and keeps state when parse fails', async () => {
    processarPlanilha.mockRejectedValue(new Error('fail'));
    const spy = vi.spyOn(toast, 'error').mockImplementation(() => {});
    const file = { name: 'x.xlsx', arrayBuffer: async () => new ArrayBuffer(0) };
    await fileEl._l.change({ target: { files: [file] } });
    expect(spy).toHaveBeenCalledWith('Não foi possível processar a planilha...');
    expect(store.state.rzList).toEqual([]);
    expect(store.state.itemsByRZ).toEqual({});
    expect(store.state.currentRZ).toBeNull();
  });
});
