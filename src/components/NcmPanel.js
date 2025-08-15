import store from '../store/index.js';

export function initNcmPanel(){
  const tbody = document.getElementById('ncm-table');
  const progress = document.getElementById('ncm-progress');
  const progressCount = document.getElementById('ncm-progress-count');
  const cancelBtn = document.getElementById('ncm-cancel');
  const chkFail = document.getElementById('ncm-only-fail');

  cancelBtn?.addEventListener('click', ()=> document.dispatchEvent(new Event('ncm-cancel')));

  document.addEventListener('ncm-progress', e=>{
    const {done,total} = e.detail || {};
    if(progress){
      progress.hidden = done >= total;
      if(progressCount) progressCount.textContent = `${done}/${total}`;
    }
  });

  function render(){
    const rows=[];
    for(const metas of Object.values(store.state.metaByRZSku||{})){
      for(const [sku, m] of Object.entries(metas||{})){
        const status = m.ncm_status || '';
        if(chkFail?.checked && status === 'ok') continue;
        rows.push(`<tr><td>${sku}</td><td>${(m.descricao||'').slice(0,40)}</td><td>${m.ncm||''}</td><td>${m.ncm_source||''}</td><td>${status||''}</td></tr>`);
      }
    }
    if(tbody) tbody.innerHTML = rows.join('');
  }

  chkFail?.addEventListener('change', render);
  document.addEventListener('ncm-update', render);
  render();
}

export default { initNcmPanel };
