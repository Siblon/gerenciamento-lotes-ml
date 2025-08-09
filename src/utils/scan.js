// src/utils/scan.js
let reader = null;
let currentStream = null;
let ZXing = null;

const ZXING_CDN = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/esm/index.js';

async function loadZXing() {
  if (ZXing) return ZXing;
  ZXing = await import(/* @vite-ignore */ ZXING_CDN);
  return ZXing;
}

export async function iniciarLeitura(videoEl, onText) {
  if (!videoEl) throw new Error('videoEl ausente');

  if (!window.isSecureContext) {
    console.warn('[SCAN] Contexto não seguro; câmera pode falhar.');
  }

  const supportsNative = 'BarcodeDetector' in window;
  if (!supportsNative) await loadZXing();

  // 1) Nativo
  if (supportsNative) {
    const detector = new window.BarcodeDetector({
      formats: ['qr_code','ean_13','code_128','code_39','upc_a','upc_e'],
    });
    currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    videoEl.srcObject = currentStream; await videoEl.play();

    const loop = async () => {
      if (!videoEl.srcObject) return; // parado
      try {
        const bitmap = await createImageBitmap(videoEl);
        const codes = await detector.detect(bitmap); bitmap.close?.();
        if (codes?.length) {
          const v = String(codes[0].rawValue ?? codes[0].value ?? '');
          if (v) onText(v);
        }
      } catch {}
      requestAnimationFrame(loop);
    };
    loop();
    return;
  }

  // 2) ZXing via CDN
  const mod = ZXing;
  const BrowserMultiFormatReader = mod.BrowserMultiFormatReader || mod.default?.BrowserMultiFormatReader;
  if (!BrowserMultiFormatReader) throw new Error('ZXing BrowserMultiFormatReader indisponível');

  const FMTS  = mod.BarcodeFormat ? Object.values(mod.BarcodeFormat) : [];
  const HINTS = mod.DecodeHintType
    ? new Map([[mod.DecodeHintType.POSSIBLE_FORMATS, FMTS]])
    : undefined;

  const devices = (mod.BrowserMultiFormatReader?.listVideoInputDevices)
    ? await mod.BrowserMultiFormatReader.listVideoInputDevices()
    : (await navigator.mediaDevices?.enumerateDevices?.())?.filter(d => d.kind === 'videoinput') || [];

  if (!devices.length) {
    throw new Error('Nenhuma câmera encontrada');
  }

  reader = HINTS ? new BrowserMultiFormatReader(HINTS) : new BrowserMultiFormatReader();

  await reader.decodeFromVideoDevice(devices[0].deviceId, videoEl, (result, err) => {
    if (result) {
      const text = String(result.getText?.() || result.text || '');
      if (text) onText(text);
    }
    // erros transitórios (NotFoundException) são normais; ignore
  });
}

export async function pararLeitura(videoEl) {
  try { reader?.reset?.(); } catch {}
  reader = null;
  if (videoEl) { try { videoEl.pause(); } catch {} videoEl.srcObject = null; }
  if (currentStream) { currentStream.getTracks().forEach(t=>t.stop()); currentStream = null; }
}

