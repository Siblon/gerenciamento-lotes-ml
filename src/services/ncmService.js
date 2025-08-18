import { RUNTIME, NCM_CACHE_KEY } from '../config/runtime.js';

const CACHE_KEY = NCM_CACHE_KEY;
const mem = new Map();
const prom = new Map();
let mapPromise;

const STOPWORDS = new Set(['de','do','da','para','com','a','o','e','em','no','na','dos','das']);

function log(term, step, result, ms){
  if(import.meta.env?.DEV){
    console.debug('[NCM]', { term, step, result, ms });
  }
}

export function normalizeNCM(n){
  const d = String(n ?? '').replace(/\D/g,'');
  return /^\d{8}$/.test(d) ? d : null;
}

function slug(s){
  return String(s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\w\s]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function keywords(s){
  return slug(s).split(' ').filter(w => w && !STOPWORDS.has(w));
}

function cacheGet(k){
  if(mem.has(k)) return mem.get(k);
  try{
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const v = raw[k];
    if(v){ mem.set(k,v); return v; }
  }catch(err){
    console.warn('cacheGet error', { key: k, err });
  }
  return null;
}

function cacheSet(k,v){
  mem.set(k,v);
  try{
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    raw[k] = v;
    localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
  }catch(err){
    console.warn('cacheSet error', { key: k, err });
  }
}

async function fetchLocalMap(){
  if(!mapPromise){
    mapPromise = fetch(RUNTIME.NCM_LOCAL_MAP_URL)
      .then(r=>r.ok?r.json():{})
      .then(m=>{
        const out={};
        for(const [k,v] of Object.entries(m||{})) out[slug(k)]=v;
        return out;
      })
      .catch(()=>({}));
  }
  return mapPromise;
}

async function fetchAPI(term){
  const isCode = /^\d{8}$/.test(term);
  const q = isCode ? `codigo=${encodeURIComponent(term)}` : `descricao=${encodeURIComponent(term)}`;
  const kw = isCode ? [] : keywords(term);

  const attempt = async () => {
    const controller = new AbortController();
    const t = setTimeout(()=>controller.abort(),4000);
    try{
      const resp = await fetch(`/api/ncm?${q}`, { signal: controller.signal });
      if(!resp.ok){
        const err = new Error('http '+resp.status);
        if(resp.status >= 500) err.retry = true;
        throw err;
      }
      const data = await resp.json();
      const list = Array.isArray(data)?data:[data];
      if(isCode){
        const code = normalizeNCM(term);
        const found = list.find(it => normalizeNCM(it.codigoNcm||it.codigo) === code);
        return { ncm: found?code:null, raw:data };
      }else{
        let best=null, bestScore=0;
        for(const it of list){
          const code = normalizeNCM(it.codigoNcm||it.codigo);
          if(!code) continue;
          const dkw = keywords(it.descricao||'');
          const score = kw.reduce((a,k)=>a + (dkw.includes(k)?1:0),0);
          if(score >= 2 && score > bestScore){
            best = { ncm:code, raw:it, score };
            bestScore = score;
          }
        }
        return { ncm: best?best.ncm:null, raw:data };
      }
    } finally {
      clearTimeout(t);
    }
  };

  for(let i=0;i<3;i++){
    try{
      return await attempt();
    }catch(err){
      if(!err.retry || i===2) throw err;
      await new Promise(r=>setTimeout(r,500*(i+1)));
    }
  }
}

async function resolveTermInternal(term, key, { onlyCache=false }={}){
  const start = (performance.now?performance.now():Date.now());
  const cached = cacheGet(key);
  if(cached){
    const ms = (performance.now?performance.now():Date.now())-start;
    log(term,'cache','hit',ms);
    return { ncm: cached.ncm, source:'cache', status:'ok' };
  }

  const map = await fetchLocalMap();
  const mapped = map[key];
  const local = normalizeNCM(mapped);
  if(local){
    const val = { ncm:local, source:'map', ts:Date.now() };
    cacheSet(key,val);
    const ms = (performance.now?performance.now():Date.now())-start;
    log(term,'map','hit',ms);
    return { ncm:local, source:'map', status:'ok' };
  }

  if(onlyCache){
    const ms = (performance.now?performance.now():Date.now())-start;
    log(term,'cache','miss',ms);
    return { ncm:null, source:'cache', status:'falha' };
  }

  try{
    const { ncm, raw } = await fetchAPI(term);
    const ms = (performance.now?performance.now():Date.now())-start;
    if(ncm){
      const val = { ncm, source:'api', ts:Date.now() };
      cacheSet(key,val);
      log(term,'api','hit',ms);
      return { ncm, source:'api', status:'ok', raw };
    }
    log(term,'api','miss',ms);
    return { ncm:null, source:'api', status:'falha', raw };
  }catch{
    const ms = (performance.now?performance.now():Date.now())-start;
    log(term,'api','err',ms);
    return { ncm:null, source:'api', status:'falha' };
  }
}

async function resolveTerm(term, opts={}){
  const key = slug(term);
  if(prom.has(key)) return prom.get(key);
  const p = resolveTermInternal(term, key, opts).finally(()=>prom.delete(key));
  prom.set(key,p);
  return p;
}

export async function resolve(input){
  if(typeof input === 'string'){
    return resolveTerm(input);
  }
  const sku = input?.sku;
  const descricao = input?.descricao;
  if(sku){
    const r = await resolveTerm(sku, { onlyCache:true });
    if(r.status === 'ok') return r;
  }
  if(descricao){
    return resolveTerm(descricao);
  }
  return { ncm:null, source:'cache', status:'falha' };
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

export function __reset(){
  mem.clear();
  prom.clear();
  mapPromise = null;
}

export { cacheGet, cacheSet, slug, keywords };

export default { normalizeNCM, resolve, resolveWithRetry, createQueue };

