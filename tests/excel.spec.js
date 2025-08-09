import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { processarPlanilha } from '../src/utils/excel.js';

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
  });
