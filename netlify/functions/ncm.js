export async function handler(evt) {
  const url = new URL(evt.rawUrl);
  const q = url.searchParams.get('descricao') || url.searchParams.get('codigo');
  if (!q) return { statusCode: 400, body: 'missing query' };
  const path = url.searchParams.has('descricao')
    ? `/classif/api/publico/ncm?descricao=${encodeURIComponent(q)}`
    : `/classif/api/publico/ncm?codigo=${encodeURIComponent(q)}`;
  const resp = await fetch('https://portalunico.siscomex.gov.br' + path, { headers: { 'accept':'application/json' }});
  const text = await resp.text();
  return { statusCode: resp.status, body: text, headers: { 'content-type': 'application/json' }};
}
