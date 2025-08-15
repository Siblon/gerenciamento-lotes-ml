import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { exportarConferencia } from '../src/utils/excel.js';

describe('exportarConferencia', () => {
  it('inclui coluna NCM', () => {
    const spy = vi.spyOn(XLSX, 'writeFile').mockImplementation(() => {});
    exportarConferencia({
      conferidos:[{SKU:'1', Descrição:'Item', Qtd:1, 'Preço Médio (R$)':1, 'Valor Total (R$)':1, NCM:'12345678'}],
      pendentes:[],
      excedentes:[],
      resumoRZ:[]
    });
    const wb = spy.mock.calls[0][0];
    const sheet = wb.Sheets['Conferidos'];
    const rows = XLSX.utils.sheet_to_json(sheet, { header:1 });
    expect(rows[0]).toContain('NCM');
    expect(rows[1][5]).toBe('12345678');
    spy.mockRestore();
  });
});
