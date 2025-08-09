// src/components/app.js

// ====== IMPORTS LOCAIS (ajuste caminhos se necessário) ======
import { processarPlanilha, exportResult } from '../utils/excel.js';
import { brl } from '../utils/format.js'; // brl(n) -> "R$ 1.234,56"
import * as XLSX from 'xlsx';

// ====== ESTADO GLOBAL ======
let skuIndex = new Map(); // sku -> Item
let ajustes = [];         // [{ tipo:'AJUSTE_PRECO'|'EXCEDENTE', ... }]
let excedentesMap = new Map(); // `${rz}::${sku}` -> Excedente
let rzAtual = '';
let listas = {
  conferidos: [],
  faltantes: [],
  excedentes: [] // (linhas UI, diferente de excedentesMap consolidado)
};
let undoStack = [];

const listState = {
  conferidos: { page: 1, perPage: 50, query: '' },
  faltantes:  { page: 1, perPage: 50, query: '' },
  excedentes: { page: 1, perPage: 50, query: '' },
};

// ====== ELEMENTOS DOM ======
const fileInput      = document.getElementById('fileInput');
const rzSelect       = document.getElementById('rzSelect');
const codigoInput    = document.getElementById('codigoInput');
const precoInput     = document.getElementById('precoInput');
const obsInput       = document.getElementById('obsInput');

const consultarBtn   = document.getElementById('consultarBtn');
const registrarBtn   = document.getElementById('registrarBtn');
const excedenteBtn   = document.getElementById('excedenteBtn');
const finalizarBtn   = document.getElementById('finalizarBtn');
const exportarBtn    = document.getElementById('exportarBtn');

const consultaCard   = document.getElementById('consultaCard');
const resumoRZEl     = document.getElementById('resumoRZ');
const resumoGeralEl  = document.getElementById('resumoGeral');

// ====== SCAN STATE/DOM ======
let stream = null;
let detector = null;
let zxingReader = null;
let usingZXing = false;
let currentTrack = null;
let torchOn = false;
let lastResult = null;            // evita duplicados
let reading = false;

const abrirCameraBtn = document.getElementById('abrirCameraBtn');
const cameraModal    = document.getElementById('cameraModal');
const videoEl        = document.getElementById('videoPreview');
const fecharBtn      = document.getElementById('fecharCameraBtn');
const cameraSelect   = document.getElementById('cameraSelect');
const torchBtn       = document.getElementById('toggleTorchBtn');
const statusEl       = document.getElementById('scanStatus');

abrirCameraBtn?.addEventListener('click', abrirCamera);
fecharBtn?.addEventListener('click', () => fecharCamera(true));

// inputs do excedente (mini‑form)
const exDescInput    = document.getElementById('exDescInput');
const exQtdInput     = document.getElementById('exQtdInput');

let scanMode = localStorage.getItem('scanMode') || 'manual'; // 'auto' | 'manual'

// ====== HELPERS ======
const fmt = (n) => brl(Number(n) || 0);
const pct = (num, den) => {
  const d = Number(den) || 0;
  if (!d) return '(0.00%)';
  const p = (Number(num) / d) * 100;
  return `(${p.toFixed(2)}%)`;
};
const diffBadge = (ajustado, original, baseQtd = 1) => {
  const delta = (ajustado - original) * baseQtd;
  const cls =
    ajustado > original ? 'diff-badge diff-pos' :
    ajustado < original ? 'diff-badge diff-neg' :
    'diff-badge diff-zero';
  const perc = pct(ajustado - original, original);
  return `<span class="diff-label">Diferença:</span><span class="${cls}">${fmt(delta)} ${perc}</span>`;
};

const paginate = (arr, page, perPage) => {
  const total = arr.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * perPage;
  return { page: p, pages, total, slice: arr.slice(start, start + perPage) };
};

const keyEx = (rz, sku) => `${rz}::${sku}`;

