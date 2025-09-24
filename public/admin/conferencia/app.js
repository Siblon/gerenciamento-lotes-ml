import { processarPlanilha } from './excel.js';
import { state, on } from './store/index.js';

let initialized = false;

function renderTabelaItens() {
  const tbody = document.getElementById('tabela-itens');
  if (!tbody) {
    console.warn('[APP] Tabela #tabela-itens não encontrada');
    return;
  }

  const itens = Array.isArray(state.itens) ? state.itens : [];

  tbody.innerHTML = '';

  itens.forEach((item) => {
    const tr = document.createElement('tr');

    const tdCodigo = document.createElement('td');
    tdCodigo.textContent = item?.codigo ?? '';
    tr.appendChild(tdCodigo);

    const tdDescricao = document.createElement('td');
    tdDescricao.textContent = item?.descricao ?? '';
    tr.appendChild(tdDescricao);

    const tdRz = document.createElement('td');
    tdRz.textContent = item?.rz ?? '';
    tr.appendChild(tdRz);

    const tdQuantidade = document.createElement('td');
    tdQuantidade.textContent = item?.quantidade ?? '';
    tr.appendChild(tdQuantidade);

    tbody.appendChild(tr);
  });

  console.debug('[DEBUG] Tabela renderizada com', itens.length, 'linhas');
}

async function handleFile(fileInput) {
  if (!fileInput || typeof fileInput !== 'object' || !('files' in fileInput)) {
    console.warn('[APP] handleFile chamado sem input de arquivo válido');
    return;
  }

  const file = fileInput.files?.[0];
  if (!file) {
    console.log('[APP] Nenhum arquivo selecionado');
    return;
  }

  console.log('[APP] Arquivo selecionado', file.name);

  try {
    const { rzs, itens } = await processarPlanilha(file);
    console.log('[APP] Resultado do processamento', { rzs, totalItens: itens.length });
  } catch (error) {
    console.error('[APP] Erro ao processar planilha', error);
  } finally {
    fileInput.value = '';
  }
}

export function initApp() {
  if (initialized) {
    console.log('[APP] initApp já foi executada');
    return;
  }

  console.log('[APP] Inicializando aplicação de conferência');

  const fileInput = document.getElementById('file');
  if (!fileInput) {
    console.error('[APP] Input de arquivo com id "file" não encontrado');
    return;
  }

  initialized = true;

  on('itens:update', renderTabelaItens);
  renderTabelaItens();

  fileInput.addEventListener('change', (event) => {
    console.log('[APP] Evento change recebido');
    const target = event.target;
    if (!target || typeof target !== 'object' || !('files' in target)) {
      console.warn('[APP] Evento change sem input de arquivo válido');
      return;
    }
    handleFile(target);
  });

  console.log('[APP] Listeners registrados');
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initApp());
  } else {
    initApp();
  }
}
