import { processarPlanilha } from './excel.js';
import { state, setRZs, setItens, setCurrentRZ } from './store/index.js';

let initialized = false;

function formatQuantidade(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  const formatter = Number.isInteger(value)
    ? new Intl.NumberFormat('pt-BR')
    : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return formatter.format(value);
}

function formatValorUnitario(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function renderTabela(itens) {
  const tabela = document.getElementById('tabela-itens');
  if (!tabela) {
    console.warn('[APP] Tabela #tabela-itens não encontrada');
    return;
  }

  console.log('[APP] Renderizando tabela com', itens.length, 'itens');

  tabela.innerHTML = '';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['SKU', 'Descrição', 'Qtd', 'Valor Unitário'].forEach((titulo) => {
    const th = document.createElement('th');
    th.textContent = titulo;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  tabela.appendChild(thead);

  const tbody = document.createElement('tbody');
  itens.forEach((item) => {
    const tr = document.createElement('tr');

    const tdCodigo = document.createElement('td');
    tdCodigo.textContent = item.codigoML ?? '';
    tr.appendChild(tdCodigo);

    const tdDescricao = document.createElement('td');
    tdDescricao.textContent = item.descricao ?? '';
    tr.appendChild(tdDescricao);

    const tdQtd = document.createElement('td');
    tdQtd.textContent = formatQuantidade(item.qtd);
    tr.appendChild(tdQtd);

    const tdValor = document.createElement('td');
    tdValor.textContent = formatValorUnitario(item.valorUnit);
    tr.appendChild(tdValor);

    tbody.appendChild(tr);
  });

  tabela.appendChild(tbody);
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

    setRZs(rzs);
    setItens(itens);
    setCurrentRZ(rzs[0] ?? null);

    renderTabela(state.itens);
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
