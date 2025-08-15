import { RUNTIME } from '../config/runtime.js';

const CACHE_KEY = 'ncmCache:v1';
const memCache = new Map();
(function load(){
  try{
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    for(const [k,v] of Object.entries(raw)) memCache.set(k,v);
  }catch{}
})();
function saveCache(){
  try{ localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(memCache))); }catch{}
}
export function cacheGet(k){ return memCache.get(k)||null; }
export function cacheSet(k,v){ memCache.set(k,v); saveCache(); }

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
    return new Promise((resolve,reject)=>{
      queue.push({fn, resolve, reject});
      next();
    });
  };
}

export async function resolveWithRetry(fn, attempts=3, baseDelay=100){
  let lastErr;
  for(let i=0;i<attempts;i++){
    try{ return await fn(); }
    catch(err){ lastErr = err; if(i < attempts-1){ await new Promise(r=>setTimeout(r, baseDelay * Math.pow(2,i))); }}
  }
  throw lastErr;
}

async function fetchLocalMap(){
  try{
    const r = await fetch(RUNTIME.NCM_LOCAL_MAP_URL, {cache:'no-store'});
    if(!r.ok) return [];
    return await r.json();
  }catch{return[];}
}

async function fetchFromAPIByDesc(desc){
  if(!RUNTIME.NCM_API_BASE) throw new Error('no_api');
  const url = `${RUNTIME.NCM_API_BASE}/ncm?descricao=${encodeURIComponent(desc)}`;
  const headers = {};
  if(RUNTIME.NCM_API_TOKEN) headers.Authorization = `Bearer ${RUNTIME.NCM_API_TOKEN}`;
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), 8000);
  try{
    const r = await fetch(url,{headers, signal:controller.signal});
    if(!r.ok){ const err = new Error('http_error'); err.status = r.status; throw err; }
    const data = await r.json();
    const first = Array.isArray(data)?data[0]:null;
    const code = first?.codigoNcm || first?.codigo || null;
    return normalizeNCM(code);
  }catch(err){
    if(err.name === 'AbortError'){ err.reason = 'timeout'; }
    throw err;
  }finally{ clearTimeout(t); }
}

export async function resolve(args){
  const { sku, ncmPlanilha, descricao } = args;
  const direct = normalizeNCM(ncmPlanilha);
  if(direct){ cacheSet(sku,direct); return { ok:true, ncm:direct, source:'row' }; }
  const cached = cacheGet(sku);
  if(cached) return { ok:true, ncm:cached, source:'cache' };
  const map = await fetchLocalMap();
  const found = map.find(x => String(x.sku).toLowerCase() === String(sku).toLowerCase());
  const local = normalizeNCM(found?.ncm);
  if(local){ cacheSet(sku,local); return { ok:true, ncm:local, source:'map' }; }
  try{
    const api = await resolveWithRetry(()=>fetchFromAPIByDesc(descricao||sku));
    if(api){ cacheSet(sku,api); return { ok:true, ncm:api, source:'api' }; }
    return { ok:false, reason:'api_no_ncm' };
  }catch(err){
    if(err.status) return { ok:false, reason:'api_http_error', detail:String(err.status) };
    if(err.reason==='timeout') return { ok:false, reason:'api_timeout' };
    if(err.message==='no_api') return { ok:false, reason:'no_api' };
    return { ok:false, reason:'api_exception', detail: String(err.message||err) };
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

export default { normalizeNCM, resolve, resolveQueued, resolveNCM };

