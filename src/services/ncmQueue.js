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
  async function worker(){
    while(queue.length){
      const { id, it } = queue.shift();
      try{
        setItemNcmStatus(id,'pendente');
        const r = await resolveWithRetry(() => timeout(resolve({ sku: it.codigoML, ncmPlanilha: it.ncm, descricao: it.descricao }), 4000), 3, 500);
        if(r.ok && r.ncm){
          it.ncm = r.ncm;
          setItemNcm(id, r.ncm, r.source);
        }else{
          setItemNcmStatus(id,'falha');
        }
      }catch{
        setItemNcmStatus(id,'falha');
      }finally{
        done++;
        store.state.ncmState = { running: true, done, total };
        if(hasDoc) document.dispatchEvent(new CustomEvent('ncm-progress',{ detail:{ done, total } }));
      }
    }
  }
  for(let i=0;i<Math.min(limit,total);i++) workers.push(worker());
  await Promise.all(workers);
  store.state.ncmState = { running:false, done, total };
  if(hasDoc) document.dispatchEvent(new CustomEvent('ncm-progress',{ detail:{ done, total } }));
}

export default { startNcmQueue };
