import store from '../store/index.js';
import { loadPrefs, savePrefs } from '../utils/prefs.js';
import { startNcmQueue } from '../services/ncmQueue.js';
import { getNcmCheckedForSku, setNcmCheckedForSku } from './ActionsPanel.js';

export function initNcmPanel(){
  const panel = document.getElementById('card-ncm');
  if (!panel) return;
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
  const collapseBtn = document.getElementById('ncm-collapse');
  const emptyDiv = document.getElementById('ncm-empty');
  const showAllBtn = document.getElementById('ncm-show-all');
  const tableWrap = panel?.querySelector('.table-wrap');
  const pager = panel?.querySelector('.pager');

  const disabledDiv = document.createElement('div');
  disabledDiv.id = 'ncm-disabled';
  disabledDiv.innerHTML = '<div class="card-body"><p>NCM desativado</p><button id="ncm-enable" class="btn btn-primary" type="button">Ativar NCM</button></div>';
  panel?.prepend(disabledDiv);
  const contentParts = Array.from(panel.children).filter(el => el !== disabledDiv);
  function applyEnabled(en){
    disabledDiv.hidden = en;
    contentParts.forEach(el => { el.hidden = !en; });
  }
  let ncmEnabled = loadPrefs().ncmEnabled;
  applyEnabled(ncmEnabled);
  document.addEventListener('ncm-pref-changed', ev => { ncmEnabled = !!ev.detail?.enabled; applyEnabled(ncmEnabled); });
  disabledDiv.querySelector('#ncm-enable')?.addEventListener('click', () => {
    const p = loadPrefs(); p.ncmEnabled = true; savePrefs(p);
    document.dispatchEvent(new CustomEvent('ncm-pref-changed',{detail:{enabled:true}}));
    startNcmQueue(store.selectAllImportedItems?.()||[]);
  });

  let page = 0;
  const limit = 20;
  let data = [];
  let renderTimeout;

  cancelBtn?.addEventListener('click', ()=> document.dispatchEvent(new Event('ncm-cancel')));
  collapseBtn?.addEventListener('click', ()=>{
    panel?.classList.toggle('collapsed');
    localStorage.setItem('ncm:collapsed', panel?.classList.contains('collapsed'));
  });
  const prefCollapsed = localStorage.getItem('ncm:collapsed');
  if(prefCollapsed === 'false') panel?.classList.remove('collapsed');

  document.addEventListener('ncm-progress', e=>{
    if(!ncmEnabled) return;
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
    if(cntOk) cntOk.textContent = `${ok} OK`;
    if(cntFail) cntFail.textContent = `${fail} Falhas`;
    if(cntPend) cntPend.textContent = `${pend} Restantes`;
    if(fail === 0 && chkFail?.checked){
      if(emptyDiv) emptyDiv.hidden = false;
      if(tableWrap) tableWrap.hidden = true;
      if(pager) pager.hidden = true;
      if(tbody) tbody.innerHTML = '';
      if(pageInfo) pageInfo.textContent = '0/0';
      return;
    } else {
      if(emptyDiv) emptyDiv.hidden = true;
      if(tableWrap) tableWrap.hidden = false;
      if(pager) pager.hidden = false;
    }
    const start = page * limit;
    const slice = data.slice(start, start + limit);
    if (tbody) {
      tbody.innerHTML = '';
      slice.forEach(r => {
        const tr = document.createElement('tr');
        const rowCls = r.status === 'ok' ? 'row-ok' : r.status === 'falha' ? 'row-falha' : '';
        if (rowCls) tr.className = rowCls;

        const tdSku = document.createElement('td');
        tdSku.textContent = r.sku;
        tr.appendChild(tdSku);

        const tdDesc = document.createElement('td');
        tdDesc.textContent = r.desc;
        tr.appendChild(tdDesc);

        const tdNcm = document.createElement('td');
        tdNcm.textContent = r.ncm;
        tr.appendChild(tdNcm);

        const tdSource = document.createElement('td');
        tdSource.textContent = r.source;
        tr.appendChild(tdSource);

        const tdStatus = document.createElement('td');
        if (r.status) {
          const badge = document.createElement('span');
          const badgeCls = r.status === 'ok' ? 'badge-ok' : r.status === 'falha' ? 'badge-falha' : '';
          badge.className = `badge ${badgeCls}`;
          badge.textContent = r.status;
          tdStatus.appendChild(badge);
        }
        const btn = document.createElement('button');
        btn.className = 'btn btn-ghost';
        btn.type = 'button';
        btn.textContent = getNcmCheckedForSku(r.sku) ? 'Desmarcar' : 'Marcar OK';
        btn.addEventListener('click', () => {
          const now = !getNcmCheckedForSku(r.sku);
          setNcmCheckedForSku(r.sku, now);
          btn.textContent = now ? 'Desmarcar' : 'Marcar OK';
        });
        tdStatus.appendChild(btn);
        tr.appendChild(tdStatus);

        tbody.appendChild(tr);
      });
    }
    if(pageInfo){
      const end = Math.min(start + slice.length, total);
      pageInfo.textContent = total ? `${start+1}-${end}/${total}` : '0/0';
    }
    if(btnPrev) btnPrev.disabled = page <= 0;
    if(btnNext) btnNext.disabled = (page + 1) * limit >= total;
  }

  btnPrev?.addEventListener('click', ()=>{ if(page>0){ page--; render(); } });
  btnNext?.addEventListener('click', ()=>{ if((page+1)*limit < data.length){ page++; render(); } });
  showAllBtn?.addEventListener('click', ()=>{ chkFail.checked = false; render(); });

  const scheduleRender = ()=>{ clearTimeout(renderTimeout); renderTimeout = setTimeout(render,150); };
  chkFail?.addEventListener('change', scheduleRender);
  document.addEventListener('ncm-update', render);
  render();
}

export default { initNcmPanel };
