// src/services/exportExcel.js
import * as XLSX from 'xlsx';
import { db, getSetting } from '../store/db.js';

function toSheet(rows, headers) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  return ws;
}

export async function exportarLoteAtual() {
  const lotId = await getSetting('activeLotId', null);
  if (!lotId) return;

  const lot = await db.lots.get(lotId);
  const all = await db.items.where('lotId').equals(lotId).toArray();

  const conferidos = all.filter(i => i.status === 'conferido');
  const pendentes  = all.filter(i => i.status === 'pendente');
  const excedentes = all.filter(i => i.status === 'excedente');

  const H = ['RZ', 'Lote', 'SKU', 'Descrição', 'Qtd', 'Preço Méd', 'Valor Total', 'Status'];

  const mapRow = (i) => [
    lot?.rz || '', lot?.name || '',
    i.sku, i.desc, i.qtd,
    i.precoMedio, i.valorTotal, i.status
  ];

  const wb = XLSX.utils.book_new();

  // Resumo
  const totalConferidos = conferidos.length;
  const totalPendentes = pendentes.length;
  const totalExcedentes = excedentes.length;
  const resumoRows = [
    ['RZ', lot?.rz || ''],
    ['Lote', lot?.name || ''],
    ['Criado em', lot?.createdAt || ''],
    ['Conferidos', totalConferidos],
    ['Pendentes', totalPendentes],
    ['Excedentes', totalExcedentes],
  ];
  XLSX.utils.book_append_sheet(wb, toSheet(resumoRows, ['Campo','Valor']), 'Resumo');

  // Abas
  XLSX.utils.book_append_sheet(wb, toSheet(conferidos.map(mapRow), H), 'Conferidos');
  XLSX.utils.book_append_sheet(wb, toSheet(pendentes.map(mapRow),  H), 'Pendentes');
  XLSX.utils.book_append_sheet(wb, toSheet(excedentes.map(mapRow), H), 'Excedentes');

  const name = `conferencia_${(lot?.name || 'lote')}_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, name);
}
