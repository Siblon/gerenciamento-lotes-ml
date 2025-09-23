import { describe, it, expect, beforeEach } from 'vitest';
import XLSX from 'xlsx-js-style';
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
  store.state.rzList = [];
  store.state.itemsByRZ = {};
  store.state.metaByRZSku = {};
  store.state.currentRZ = null;
  store.state.rzAuto = null;
});

describe('processarPlanilha', () => {
    it('agrupa itens por RZ', async () => {
      const data = [
        ['alguma coisa', 'foo'],
        [],
        ['Codigo ML', 'Descricao', 'Qtd', 'Cod RZ', 'Valor Unit'],
        ['AAA123', 'Produto A', 2, 'RZ-123', 10.5],
        ['BBB456', 'Produto B', '1', 'RZ-124', 5],
        ['TOTAL', '', { f: 'SUM(C4:C5)' }, 'RZ-123', 0],
      ];
      const buf = createXlsxBuffer(data);
      const { rzList, itemsByRZ } = await processarPlanilha(buf);
      expect(rzList).toEqual(['RZ-123', 'RZ-124']);
      expect(itemsByRZ['RZ-123'][0]).toMatchObject({ codigoML: 'AAA123', codigoRZ: 'RZ-123', qtd: 2 });
      expect(itemsByRZ['RZ-124'][0]).toMatchObject({ codigoML: 'BBB456', codigoRZ: 'RZ-124', qtd: 1 });
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

    it('gera RZ automático quando a coluna está ausente', async () => {
      const data = [
        ['Codigo ML', 'Descricao', 'Qtd'],
        ['AAA123', 'Produto A', 2],
      ];
      const buf = createXlsxBuffer(data);
      const fakeFile = {
        name: '66.xlsx',
        async arrayBuffer() {
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        },
      };

      const { rzAuto, rzList, itemsByRZ } = await processarPlanilha(fakeFile);
      expect(rzAuto).toBe('RZ-66');
      expect(rzList).toEqual(['RZ-66']);
      expect(Object.keys(itemsByRZ)).toEqual(['RZ-66']);
      expect(store.state.currentRZ).toBe('RZ-66');
      expect(store.state.rzAuto).toBe('RZ-66');
    });

  });
