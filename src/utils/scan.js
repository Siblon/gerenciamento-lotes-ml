// src/utils/scan.js
let reader = null;
let currentStream = null;

const ZXING_CDN = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.4/+esm';

export async function iniciarLeitura(videoEl, onText) {
  if (!videoEl) throw new Error('videoEl ausente');

  // 1) nativo se disponível
  if ('BarcodeDetector' in window) {
    const detector = new window.BarcodeDetector({
      formats: ['qr_code','ean_13','code_128','code_39','upc_a','upc_e']
    });
    currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    videoEl.srcObject = currentStream; await videoEl.play();

    const loop = async () => {
      if (!videoEl.srcObject) return; // parado
      try {
        const bitmap = await createImageBitmap(videoEl);
        const codes = await detector.detect(bitmap); bitmap.close?.();
        if (codes?.length) onText(String(codes[0].rawValue || codes[0].value || ''));
      } catch {}
      requestAnimationFrame(loop);
    };
    loop();
    return;
  }

  // 2) ZXing via CDN
  const mod = await import(/* @vite-ignore */ ZXING_CDN);
  const BrowserMultiFormatReader = mod.BrowserMultiFormatReader || mod.default?.BrowserMultiFormatReader;
  if (!BrowserMultiFormatReader) throw new Error('ZXing BrowserMultiFormatReader indisponível');

  const BarcodeFormat   = mod.BarcodeFormat || {};
  const DecodeHintType  = mod.DecodeHintType || {};

  // cria reader com hints somente se os enums existirem
  let hints;
  if (DecodeHintType.POSSIBLE_FORMATS) {
    const formats = [];
    if (BarcodeFormat.QR_CODE) formats.push(BarcodeFormat.QR_CODE);
    if (BarcodeFormat.EAN_13)  formats.push(BarcodeFormat.EAN_13);
    if (BarcodeFormat.CODE_128)formats.push(BarcodeFormat.CODE_128);
    if (BarcodeFormat.CODE_39) formats.push(BarcodeFormat.CODE_39);
    if (BarcodeFormat.UPC_A)   formats.push(BarcodeFormat.UPC_A);
    if (BarcodeFormat.UPC_E)   formats.push(BarcodeFormat.UPC_E);

    hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
  }

  reader = hints ? new BrowserMultiFormatReader(hints) : new BrowserMultiFormatReader();

  const devices = await reader.listVideoInputDevices();
  const deviceId = devices?.[0]?.deviceId;

  currentStream = await navigator.mediaDevices.getUserMedia({
    video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }
  });
  videoEl.srcObject = currentStream; await videoEl.play();

  await reader.decodeFromVideoDevice(deviceId ?? undefined, videoEl, (result, err) => {
    if (result) onText(String(result.getText?.() || result.text || ''));
    // erros transitórios são normais
  });
}

export async function pararLeitura(videoEl) {
  try { reader?.reset?.(); } catch {}
  reader = null;
  if (videoEl) { try { videoEl.pause(); } catch {} videoEl.srcObject = null; }
  if (currentStream) { currentStream.getTracks().forEach(t=>t.stop()); currentStream = null; }
}
