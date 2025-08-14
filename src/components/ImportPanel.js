// src/components/ImportPanel.js
import { processarPlanilha } from '../utils/excel.js';
import store, { setCurrentRZ } from '../store/index.js';

export function initImportPanel(render){
  const fileInput = document.getElementById('input-arquivo');
  const rzSelect  = document.getElementById('select-rz');

  fileInput?.addEventListener('change', async (e)=>{
    const f = e.target?.files?.[0];
    if (!f) return;
    const buf = (f.arrayBuffer ? await f.arrayBuffer() : f);
    const { rzList } = await processarPlanilha(buf);
    if (rzSelect){
      rzSelect.innerHTML = rzList.map(rz=>`<option value="${rz}">${rz}</option>`).join('');
      if (rzList.length){
        rzSelect.value = rzList[0];
        setCurrentRZ(rzList[0]);
      }
    } else {
      setCurrentRZ(rzList[0] || null);
    }
    render?.();
  });

  rzSelect?.addEventListener('change', e=>{ setCurrentRZ(e.target.value || null); render?.(); });
}
