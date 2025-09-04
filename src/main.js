import './styles.css';
import { initImportPanel } from './components/ImportPanel.js';
import { mountKpis } from '@/components/Kpis';
import { updateBoot } from './utils/boot.js';
import { exportWorkbook } from './services/exportExcel.js';
import { resetAll } from './store/db.js';
import store from './store/index.js';

// utilitário opcional no console
window.__resetDb = resetAll;

window.addEventListener('DOMContentLoaded', () => {
  initImportPanel();
  updateBoot('Boot: aplicativo carregado. Selecione a planilha e o RZ para iniciar.');

  const kpisHost = document.querySelector('#kpis-host');
  mountKpis(kpisHost);
  const currentMeta = () => {
    const rz = document.querySelector('#select-rz')?.value || store.selectRz?.() || '';
    const lote = document.querySelector('#select-lote')?.value || store.selectLote?.() || '';
    return { rz, lote };
  };

  document.getElementById('finalizarBtn')?.addEventListener('click', () => {
    const items = store.selectAllItems ? store.selectAllItems() : [];
    const conferidos = items.filter(i => i.status === 'Conferido');
    const excedentes = items.filter(i => i.status === 'Excedente');
    const pendentes = items.filter(i => (i.status ?? 'Pendente') === 'Pendente');

    exportWorkbook({
      conferidos, pendentes, excedentes,
      meta: currentMeta()
    });
  });
});

