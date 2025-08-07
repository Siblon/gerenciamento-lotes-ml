import store, { init, conferir, marcarFaltante, progress, load as loadState } from '../store/index.js';
import { readCodesFromXlsx, exportResult } from '../utils/excel.js';

function render() {
  const { conferidos, faltantes, excedentes } = store.state;
  const prog = progress();
  document.getElementById('progresso').textContent = `${prog.done} de ${prog.total} conferidos`;
  renderList('conferidosTable', conferidos);
  renderList('faltantesTable', faltantes);
  renderList('excedentesTable', excedentes);
}

function renderList(id, list) {
  const tbody = document.getElementById(id);
  tbody.innerHTML = '';
  list.forEach(codigo => {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.textContent = codigo;
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
}

function handleFile(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const codes = readCodesFromXlsx(new Uint8Array(e.target.result));
    init(codes);
    render();
  };
  reader.readAsArrayBuffer(file);
}

function handleInput() {
  const input = document.getElementById('codigoInput');
  const codigo = input.value.trim();
  if (!codigo) return;
  conferir(codigo);
  input.value = '';
  render();
}

function handleFaltante() {
  const input = document.getElementById('codigoInput');
  const codigo = input.value.trim();
  if (!codigo) return;
  marcarFaltante(codigo);
  input.value = '';
  render();
}

function finalize() {
  exportResult(store.state);
}

function setup() {
  document.getElementById('fileInput').addEventListener('change', handleFile);
  document.getElementById('registrarBtn').addEventListener('click', handleInput);
  document.getElementById('faltanteBtn').addEventListener('click', handleFaltante);
  document.getElementById('finalizarBtn').addEventListener('click', finalize);
  document.getElementById('codigoInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') handleInput();
  });
  loadState();
  render();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', setup);
}
