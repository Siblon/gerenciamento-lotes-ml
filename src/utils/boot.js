let hideTimer = null;

function getBootEl() {
  return document.getElementById('boot-status');
}

/**
 * Mostra um toast e esconde automaticamente após `persistMs` (default 10s).
 * @param {string} msg
 * @param {{level?: 'info'|'warn'|'error', persistMs?: number}} [opts]
 */
export function updateBoot(msg, opts = {}) {
  const el = getBootEl();
  if (!el) return;
  const { level = 'info', persistMs = 10000 } = opts;

  if (el.dataset) el.dataset.level = level;
  el.innerHTML = msg;
  el.classList?.remove('hidden');

  // limpa timer anterior
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  // agenda auto-hide
  hideTimer = setTimeout(() => {
    el.classList?.add('hidden');
  }, Math.max(0, persistMs));
}

/** Esconde imediatamente o toast. */
export function hideBoot() {
  const el = getBootEl();
  if (!el) return;
  el.classList?.add('hidden');
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = null;
}

