import store, {
  init,
  selectRZ,
  conferir,
  progress,
  listarConferidos,
  listarFaltantes,
  listarExcedentes,
  finalizeCurrent,
  load as loadState,
} from '../store/index.js';
import { processarPlanilha, exportResult } from '../utils/excel.js';

function render() {
  const prog = progress();
  const rz = store.state.currentRZ ? `RZ: ${store.state.currentRZ} - ` : '';
  document.getElementById('progresso').textContent = `${rz}${prog.done} de ${prog.total} conferidos`;
  renderConferidos();
  renderFaltantes();
  renderExcedentes();
}

function renderConferidos() {
  const list = listarConferidos();
  const tbody = document.getElementById('conferidosTable');
  tbody.innerHTML = '';
  list.forEach(item => {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    const esperado = item.esperado;
    const conf = Math.min(item.conferido, esperado);
    td.textContent = esperado > 1 ? `${item.codigo} (${conf}/${esperado})` : item.codigo;
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
}

function renderFaltantes() {
  const list = listarFaltantes();
  const tbody = document.getElementById('faltantesTable');
  tbody.innerHTML = '';
  list.forEach(item => {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    const esperado = item.esperado;
    td.textContent = esperado > 1 ? `${item.codigo} (${item.conferido}/${esperado})` : item.codigo;
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
}

function renderExcedentes() {
  const list = listarExcedentes();
  const tbody = document.getElementById('excedentesTable');
  tbody.innerHTML = '';
  list.forEach(item => {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.textContent = item.quantidade > 1 ? `${item.codigo} (${item.quantidade})` : item.codigo;
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
}

function handleFile(evt) {
  const file = evt.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const { produtos, headerRow, missingFields } = await processarPlanilha(e.target.result);

      if (!headerRow) {
        alert('Nenhum cabeçalho foi detectado na planilha.');
        console.error('Cabeçalho não encontrado. Campos ausentes:', missingFields);
        return;
      }

      if (!produtos || produtos.length === 0) {
        alert('Nenhum produto foi encontrado na planilha. Verifique os nomes das colunas.');
        console.warn('processarPlanilha retornou vazio.');
        return;
      }

      const produtosValidos = produtos.filter(p => p.codigoML && p.rz && p.quantidade !== undefined);
      if (produtosValidos.length === 0) {
        alert('Os produtos lidos estão incompletos (falta código, RZ ou quantidade).');
        console.warn('Produtos com dados ausentes:', produtos);
        return;
      }

      const pallets = {};
      produtosValidos.forEach(({ codigoML, quantidade, rz }) => {
        if (!pallets[rz]) pallets[rz] = {};
        pallets[rz][codigoML] = (pallets[rz][codigoML] || 0) + quantidade;
      });

      init(pallets);
      populateRZs();
      render();
      console.log('Produtos válidos carregados:', produtosValidos.length);

    } catch (err) {
      alert('Erro ao ler a planilha. Veja o console para detalhes.');
      console.error('Erro no processamento da planilha:', err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function populateRZs() {
  const select = document.getElementById('rzSelect');
  select.innerHTML = '<option value="">Selecione o RZ</option>';
  Object.keys(store.state.pallets).forEach(rz => {
    const opt = document.createElement('option');
    opt.value = rz;
    opt.textContent = rz;
    select.appendChild(opt);
  });
  if (store.state.currentRZ) {
    select.value = store.state.currentRZ;
  }
}

function handleRzChange(evt) {
  const rz = evt.target.value;
  if (rz) {
    selectRZ(rz);
    render();
  }
}

function handleInput() {
  if (!store.state.currentRZ) return;
  const input = document.getElementById('codigoInput');
  const codigo = input.value.trim();
  if (!codigo) return;
  conferir(codigo);
  input.value = '';
  render();
}

function finalize() {
  const result = finalizeCurrent();
  const faltantesCount = result.faltantes.reduce((s, i) => s + i.quantidade, 0);
  const excedentesCount = result.excedentes.reduce((s, i) => s + i.quantidade, 0);
  const completo = faltantesCount === 0 ? 'completa' : 'parcial';
  const resumo = `Conferência ${completo}\nFaltantes: ${faltantesCount}\nExcedentes: ${excedentesCount}\nDeseja encerrar?`;
  if (confirm(resumo)) {
    exportResult(result);
  }
}

function setup() {
  document.getElementById('fileInput').addEventListener('change', handleFile);
  document.getElementById('rzSelect').addEventListener('change', handleRzChange);
  document.getElementById('registrarBtn').addEventListener('click', handleInput);
  document.getElementById('finalizarBtn').addEventListener('click', finalize);
  document.getElementById('codigoInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') handleInput();
  });
  loadState();
  populateRZs();
  render();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', setup);
}

