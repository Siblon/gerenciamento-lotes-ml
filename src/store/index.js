import { markAsConferido as dbMarkAsConferido, addExcedente as dbAddExcedente } from '../services/loteDb.js';
import { loadCurrentRZ, saveCurrentRZ } from './rzMeta.js';

const DEBUG = () => {
  try { return localStorage.getItem('DEBUG_RZ') === '1'; } catch { return false; }
};

let __booted = false;

// src/store/index.js
const state = {
  currentRZ: null,
  rzAtual: null,

  // listas e dados brutos
  rzList: [],
  itemsByRZ: {},          // { RZ: [ { codigoML, descricao, qtd, valorUnit, ... } ] }

  // totais por RZ → SKU (vindo do Excel)
  totalByRZSku: {},       // { [rz]: { [sku]: qtdTotal } }

  // metadados por RZ → SKU (vindo do Excel)
  metaByRZSku: {},        // { [rz]: { [sku]: { descricao, precoMedio } } }

    // conferidos em runtime (pode acumular quantidade)
    conferidosByRZSku: {},  // { [rz]: { [sku]: { qtd, precoAjustado, observacao, status } } }

  // contadores por RZ
  contadores: {},         // { [rz]: { conferidos, total } }

  // eventos de conferência (para auditoria/finalizar)
  movimentos: [],         // [{ ts, rz, sku, precoAjustado, observacao }]

  // excedentes por RZ
  excedentes: {},         // { [rz]: [ { sku, descricao, qtd, preco_unit, obs, fonte } ] }

  limits: {
    conferidos: 50,
    pendentes: 50,
  },

  // tags livres por item (id -> Set)
  itemTags: {},
  // lista simples de itens para recursos básicos
  items: [],
  __listeners: {},
};

