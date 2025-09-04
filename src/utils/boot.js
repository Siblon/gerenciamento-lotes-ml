let hideTimer = null;

function getBootEl() {
  return document.getElementById('boot-status');
}

/**
 * Exibe um toast temporário com auto-hide de 10s.
 * Pausa o temporizador ao passar o mouse e retoma ao sair.
 * @param {string} msg
 * @param {{level?: 'info'|'warn'|'error'}} [opts]
 */
export function updateBoot(msg, opts = {}) {
  const el = getBootEl();
  if (!el) return;
  const { level = 'info' } = opts;

  if (el.dataset) el.dataset.level = level;
  const textEl = typeof el.querySelector === 'function' ? el.querySelector('.boot-text') : null;
  if (textEl) textEl.textContent = msg;

  // limpa timer antigo
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

  const onEnter = () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } };
  const onLeave = () => { if (!hideTimer) hideTimer = setTimeout(() => el.classList.add('hidden'), 10_000); };

  if (typeof el.removeEventListener === 'function') {
    el.removeEventListener('mouseenter', onEnter);
    el.removeEventListener('mouseleave', onLeave);
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
  }

  el.classList?.remove?.('hidden');
  hideTimer = setTimeout(() => el.classList?.add?.('hidden'), 10_000);
}

/** Esconde imediatamente o toast. */
export function hideBoot() {
  const el = getBootEl();
  if (!el) return;
  el.classList?.add('hidden');
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = null;
}

