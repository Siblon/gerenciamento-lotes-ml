// src/components/ScannerPanel.js
import { iniciarLeitura, pararLeitura, listarCameras } from '../utils/scan.js';
import { createCard } from './Card.js';

function setBoot(msg){
  const st = document.getElementById('boot-status');
  if (st) st.textContent = `Boot: ${msg}`;
}

export function initScannerPanel({ onCode }){
  const btnOpenScanner = document.getElementById('btn-open-scanner');
  const scannerCard = createCard('#card-scanner');
  const btnScan = document.getElementById('btn-scan-toggle');
  const videoEl = document.getElementById('preview');

  videoEl?.setAttribute('hidden', '');

  const camSelect = document.createElement('select');
  camSelect.id = 'camera-select';
  camSelect.className = 'input';
  camSelect.hidden = true;
  btnScan?.insertAdjacentElement('beforebegin', camSelect);

  const scanMsg = document.createElement('p');
  scanMsg.id = 'scan-msg';
  scanMsg.className = 'muted';
  scanMsg.hidden = true;
  btnScan?.insertAdjacentElement('afterend', scanMsg);

  const liveRegion = document.createElement('p');
  liveRegion.id = 'scanner-live';
  liveRegion.className = 'sr-only';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('role', 'status');
  btnScan?.insertAdjacentElement('afterend', liveRegion);

  const announce = (msg) => { liveRegion.textContent = msg; };

  listarCameras()?.then(devs => {
    if (devs.length > 1) {
      camSelect.innerHTML = devs
        .map((d,i)=>`<option value="${d.deviceId}">${d.label || ('Câmera ' + (i+1))}</option>`)
        .join('');
      camSelect.hidden = false;
    }
  });

  let scanning = false;

  btnOpenScanner?.addEventListener('click', () => {
    scannerCard.toggle();
    if (scannerCard.el.classList.contains('collapsed') && scanning) {
      btnScan?.click();
    }
  });

  btnScan?.addEventListener('click', async ()=>{
    try {
      if (!scanning) {
        const once = (fn, ms=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms);} };
        const onDecoded = once((code)=>{ onCode?.((code||'').trim().toUpperCase()); },350);
        scanMsg.hidden = true;
        const deviceId = !camSelect.hidden ? camSelect.value : undefined;
        videoEl.hidden = false;
        await iniciarLeitura(videoEl, (texto)=>{ onDecoded(texto); }, deviceId);
        scanning = true; btnScan.textContent = 'Parar Scanner';
        setBoot('Scanner ativo ▶️');
        announce('Scanner ativado');
      } else {
        await pararLeitura(videoEl);
        scanning = false; btnScan.textContent = 'Ativar Scanner';
        videoEl.hidden = true;
        setBoot('Scanner parado ⏹️');
        announce('Scanner parado');
      }
    } catch(err){
      console.error('Erro iniciarLeitura', err);
      scanMsg.textContent = 'Não foi possível acessar a câmera. Digite o código manualmente.';
      scanMsg.hidden = false;
      videoEl.hidden = true;
      setBoot('Falha ao iniciar scanner ❌ (veja Console)');
      scanning = false; btnScan.textContent = 'Ativar Scanner';
      announce('Falha ao iniciar scanner');
    }
  });

  document.addEventListener('keydown',(e)=>{
    if (e.ctrlKey && e.key.toLowerCase()==='j'){ e.preventDefault(); btnScan?.click(); }
  });
}
