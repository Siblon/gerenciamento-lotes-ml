// src/components/ImportPanel.js
import { parsePlanilha } from '../utils/excel.js';
import store, { setCurrentRZ, setRZs, setItens } from '../store/index.js';
import { startNcmQueue } from '../services/ncmQueue.js';
import { loadPrefs } from '../utils/prefs.js';

export function initImportPanel(render){
  const fileInput = document.getElementById('file');
  const fileName  = document.getElementById('file-name');
  const rzSelect  = document.getElementById('select-rz');

  let ncmActive = loadPrefs().ncmEnabled;

  fileInput?.addEventListener('change', async (e)=>{
    const f = e.target?.files?.[0];
    const name = f?.name || '';
    if (fileName) {
      fileName.textContent = name;
      fileName.title = name;
    }
    if (!f) return;
    const buf = (f.arrayBuffer ? await f.arrayBuffer() : f);
    const { rzs, itens } = await parsePlanilha(buf);
    setRZs(rzs);
    setItens(itens);
    if (ncmActive) startNcmQueue(itens);
    if (rzSelect){
      rzSelect.innerHTML = rzs.map(rz=>`<option value="${rz}">${rz}</option>`).join('');
      if (rzs.length){
        rzSelect.value = rzs[0];
        setCurrentRZ(rzs[0]);
      }
    } else {
      setCurrentRZ(rzs[0] || null);
    }
    render?.();
  });

  rzSelect?.addEventListener('change', e=>{
    setCurrentRZ(e.target.value || null);
    render?.();
    const input = document.querySelector('#input-codigo-produto');
    if (input) { input.focus(); input.select(); }
  });

  const badge = document.getElementById('ncm-badge');
  const badgeCount = document.getElementById('ncm-badge-count');
  document.addEventListener('ncm-progress', e=>{
    if(!ncmActive || !badge) return;
    const { done, total } = e.detail;
    if(total > 0 && done < total){
      badge.hidden = false;
      if(badgeCount) badgeCount.textContent = `${done}/${total}`;
    }else{
      badge.hidden = true;
    }
  });

  document.addEventListener('ncm-pref-changed', ev => {
    ncmActive = !!ev.detail?.enabled;
    if(!ncmActive) badge.hidden = true;
  });
}
