import './styles.css';
import { initImportPanel } from './components/ImportPanel.js';
import { updateBoot } from './utils/boot.js';
import { exportarPlanilha } from './services/exportExcel.js';
import { downloadSnapshot } from './services/backup.js';
import { resetAllData } from './services/resetDb.js';
import { db, resetDb } from './store/db.js';

// utilitário opcional no console
window.__resetDb = resetDb;

window.addEventListener('DOMContentLoaded', () => {
  initImportPanel();
  updateBoot('Boot: aplicativo carregado. Selecione a planilha e o RZ para iniciar.');

  const verEl = document.getElementById('app-version');
  if (verEl) verEl.textContent = `v${__APP_VERSION__ || 'dev'} • ${(__COMMIT_HASH__ || 'local').slice(0,7)}`;

  document.getElementById('finalizarBtn')?.addEventListener('click', () => {
    exportarPlanilha();
  });
  document.getElementById('btn-exportar')?.addEventListener('click', () => {
    exportarPlanilha();
  });
  document.getElementById('btn-download-backup')?.addEventListener('click', () => {
    downloadSnapshot(db);
  });
  document.getElementById('btn-reset-db')?.addEventListener('click', async () => {
    await resetAllData();
    updateBoot('Banco zerado.');
    location.reload();
  });
});

