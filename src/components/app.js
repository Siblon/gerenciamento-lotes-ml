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
  findRZDeSKU,
} from '../store/index.js';
import { processarPlanilha, exportResult } from '../utils/excel.js';
import { brl } from '../utils/format.js';

const listState = {
  conferidos: { page: 1, perPage: 50, query: '', collapsed: false },
  faltantes: { page: 1, perPage: 50, query: '', collapsed: false },
  excedentes: { page: 1, perPage: 50, query: '', collapsed: false },
};

const debounce = (fn, delay = 200) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
};

function paginate(array, page, perPage) {
  const total = array.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  return { slice: array.slice(start, start + perPage), total, pages };
}

function toast(msg, dur = 2000) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, dur);
}

let scanMode = 'manual';

let stream = null;
let detector = null;
let zxingReader = null;
let usingZXing = false;

const abrirBtn = document.getElementById('abrirCameraBtn');
const modal = document.getElementById('cameraModal');
const fecharBtn = document.getElementById('fecharCameraBtn');
const videoEl = document.getElementById('videoPreview');
const statusEl = document.getElementById('scanStatus');
const cameraSelect = document.getElementById('cameraSelect');
const torchBtn = document.getElementById('toggleTorchBtn');

let currentTrack = null;
let torchOn = false;

abrirBtn?.addEventListener('click', abrirCamera);

fecharBtn?.addEventListener('click', () => fecharCamera());

function setScanMode(mode) {
  scanMode = mode;
  const manualBtn = document.getElementById('scanManualBtn');
  const autoBtn = document.getElementById('scanAutoBtn');
  manualBtn?.classList.toggle('active', mode === 'manual');
  autoBtn?.classList.toggle('active', mode === 'auto');
  try {
    localStorage.setItem('scanMode', mode);
  } catch {}
  toast(`Scan em modo ${mode === 'auto' ? 'Automático' : 'Manual'}.`, 1500);
}

function mostrarDialogoTrocaRZ({ sku, rzEncontrado, onTrocar, onExcedente }) {
  const msg = `SKU ${sku} encontrado no ${rzEncontrado}. Trocar para esse RZ?`;
  if (confirm(msg)) onTrocar();
  else onExcedente();
}

let consultaAtual = null;

function render() {
  const prog = progress();
  const rz = store.state.currentRZ ? `RZ: ${store.state.currentRZ} - ` : '';
  document.getElementById('progresso').textContent = `${rz}${prog.done} de ${prog.total} conferidos`;
  renderConferidos();
  renderFaltantes();
  renderExcedentes();
  renderConsulta();
  renderResumos();
}

