import './styles.css';
import { initImportPanel } from './components/ImportPanel.js';
import { mountKpis } from '@/components/Kpis';
import { updateBoot } from './utils/boot.js';
import { exportConferidos } from './services/exportExcel.js';
import { resetAll } from './store/db.js';
import store from './store/index.js';

// utilitário opcional no console
window.__resetDb = resetAll;

window.addEventListener('DOMContentLoaded', () => {
  initImportPanel();
  updateBoot('Boot: aplicativo carregado. Selecione a planilha e o RZ para iniciar.');

  const kpisHost = document.querySelector('#kpis-host');
  mountKpis(kpisHost);

  document.getElementById('finalizarBtn')?.addEventListener('click', () => {
    exportConferidos(store.selectAllImportedItems());
  });
  document.getElementById('btn-exportar')?.addEventListener('click', () => {
    exportConferidos(store.selectAllImportedItems());
  });
});

