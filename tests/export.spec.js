import { describe, it, expect, vi } from 'vitest';
import XLSX from 'xlsx-js-style';
import { exportarConferencia } from '../src/utils/excel.js';

describe('exportarConferencia', () => {
  it('gera planilha com colunas básicas', () => {
    const spy = vi.spyOn(XLSX, 'writeFile').mockImplementation(() => {});
    exportarConferencia({
      conferidos:[{SKU:'1', Descrição:'Item', Qtd:1, 'Preço Médio (R$)':1, 'Valor Total (R$)':1}],
      pendentes:[],
      excedentes:[],
      resumoRZ:[]
    });
    const wb = spy.mock.calls[0][0];
    const sheet = wb.Sheets['Conferidos'];
    const rows = XLSX.utils.sheet_to_json(sheet, { header:1 });
    expect(rows[0]).toEqual(['SKU','Descrição','Qtd','Preço Médio (R$)','Valor Total (R$)']);
    spy.mockRestore();
  });
});
