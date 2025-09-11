// simples overlay no canto para ver RZ atual e contagem
export function mountRzOverlay(getState){
  const el = document.createElement('div');
  el.style = 'position:fixed;left:8px;bottom:8px;padding:6px 8px;background:#111;color:#fff;font:12px/1.3 ui-monospace;border-radius:6px;opacity:.85;z-index:99999';
  document.body.appendChild(el);
  const tick = ()=>{
    const st = getState();
    el.textContent = `RZ=${st.rz ?? '(null)'} | itens=${st.total} | doRZ=${st.doRZ}`;
  };
  tick();
  const id = setInterval(tick, 800);
  return ()=>clearInterval(id);
}