// ====== INIT ======
function init() {
  // Eventos básicos
  fileInput?.addEventListener('change', handleUpload);
  rzSelect?.addEventListener('change', () => {
    rzAtual = rzSelect.value;
    salvar();
    renderTudo();
  });

  consultarBtn?.addEventListener('click', consultar);
  registrarBtn?.addEventListener('click', registrar);
  excedenteBtn?.addEventListener('click', registrarExcedente);
  finalizarBtn?.addEventListener('click', finalizarConferencia);
  exportarBtn?.addEventListener('click', exportarXLSX);

  // Atalhos mínimos
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.ctrlKey) consultar();
    if (ev.key === 'Enter' && ev.ctrlKey) {
      if (!registrarBtn?.disabled) registrar();
      else if (!excedenteBtn?.disabled) registrarExcedente();
    }
  });

  restaurar();
}
document.addEventListener('DOMContentLoaded', init);

// ====== UPLOAD / INDEX ======
async function handleUpload() {
  const file = fileInput.files?.[0];
  if (!file) return;
  const parsed = await processarPlanilha(file); // deve retornar { itens, rzs, ... }
  montarIndice(parsed.itens);
  montarListasBase(parsed.itens);

  // popular select RZ
  rzSelect.innerHTML = '';
  [...new Set(parsed.itens.map(it => it.rz))].forEach(rz => {
    const opt = document.createElement('option');
    opt.value = rz; opt.textContent = rz;
    rzSelect.appendChild(opt);
  });
  rzAtual = rzSelect.value = rzSelect.value || parsed.itens[0]?.rz || '';
  salvar();
  renderTudo();
}

function montarIndice(itens) {
  skuIndex.clear();
  itens.forEach(it => {
    const precoOriginal = Number(it.preco || 0);
    const obj = {
      sku: it.sku,
      rz: it.rz,
      descricao: it.descricao || '',
      qtd: Number(it.qtd || 0),
      lidas: 0,
      precoOriginal,
      precoAtual: precoOriginal,
      valorTotalOriginal: Number(it.valorTotal ?? (precoOriginal * Number(it.qtd || 0)))
    };
    skuIndex.set(it.sku, obj);
  });
}

function montarListasBase(itens) {
  listas.conferidos = [];
  listas.excedentes = [];
  // faltantes = todos inicial
  listas.faltantes = itens.map(it => ({
    sku: it.sku, descricao: it.descricao || '', qtd: Number(it.qtd || 0), lidas: 0, rz: it.rz
  })).filter(x => x.rz === rzAtual);
}

// ====== CONSULTAR / REGISTRAR ======
function consultar() {
  if (!consultaCard || !precoInput || !obsInput || !codigoInput || !registrarBtn || !excedenteBtn) {
    console.error('Elementos da interface ausentes');
    return;
  }
  const sku = (codigoInput.value || '').trim();
  const it = skuIndex.get(sku);

  if (!it || it.rz !== rzAtual) {
    // Excedente
    registrarBtn.disabled = true;
    excedenteBtn.disabled = false;
    mostrarCardExcedente(sku);
    return;
  }

  // SKU do RZ atual
  registrarBtn.disabled = false;
  excedenteBtn.disabled = true;

  // preenche campos
  precoInput.value = it.precoAtual ?? it.precoOriginal ?? 0;
  obsInput.value = '';

  consultaCard.innerHTML = `
    <div><strong>SKU:</strong> ${it.sku}</div>
    <div>${it.descricao || ''}</div>
    <div><strong>RZ:</strong> ${it.rz}</div>
    <div><strong>Qtd:</strong> ${it.lidas}/${it.qtd}</div>
    <div><strong>Preço original:</strong> ${fmt(it.precoOriginal)}</div>
    <div><strong>Preço ajustado:</strong> ${fmt(it.precoAtual)}</div>
    <div>${diffBadge(it.precoAtual, it.precoOriginal, it.qtd)}</div>
    <div style="opacity:.8">Edite o preço se necessário e informe observação.</div>
  `;
}

