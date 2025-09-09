import { resolveNcmByDescription } from './ncmApi.js';
import store from '../store/index.js';

export function startNcmQueue(){
  const { state, updateItem } = store;
  if (state.__ncmQueueBooted) return;
  state.__ncmQueueBooted = true;
  let stopped = false;

  (async function loop(){
    while(!stopped){
      const next = state.items?.find(it => it.ncmStatus === 'pending' && (it?.descricao || it?.nome));
      if(!next){ await sleep(1500); continue; }
      next.ncmStatus = 'resolving';
      try{
        const { ncm, status } = await resolveNcmByDescription(next.descricao || next.nome || '');
        updateItem(next.id, { ncm: ncm || next.ncm || null, ncmStatus: status });
      }catch{
        const h = (globalThis?.location?.hostname || '').toLowerCase();
        const dev = h === 'localhost' || h === '127.0.0.1';
        updateItem(next.id, { ncmStatus: dev ? 'skipped' : 'error' });
      }
      await sleep(120);
    }
  })();

  return () => { stopped = true; };

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
}
