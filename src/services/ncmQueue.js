import { resolve, resolveWithRetry } from './ncmService.js';
import store, { setItemNcm, setItemNcmStatus } from '../store/index.js';

function timeout(promise, ms){
  return Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')), ms))
  ]);
}

export async function startNcmQueue(items = []){
  const pending = items
    .filter(it => !it.ncm)
    .map(it => ({ id: `${it.codigoRZ}:${it.codigoML}`, it }));

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
    while(queue.length){
      if(pausePromise) await pausePromise;
      const { id, it } = queue.shift();
      try{
        setItemNcmStatus(id,'pendente');
        const r = await resolveWithRetry(() => timeout(resolve({ sku: it.codigoML, descricao: it.descricao }), 4000), 3, 500);
        if(r.status === 'ok' && r.ncm){
          it.ncm = r.ncm;
          setItemNcm(id, r.ncm, r.source);
          errStreak = 0;
        }else{
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
