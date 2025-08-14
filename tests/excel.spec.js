import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { processarPlanilha } from '../src/utils/excel.js';
import store from '../src/store/index.js';

function createXlsxBuffer(data){
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  // write as buffer
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
}

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
  });
