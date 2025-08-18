// src/components/ImportPanel.js
import { parsePlanilha } from '../utils/excel.js';
import store, { setCurrentRZ, setRZs, setItens } from '../store/index.js';
import { startNcmQueue } from '../services/ncmQueue.js';
import { loadPrefs } from '../utils/prefs.js';

export function initImportPanel(render){
    const fileInput = document.getElementById('file');
    const fileName  = document.getElementById('file-name');
    const rzSelect  = document.getElementById('select-rz');

    if (fileName) fileName.classList.add('ellipsis');

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
          rzSelect.dispatchEvent(new CustomEvent('rz:changed', { bubbles:true }));
        }
      } else {
        setCurrentRZ(rzs[0] || null);
        document.dispatchEvent(new CustomEvent('rz:changed', { bubbles:true }));
      }
      render?.();
  });

  rzSelect?.addEventListener('change', e=>{
      setCurrentRZ(e.target.value || null);
      render?.();
      rzSelect.dispatchEvent(new CustomEvent('rz:changed', { bubbles:true }));
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

export default function ImportPanel(){
  const sec = document.createElement('section');
  sec.className = 'card';
  sec.innerHTML = `
    <h2 class="section-title">Importação & Seleção</h2>
    <div class="field">
      <input type="file" id="file" accept=".xlsx" />
      <span id="file-name" class="subtle"></span>
    </div>
    <div class="field">
      <label for="select-rz" class="label">RZ</label>
      <select id="select-rz"></select>
      <span id="ncm-badge" class="chip" hidden>Resolvendo NCM… <span id="ncm-badge-count">0/0</span></span>
    </div>`;
  setTimeout(()=>initImportPanel(()=>{}),0);
  return sec;
}