function registrar() {
  const sku = (codigoInput.value || '').trim();
  const it = skuIndex.get(sku);
  if (!it || it.rz !== rzAtual) return;

  const novoPreco = Number(precoInput.value || it.precoAtual || 0);
  const obs = (obsInput.value || '').trim();

  if (it.lidas >= it.qtd) {
    toast('Quantidade já completa para este SKU.');
    return;
  }

  // ajuste de preço?
  if (novoPreco !== it.precoOriginal || obs) {
    ajustes.push({
      tipo: 'AJUSTE_PRECO',
      sku: it.sku,
      rz: it.rz,
      precoOriginal: it.precoOriginal,
      precoAjustado: novoPreco,
      obs,
      timestamp: new Date().toISOString()
    });
    it.precoAtual = novoPreco;
  }

  it.lidas += 1;

  // mover UI faltantes->conferidos
  moverFaltanteParaConferido(it.sku);

  undoStack.push({ type: 'REGISTRO', sku: it.sku, rz: it.rz });
  salvar();
  renderTudo();
  codigoInput.focus();
  codigoInput.select();
}

function mostrarCardExcedente(sku) {
  const prev = excedentesMap.get(keyEx(rzAtual, sku));
  const precoSugerido = prev?.precoMedio || 0;
  consultaCard.innerHTML = `
    <div>SKU <strong>${sku || '(vazio)'}</strong> não está neste RZ.</div>
    <div>Registro será lançado como <strong>Excedente</strong>.</div>
    <div style="margin-top:6px;opacity:.9">Informe <strong>Descrição</strong>, <strong>Quantidade</strong> e <strong>Preço unitário</strong>.</div>
  `;
  if (exDescInput) exDescInput.value = prev?.descricao || '';
  if (exQtdInput) exQtdInput.value = 1;
  if (precoInput) precoInput.value = precoSugerido ? String(precoSugerido) : '';
}

function registrarExcedente() {
  const sku = (codigoInput.value || '').trim();
  const desc = (exDescInput?.value || '').trim();
  const qtd = Number(exQtdInput?.value || 1);
  const precoUnit = Number(precoInput.value || 0);
  const obs = (obsInput.value || '').trim();

  if (!sku) return toast('Informe o SKU.');
  if (!desc) return toast('Descrição obrigatória para excedente.');
  if (!(qtd >= 1)) return toast('Quantidade deve ser ≥ 1.');
  if (!(precoUnit > 0)) return toast('Preço unitário obrigatório para excedente.');

  const k = keyEx(rzAtual, sku);
  const valorNovo = qtd * precoUnit;

  if (!excedentesMap.has(k)) {
    excedentesMap.set(k, {
      sku, rz: rzAtual, descricao: desc,
      qtd, precoMedio: precoUnit, valorTotal: valorNovo,
      historico: [{ qtd, precoUnit, obs, ts: new Date().toISOString() }]
    });
  } else {
    const ex = excedentesMap.get(k);
    const valorAnt = ex.qtd * ex.precoMedio;
    const qtdTot  = ex.qtd + qtd;
    const valorTot= valorAnt + valorNovo;
    ex.qtd = qtdTot;
    ex.precoMedio = valorTot / qtdTot;
    ex.valorTotal = valorTot;
    if (!ex.descricao) ex.descricao = desc;
    ex.historico.push({ qtd, precoUnit, obs, ts: new Date().toISOString() });
  }

  // linha de ajustes (auditoria)
  ajustes.push({
    tipo: 'EXCEDENTE',
    sku, rz: rzAtual, precoOriginal: 0,
    precoAjustado: precoUnit, qtd, obs,
    timestamp: new Date().toISOString()
  });

  // UI lista Excedentes (simples)
  listas.excedentes.push({ sku, descricao: desc, qtd, preco: precoUnit, rz: rzAtual });

  undoStack.push({ type: 'EXCEDENTE', sku, rz: rzAtual, qtd, preco: precoUnit });

  // limpar campos
  if (exDescInput) exDescInput.value = '';
  if (exQtdInput) exQtdInput.value = 1;
  precoInput.value = '';
  obsInput.value = '';

  salvar();
  renderTudo();
  codigoInput.focus();
  codigoInput.select();
}

