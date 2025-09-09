const SISCOMEX_URL = 'https://portalunico.siscomex.gov.br/classif/api/publico/ncm?descricao=';

function isLocal() {
  const h = (globalThis?.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1';
}

// Retorna { ncm: string|null, status: 'ok'|'skipped'|'error' }
export async function resolveNcmByDescription(desc) {
  // Evitar travar o app em dev
  if (isLocal()) {
    return { ncm: null, status: 'skipped' };
  }
  try {
    const url = SISCOMEX_URL + encodeURIComponent(desc);
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return { ncm: null, status: 'error' };
    const data = await res.json();
    const ncm = Array.isArray(data) && data[0]?.codigo || null;
    return { ncm, status: 'ok' };
  } catch {
    return { ncm: null, status: 'error' };
  }
}

export default { resolveNcmByDescription };
