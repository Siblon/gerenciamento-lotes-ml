import { loadPrefs, savePrefs } from './utils/prefs.js';

const routes = {
  '#/conferencia': () => import('./pages/ConferenciaPage.js'),
  '#/ncm':         () => import('./pages/NcmPage.js')
};

export async function mountRoute(root){
  const key = window.location.hash in routes ? window.location.hash : '#/conferencia';
  const mod = await routes[key]();
  root.innerHTML = '';
  const el = await mod.default();
  root.append(el);
}

export function initRouter(root){
  window.addEventListener('hashchange', () => {
    mountRoute(root);
    const p = loadPrefs();
    p.lastRoute = location.hash;
    savePrefs(p);
  });
  if(!location.hash){
    const p = loadPrefs();
    location.hash = p.lastRoute || '#/conferencia';
  }
  mountRoute(root);
}
