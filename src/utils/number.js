export function parseBRLLoose(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  // Se contém vírgula, assumir formato BR e converter para ponto decimal
  if (/,/.test(s)) {
    const norm = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
    const n = Number(norm);
    return Number.isFinite(n) ? n : null;
  }
  // Se contém apenas dígitos → pode ser centavos ou reais
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n;
  }
  // Se formato US "1234.56"
  const n = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}
