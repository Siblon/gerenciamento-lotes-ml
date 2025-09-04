let bootTimer;
export function updateBoot(msg, { durationMs = 10_000 } = {}) {
  const el = document.getElementById('boot-status');
  if (!el) return;
  if (el.style) {
    el.style.opacity = '1';
    el.style.transition = 'opacity .4s ease';
  }
  el.innerHTML = `<strong>Boot:</strong> ${msg}`;
  if (bootTimer) clearTimeout(bootTimer);
  bootTimer = setTimeout(() => {
    if (el.style) el.style.opacity = '0';
  }, durationMs);
}
