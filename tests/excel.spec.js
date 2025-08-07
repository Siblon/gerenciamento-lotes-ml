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
  it('extrai produtos de planilha com cabecalho flexivel', async () => {
    const data = [
      ['alguma coisa', 'foo'],
      [],
      ['Cod. ML', 'Item', 'Qtde', 'Palete'],
      ['AAA123', 'Produto A', 2, 'RZ-123'],
      ['BBB456', 'Produto B', '1', 'RZ-124'],
      ['TOTAL', '', { f: 'SUM(C4:C5)' }, 'RZ-123'],
    ];
    const buf = createXlsxBuffer(data);
    const { produtos } = await processarPlanilha(buf);
    expect(produtos).toEqual([
      { codigoML: 'AAA123', descricao: 'Produto A', quantidade: 2, rz: 'RZ-123' },
      { codigoML: 'BBB456', descricao: 'Produto B', quantidade: 1, rz: 'RZ-124' },
    ]);
  });
});
