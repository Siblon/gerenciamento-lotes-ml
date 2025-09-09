// src/services/ncmQueue.js
import { resolveNcmByDescription } from './ncmApi.js';
import store, { setItemNcm, setItemNcmStatus } from '../store/index.js';

let cancelled = false;
if (typeof document !== 'undefined') {
  document.addEventListener('ncm-cancel', () => { cancelled = true; });
}

export async function startNcmQueue(items = []){
  cancelled = false;
  const pending = items
    .filter(it => !it.ncm)
    .map(it => {
      const rz = String(it.codigoRZ || '').trim().toUpperCase();
      const sku = String(it.codigoML || '').trim().toUpperCase();
      if(!rz || !sku){
        console.warn('Item sem codigoRZ/codigoML, ignorando', it);
        return null;
      }
      it.codigoRZ = rz;
      it.codigoML = sku;
      return { id: `${rz}:${sku}`, it };
    })
    .filter(Boolean);

  const total = pending.length;
  let done = 0;
  store.state.ncmState = { running: total > 0, done, total };
  const hasDoc = typeof document !== 'undefined';
  if(hasDoc) document.dispatchEvent(new CustomEvent('ncm-progress',{ detail:{ done, total } }));
  if(!total) return;

  const queue = pending.slice();
  const workers = [];
  const limit = 3;
  let errStreak = 0;
  let pausePromise = null;

  async function worker(){
    while(queue.length && !cancelled){
      if(pausePromise) await pausePromise;
      const { id, it } = queue.shift();
      try{
        setItemNcmStatus(id,'pendente');
        const r = await resolveNcmByDescription(it.descricao || '');
        if (r.status === 'ok' && r.ncm){
          it.ncm = r.ncm;
          setItemNcm(id, r.ncm, 'api');
          errStreak = 0;
        } else if (r.status === 'skipped') {
          setItemNcmStatus(id,'skipped');
        } else {
          setItemNcmStatus(id,'falha');
          errStreak++;
        }
      }catch{
        setItemNcmStatus(id,'falha');
        errStreak++;
      }finally{
        done++;
        store.state.ncmState = { running: true, done, total };
        if(hasDoc) document.dispatchEvent(new CustomEvent('ncm-progress',{ detail:{ done, total } }));
      }
      if(errStreak > 10 && !pausePromise){
        console.warn('API instável; tentando novamente em 30s');
        store.state.ncmState = { running: true, done, total, paused:true };
        if(hasDoc) document.dispatchEvent(new CustomEvent('ncm-progress',{ detail:{ done, total, paused:true } }));
        pausePromise = new Promise(res=>setTimeout(()=>{
          pausePromise = null;
          store.state.ncmState = { running: true, done, total, paused:false };
          if(hasDoc) document.dispatchEvent(new CustomEvent('ncm-progress',{ detail:{ done, total, paused:false } }));
          errStreak = 0;
          res();
        },30000));
        await pausePromise;
      }
    }
  }
  for(let i=0;i<Math.min(limit,total);i++) workers.push(worker());
  await Promise.all(workers);
  store.state.ncmState = { running:false, done, total };
  if(hasDoc) document.dispatchEvent(new CustomEvent('ncm-progress',{ detail:{ done, total } }));
}

export default { startNcmQueue };
