// src/utils/scan.js
// Leitura de códigos por câmera usando BarcodeDetector ou ZXing
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { switchTo } from './scannerController.js';
import { toast } from './toast.js';

let reader = null;
let currentStream = null;

function fallback(err) {
  console.warn('[SCANNER] fallback to wedge', err);
  switchTo('wedge');
  toast.warn('Leitor de câmera indisponível. Usando modo Bipe (USB).');
}

export async function iniciarLeitura(videoEl, onText, deviceId) {
  if (!videoEl) throw new Error('videoEl ausente');

  if (!window.isSecureContext) {
    console.warn('[SCAN] Contexto não seguro; câmera pode falhar.');
  }

  const supportsNative = 'BarcodeDetector' in window;

  const start = async () => {
    if (supportsNative) {
      const detector = new window.BarcodeDetector({
        formats: ['qr_code', 'ean_13', 'code_128', 'code_39', 'upc_a', 'upc_e'],
      });
      const videoConfig = deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: 'environment' };
      currentStream = await navigator.mediaDevices.getUserMedia({ video: videoConfig });
      videoEl.srcObject = currentStream;
      await videoEl.play();
      const loop = async () => {
        if (!videoEl.srcObject) return; // parado
        try {
          const bitmap = await createImageBitmap(videoEl);
          const codes = await detector.detect(bitmap);
          bitmap.close?.();
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

    const FMTS = Object.values(BarcodeFormat);
    const HINTS = new Map([[DecodeHintType.POSSIBLE_FORMATS, FMTS]]);
    reader = new BrowserMultiFormatReader(HINTS);
    const devices = await BrowserMultiFormatReader.listVideoInputDevices();
    if (!devices.length) throw new Error('Nenhuma câmera encontrada');
    const chosen = deviceId || devices[0].deviceId;
    await reader.decodeFromVideoDevice(chosen, videoEl, (result, err) => {
      if (result) {
        const text = String(result.getText?.() || result.text || '');
        if (text) onText(text);
      }
    });
  };

  try {
    await Promise.race([
      start(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
  } catch (err) {
    fallback(err);
    throw err;
  }
}

export async function pararLeitura(videoEl) {
  try { reader?.reset?.(); } catch {}
  reader = null;
  if (videoEl) { try { videoEl.pause(); } catch {} videoEl.srcObject = null; }
  if (currentStream) { currentStream.getTracks().forEach(t => t.stop()); currentStream = null; }
}

export async function listarCameras() {
  try {
    const devices = await navigator.mediaDevices?.enumerateDevices?.();
    return devices?.filter(d => d.kind === 'videoinput') || [];
  } catch {
    return [];
  }
}
