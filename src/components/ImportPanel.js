import { importFile, loadMeta, saveMeta } from '../services/importer.js';
import { initLotSelector } from './LotSelector.js';
import { toast } from '../utils/toast.js';
import { clearAll } from '../store/db.js';
import { updateBoot } from '../utils/boot.js';

export function initImportPanel() {
  const fileInput = document.getElementById('file');
  const fileName = document.getElementById('file-name');
  const rzSelect = document.getElementById('select-rz');

  // 🧠 Restaura RZ previamente salvo (se existir)
  const meta = loadMeta();
  if (meta.rz && rzSelect) {
    rzSelect.value = meta.rz;
  }

  // 🧠 Salva RZ sempre que for alterado
  rzSelect?.addEventListener('change', () => {
    const rz = rzSelect.value || '';
    saveMeta({ rz });
  });

  ensureResetButton();

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Atualiza o nome do arquivo na UI
    if (fileName) {
      fileName.textContent = file.name;
      fileName.title = file.name;
    }

    const rz = rzSelect?.value || '';

    try {
      // Processa a planilha
      await importFile(file, rz);

      // Atualiza o seletor de lotes após importar
      await initLotSelector();

      // Exibe notificações visuais
      toast.success(`Lote carregado: ${file.name} — prossiga com a conferência`);
      updateBoot(`Lote carregado: <strong>${file.name}</strong> — prossiga com a conferência`);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível processar a planilha...');
    }
  });
}

function ensureResetButton() {
  const host =
    document.querySelector('#card-importacao .card-header, #card-importacao .card-body') ||
    document.body;

  if (!host || typeof host.querySelector !== 'function' || host.querySelector('#btn-reset-db')) return;

  const btn = document.createElement('button');
  btn.id = 'btn-reset-db';
  btn.className = 'btn btn-ghost';
  btn.type = 'button';
  btn.textContent = 'Zerar dados';
  btn.title = 'Limpar banco e começar novo palete';
  btn.style.marginLeft = '8px';

  host.appendChild(btn);

  btn.addEventListener('click', async () => {
    if (!confirm('Zerar todos os dados (itens, excedentes e preferências)?')) return;
    await clearAll();
    window.refreshAll?.();
  });
}