// assinatura leve (pub/sub quando itens mudarem)
const listeners = new Set();
export function subscribeCounts(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function updateContadores(rz){
  const totalMap = state.totalByRZSku[rz] || {};
  const confMap = state.conferidosByRZSku[rz] || {};
  const total = Object.keys(totalMap).length;
  const conf = Object.keys(confMap).filter(sku => (confMap[sku]?.qtd || 0) >= (totalMap[sku] || 0)).length;
  const exc  = (state.excedentes[rz] || []).length;
  state.contadores[rz] = { conferidos: conf, total, excedentes: exc };
  listeners.forEach(l => l());
}

// selects agregados
export function selectCounts() {
  const rz = state.rzAtual || state.currentRZ;
  const c = state.contadores[rz] || {};
  const total = c.total ?? 0;
  const conferidos = c.conferidos ?? 0;
  const excedentes = c.excedentes ?? 0;
  const pendentes = Math.max(0, total - conferidos - excedentes);
  return { total, conferidos, excedentes, pendentes };
}

export function setCurrentRZ(rz){
  state.currentRZ = state.rzAtual = rz;
  saveCurrentRZ(rz);
  if (rz) updateContadores(rz);
  if (DEBUG()) console.log('[DEBUG_RZ] setCurrentRZ', rz);
  emit('refresh');
}

export function setRZs(rzs = []){
  state.rzList = Array.isArray(rzs) ? rzs : [];
  if(!state.currentRZ) state.currentRZ = state.rzList[0] || null;
  if(state.currentRZ) updateContadores(state.currentRZ);
}

export function setItens(items = []){
  const itemsByRZ = {};
  const totalByRZSku = {};
  const metaByRZSku = {};
  const now = Date.now();
  for(const it of items){
    (itemsByRZ[it.codigoRZ] ||= []).push(it);
    const sku = String(it.codigoML || '').trim().toUpperCase();
    if(!sku) continue;
    (totalByRZSku[it.codigoRZ] ||= {});
    const inc = Number(it.qtd) || 0;
    totalByRZSku[it.codigoRZ][sku] = (totalByRZSku[it.codigoRZ][sku] || 0) + inc;
    (metaByRZSku[it.codigoRZ] ||= {});
    if(!metaByRZSku[it.codigoRZ][sku]){
      const descricao = String(it.descricao || '').trim();
      const precoMedio = Number(it.valorUnit || 0);
      const meta = { descricao, precoMedio };
      metaByRZSku[it.codigoRZ][sku] = meta;
    }
  }
  state.itemsByRZ = itemsByRZ;
  state.totalByRZSku = totalByRZSku;
  state.metaByRZSku = metaByRZSku;
  state.conferidosByRZSku = {};
  state.excedentes = {};
  if(!state.currentRZ) state.currentRZ = Object.keys(itemsByRZ)[0] || null;
  if(state.currentRZ) updateContadores(state.currentRZ);
  return { itemsByRZ, totalByRZSku, metaByRZSku };
}

export function addMovimento(m){ state.movimentos.push(m); }
export function setLimits(part, v){ state.limits[part] = Number(v)||50; }

// Helpers de acesso seguro
export function getTotals(rz) {
  return state.totalByRZSku[rz] || {};
}

export function getConferidos(rz) {
  return state.conferidosByRZSku[rz] || {};
}

export function sumQuant(obj) {
  return Object.values(obj || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

export function totalPendentesCount(rz) {
  const tot = getTotals(rz);
  const conf = getConferidos(rz);
  const totalAll = Object.keys(tot).length; // cada SKU conta 1
  const doneAll = Object.keys(conf).length; // cada SKU conta 1
  return Math.max(0, totalAll - doneAll);
}

// evita duplicidade
export function addConferido(rz, sku, payload = {}) {
  const map = (state.conferidosByRZSku[rz] ||= {});
  const total = state.totalByRZSku[rz]?.[sku] || 0;
  const qty = Math.max(1, parseInt(payload.qty ?? 1, 10));
  const existente = map[sku] || { qtd: 0, precoAjustado: null, observacao: null, status: null, avariados: 0 };
  const restante = Math.max(0, total - existente.qtd);
  const efetivo = Math.min(qty, restante);
  if (efetivo <= 0) return;
  existente.qtd += efetivo;
  if (payload.precoAjustado !== undefined) existente.precoAjustado = payload.precoAjustado;
  if (payload.observacao) existente.observacao = payload.observacao;
  if (payload.avaria) {
    existente.status = 'avariado';
    existente.avariados = (existente.avariados || 0) + efetivo;
  }
  map[sku] = existente;
  state.movimentos.push({ ts: Date.now(), rz, sku, qty: efetivo, precoAjustado: existente.precoAjustado, observacao: existente.observacao, status: existente.status });
  updateContadores(rz);
  emit('refresh');
}

export function getSkuInRZ(rz, sku){
  return !!(state.totalByRZSku[rz] || {})[sku];
}

export function isConferido(rz, sku){
  const tot = state.totalByRZSku[rz]?.[sku] || 0;
  const conf = state.conferidosByRZSku[rz]?.[sku]?.qtd || 0;
  return conf >= tot && tot > 0;
}

export function findInRZ(rz, sku){
  const tot = state.totalByRZSku[rz] || {};
  if (!tot[sku]) return null;
  const confQtd = state.conferidosByRZSku[rz]?.[sku]?.qtd || 0;
  if (confQtd >= tot[sku]) return null;
  const meta = state.metaByRZSku[rz]?.[sku] || {};
  return {
    sku,
    descricao: meta.descricao || '',
    qtd: tot[sku] - confQtd,
    precoMedio: meta.precoMedio,
  };
}

export function findConferido(rz, sku){
  const conf = state.conferidosByRZSku[rz]?.[sku];
  if (!conf) return null;
  const meta = state.metaByRZSku[rz]?.[sku] || {};
  return {
    sku,
    descricao: meta.descricao || '',
    qtd: conf.qtd || 0,
    precoMedio: meta.precoMedio,
  };
}

export function findEmOutrosRZ(sku){
  for (const [rz, map] of Object.entries(state.totalByRZSku || {})){
    if (rz !== state.rzAtual && map[sku]) return rz;
  }
  return null;
}

export function addExcedente(rz, { sku, descricao, qtd, preco_unit, obs, fonte }){
  const list = (state.excedentes[rz] ||= []);
  const existente = list.find(it => it.sku === sku);
  const q = Number(qtd) || 0;
  const p = (preco_unit === undefined || preco_unit === null || preco_unit === '') ? undefined : Number(preco_unit);
  if (existente) {
    existente.qtd += q;
    if (p !== undefined) existente.preco_unit = p;
    existente.obs = obs || existente.obs;
  } else {
    list.push({ sku, descricao: descricao || '', qtd: q, preco_unit: p, obs: obs || '', fonte: fonte || '' });
  }
  state.movimentos.push({ ts: Date.now(), tipo: 'EXCEDENTE', rz, sku, qtd: q, preco_unit: p, obs, fonte });
  updateContadores(rz);
  emit('refresh');
}

export function moveItemEntreRZ(origem, destino, sku, qtd=1){
  const q = Number(qtd) || 0;
  const mapOrig = state.totalByRZSku[origem] || {};
  const mapDest = (state.totalByRZSku[destino] ||= {});
  if (mapOrig[sku]) {
    mapOrig[sku] -= q;
    if (mapOrig[sku] <= 0) delete mapOrig[sku];
  }
  mapDest[sku] = (mapDest[sku] || 0) + q;
  const meta = state.metaByRZSku[origem]?.[sku];
  if (meta){
    (state.metaByRZSku[destino] ||= {});
    state.metaByRZSku[destino][sku] = meta;
  }
  updateContadores(origem);
  updateContadores(destino);
  emit('refresh');
}

export function dispatch(action){
  if (action?.type === 'REGISTRAR'){
    const { rz, sku, qty, precoAjustado, observacao } = action;
    addConferido(rz, sku, { qty, precoAjustado, observacao });
  }
}

export function conferir(sku, opts = {}) {
  const rz = state.rzAtual;
  addConferido(rz, sku, { qty: opts.qty, precoAjustado: opts.price, observacao: opts.note, avaria: opts.avaria });
  dbMarkAsConferido(sku, {
    qtd: opts.qty,
    precoMedio: opts.price,
    valorTotal: Number(opts.price || 0) * Number(opts.qty || 0)
  }).catch(console.error);
}

export function registrarExcedente({ sku, qty, price, note }) {
  const rz = state.currentRZ;
  addExcedente(rz, { sku, descricao: '', qtd: qty, preco_unit: price, obs: note, fonte: 'preset' });
  dbAddExcedente({ sku, descricao: '', qtd: qty, preco: price }).catch(console.error);
}

function parseId(id){
  const [rz, sku] = String(id || '').split(':');
  return { rz, sku };
}

function getItem(rz, sku) {
  const map = (state.conferidosByRZSku[rz] ||= {});
  const item = (map[sku] ||= { qtd: 0, precoAjustado: null, observacao: null, status: null, avariados: 0 });
  if (!item.flags) item.flags = {};
  return item;
}

export function setExcedente(id, isExcedente, obsOptionalString = '') {
  const { rz, sku } = parseId(id);
  if (!rz || !sku) return;
  const item = getItem(rz, sku);
  if (isExcedente) {
    item.flags.excedente = true;
    item.obs_excedente = obsOptionalString || '';
  } else {
    delete item.flags.excedente;
    delete item.obs_excedente;
  }
}

export function setDescarte(id, qtd, obsOptionalString = '') {
  const { rz, sku } = parseId(id);
  if (!rz || !sku) return;
  const item = getItem(rz, sku);
  const total = Number(item.qtd || 0);
  const q = Math.max(0, Math.min(Number(qtd) || 0, total));
  item.qtd_descarte = q;
  item.obs_descarte = obsOptionalString || '';
  if (q > 0) {
    item.flags.descarte = true;
  } else {
    delete item.flags.descarte;
  }
}

export function selectDescartes() {
  const out = [];
  for (const [rz, map] of Object.entries(state.conferidosByRZSku || {})) {
    for (const [sku, item] of Object.entries(map || {})) {
      if (item?.flags?.descarte && item.qtd_descarte > 0) {
        const meta = state.metaByRZSku[rz]?.[sku] || {};
        out.push({
          rz,
          sku,
          descricao: meta.descricao || '',
          qtd_descartada: item.qtd_descarte,
          obs: item.obs_descarte || '',
        });
      }
    }
  }
  return out;
}


export function tagItem(id, tag){
  const set = (state.itemTags[id] ||= new Set());
  set.add(tag);
}

export function untagItem(id, tag){
  const set = state.itemTags[id];
  if(!set) return;
  set.delete(tag);
  if(set.size === 0) delete state.itemTags[id];
}

export function selectAllItems(){
  const rz = state.currentRZ;
  const out = [];
  const totals = state.totalByRZSku[rz] || {};
  const meta = state.metaByRZSku[rz] || {};
  for(const sku of Object.keys(totals)){
    out.push({ id:`${rz}:${sku}`, sku, ...(meta[sku]||{}) });
  }
  const exc = state.excedentes[rz] || [];
  for(const it of exc){
    out.push({ id:`${rz}:${it.sku}`, ...it });
  }
  return out;
}

export function selectAllImportedItems(){
  const items = [];
  for(const [rz, totals] of Object.entries(state.totalByRZSku || {})){
    const meta = state.metaByRZSku[rz] || {};
    for(const [sku, qtd] of Object.entries(totals)){
      items.push({
        rz,
        sku,
        descricao: meta[sku]?.descricao || '',
        preco_ml_unit: Number(meta[sku]?.precoMedio || 0),
        qtd: Number(qtd || 0),
      });
    }
  }
  return items;
}

const store = (typeof window !== 'undefined' && window.__STORE_SINGLETON) || {
  state,
  dispatch,
  getSkuInRZ,
  isConferido,
  findInRZ,
  findConferido,
  addExcedente,
  findEmOutrosRZ,
  moveItemEntreRZ,
  conferir,
  registrarExcedente,
  tagItem,
  untagItem,
  selectAllItems,
  selectAllImportedItems,
  setExcedente,
  setDescarte,
  selectDescartes,
  setRZs,
  setItens,
  selectCounts,
  subscribeCounts,
};

if (typeof window !== 'undefined') window.__STORE_SINGLETON = store;

// novos utilitários simples -------------------------------------------------
export function emit(event){
  (state.__listeners[event] || []).forEach(fn => {
    try { fn(); } catch (err) { console.error(err); }
  });
}

export function on(event, fn){
  (state.__listeners[event] ||= []).push(fn);
  return () => {
    state.__listeners[event] = (state.__listeners[event] || []).filter(f => f !== fn);
  };
}

function reset(){
  state.items = [];
}

export function bulkUpsertItems(items){
  const map = new Map(state.items.map(it => [it.id, it]));
  for (const it of items){
    if (map.has(it.id)) {
      Object.assign(map.get(it.id), it);
    } else {
      map.set(it.id, it);
      state.items.push(it);
    }
  }
  if (DEBUG()) console.log('[DEBUG_RZ] bulkUpsertItems', items.length);
  emit('refresh');
}

export function updateItem(id, patch){
  const it = state.items.find(i => i.id === id);
  if (it) Object.assign(it, patch);
  emit('refresh');
}

export function upsertItem(obj){
  bulkUpsertItems([obj]);
}

function listByRZ(rz){
  return state.items.filter(it => it.rz === rz);
}

store.emit = emit;
store.on = on;
store.reset = reset;
store.bulkUpsertItems = bulkUpsertItems;
store.updateItem = updateItem;
store.upsertItem = upsertItem;
store.listByRZ = listByRZ;
store.setCurrentRZ = setCurrentRZ;
store.init = store.init || init;
store.__resetBoot = () => { __booted = false; };

if (typeof window !== 'undefined') {
  window.app = Object.assign(window.app || {}, {
    rzInfo(){ console.log({ currentRZ: store.state.currentRZ, items: store.state.items.length }); }
  });
}

async function init(){
  if (__booted) return;
  __booted = true;
  store.__booted = true;
  const val = await loadCurrentRZ();
  if (val && !state.currentRZ) {
    state.currentRZ = state.rzAtual = val;
    if (DEBUG()) console.log('[DEBUG_RZ] loadCurrentRZ', val);
  }
  store.state = store.state || state;
  store.emit = store.emit || emit;
  store.on = store.on || on;
  try {
    if (typeof store.load === 'function') {
      store.load();
    } else if (typeof load === 'function') {
      load();
    }
  } catch {}
}

export { init, setCurrentRZ as selectRZ };

export default store;

// Expor store para debug quando existir window (dev/preview)
if (typeof window !== 'undefined') {
  window.store = window.store || store;
}
