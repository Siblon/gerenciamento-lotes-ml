import { describe, it, expect, beforeEach } from 'vitest';
import { computeFreteUnit, computeItemFinance, loadMetricsPrefs, saveMetricsPrefs } from '../src/utils/financeUtils.js';

describe('finance computations', () => {
  it('base case quantity rateio', () => {
    const item = { preco_ml_unit: 100, qtd: 1 };
    const config = { percent_pago_sobre_ml: 0.20, desconto_venda_vs_ml: 0.20, frete_total: 10, rateio_frete: 'quantidade' };
    const ctx = { totalQtd: 5, totalValor: 500, frete_total: 10, rateio_frete: 'quantidade' };
    const res = computeItemFinance(item, config, ctx);
    expect(res.custo_pago_unit).toBeCloseTo(20);
    expect(res.preco_venda_unit).toBeCloseTo(80);
    expect(res.frete_unit).toBeCloseTo(2);
    expect(res.lucro_unit).toBeCloseTo(58);
  });

  it('rateio por valor distribui corretamente', () => {
    const items = [
      { preco_ml_unit: 100, qtd: 1 },
      { preco_ml_unit: 200, qtd: 1 }
    ];
    const ctx = { totalQtd: 2, totalValor: 300, frete_total: 30, rateio_frete: 'valor' };
    const f1 = computeFreteUnit(items[0], ctx);
    const f2 = computeFreteUnit(items[1], ctx);
    expect(f1).toBeCloseTo(10);
    expect(f2).toBeCloseTo(20);
  });
});

describe('metrics prefs persistence', () => {
  beforeEach(() => localStorage.removeItem('ui:metricsPrefs:v1'));
  it('persists selections', () => {
    const prefs = loadMetricsPrefs();
    prefs.showIndicators = true;
    prefs.visible.preco_medio_ml_palete = true;
    saveMetricsPrefs(prefs);
    const again = loadMetricsPrefs();
    expect(again.showIndicators).toBe(true);
    expect(again.visible.preco_medio_ml_palete).toBe(true);
  });
});
