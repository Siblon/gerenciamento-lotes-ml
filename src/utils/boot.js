let _bootTimer;
export function updateBoot(msg) {
  const el = document.getElementById('boot-status');
  if (!el) return;
  el.textContent = msg || '';
  el.classList?.add('show');
  clearTimeout(_bootTimer);
  _bootTimer = setTimeout(() => {
    el.classList?.remove('show');
    el.textContent = '';
  }, 10000); // 10s
}

export function hideBoot() {
  const el = document.getElementById('boot-status');
  if (!el) return;
  el.classList?.remove('show');
  el.textContent = '';
  clearTimeout(_bootTimer);
  _bootTimer = undefined;
}
