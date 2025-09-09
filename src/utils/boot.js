let _bootTimer;
function getEl(){
  return document.querySelector('#boot-status, #boot, .boot-badge, [data-boot]');
}

export function showBoot(msg='aguardando...'){
  const el = getEl();
  if (!el) return;
  if (el.querySelector('strong')) {
    el.innerHTML = `<strong>Boot:</strong> ${msg}`;
  } else {
    el.textContent = `Boot: ${msg}`;
  }
  el.classList?.add('show');
  clearTimeout(_bootTimer);
}

export function hideBoot(){
  const el = getEl();
  if (!el) return;
  el.classList?.remove('show');
  el.textContent = '';
  clearTimeout(_bootTimer);
  _bootTimer = undefined;
}
