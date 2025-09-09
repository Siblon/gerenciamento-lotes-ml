// Utilities for finance configuration and calculations
import { FINANCE } from '../config/financeConfig.js';

export const FINANCE_KEY = 'config:finance:v1';
export const METRICS_PREFS_KEY = 'ui:metricsPrefs:v1';

export const DEFAULT_METRICS_PREFS = {
  showIndicators: false,
  visible: {
    preco_medio_ml_palete: false,
    custo_medio_pago_palete: false,
    preco_venda_medio_palete: false,
    lucro_total_palete: false,
    rateio_frete: false,
  }
};

export function loadFinanceConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(FINANCE_KEY) || '{}');
    return { ...FINANCE, ...saved };
  } catch {
    return { ...FINANCE };
  }
}

export function saveFinanceConfig(cfg) {
  localStorage.setItem(FINANCE_KEY, JSON.stringify(cfg || {}));
}

export function loadMetricsPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(METRICS_PREFS_KEY) || '{}');
    return {
      ...DEFAULT_METRICS_PREFS,
      ...saved,
      visible: { ...DEFAULT_METRICS_PREFS.visible, ...(saved?.visible || {}) },
    };
  } catch {
    return { ...DEFAULT_METRICS_PREFS, visible: { ...DEFAULT_METRICS_PREFS.visible } };
  }
}

export function saveMetricsPrefs(prefs) {
  localStorage.setItem(METRICS_PREFS_KEY, JSON.stringify(prefs || {}));
}

export function computeFreteUnit(item, ctx) {
  const preco = Number(item.preco_ml_unit || 0);
  const qtd = Number(item.qtd || 0);
  const frete = Number(ctx.frete_total || 0);
  const rateio = ctx.rateio_frete;
  const totalValor = Number(ctx.totalValor || 0);
  const totalQtd = Number(ctx.totalQtd || 0);
  if (frete <= 0) return 0;
  if (rateio === 'valor') {
    if (totalValor <= 0) return 0;
    const peso = (preco * qtd) / totalValor;
    return (frete * peso) / Math.max(1, qtd);
  } else {
    if (totalQtd <= 0) return 0;
    return (qtd / totalQtd) * frete / Math.max(1, qtd);
  }
}

export function computeItemFinance(item, config, ctx) {
  const preco = Number(item.preco_ml_unit || 0);
  const qtd = Number(item.qtd || 0);
  const custo_pago_unit = preco * Number(config.percent_pago_sobre_ml || 0);
  const preco_venda_unit = preco * (1 - Number(config.desconto_venda_vs_ml || 0));
  const frete_unit = computeFreteUnit({ preco_ml_unit: preco, qtd }, { ...ctx, ...config });
  const lucro_unit = preco_venda_unit - custo_pago_unit - frete_unit;
  const lucro_total = lucro_unit * qtd;
  return { custo_pago_unit, preco_venda_unit, frete_unit, lucro_unit, lucro_total };
}

export function computeAggregates(lista, config) {
  const totalQtd = lista.reduce((s, it) => s + Number(it.qtd || 0), 0);
  const totalValor = lista.reduce((s, it) => s + Number(it.preco_ml_unit || 0) * Number(it.qtd || 0), 0);
  let sumCusto = 0, sumVenda = 0, sumML = 0, sumLucro = 0;
  for (const it of lista) {
    const ctx = { totalValor, totalQtd, frete_total: config.frete_total, rateio_frete: config.rateio_frete };
    const fin = computeItemFinance(it, config, ctx);
    const q = Number(it.qtd || 0);
    sumCusto += fin.custo_pago_unit * q;
    sumVenda += fin.preco_venda_unit * q;
    sumML += Number(it.preco_ml_unit || 0) * q;
    sumLucro += fin.lucro_total;
  }
  const preco_medio_ml_palete = totalQtd > 0 ? sumML / totalQtd : 0;
  const custo_medio_pago_palete = totalQtd > 0 ? sumCusto / totalQtd : 0;
  const preco_venda_medio_palete = totalQtd > 0 ? sumVenda / totalQtd : 0;
  const lucro_total_palete = sumLucro;
  return { preco_medio_ml_palete, custo_medio_pago_palete, preco_venda_medio_palete, lucro_total_palete };
}
