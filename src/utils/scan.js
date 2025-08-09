const ZXING_CDN = 'https://cdn.jsdelivr.net/npm/' + '@zxing' + '/browser@0.1.4/+esm';

let zxingReader = null;
let zxingControls = null;

const dbg = (...a) => { if (window.__DEBUG_SCAN__) console.log('[SCAN]', ...a); };

/** Carrega ZXing do CDN e inicia leitura contínua no <video> */
export async function iniciarZXing(videoEl, onResult, opts = {}) {
  if (zxingReader) return zxingReader;
  dbg('Carregando ZXing do CDN...');
  const mod = await import(/* @vite-ignore */ ZXING_CDN);
  const { BrowserMultiFormatReader } = mod;

  zxingReader = new BrowserMultiFormatReader();
  zxingControls = await zxingReader.decodeFromVideoDevice(
    opts.deviceId ?? undefined,
    videoEl,
    (result, err) => {
      if (result) {
        try { onResult(result.getText(), result); } catch {}
      }
      // erros de frame são normais; ignorar
    }
  );
  dbg('ZXing iniciado.');
  return zxingReader;
}

/** Para ZXing e libera câmera */
export async function pararZXing(videoEl) {
  try {
    if (zxingControls) { zxingControls.stop(); zxingControls = null; }
    if (zxingReader?.reset) zxingReader.reset();
    zxingReader = null;
  } catch (e) { console.warn('Erro ao parar ZXing:', e); }

  try {
    const stream = videoEl?.srcObject;
    if (stream?.getTracks) stream.getTracks().forEach(t => t.stop());
    if (videoEl) { videoEl.srcObject = null; videoEl.removeAttribute('src'); videoEl.load?.(); }
  } catch {}
}

let detector = null;
let rafId = null;
let missCount = 0;
const MISS_THRESHOLD = 30; // ~1–2s

async function startBarcodeDetector(videoEl, onResult) {
  dbg('Tentando BarcodeDetector...');
  detector = new window.BarcodeDetector({
    formats: ['qr_code','code_128','ean_13','ean_8','upc_e']
  });

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' }, audio: false
  });
  videoEl.srcObject = stream;
  await videoEl.play();

  const loop = async () => {
    try {
      const barcodes = await detector.detect(videoEl);
      if (barcodes?.length) {
        missCount = 0;
        onResult(barcodes[0].rawValue, barcodes[0]);
      } else {
        if (++missCount >= MISS_THRESHOLD) {
          dbg('Muitas tentativas sem leitura; caindo para ZXing.');
          await stopBarcodeDetector(videoEl);
          await iniciarZXing(videoEl, onResult);
          return;
        }
      }
    } catch (e) {
      dbg('BarcodeDetector falhou, caindo para ZXing.', e);
      await stopBarcodeDetector(videoEl);
      await iniciarZXing(videoEl, onResult);
      return;
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

async function stopBarcodeDetector(videoEl) {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  try {
    const stream = videoEl?.srcObject;
    if (stream?.getTracks) stream.getTracks().forEach(t => t.stop());
  } catch {}
  if (videoEl) { videoEl.srcObject = null; videoEl.removeAttribute('src'); videoEl.load?.(); }
  detector = null;
  missCount = 0;
}

export async function iniciarLeitura(videoEl, onResult) {
  dbg('iniciarLeitura()');
  if ('BarcodeDetector' in window) return startBarcodeDetector(videoEl, onResult);
  dbg('BarcodeDetector indisponível; iniciando ZXing direto.');
  return iniciarZXing(videoEl, onResult);
}

export async function pararLeitura(videoEl) {
  dbg('pararLeitura()');
  await pararZXing(videoEl);
  await stopBarcodeDetector(videoEl);
}

