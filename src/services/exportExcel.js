import { db, getMeta } from '../store/db.js';
import { exportToExcel } from '../utils/excel.js';

// Monta dados e delega exportação ao utilitário
export async function exportarPlanilha() {
  const rz = await getMeta('rzAtual', '—');
  const lote = await getMeta('loteAtual', '—');
  const now = new Date();
  const dataStr = now.toLocaleString('pt-BR');

  const conferidos = await db.itens.where('status').equals('Conferido').toArray();
  const pendentes  = await db.itens.where('status').equals('Pendente').toArray();
  const excedentes = await db.excedentes.toArray();

  const linhas = [];

  const add = (arr, status, precoField) => {
    arr.forEach(it => {
      const preco = Number(it[precoField] || 0);
      const qtd = Number(it.qtd || 0);
      linhas.push({
        SKU: it.sku,
        Descrição: it.descricao || '',
        Qtd: qtd,
        Preço: preco || '',
        Valor: preco * qtd,
        Status: status,
        Lote: lote,
        RZ: rz,
        Data: dataStr,
      });
    });
  };

  add(conferidos, 'Conferido', 'precoMedio');
  add(pendentes, 'Pendente', 'precoMedio');
  add(excedentes, 'Excedente', 'preco');

  exportToExcel(linhas, { lote, rz, date: now });
}

