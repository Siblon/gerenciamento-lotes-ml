// src/utils/scan.js
let reader = null;
let currentStream = null;

const ZXING_CDN = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.4/+esm';

export async function iniciarLeitura(videoEl, onText) {
  if (!videoEl) throw new Error('videoEl ausente');

  // Tenta BarcodeDetector nativo primeiro
  const hasNative = 'BarcodeDetector' in window;
  if (hasNative) {
    const detector = new window.BarcodeDetector({
      formats: ['qr_code', 'ean_13', 'code_128', 'code_39', 'upc_a', 'upc_e'],
    });
    // abre câmera
    currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    videoEl.srcObject = currentStream;
    await videoEl.play();

    const loop = async () => {
      if (!videoEl.srcObject) return; // parado
      try {
        const bitmap = await createImageBitmap(videoEl);
        const codes = await detector.detect(bitmap);
        bitmap.close?.();
        if (codes && codes.length) onText(String(codes[0].rawValue || codes[0].rawValue || codes[0].value));
      } catch (_) {}
      requestAnimationFrame(loop);
    };
    loop();
    return;
  }

  // ZXing via CDN
  const mod = await import(/* @vite-ignore */ ZXING_CDN);
  const { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } = mod;

  // formatos suportados
  const formats = new Set([
    BarcodeFormat.QR_CODE,
    BarcodeFormat.EAN_13,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, Array.from(formats));

  reader = new BrowserMultiFormatReader(hints);

  // abrir câmera
  const devices = await reader.listVideoInputDevices();
  const deviceId = devices?.[0]?.deviceId;
  currentStream = await navigator.mediaDevices.getUserMedia({
    video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' },
  });
  videoEl.srcObject = currentStream;
  await videoEl.play();

  // loop do ZXing (interval + draw no <video>)
  await reader.decodeFromVideoDevice(deviceId ?? undefined, videoEl, (result, err) => {
    if (result) onText(String(result.getText()));
    // erros de “NotFound” são normais no streaming; ignorar
  });
}

export async function pararLeitura(videoEl) {
  if (reader?.reset) reader.reset();
  reader = null;
  if (videoEl) {
    try { videoEl.pause(); } catch {}
    videoEl.srcObject = null;
  }
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
}
