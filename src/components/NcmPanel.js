import store from '../store/index.js';

export function initNcmPanel(){
  const tbody = document.getElementById('ncm-table');
  const progress = document.getElementById('ncm-progress');
  const progressCount = document.getElementById('ncm-progress-count');
  const cancelBtn = document.getElementById('ncm-cancel');
  const chkFail = document.getElementById('ncm-only-fail');
  const cntOk = document.getElementById('ncm-count-ok');
  const cntFail = document.getElementById('ncm-count-fail');
  const cntPend = document.getElementById('ncm-count-pend');
  const btnPrev = document.getElementById('ncm-prev');
  const btnNext = document.getElementById('ncm-next');
  const pageInfo = document.getElementById('ncm-page');

  let page = 0;
  const limit = 50;
  let data = [];

  cancelBtn?.addEventListener('click', ()=> document.dispatchEvent(new Event('ncm-cancel')));

  document.addEventListener('ncm-progress', e=>{
    const {done,total} = e.detail || {};
    if(progress){
      progress.hidden = done >= total;
      if(progressCount) progressCount.textContent = `${done}/${total}`;
    }
  });

  function render(){
    data = [];
    let ok = 0, fail = 0;
    for(const metas of Object.values(store.state.metaByRZSku||{})){
      for(const [sku, m] of Object.entries(metas||{})){
        const status = m.ncm_status || '';
        if(chkFail?.checked && status === 'ok') continue;
        if(status === 'ok') ok++; else if(status === 'falha') fail++;
        data.push({ sku, desc:(m.descricao||'').slice(0,40), ncm:m.ncm||'', source:m.ncm_source||'', status });
      }
    }
    const total = data.length;
    const pend = Math.max(0, total - ok - fail);
    if(cntOk) cntOk.textContent = ok;
    if(cntFail) cntFail.textContent = fail;
    if(cntPend) cntPend.textContent = pend;
    const start = page * limit;
    const slice = data.slice(start, start + limit);
    if(tbody) tbody.innerHTML = slice.map(r=>`<tr><td>${r.sku}</td><td>${r.desc}</td><td>${r.ncm}</td><td>${r.source}</td><td>${r.status}</td></tr>`).join('');
    if(pageInfo){
      const end = Math.min(start + slice.length, total);
      pageInfo.textContent = total ? `${start+1}-${end}/${total}` : '0/0';
    }
    if(btnPrev) btnPrev.disabled = page <= 0;
    if(btnNext) btnNext.disabled = (page + 1) * limit >= total;
  }

  btnPrev?.addEventListener('click', ()=>{ if(page>0){ page--; render(); } });
  btnNext?.addEventListener('click', ()=>{ if((page+1)*limit < data.length){ page++; render(); } });

  chkFail?.addEventListener('change', render);
  document.addEventListener('ncm-update', render);
  render();
}

export default { initNcmPanel };
