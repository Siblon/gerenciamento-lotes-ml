import { saveExcedente } from '../services/persist.js';
import { updateBoot } from '../utils/boot.js';

export function wireExcedenteDialog() {
  const dlg  = document.getElementById('dlg-excedente');
  const form = document.getElementById('form-exc');
  const inputs = [
    document.getElementById('exc-desc'),
    document.getElementById('exc-qtd'),
    document.getElementById('exc-preco'),
    document.getElementById('exc-obs'),
  ].filter(Boolean);

  // Navegação com Enter entre campos; no último, Enter envia
  inputs.forEach((el, idx) => {
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const last = idx === inputs.length - 1;
      if (!last) {
        inputs[idx + 1].focus();
        inputs[idx + 1].select?.();
      } else {
        // submit programático
        form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', {cancelable:true}));
      }
    });
  });

  // Envio do form → valida + salva + fecha + feedback
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const sku   = document.getElementById('exc-sku')?.value?.trim();
    const desc  = document.getElementById('exc-desc')?.value?.trim();
    const qtd   = Number(document.getElementById('exc-qtd')?.value || 0);
    const preco = document.getElementById('exc-preco')?.value; // opcional
    const obs   = document.getElementById('exc-obs')?.value?.trim();

    if (!sku)  { updateBoot('SKU inválido'); return; }
    if (!desc) { updateBoot('Informe a descrição'); inputs[0]?.focus(); return; }
    if (!(qtd >= 1)) { updateBoot('Qtd deve ser ≥ 1'); inputs[1]?.focus(); return; }

    const reg = { sku, descricao: desc, qtd, preco_unit: (preco === '' ? null : Number(preco)), obs };
    saveExcedente(reg);

    try { dlg.close(); } catch {}
    updateBoot(`Excedente salvo: ${sku} • ${desc}`);

    // atualiza a lista/contadores imediatamente (ajuste para seus renders)
    if (typeof window.refreshExcedentesTable === 'function') window.refreshExcedentesTable();
    if (typeof window.refreshKpis === 'function') window.refreshKpis();
  });

  // Quando o diálogo abrir, focar descrição
  dlg?.addEventListener('close', () => {
    // nada; o submit já chama updateBoot
  });
  dlg?.addEventListener('show', () => {
    inputs[0]?.focus();
    inputs[0]?.select?.();
  });
}

// chame isso no bootstrap da página:
window.addEventListener('DOMContentLoaded', () => {
  try { wireExcedenteDialog(); } catch {}
});

