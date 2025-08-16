export function installWedgeScanner({ onScan, allowInput } = {}) {
  let buffer = '';
  let lastTime = 0;
  const THRESH = 50; // ms
  function handler(e) {
    const active = document.activeElement;
    const isInput = active && ['INPUT','TEXTAREA','SELECT'].includes(active.tagName);
    const isAllowed = !isInput || active === allowInput;
    if (!isAllowed) return;
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (buffer) {
        e.preventDefault();
        const code = buffer.replace(/\r|\n/g,'').trim();
        buffer = '';
        onScan?.(code, e.key);
      }
      return;
    }
    if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) {
      buffer = '';
      return;
    }
    const now = Date.now();
    if (now - lastTime > THRESH) buffer = '';
    buffer += e.key;
    lastTime = now;
  }
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}