// ====== LISTAS / RENDER ======
function moverFaltanteParaConferido(sku) {
  // remove da lista faltantes do RZ atual se ficou completo
  const i = listas.faltantes.findIndex(x => x.sku === sku && x.rz === rzAtual);
  if (i >= 0) {
    const base = skuIndex.get(sku);
    listas.faltantes[i].lidas = base.lidas;
    if (base.lidas >= base.qtd) {
      const [rem] = listas.faltantes.splice(i, 1);
      listas.conferidos.push({ sku: rem.sku, descricao: rem.descricao, qtd: base.qtd, rz: rzAtual });
    }
  }
}

function renderTudo() {
  renderResumos();
  renderListas();
  // botões default
  registrarBtn.disabled = true;
  excedenteBtn.disabled = true;
}

function renderResumos() {
  const rz = calcResumoRZ(rzAtual);
  const ge = calcResumoGeral();
  const exRZ = subtotalExcedentes(rzAtual);
  const exG  = subtotalExcedentes();

  resumoRZEl.innerHTML =
    `${rzAtual} | Original: ${fmt(rz.totalOriginal)} | Ajustado: ${fmt(rz.totalAjustado)} | ` +
    `${diffBadge(rz.totalAjustado, rz.totalOriginal, 1)} | Excedentes: ${fmt(exRZ)}`;

  resumoGeralEl.innerHTML =
    `GERAL | Original: ${fmt(ge.totalOriginal)} | Ajustado: ${fmt(ge.totalAjustado)} | ` +
    `${diffBadge(ge.totalAjustado, ge.totalOriginal, 1)} | Excedentes: ${fmt(exG)}`;
}

function subtotalExcedentes(rz = null) {
  let total = 0;
  for (const ex of excedentesIter()) {
    if (rz && ex.rz !== rz) continue;
    total += ex.valorTotal;
  }
  return total;
}

function* excedentesIter() {
  for (const [, ex] of excedentesMap) yield ex;
}

function renderListas() {
  // Este arquivo não conhece seus templates/tables.
  // Para simplificar, mantenha seu render existente e apenas garanta que
  // listas.faltantes tenha { sku, descricao, qtd, lidas, rz }.
  // (Se você renderiza manualmente com innerHTML, aplique paginação + busca.)
  // Aqui só atualizamos contadores no título se existirem badges.
  const conferidosBadge = document.querySelector('[data-badge="conferidos"]');
  const faltantesBadge  = document.querySelector('[data-badge="faltantes"]');
  const excedentesBadge = document.querySelector('[data-badge="excedentes"]');
  if (conferidosBadge) conferidosBadge.textContent = String(listas.conferidos.length);
  if (faltantesBadge)  faltantesBadge.textContent  = String(listas.faltantes.length);
  if (excedentesBadge) excedentesBadge.textContent = String(listas.excedentes.length);
}

// ====== RESUMOS ======
function calcResumoRZ(rz) {
  let totalOriginal = 0;
  let totalAjustado = 0;
  for (const it of skuIndex.values()) {
    if (it.rz !== rz) continue;
    totalOriginal += Number(it.valorTotalOriginal || 0);
    totalAjustado += Number(it.precoAtual || 0) * Number(it.qtd || 0);
  }
  return { totalOriginal, totalAjustado, delta: totalAjustado - totalOriginal,
    deltaPct: totalOriginal ? (totalAjustado - totalOriginal) / totalOriginal : 0 };
}

function calcResumoGeral() {
  let totalOriginal = 0;
  let totalAjustado = 0;
  for (const it of skuIndex.values()) {
    totalOriginal += Number(it.valorTotalOriginal || 0);
    totalAjustado += Number(it.precoAtual || 0) * Number(it.qtd || 0);
  }
  return { totalOriginal, totalAjustado, delta: totalAjustado - totalOriginal,
    deltaPct: totalOriginal ? (totalAjustado - totalOriginal) / totalOriginal : 0 };
}

// ====== AUTOSAVE ======
function salvar() {
  const itens = [...skuIndex.values()];
  const excedentes = [...excedentesMap.values()];
  const state = {
    version: 2,
    rzAtual,
    itens,
    ajustes,
    excedentes,
    listas
  };
  localStorage.setItem('estadoConferencia', JSON.stringify(state));
}

