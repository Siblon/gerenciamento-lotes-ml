import { processarPlanilha } from '../services/planilha.js'; // Substitui importFile
import { hydrateRzSelect, wireRzCapture } from '../services/meta.js';
import { initLotSelector } from './LotSelector.js';
import { toast } from '../utils/toast.js';
import { clearAll } from '../store/db.js';
import { hideBoot } from '../utils/boot.js';
import store from '../store/index.js';

export function initImportPanel() {
  const fileInput = document.getElementById('file');
  const fileName = document.getElementById('file-name');
  const rzSelect = document.getElementById('select-rz');

  // Preenche o select com RZs já salvos e conecta o listener de mudança
  hydrateRzSelect(rzSelect);
  wireRzCapture(rzSelect);

  ensureResetButton();

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Atualiza o nome do arquivo exibido na UI
    if (fileName) {
      fileName.textContent = file.name;
      fileName.title = file.name;
    }

    const rz = rzSelect?.value || '';

    try {
      // 📦 Processa a planilha e atualiza o estado do app (incluindo store.state.rzList)
      await processarPlanilha(file, rz);
      if (rz && store.state?.rzList?.includes(rz)) {
        store.setCurrentRZ?.(rz);
      }
      store.emit?.('refresh');

      // 🔁 Reidrata o select de RZ após a importação
      hydrateRzSelect(rzSelect);

      // 🔄 Atualiza os lotes disponíveis
      await initLotSelector();

      // ✅ Notifica o usuário
      toast.success(`Lote carregado: ${file.name} — prossiga com a conferência`);
      hideBoot();
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

  // Verifica se o botão já existe
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