function renderConferidos() {
  const state = listState.conferidos;
  const list = listarConferidos().map(it => ({
    ...it,
    descricao:
      store.state.pallets[store.state.currentRZ]?.expected[it.codigo]?.descricao || '',
  }));
  const q = state.query.trim().toLowerCase();
  const filtered = q
    ? list.filter(it =>
        it.codigo.toLowerCase().includes(q) || (it.descricao || '').toLowerCase().includes(q),
      )
    : list;
  const { slice, total, pages } = paginate(filtered, state.page, state.perPage);
  if (state.page > pages) {
    state.page = pages;
    return renderConferidos();
  }
  const search = document.querySelector('.lista-search[data-list="conferidos"]');
  if (search && search.value !== state.query) search.value = state.query;
  const sel = document.querySelector('.lista-pagesize[data-list="conferidos"]');
  if (sel && Number(sel.value) !== state.perPage) sel.value = state.perPage;
  document.getElementById('conferidosCount').textContent = total;
  const tbody = document.getElementById('conferidosTable');
  tbody.innerHTML = '';
  slice.forEach(item => {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    const esperado = item.esperado;
    const conf = Math.min(item.conferido, esperado);
    td.textContent =
      esperado > 1 ? `${item.codigo} (${conf}/${esperado})` : item.codigo;
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
  renderPagination('conferidos', state.page, pages);
  document
    .getElementById('conferidosBody')
    .classList.toggle('hidden', state.collapsed);
  const toggleBtn = document.querySelector('.lista-toggle[data-list="conferidos"]');
  if (toggleBtn) toggleBtn.textContent = state.collapsed ? 'Expandir' : 'Recolher';
}

function renderFaltantes() {
  const state = listState.faltantes;
  const list = listarFaltantes().map(it => ({
    ...it,
    descricao:
      store.state.pallets[store.state.currentRZ]?.expected[it.codigo]?.descricao || '',
  }));
    const q = state.query.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          it =>
            it.codigo.toLowerCase().includes(q) || (it.descricao || '').toLowerCase().includes(q),
        )
      : list;
  const { slice, total, pages } = paginate(filtered, state.page, state.perPage);
  if (state.page > pages) {
    state.page = pages;
    return renderFaltantes();
  }
  const search = document.querySelector('.lista-search[data-list="faltantes"]');
  if (search && search.value !== state.query) search.value = state.query;
  const sel = document.querySelector('.lista-pagesize[data-list="faltantes"]');
  if (sel && Number(sel.value) !== state.perPage) sel.value = state.perPage;
  document.getElementById('faltantesCount').textContent = total;
  const tbody = document.getElementById('faltantesTable');
  tbody.innerHTML = '';
  slice.forEach(item => {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    const esperado = item.esperado;
    const desc = item.descricao ? ` — ${item.descricao}` : '';
    const base = `${item.codigo}${desc}`;
    td.textContent = esperado > 1 ? `${base} (${item.conferido}/${esperado})` : base;
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
  renderPagination('faltantes', state.page, pages);
  document
    .getElementById('faltantesBody')
    .classList.toggle('hidden', state.collapsed);
  const toggleBtn = document.querySelector('.lista-toggle[data-list="faltantes"]');
  if (toggleBtn) toggleBtn.textContent = state.collapsed ? 'Expandir' : 'Recolher';
}

function renderExcedentes() {
  const state = listState.excedentes;
  const list = listarExcedentes();
  const q = state.query.toLowerCase();
  const filtered = q
    ? list.filter(
        it => it.sku.toLowerCase().includes(q) || it.descricao.toLowerCase().includes(q),
      )
    : list;
  const { slice, total, pages } = paginate(filtered, state.page, state.perPage);
  if (state.page > pages) {
    state.page = pages;
    return renderExcedentes();
  }
  const search = document.querySelector('.lista-search[data-list="excedentes"]');
  if (search && search.value !== state.query) search.value = state.query;
  const sel = document.querySelector('.lista-pagesize[data-list="excedentes"]');
  if (sel && Number(sel.value) !== state.perPage) sel.value = state.perPage;
  document.getElementById('excedentesCount').textContent = total;
  const tbody = document.getElementById('excedentesTable');
  tbody.innerHTML = '';
  slice.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.sku}</td>
      <td>${item.descricao}</td>
      <td>${item.qtd}</td>
      <td>${brl(item.precoMedio)}</td>
      <td>${brl(item.valorTotal)}</td>
    `;
    tbody.appendChild(tr);
  });
  renderPagination('excedentes', state.page, pages);
  document
    .getElementById('excedentesBody')
    .classList.toggle('hidden', state.collapsed);
  const toggleBtn = document.querySelector('.lista-toggle[data-list="excedentes"]');
  if (toggleBtn) toggleBtn.textContent = state.collapsed ? 'Expandir' : 'Recolher';
}

function renderPagination(name, page, pages) {
  const container = document.getElementById(`${name}Pagination`);
  if (!container) return;
  container.innerHTML = '';
  const makeBtn = (label, target) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      listState[name].page = target;
      render();
    });
    return btn;
  };
  const first = makeBtn('«', 1);
  const prev = makeBtn('‹', Math.max(1, page - 1));
  const next = makeBtn('›', Math.min(pages, page + 1));
  const last = makeBtn('»', pages);
  first.disabled = page === 1;
  prev.disabled = page === 1;
  next.disabled = page === pages;
  last.disabled = page === pages;
  container.append(first, prev);
  const info = document.createElement('span');
  info.textContent = `página ${page}/${pages}`;
  container.append(info, next, last);
}

function calcResumoRZ(rz) {
  const pallet = store.state.pallets[rz];
  if (!pallet) return { totalOriginal: 0, totalAjustado: 0, delta: 0, deltaPct: 0 };
  let totalOriginal = 0;
  let totalAjustado = 0;
  Object.values(pallet.expected).forEach(it => {
    totalOriginal += it.valorTotalOriginal || it.precoOriginal * it.qtd;
    totalAjustado += (it.precoAtual ?? it.precoOriginal) * it.qtd;
  });
  const delta = totalAjustado - totalOriginal;
  const deltaPct = totalOriginal ? delta / totalOriginal : 0;
  return { totalOriginal, totalAjustado, delta, deltaPct };
}

function calcResumoGeral() {
  let totalOriginal = 0;
  let totalAjustado = 0;
  Object.keys(store.state.pallets).forEach(rz => {
    const r = calcResumoRZ(rz);
    totalOriginal += r.totalOriginal;
    totalAjustado += r.totalAjustado;
  });
  const delta = totalAjustado - totalOriginal;
  const deltaPct = totalOriginal ? delta / totalOriginal : 0;
  return { totalOriginal, totalAjustado, delta, deltaPct };
}

function renderResumos() {
  const rzDiv = document.getElementById('resumoRZ');
  const geralDiv = document.getElementById('resumoGeral');
  if (store.state.currentRZ) {
    const r = calcResumoRZ(store.state.currentRZ);
    const exRZ = listarExcedentes().reduce((s, e) => s + e.valorTotal, 0);
    const cls = r.delta < 0 ? 'diff-neg' : r.delta > 0 ? 'diff-pos' : 'diff-zero';
    rzDiv.innerHTML =
      `${store.state.currentRZ} | Original: ${brl(r.totalOriginal)} | Ajustado: ${brl(r.totalAjustado)} | ` +
      `<span class="diff-label">Diferença:</span><span class="diff-badge ${cls}">${brl(r.delta)} (${(
        r.deltaPct * 100
      ).toFixed(2)}%)</span> | Excedentes: ${brl(exRZ)}`;
  } else {
    rzDiv.textContent = '';
  }
  const g = calcResumoGeral();
  const exG = Array.from(store.state.excedentes.values()).reduce(
    (s, e) => s + e.valorTotal,
    0,
  );
  const gCls = g.delta < 0 ? 'diff-neg' : g.delta > 0 ? 'diff-pos' : 'diff-zero';
  geralDiv.innerHTML =
    `GERAL | Original: ${brl(g.totalOriginal)} | Ajustado: ${brl(g.totalAjustado)} | ` +
    `<span class="diff-label">Diferença:</span><span class="diff-badge ${gCls}">${brl(g.delta)} (${(
      g.deltaPct * 100
    ).toFixed(2)}%)</span> | Excedentes: ${brl(exG)}`;
}

function renderConsulta() {
  const container = document.getElementById('consultaCard');
  if (!container) return;
  const precoInput = document.getElementById('precoInput');
  const obsInput = document.getElementById('obsInput');
  const registrarBtn = document.getElementById('registrarBtn');
  const excedenteBtn = document.getElementById('excedenteBtn');
  const exDescInput = document.getElementById('exDescInput');
  const exQtdInput = document.getElementById('exQtdInput');
  const exForm = document.getElementById('excedenteForm');
  precoInput.value = '';
  obsInput.value = '';
  precoInput.placeholder = 'Preço ajustado';
  registrarBtn.disabled = true;
  excedenteBtn.disabled = true;
  if (exDescInput) exDescInput.value = '';
  if (exQtdInput) exQtdInput.value = 1;
  if (exForm) exForm.style.display = 'none';
  container.innerHTML = '';
  if (!consultaAtual) return;
  if (consultaAtual.encontrado) {
    registrarBtn.disabled = false;
    precoInput.value = consultaAtual.precoAtual;
    const delta = consultaAtual.precoAtual - consultaAtual.precoOriginal;
    const deltaPct = consultaAtual.precoOriginal
      ? delta / consultaAtual.precoOriginal
      : 0;
    const cls = delta < 0 ? 'diff-neg' : delta > 0 ? 'diff-pos' : 'diff-zero';
    container.innerHTML = `
      <p>SKU: ${consultaAtual.codigo}</p>
      <p>${consultaAtual.descricao}</p>
      <p>RZ: ${store.state.currentRZ}</p>
      <p>Qtd: ${consultaAtual.conferido}/${consultaAtual.esperado}</p>
      <p>Preço original: ${brl(consultaAtual.precoOriginal)}</p>
      <p>Preço ajustado: ${brl(consultaAtual.precoAtual)}</p>
      <p><span class="diff-label">Diferença:</span><span class="diff-badge ${cls}">${brl(delta)} (${(
        deltaPct * 100
      ).toFixed(2)}%)</span></p>
      <p>Edite o preço se necessário e informe observação.</p>
    `;
  } else {
    excedenteBtn.disabled = false;
    precoInput.placeholder = 'Preço ajustado (obrigatório p/ excedente)';
    if (exForm) exForm.style.display = 'block';
    const sku = consultaAtual.codigo;
    const key = `${store.state.currentRZ}::${sku}`;
    const prev = store.state.excedentes.get(key);
    if (prev) {
      if (exDescInput) exDescInput.value = prev.descricao || '';
      if (exQtdInput) exQtdInput.value = 1;
      precoInput.value = Number(prev.precoMedio || 0) || '';
    } else {
      if (exDescInput) exDescInput.value = '';
      if (exQtdInput) exQtdInput.value = 1;
      precoInput.value = '';
    }
    container.innerHTML = `
      <p>SKU ${consultaAtual.codigo} não está neste RZ. Registro será lançado como Excedente.</p>
    `;
    if (exDescInput) exDescInput.focus();
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
      salvar();
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
    salvar();
  }
}

function consultar() {
  if (!store.state.currentRZ) return { status: 'no-rz' };
  const input = document.getElementById('codigoInput');
  const codigo = input.value.trim();
  if (!codigo) return { status: 'empty' };

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
  renderResumos();

  if (esperado) return { status: 'found' };
  const other = findRZDeSKU(codigo);
  if (other && other !== store.state.currentRZ) {
    mostrarDialogoTrocaRZ({
      sku: codigo,
      rzEncontrado: other,
      onTrocar: () => {
        selectRZ(other);
        document.getElementById('rzSelect').value = other;
        render();
        salvar();
        consultar();
      },
      onExcedente: () => {},
    });
    return { status: 'other', rzEncontrado: other };
  }
  return { status: 'not-found' };
}

function handleRegistrar() {
  if (!store.state.currentRZ || !consultaAtual || !consultaAtual.encontrado) return;
  const codigo = consultaAtual.codigo;
  const precoInput = document.getElementById('precoInput');
  const obsInput = document.getElementById('obsInput');
  const obs = obsInput.value.trim();
  const precoAjustado = Number(precoInput.value) || 0;

  const res = conferir(codigo);
  if (res.status === 'ok') {
    if (precoAjustado !== consultaAtual.precoAtual || obs) {
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

  consultaAtual = null;
  const codigoInput = document.getElementById('codigoInput');
  codigoInput.value = '';
  precoInput.value = '';
  obsInput.value = '';
  render();
  salvar();
  codigoInput.focus();
  codigoInput.select();
}

function onCodigo(valor) {
  const v = String(valor || '').trim();
  if (!v) return;
  const input = document.getElementById('codigoInput');
  input.value = v;

  const mode = localStorage.getItem('scanMode') || 'manual';
  if (mode === 'auto') consultar();
  else input.focus();

  fecharCamera();
}

async function abrirCamera() {
  try {
    modal.classList.remove('hidden');
    statusEl.textContent = 'Solicitando câmera...';

    const constraints = { video: { facingMode: { ideal: 'environment' } } };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = stream;
    await videoEl.play();

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(d => d.kind === 'videoinput');
    if (videoInputs.length > 1) {
      cameraSelect.classList.remove('hidden');
      cameraSelect.innerHTML = videoInputs
        .map(d => `<option value="${d.deviceId}">${d.label || 'Câmera'}</option>`)
        .join('');
      cameraSelect.onchange = async () => {
        await trocarCamera(cameraSelect.value);
      };
    }

    currentTrack = stream.getVideoTracks()[0];
    const caps = currentTrack?.getCapabilities?.();
    if (caps && 'torch' in caps) {
      torchBtn.classList.remove('hidden');
      torchBtn.onclick = async () => {
        torchOn = !torchOn;
        await currentTrack.applyConstraints({ advanced: [{ torch: torchOn }] });
        torchBtn.textContent = torchOn ? 'Lanterna (on)' : 'Lanterna';
      };
    }

    if ('BarcodeDetector' in window) {
      detector = new BarcodeDetector({ formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      statusEl.textContent = 'Lendo...';
      loopNativo();
      usingZXing = false;
    } else {
      usingZXing = true;
      statusEl.textContent = 'Lendo (ZXing)...';
      await iniciarZXing(videoEl, onCodigo);
    }
  } catch (err) {
    statusEl.textContent = 'Erro ao abrir câmera';
    if (err?.name === 'NotAllowedError') {
      toast?.('Permissão negada. Verifique as permissões do navegador (HTTPS obrigatório no mobile).');
    } else {
      toast?.('Não foi possível acessar a câmera. Verifique permissões (HTTPS obrigatório no mobile).');
    }
    console.error(err);
  }
}

async function trocarCamera(deviceId) {
  const wasZXing = usingZXing;
  fecharCamera(false);
  usingZXing = wasZXing;
  const constraints = { video: { deviceId: { exact: deviceId } } };
  stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoEl.srcObject = stream;
  await videoEl.play();
  currentTrack = stream.getVideoTracks()[0];

  const caps = currentTrack?.getCapabilities?.();
  if (caps && 'torch' in caps) {
    torchBtn.classList.remove('hidden');
    torchBtn.onclick = async () => {
      torchOn = !torchOn;
      await currentTrack.applyConstraints({ advanced: [{ torch: torchOn }] });
      torchBtn.textContent = torchOn ? 'Lanterna (on)' : 'Lanterna';
    };
  } else {
    torchBtn.classList.add('hidden');
  }

  if (usingZXing) {
    statusEl.textContent = 'Lendo (ZXing)...';
    await iniciarZXing(videoEl, onCodigo);
  } else {
    statusEl.textContent = 'Lendo...';
    loopNativo();
  }
}

async function loopNativo() {
  if (!detector || modal.classList.contains('hidden')) return;
  try {
    const results = await detector.detect(videoEl);
    if (results?.length) {
      onCodigo(results[0].rawValue);
      return;
    }
  } catch (e) {
    /* ignore */
  }
  requestAnimationFrame(loopNativo);
}

async function iniciarZXing(videoEl, onCodigo) {
  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    if (!BrowserMultiFormatReader) {
      console.error('BrowserMultiFormatReader não disponível');
      toast?.('Leitor ZXing indisponível');
      return;
    }
    zxingReader = new BrowserMultiFormatReader();
    await zxingReader.decodeFromVideoDevice(null, videoEl, result => {
      if (result) onCodigo(result.getText());
    });
  } catch (err) {
    console.error('Erro ao carregar ZXing:', err);
    toast?.('Falha ao carregar leitor ZXing');
  }
}

function pararZXing() {
  try {
    zxingReader?.reset?.();
  } catch (err) {
    console.error('Erro ao parar ZXing:', err);
  }
  zxingReader = null;
}

function fecharCamera(hide = true) {
  try {
    pararZXing();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    currentTrack = null;
    torchOn = false;
  } finally {
    if (hide) modal.classList.add('hidden');
    statusEl.textContent = 'Pronto';
  }
}

function handleRegistrarExcedente() {
  if (!store.state.currentRZ || !consultaAtual || consultaAtual.encontrado) return;
  const sku = consultaAtual.codigo;
  const precoInput = document.getElementById('precoInput');
  const obsInput = document.getElementById('obsInput');
  const exDescInput = document.getElementById('exDescInput');
  const exQtdInput = document.getElementById('exQtdInput');
  const descricao = exDescInput.value.trim();
  const qtd = Number(exQtdInput.value);
  const precoUnit = Number(precoInput.value);
  if (!descricao || qtd < 1 || precoUnit <= 0) {
    alert('Preencha descrição, quantidade >=1 e preço unitário > 0');
    return;
  }
  const obs = obsInput.value.trim();
  registrarExcedente({ sku, descricao, qtd, precoUnit, obs });
  registrarAjuste({
    tipo: 'EXCEDENTE',
    codigo: sku,
    precoOriginal: 0,
    precoAjustado: precoUnit,
    qtd,
    obs,
  });
  consultaAtual = null;
  const codigoInput = document.getElementById('codigoInput');
  codigoInput.value = '';
  precoInput.value = '';
  obsInput.value = '';
  if (exDescInput) exDescInput.value = '';
  if (exQtdInput) exQtdInput.value = 1;
  render();
  salvar();
  codigoInput.focus();
  codigoInput.select();
}

function finalize() {
  const result = finalizeCurrent();
  const faltantesCount = result.faltantes.reduce((s, i) => s + i.quantidade, 0);
  const excedentesCount = result.excedentes.reduce((s, i) => s + i.qtd, 0);
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

function getConferidosPlain() {
  const arr = [];
  Object.keys(store.state.pallets).forEach(rz => {
    const pal = store.state.pallets[rz];
    Object.entries(pal.conferido).forEach(([sku, qtd]) => {
      arr.push({ sku, rz, qtd });
    });
  });
  return arr;
}

function getFaltantesPlain() {
  const arr = [];
  Object.keys(store.state.pallets).forEach(rz => {
    const pal = store.state.pallets[rz];
    Object.keys(pal.expected).forEach(sku => {
      const exp = pal.expected[sku].qtd;
      const conf = pal.conferido[sku] || 0;
      if (conf < exp) {
        arr.push({ sku, rz, quantidade: exp - conf, esperado: exp, conferido: conf });
      }
    });
  });
  return arr;
}

function setConferidosFromPlain(list) {
  Object.keys(store.state.pallets).forEach(rz => {
    store.state.pallets[rz].conferido = {};
  });
  list.forEach(it => {
    if (!store.state.pallets[it.rz]) {
      store.state.pallets[it.rz] = { expected: {}, conferido: {} };
    }
    store.state.pallets[it.rz].conferido[it.sku] = it.qtd;
  });
}

function setFaltantesFromPlain(_list) {
  // faltantes são derivados de expected e conferido
}


function salvar() {
  const itens = [];
  Object.keys(store.state.pallets).forEach(rz => {
    const pal = store.state.pallets[rz];
    Object.entries(pal.expected).forEach(([sku, it]) => {
      itens.push({
        sku,
        rz,
        qtd: it.qtd,
        descricao: it.descricao,
        precoOriginal: it.precoOriginal,
        precoAtual: it.precoAtual,
        valorTotalOriginal: it.valorTotalOriginal,
      });
    });
  });
  const state = {
    rzAtual: store.state.currentRZ,
    itens,
    ajustes: store.state.ajustes,
    listas: {
      conferidos: getConferidosPlain(),
      faltantes: getFaltantesPlain(),
    },
    excedentes: Array.from(store.state.excedentes.values()),
    version: 2,
  };
  localStorage.setItem('estadoConferencia', JSON.stringify(state));
}

function restaurar() {
  const raw = localStorage.getItem('estadoConferencia');
  if (!raw) return;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return;
  }
  store.state.pallets = {};
  (data.itens || []).forEach(it => {
    if (!store.state.pallets[it.rz]) {
      store.state.pallets[it.rz] = { expected: {}, conferido: {} };
    }
    store.state.pallets[it.rz].expected[it.sku] = {
      qtd: it.qtd,
      precoOriginal: it.precoOriginal,
      precoAtual: it.precoAtual ?? it.precoOriginal,
      valorTotalOriginal: it.valorTotalOriginal || it.precoOriginal * it.qtd,
      descricao: it.descricao,
    };
  });
  store.state.currentRZ = data.rzAtual || null;
  store.state.ajustes = Array.isArray(data.ajustes) ? data.ajustes : [];
  setConferidosFromPlain(data.listas?.conferidos || []);
  setFaltantesFromPlain(data.listas?.faltantes || []);
  store.state.excedentes = new Map(
    (data.excedentes || []).map(e => [`${e.rz}::${e.sku}`, e]),
  );
  populateRZs();
  renderTudo();
  renderResumos();
}

function renderTudo() {
  render();
}

function setup() {
  document.getElementById('fileInput').addEventListener('change', handleFile);
  document.getElementById('rzSelect').addEventListener('change', handleRzChange);
  document.getElementById('consultarBtn').addEventListener('click', consultar);
  document.getElementById('registrarBtn').addEventListener('click', handleRegistrar);
  document
    .getElementById('excedenteBtn')
    .addEventListener('click', handleRegistrarExcedente);
  document.getElementById('finalizarBtn').addEventListener('click', finalize);
  document.getElementById('codigoInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.ctrlKey) handleRegistrar();
      else onCodigo(e.target.value);
    }
  });
  document
    .getElementById('scanManualBtn')
    .addEventListener('click', () => setScanMode('manual'));
  document
    .getElementById('scanAutoBtn')
    .addEventListener('click', () => setScanMode('auto'));
  scanMode = localStorage.getItem('scanMode') || 'manual';
  setScanMode(scanMode);
  if (!navigator.mediaDevices?.getUserMedia) {
    abrirBtn.disabled = true;
    abrirBtn.title = 'Câmera não disponível';
  } else {
    navigator.mediaDevices
      .enumerateDevices()
      .then(devices => {
        if (!devices.some(d => d.kind === 'videoinput')) {
          abrirBtn.disabled = true;
          abrirBtn.title = 'Câmera não disponível';
        }
      })
      .catch(() => {});
  }
  document.querySelectorAll('.lista-search').forEach(inp => {
    const list = inp.dataset.list;
    inp.addEventListener(
      'input',
      debounce(e => {
        listState[list].query = e.target.value;
        listState[list].page = 1;
        render();
      }),
    );
  });
  document.querySelectorAll('.lista-pagesize').forEach(sel => {
    const list = sel.dataset.list;
    sel.addEventListener('change', e => {
      listState[list].perPage = Number(e.target.value);
      listState[list].page = 1;
      render();
    });
  });
  document.querySelectorAll('.lista-toggle').forEach(btn => {
    const list = btn.dataset.list;
    btn.addEventListener('click', () => {
      listState[list].collapsed = !listState[list].collapsed;
      render();
    });
  });
  restaurar();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', setup);
  window.handleCodigoLido = onCodigo;
}

