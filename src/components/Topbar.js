export default function Topbar(){
  const wrap = document.createElement('div');
  wrap.className = 'topbar';
  wrap.innerHTML = `
    <div class="container">
      <div class="tabs">
        <button class="tab" data-href="#/conferencia">Conferência</button>
        <button class="tab" data-href="#/ncm">NCM</button>
      </div>
    </div>`;
  wrap.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-href]');
    if (btn) location.hash = btn.dataset.href;
  });
  const sync = () => {
    wrap.querySelectorAll('.tab').forEach(t=>{
      t.classList.toggle('active', t.dataset.href === location.hash);
    });
  };
  window.addEventListener('hashchange', sync); sync();
  return wrap;
}
