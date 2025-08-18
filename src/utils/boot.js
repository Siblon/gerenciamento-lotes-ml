export function updateBoot(msg) {
  const el = document.getElementById('boot-status');
  if (el) el.firstChild.nodeValue = '';
  if (el) {
    el.innerHTML = `<strong>Boot:</strong> ${msg} <button id="btn-debug" type="button" class="btn btn-ghost">Debug</button>`;
  }
}
