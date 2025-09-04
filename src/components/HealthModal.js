import './HealthModal.css';
import { runHealthChecks, resetStorage } from '../utils/health.js';

export function initHealthModal() {
  const btn = document.getElementById('btn-health') || (() => {
    const actions = document.querySelector('.toolbar .actions');
    if (!actions) return null;
    const b = document.createElement('button');
    b.id = 'btn-health';
    b.className = 'btn btn-ghost';
    b.textContent = 'Health';
    actions.appendChild(b);
    return b;
  })();
  if (!btn) return;

  const dlg = document.createElement('dialog');
  dlg.id = 'dlg-health';
  dlg.className = 'health-modal';
  dlg.innerHTML = '<h2>Health Check</h2><div id="health-content"></div><form method="dialog"><button class="btn">Fechar</button></form>';
  document.body.appendChild(dlg);

  btn.addEventListener('click', async () => {
    const res = await runHealthChecks();
    const body = dlg.querySelector('#health-content');
    const items = [];
    items.push(`<li>Ícones: <span class="${res.icons.ok ? 'status-ok' : 'status-fail'}">${res.icons.ok ? '✅' : '❌'}</span></li>`);
    if (res.dexie.ok) {
      items.push('<li>Dexie: <span class="status-ok">✅</span></li>');
    } else {
      items.push('<li>Dexie: <span class="status-fail">❌</span> <button id="btn-reset-storage" class="btn btn-ghost">Zerar dados</button></li>');
    }
    body.innerHTML = `<ul>${items.join('')}</ul>`;
    body.querySelector('#btn-reset-storage')?.addEventListener('click', () => {
      resetStorage();
    });
    dlg.showModal();
  });
}
