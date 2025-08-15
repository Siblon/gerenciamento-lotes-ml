import { RUNTIME } from '../config/runtime.js';

const memCache = new Map();
function readLocalCache(){try{return JSON.parse(localStorage.getItem(RUNTIME.CACHE_KEY)||'{}')}catch{return{}}}
function writeLocalCache(o){try{localStorage.setItem(RUNTIME.CACHE_KEY,JSON.stringify(o||{}))}catch{}}
function cacheGet(k){ if(memCache.has(k)) return memCache.get(k); const all=readLocalCache(); return all[k]||null; }
function cacheSet(k,v){ memCache.set(k,v); const all=readLocalCache(); all[k]=v; writeLocalCache(all); }

export function sanitizeNCM(n){ const d=String(n??'').replace(/\D/g,''); return /^\d{8}$/.test(d)?d:null; }

async function fetchLocalMap(){ try{ const r=await fetch(RUNTIME.NCM_LOCAL_MAP_URL,{cache:'no-store'}); if(!r.ok) return []; return await r.json(); }catch{return[]} }

async function fetchFromAPIByDesc(desc){
  if(!RUNTIME.NCM_API_BASE) return null;
  const url = `${RUNTIME.NCM_API_BASE}/ncm?descricao=${encodeURIComponent(desc)}`;
  const headers = {}; if(RUNTIME.NCM_API_TOKEN) headers.Authorization=`Bearer ${RUNTIME.NCM_API_TOKEN}`;
  try{ const r=await fetch(url,{headers}); if(!r.ok) return null; const data=await r.json();
       const first=Array.isArray(data)?data[0]:null; const code=first?.codigoNcm||first?.codigo||null;
       const d=String(code||'').replace(/\D/g,''); return /^\d{8}$/.test(d)?d:null; }catch{return null}
}

export async function resolveNCM({ sku, ncmPlanilha, descricao }){
  const direct=sanitizeNCM(ncmPlanilha); if(direct){ cacheSet(sku,direct); return direct; }
  const cached=cacheGet(sku); if(cached) return cached;
  const map=await fetchLocalMap(); const found=map.find(x=>String(x.sku).toLowerCase()===String(sku).toLowerCase());
  const local=sanitizeNCM(found?.ncm); if(local){ cacheSet(sku,local); return local; }
  const api=await fetchFromAPIByDesc(descricao||sku); if(api){ cacheSet(sku,api); return api; }
  return null;
}

