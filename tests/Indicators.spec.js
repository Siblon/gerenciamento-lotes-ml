import { describe, it, expect, vi } from 'vitest';

const prefs = { showIndicators: true, calcFreteMode: 'ao_vivo', showFinance: true };

vi.mock('../src/utils/prefs.js', () => ({
  loadPrefs: vi.fn(() => prefs),
  savePrefs: vi.fn(),
}));

vi.mock('../src/utils/finance.js', () => ({
  loadFinanceConfig: vi.fn(() => ({ frete_total: 0, rateio_frete: 'valor', percent_pago_sobre_ml: 0.2, desconto_venda_vs_ml: 0.1 })),
  loadMetricsPrefs: vi.fn(() => ({ visible: { preco_medio_ml_palete: true } })),
  saveMetricsPrefs: vi.fn(),
  computeItemFinance: vi.fn(() => ({})),
  computeAggregates: vi.fn(() => ({ preco_medio_ml_palete: 100 })),
}));

vi.mock('../src/store/index.js', () => ({
  default: { selectAllImportedItems: () => [] }
}));

function classList() {
  const set = new Set();
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    toggle: (c, force) => {
      if (force === undefined) {
        set.has(c) ? set.delete(c) : set.add(c);
      } else {
        force ? set.add(c) : set.delete(c);
      }
    },
    contains: (c) => set.has(c),
  };
}

describe('Indicators component', () => {
  it('renders and toggles', async () => {
    const grid = { innerHTML: '', appendChild: vi.fn() };
    const sec = { classList: classList(), querySelector: () => grid };
    const toggleBtn = { addEventListener: (e, fn) => (toggleBtn.fn = fn), textContent: '' };
    const configBtn = { addEventListener: () => {} };
    const dlg = { showModal: () => {}, addEventListener: () => {} };
    const options = { innerHTML: '', appendChild: () => {} };
    const applyBtn = { addEventListener: () => {} };
    const finPanel = { classList: { toggle: () => {} } };
    const finTgl = { checked: true, addEventListener: () => {} };

    global.window = {};
    global.document = {
      getElementById: (id) => ({
        indicadores: sec,
        'toggle-indicators': toggleBtn,
        'config-indicators': configBtn,
        'dlg-indicators': dlg,
        'metrics-options': options,
        'apply-indicators': applyBtn,
        'finance-panel': finPanel,
        'toggle-finance': finTgl,
        'card-scanner': { style: {} },
      })[id],
      createElement: () => ({ className: '', appendChild: () => {}, textContent: '' }),
    };

    const mod = await import('../src/components/Indicators.js');
    mod.initIndicators();
    expect(grid.appendChild).toHaveBeenCalled();
    toggleBtn.fn();
    expect(prefs.showIndicators).toBe(false);
  });
});
