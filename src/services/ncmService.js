import { RUNTIME } from '../config/runtime.js';

const CACHE_KEY = 'ncmCache:v1';
const mem = new Map();
let ncmMapCache;

function log(term, source, hit){
  if(import.meta.env?.DEV){
    console.debug('[NCM]', { term, source, hit });
  }
}

export function normalizeNCM(n){
  const d = String(n ?? '').replace(/\D/g, '');
  return /^\d{8}$/.test(d) ? d : null;
}

export function createQueue(limit = 3){
  const queue = [];
  let active = 0;
  const next = () => {
    if(active >= limit || queue.length === 0) return;
    const {fn, resolve, reject} = queue.shift();
    active++;
    Promise.resolve().then(fn).then(resolve, reject).finally(()=>{ active--; next(); });
  };
  return function enqueue(fn){
    return new Promise((resolve,reject)=>{ queue.push({fn, resolve, reject}); next(); });
  };
}

export async function resolveWithRetry(fn, attempts=3, baseDelay=500){
  let lastErr;
  for(let i=0;i<attempts;i++){
    try{ return await fn(); }
    catch(err){ lastErr = err; if(i < attempts-1){ await new Promise(r=>setTimeout(r, baseDelay*Math.pow(2,i))); }}
  }
  throw lastErr;
}

function slug(s){
  return String(s||'').toLowerCase()
    .normalize('NFD').replace(/[^\w]+/g,'').replace(/\s+/g,'')
    .replace(/[\u0300-\u036f]/g,'');
}

function cacheGet(k){
  if(mem.has(k)) return mem.get(k);
  try{
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const v = raw[k];
    if(v){ mem.set(k,v); return v; }
  }catch{}
  return null;
}

function cacheSet(k,v){
  mem.set(k,v);
  try{
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    raw[k] = v;
    localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
  }catch{}
}

async function fetchLocalMap(){
  if(!ncmMapCache){
    ncmMapCache = fetch(RUNTIME.NCM_LOCAL_MAP_URL)
      .then(r=>r.ok?r.json():{})
      .catch(()=>({}));
  }
  return ncmMapCache;
}

async function fetchFromAPI(term){
  const isCode = /^\d{8}$/.test(term);
  const q = isCode ? `codigo=${encodeURIComponent(term)}` : `descricao=${encodeURIComponent(term)}`;
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), 4000);
  try{
    const r = await fetch(`/api/ncm?${q}`, { signal: controller.signal });
    if(!r.ok) throw new Error('http');
    const data = await r.json();
    const list = Array.isArray(data) ? data : [data];
    const key = slug(term);
    let best = null, score = -1;
    for(const it of list){
      const code = normalizeNCM(it.codigoNcm || it.codigo);
      const desc = slug(it.descricao || '');
      const s = (code && code.length===8 ? 1 : 0) + (key && desc.includes(key) ? 1 : 0);
      if(s > score){ score = s; best = code; }
    }
    return best;
  } finally {
    clearTimeout(t);
  }
}

export async function resolve({ sku, ncmPlanilha, descricao }){
  const term = sku;
  const direct = normalizeNCM(ncmPlanilha);
  if(direct){ cacheSet(term,direct); log(term,'row',true); return { ok:true, ncm:direct, source:'row' }; }

  const cached = cacheGet(term);
  if(cached){ log(term,'cache',true); return { ok:true, ncm:cached, source:'cache' }; }

  const map = await fetchLocalMap();
  const slugDesc = slug(descricao);
  const mapped = map[term] || map[slugDesc];
  const local = normalizeNCM(mapped);
  if(local){ cacheSet(term, local); log(term,'map',true); return { ok:true, ncm:local, source:'map' }; }

  try{
    const api = await fetchFromAPI(descricao || term);
    if(api){ cacheSet(term, api); log(term,'api',true); return { ok:true, ncm:api, source:'api' }; }
    log(term,'api',false);
    return { ok:false, ncm:null, source:'api', error:true };
  }catch{
    log(term,'api',false);
    return { ok:false, ncm:null, source:'api', error:true };
  }
}

const enqueue = createQueue(3);

export function resolveQueued(args){
  return enqueue(()=>resolve(args));
}

export async function resolveNCM(args){
  const r = await resolve(args);
  return r.ok ? r.ncm : null;
}

export { cacheGet, cacheSet, slug };

export default { normalizeNCM, resolve, resolveQueued, resolveNCM };
