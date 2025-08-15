export function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

toast.info = (msg) => toast(msg, 'info');
toast.warn = (msg) => toast(msg, 'warn');
toast.error = (msg) => toast(msg, 'error');
toast.success = (msg) => toast(msg, 'success');

export default toast;
