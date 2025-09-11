// src/debug/traceRZ.js
import store from '../store/index.js';
import { createLogger, isDebug } from './logger.js';
import { mountRzOverlay } from './overlay.js';

const log = createLogger('RZ');

let boundAbort = null;

function findSelect(){
  return document.getElementById('select-rz')
      || document.getElementById('rz')
      || document.querySelector('select[name="rz"]')
      || document.querySelector('[data-rz]');
}

function bindSelectOnce(){
  const sel = findSelect();
  if(!sel){ log.warn('Select RZ não encontrado ainda'); return false; }
  if(sel.dataset.rzBound === '1'){ log.debug('Select RZ já está bound'); return true; }

  boundAbort?.abort?.();
  const ac = new AbortController();
  boundAbort = ac;
  sel.addEventListener('change', ()=>{
    const before = store?.state?.currentRZ ?? null;
    const after = sel.value;
    log.group(`UI change -> setCurrentRZ("${after}")`);
    log.debug('ANTES', { currentRZ: before });
    try {
      store.setCurrentRZ?.(after);
      store.emit?.('refresh');
      log.info('DEPOIS', { currentRZ: store?.state?.currentRZ ?? null });
    } catch(e){
      log.error('Falha ao setar RZ via UI', e);
    } finally {
      log.groupEnd();
    }
  }, { signal: ac.signal });

  // sincroniza valores
  const st = store?.state?.currentRZ ?? '';
  if(st){ sel.value = st; }
  else if(sel.value){ 
    log.info('State sem RZ; adotando o do select inicial', sel.value);
    store.setCurrentRZ?.(sel.value);
    store.emit?.('refresh');
  }

  sel.dataset.rzBound = '1';
  log.info('RZ select bound', { value: sel.value, id: sel.id || '(sem id)' });
  return true;
}

function watchSelectAppearance(ms=3000){
  if(bindSelectOnce()) return;
  const obs = new MutationObserver(()=>{
    if(bindSelectOnce()) obs.disconnect();
  });
  obs.observe(document.documentElement, { childList:true, subtree:true });
  setTimeout(()=>obs.disconnect(), ms);
}

function patchStore(){
  if(!store) return;
  if(store.__rzPatched) return;
  store.__rzPatched = true;

  const origSet = store.setCurrentRZ?.bind(store);
  if(origSet){
    store.setCurrentRZ = (rz)=>{
      const before = store?.state?.currentRZ ?? null;
      log.group(`store.setCurrentRZ("${rz}")`);
      log.debug('ANTES', { currentRZ: before });
      const ret = origSet(rz);
      log.info('DEPOIS', { currentRZ: store?.state?.currentRZ ?? null });
      log.groupEnd();
      return ret;
    };
  }

  const wrapMut = (name)=>{
    const fn = store[name]?.bind(store);
    if(!fn) return;
    store[name] = (...args)=>{
      const rz = store?.state?.currentRZ ?? null;
      log.group(`${name}() @rz=${rz}`);
      try { 
        const out = fn(...args);
        const items = store?.state?.items || [];
        log.info('itens no state', { total: items.length, rzAtual: rz, doRZ: items.filter(i=>i?.rz===rz).length });
        return out;
      } catch(e){
        log.error(`${name} falhou`, e);
      } finally {
        log.groupEnd();
      }
    };
  };

  ['upsertItem','bulkUpsertItems','updateItem'].forEach(wrapMut);

  const origEmit = store.emit?.bind(store);
  if(origEmit){
    store.emit = (evt, ...rest)=>{
      const rz = store?.state?.currentRZ ?? null;
      log.debug(`emit("${evt}") @rz=${rz}`, ...rest);
      return origEmit(evt, ...rest);
    };
  }

  const origOn = store.on?.bind(store);
  if(origOn){
    store.on = (evt, fn)=>{
      log.debug(`on("${evt}") registrado`);
      return origOn(evt, fn);
    };
  }
}

function patchBoot(){
  const bootEl = document.getElementById('boot') || document.querySelector('.boot-badge,[data-boot]');
  if(bootEl){
    const origText = bootEl.textContent;
    log.debug('Boot badge detectado', { text: origText });
  }
  const g = (p)=> (typeof p === 'function' ? p : ()=>{});
  try {
    const mod = require('../utils/boot.js'); // Vite resolverá ESM; fica só como dica
    const show = g(mod.showBoot), hide = g(mod.hideBoot);
    mod.showBoot = (...a)=>{ log.info('BOOT show', a); return show(...a); };
    mod.hideBoot = (...a)=>{ log.info('BOOT hide'); return hide(...a); };
  } catch {}
}

export function enableRzDebug(){
  if(!isDebug()) return;
  log.info('Debug RZ ATIVADO');
  patchStore();
  bindSelectOnce();
  watchSelectAppearance(3000);
  patchBoot();

  // helpers no window
  window.app = Object.assign(window.app || {}, {
    rzDump(){
      const st = store?.state || {};
      const items = st.items || [];
      const rz = st.currentRZ ?? null;
      const same = items.filter(i=>i?.rz===rz).length;
      console.table([{ currentRZ: rz, totalItems: items.length, itemsDoRZ: same }]);
      return { rz, total: items.length, doRZ: same };
    }
  });

  const unmount = mountRzOverlay(()=>window.app.rzDump());
  if(import.meta?.hot){
    import.meta.hot.dispose(()=>{
      boundAbort?.abort?.();
      unmount();
      log.warn('HMR dispose: removendo listeners do RZ');
    });
  }
}