function restaurar() {
  const raw = localStorage.getItem('estadoConferencia');
  if (!raw) return;
  try {
    const st = JSON.parse(raw);
    rzAtual = st.rzAtual || rzAtual;
    skuIndex = new Map((st.itens || []).map(v => [v.sku, v]));
    ajustes = st.ajustes || [];
    excedentesMap = new Map((st.excedentes || []).map(e => [keyEx(e.rz, e.sku), e]));
    listas = st.listas || listas;

    if (rzSelect && rzAtual) {
      [...rzSelect.options].forEach(o => { if (o.value === rzAtual) o.selected = true; });
    }
    renderTudo();
  } catch {
    // ignore
  }
}

// ====== EXPORT XLSX ======
function exportarXLSX() {
  const wb = XLSX.utils.book_new();

  // Planilhas "plain"
  const wsConf = XLSX.utils.json_to_sheet(listas.conferidos);
  const wsFalt = XLSX.utils.json_to_sheet(listas.faltantes);
  const wsExcL = XLSX.utils.json_to_sheet(listas.excedentes);

  // Ajustes
  const wsAju  = XLSX.utils.json_to_sheet(ajustes);

  // ResumoFinanceiro
  const resumo = [];
  const rzs = [...new Set([...skuIndex.values()].map(v => v.rz))];
  rzs.forEach(rz => {
    const r = calcResumoRZ(rz);
    resumo.push({ RZ: rz, TotalOriginal: r.totalOriginal, TotalAjustado: r.totalAjustado,
      Delta: r.delta, Percentual: r.deltaPct });
  });
  const g = calcResumoGeral();
  resumo.push({ RZ: 'GERAL', TotalOriginal: g.totalOriginal, TotalAjustado: g.totalAjustado,
    Delta: g.delta, Percentual: g.deltaPct });
  const wsRes  = XLSX.utils.json_to_sheet(resumo);

  XLSX.utils.book_append_sheet(wb, wsConf, 'Conferidos');
  XLSX.utils.book_append_sheet(wb, wsFalt, 'Faltantes');
  XLSX.utils.book_append_sheet(wb, wsExcL, 'Excedentes');
  XLSX.utils.book_append_sheet(wb, wsAju,  'AjustesPrecoOuErro');
  XLSX.utils.book_append_sheet(wb, wsRes,  'ResumoFinanceiro');

  XLSX.writeFile(wb, `Conferencia_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ====== SCAN (CÂMERA) ======
async function abrirCamera() {
  const isBrowser = typeof window !== 'undefined';
  const hasMedia = isBrowser && !!(navigator?.mediaDevices?.getUserMedia);
  const isSecure = isBrowser && (location.protocol === 'https:' || location.hostname === 'localhost');
  const isMobile = isBrowser && /Mobi|Android/i.test(navigator.userAgent);

  if (!hasMedia) { toast?.('Seu navegador não suporta câmera.'); return; }
  if (isMobile && !isSecure) { toast?.('No celular, a câmera exige HTTPS.'); }

  if (!cameraModal || !videoEl) { console.error('Modal/Video ausente no DOM'); return; }

  try {
    cameraModal.classList.remove('hidden');
    statusEl && (statusEl.textContent = 'Solicitando câmera...');

    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
    videoEl.srcObject = stream;
    await videoEl.play();

    // listar câmeras
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const inputs = devs.filter(d => d.kind === 'videoinput');
      if (inputs.length > 1 && cameraSelect) {
        cameraSelect.classList.remove('hidden');
        cameraSelect.innerHTML = inputs.map(d => `<option value="${d.deviceId}">${d.label || 'Câmera'}</option>`).join('');
        cameraSelect.onchange = async () => { await trocarCamera(cameraSelect.value); };
      }
    } catch { /* ignore */ }

    // torch (se suportado)
    currentTrack = stream.getVideoTracks()[0];
    const caps = currentTrack?.getCapabilities?.();
    if (caps && 'torch' in caps && torchBtn) {
      torchBtn.classList.remove('hidden');
      torchBtn.onclick = async () => {
        torchOn = !torchOn;
        await currentTrack.applyConstraints({ advanced: [{ torch: torchOn }] });
        torchBtn.textContent = torchOn ? 'Lanterna (on)' : 'Lanterna';
      };
    }

    lastResult = null;
    reading = true;

    if ('BarcodeDetector' in window) {
      detector = new BarcodeDetector({ formats: ['code_128','ean_13','ean_8','upc_a','upc_e'] });
      statusEl && (statusEl.textContent = 'Lendo...');
      loopNativo();
    } else {
      usingZXing = true;
      statusEl && (statusEl.textContent = 'Lendo (ZXing)...');
      await iniciarZXing(); // import dinâmico
    }
  } catch (err) {
    statusEl && (statusEl.textContent = 'Erro ao abrir câmera');
    console.error('getUserMedia falhou:', err);
    toast?.('Não foi possível acessar a câmera. Verifique permissões.');
  }
}

async function trocarCamera(deviceId) {
  try {
    await fecharCamera(false);
    stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
    videoEl.srcObject = stream;
    await videoEl.play();
    currentTrack = stream.getVideoTracks()[0];
    // reiniciar leitura
    if ('BarcodeDetector' in window) {
      detector = new BarcodeDetector({ formats: ['code_128','ean_13','ean_8','upc_a','upc_e'] });
      loopNativo();
    } else {
      usingZXing = true;
      await iniciarZXing();
    }
  } catch (e) {
    console.error('Troca de câmera falhou', e);
  }
}

async function loopNativo() {
  if (!reading || !detector || cameraModal.classList.contains('hidden')) return;
  try {
    const res = await detector.detect(videoEl);
    if (res?.length) {
      const value = String(res[0].rawValue || '').trim();
      if (value && value !== lastResult) {
        lastResult = value;
        onCodigo(value);
        return;
      }
    }
  } catch { /* silencioso */ }
  requestAnimationFrame(loopNativo);
}

async function iniciarZXing() {
  try {
    // CDN em ESM; @vite-ignore impede o Vite de tentar resolver localmente
    const ZXING_CDN = 'https://cdn.jsdelivr.net/npm/' + '@zxing' + '/browser@0.1.4/+esm';
    const mod = await import(/* @vite-ignore */ ZXING_CDN);
    const { BrowserMultiFormatReader } = mod || {};
    if (!BrowserMultiFormatReader) {
      console.error('ZXing sem BrowserMultiFormatReader');
      toast?.('Leitor ZXing indisponível');
      return;
    }

    zxingReader = new BrowserMultiFormatReader();
    await zxingReader.decodeFromVideoElement(videoEl, (result) => {
      if (!reading || !result) return;
      const text = String(result.getText?.() || '').trim();
      if (text && text !== lastResult) {
        lastResult = text;
        onCodigo(text);
      }
    });
  } catch (err) {
    console.error('Falha ao carregar ZXing do CDN:', err);
    toast?.('Falha ao carregar leitor ZXing');
  }
}

function pararZXing() {
  try { zxingReader?.reset?.(); } catch (e) { console.warn('ZXing reset falhou', e); }
  zxingReader = null;
  usingZXing = false;
}

async function fecharCamera(hide = true) {
  reading = false;
  try {
    pararZXing();
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    currentTrack = null;
    torchOn = false;
  } finally {
    if (hide) cameraModal?.classList?.add('hidden');
    statusEl && (statusEl.textContent = 'Pronto');
  }
}

function onCodigo(valor) {
  const v = String(valor || '').trim();
  if (!v) return;
  const input = document.getElementById('codigoInput');
  if (input) input.value = v;

  const mode = (localStorage.getItem('scanMode') || 'manual');
  if (mode === 'auto') {
    // só consulta automaticamente; registro automático fica pra um modo "scan rápido"
    consultar?.();
  } else {
    input?.focus();
  }
  fecharCamera(true); // fecha após a primeira leitura válida
}

// ====== TOAST MINI ======
function toast(msg){ try{console.log('[toast]', msg);}catch{} }

// ====== EXTRAS ======
// Expor algumas funções no window pra debug opcional
Object.assign(window, {
  consultar, registrar, registrarExcedente, exportarXLSX,
  abrirCamera, fecharCamera
});
