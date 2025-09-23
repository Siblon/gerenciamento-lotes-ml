export default function Alert({ message }) {
  const el = document.createElement('div');
  const style = el.style || (el.style = {});
  Object.assign(style, {
    background: '#fff3cd',
    color: '#856404',
    padding: '10px',
    borderRadius: '5px',
    margin: '10px 0',
    border: '1px solid #ffeeba',
  });
  if (typeof el.setAttribute === 'function') {
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'polite');
  }
  el.textContent = message;
  return el;
}
