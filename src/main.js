import './styles.css';
import { initImportPanel } from './components/ImportPanel.js';
import { updateBoot } from './utils/boot.js';
import { exportarPlanilha } from './services/exportExcel.js';
import { resetDb } from './store/db.js';

// utilitário opcional no console
window.__resetDb = resetDb;

window.addEventListener('DOMContentLoaded', () => {
  initImportPanel();
  updateBoot('Boot: aplicativo carregado. Selecione a planilha e o RZ para iniciar.');

  document.getElementById('finalizarBtn')?.addEventListener('click', () => {
    exportarPlanilha();
  });
  document.getElementById('btn-exportar')?.addEventListener('click', () => {
    exportarPlanilha();
  });
});

