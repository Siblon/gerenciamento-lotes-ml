import store, {
  init,
  selectRZ,
  conferir,
  progress,
  listarConferidos,
  listarFaltantes,
  listarExcedentes,
  finalizeCurrent,
  registrarExcedente,
  registrarAjuste,
  load as loadState,
  calcResumoRZ,
  calcResumoGeral,
} from '../store/index.js';
import { processarPlanilha, exportResult } from '../utils/excel.js';

let consultaAtual = null;

function render() {
  const prog = progress();
  const rz = store.state.currentRZ ? `RZ: ${store.state.currentRZ} - ` : '';
  document.getElementById('progresso').textContent = `${rz}${prog.done} de ${prog.total} conferidos`;
  renderConferidos();
  renderFaltantes();
  renderExcedentes();
  renderConsulta();
  renderResumo();
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

function renderResumo() {
  const rzDiv = document.getElementById('resumoRZ');
  const geralDiv = document.getElementById('resumoGeral');
  const fmt = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (store.state.currentRZ) {
    const r = calcResumoRZ(store.state.currentRZ);
    rzDiv.textContent = `${store.state.currentRZ} | Original: ${fmt(r.totalOriginal)} | Ajustado: ${fmt(r.totalAjustado)} | Δ: ${fmt(r.delta)} (${(r.deltaPct * 100).toFixed(2)}%)`;
  } else {
    rzDiv.textContent = '';
  }
  const g = calcResumoGeral();
  geralDiv.textContent = `GERAL | Original: ${fmt(g.totalOriginal)} | Ajustado: ${fmt(g.totalAjustado)} | Δ: ${fmt(g.delta)} (${(g.deltaPct * 100).toFixed(2)}%)`;
}

function renderConsulta() {
  const container = document.getElementById('consultaCard');
  if (!container) return;
  const precoInput = document.getElementById('precoInput');
  const obsInput = document.getElementById('obsInput');
  precoInput.value = '';
  obsInput.value = '';
  container.innerHTML = '';
  if (!consultaAtual) return;
  if (consultaAtual.encontrado) {
    precoInput.value = consultaAtual.precoAtual;
    container.innerHTML = `
      <p>SKU: ${consultaAtual.codigo}</p>
      <p>${consultaAtual.descricao}</p>
      <p>RZ: ${store.state.currentRZ}</p>
      <p>Qtd: ${consultaAtual.conferido}/${consultaAtual.esperado}</p>
      <p>Preço (planilha): ${consultaAtual.precoOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
      <p>Edite o preço se necessário e informe observação.</p>
    `;
  } else {
    container.innerHTML = `
      <p>SKU ${consultaAtual.codigo} não está neste RZ, se registrar entra como Excedente.</p>
    `;
  }
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

      const itens = produtosValidos.map(p => ({
        sku: p.codigoML,
        rz: p.rz,
        qtd: p.quantidade,
        descricao: p.descricao,
        preco: p.preco,
        valorTotal: p.valorTotal,
      }));

      init(itens);
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

function handleConsultar() {
  if (!store.state.currentRZ) return;
  const input = document.getElementById('codigoInput');
  const codigo = input.value.trim();
  if (!codigo) return;

  const pallet = store.state.pallets[store.state.currentRZ];
  const esperado = pallet.expected[codigo];
  const conferido = pallet.conferido[codigo] || 0;

  consultaAtual = {
    codigo,
    encontrado: !!esperado,
    esperado: esperado ? esperado.qtd : 0,
    conferido,
    descricao: esperado ? esperado.descricao : '',
    precoOriginal: esperado ? esperado.precoOriginal : 0,
    precoAtual: esperado ? esperado.precoAtual : 0,
  };
  renderConsulta();
}

function handleRegistrar() {
  if (!store.state.currentRZ || !consultaAtual) return;
  const codigo = consultaAtual.codigo;
  const precoInput = document.getElementById('precoInput');
  const obsInput = document.getElementById('obsInput');
  const obs = obsInput.value.trim();
  const precoAjustado = Number(precoInput.value) || 0;

  if (consultaAtual.encontrado) {
    const res = conferir(codigo);
    if (res.status === 'ok') {
      if (precoAjustado !== consultaAtual.precoOriginal || obs) {
        registrarAjuste({
          codigo,
          precoOriginal: consultaAtual.precoOriginal,
          precoAjustado,
          obs,
        });
      }
    } else if (res.status === 'full') {
      alert('Quantidade já conferida');
    }
  } else {
    registrarExcedente(codigo);
    registrarAjuste({
      tipo: 'EXCEDENTE',
      codigo,
      precoOriginal: 0,
      precoAjustado,
      obs,
    });
  }

  consultaAtual = null;
  document.getElementById('codigoInput').value = '';
  precoInput.value = '';
  obsInput.value = '';
  render();
}

function finalize() {
  const result = finalizeCurrent();
  const faltantesCount = result.faltantes.reduce((s, i) => s + i.quantidade, 0);
  const excedentesCount = result.excedentes.reduce((s, i) => s + i.quantidade, 0);
  const completo = faltantesCount === 0 ? 'completa' : 'parcial';
  const resumoMsg = `Conferência ${completo}\nFaltantes: ${faltantesCount}\nExcedentes: ${excedentesCount}\nDeseja encerrar?`;
  if (confirm(resumoMsg)) {
    const resumo = Object.keys(store.state.pallets).map(rz => ({
      rz,
      ...calcResumoRZ(rz),
    }));
    resumo.push({ rz: 'GERAL', ...calcResumoGeral() });
    exportResult({ ...result, resumo });
  }
}

function setup() {
  document.getElementById('fileInput').addEventListener('change', handleFile);
  document.getElementById('rzSelect').addEventListener('change', handleRzChange);
  document.getElementById('consultarBtn').addEventListener('click', handleConsultar);
  document.getElementById('registrarBtn').addEventListener('click', handleRegistrar);
  document.getElementById('finalizarBtn').addEventListener('click', finalize);
  document.getElementById('codigoInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (e.ctrlKey) handleRegistrar();
      else handleConsultar();
    }
  });
  loadState();
  populateRZs();
  render();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', setup);
}

