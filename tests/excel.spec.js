import { describe, it, expect, beforeEach, vi } from 'vitest';
import XLSX from 'xlsx-js-style';
vi.mock('../src/services/ncmQueue.js', () => ({ startNcmQueue: vi.fn() }));
import { startNcmQueue } from '../src/services/ncmQueue.js';
import { processarPlanilha } from '../src/utils/excel.js';
import store from '../src/store/index.js';

function createXlsxBuffer(data){
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  // write as buffer
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
}

beforeEach(() => {
  startNcmQueue.mockReset();
  store.state.rzList = [];
  store.state.itemsByRZ = {};
  store.state.metaByRZSku = {};
});

describe('processarPlanilha', () => {
    it('agrupa itens por RZ', async () => {
      const data = [
        ['alguma coisa', 'foo'],
        [],
        ['Codigo ML', 'Descricao', 'Qtd', 'Cod RZ', 'Valor Unit', 'NCM'],
        ['AAA123', 'Produto A', 2, 'RZ-123', 10.5, '12.34.56.78'],
        ['BBB456', 'Produto B', '1', 'RZ-124', 5, '87654321'],
        ['TOTAL', '', { f: 'SUM(C4:C5)' }, 'RZ-123', 0, ''],
      ];
      const buf = createXlsxBuffer(data);
      const { rzList, itemsByRZ } = await processarPlanilha(buf);
      expect(rzList).toEqual(['RZ-123', 'RZ-124']);
        expect(itemsByRZ['RZ-123'][0]).toMatchObject({ codigoML: 'AAA123', codigoRZ: 'RZ-123', qtd: 2, ncm: '12345678' });
        expect(itemsByRZ['RZ-124'][0]).toMatchObject({ codigoML: 'BBB456', codigoRZ: 'RZ-124', qtd: 1, ncm: '87654321' });
    });

    it('sanitiza NCM e salva no metaByRZSku', async () => {
      const data = [
        ['Codigo ML', 'Descricao', 'Qtd', 'Cod RZ', 'Valor Unit', 'N.C.M.'],
        ['AAA123', 'Produto A', 1, 'RZ-999', 2.5, '00.11.22.33'],
      ];
      const buf = createXlsxBuffer(data);
      const { itemsByRZ } = await processarPlanilha(buf);
      expect(itemsByRZ['RZ-999'][0].ncm).toBe('00112233');
      expect(store.state.metaByRZSku['RZ-999']['AAA123'].ncm).toBe('00112233');
    });

    it('interpreta preços com vírgula e calcula total', async () => {
      const data = [
        ['Codigo ML', 'Descricao', 'Qtd', 'Cod RZ', 'Valor Unit', 'Valor Total'],
        ['AAA123', 'Produto A', 2, 'RZ-1', '2,33', '4,66'],
      ];
      const buf = createXlsxBuffer(data);
      const { itemsByRZ } = await processarPlanilha(buf);
      const item = itemsByRZ['RZ-1'][0];
      expect(item.valorUnit).toBeCloseTo(2.33);
      expect(item.valorTotal).toBeCloseTo(4.66);
      expect(item.__preco_raw).toBe('2,33');
    });

    it('detecta planilha em centavos e normaliza', async () => {
      const data = [
        ['Codigo ML', 'Descricao', 'Qtd', 'Cod RZ', 'Valor Unit', 'Valor Total'],
        ['AAA123', 'Produto A', 1, 'RZ-1', 233, 233],
        ['BBB456', 'Produto B', 2, 'RZ-1', 455, 910],
        ['CCC789', 'Produto C', 3, 'RZ-1', 199, 597],
      ];
      const buf = createXlsxBuffer(data);
      const { itemsByRZ } = await processarPlanilha(buf);
      const item = itemsByRZ['RZ-1'][0];
      expect(item.valorUnit).toBeCloseTo(2.33);
      expect(item.valorTotal).toBeCloseTo(2.33);
    });

    it('marca preço anômalo quando muito alto', async () => {
      const data = [
        ['Codigo ML', 'Descricao', 'Qtd', 'Cod RZ', 'Valor Unit'],
        ['AAA123', 'Produto A', 1, 'RZ-1', '1500'],
      ];
      const buf = createXlsxBuffer(data);
      const { itemsByRZ } = await processarPlanilha(buf);
      const item = itemsByRZ['RZ-1'][0];
      expect(item.__price_anomaly).toBe(true);
    });

    it('define RZs antes de iniciar fila NCM', async () => {
      startNcmQueue.mockImplementation(() => {
        expect(store.state.rzList.length).toBeGreaterThan(0);
        return Promise.resolve();
      });
      const data = [
        ['Codigo ML', 'Descricao', 'Qtd', 'Cod RZ'],
        ['AAA123', 'Produto A', 1, 'RZ-1'],
      ];
      const buf = createXlsxBuffer(data);
      await processarPlanilha(buf);
      expect(startNcmQueue).toHaveBeenCalled();
    });
  });
