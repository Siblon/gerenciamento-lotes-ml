import '../css/theme.css';
import ImportPanel from '../components/ImportPanel.js';
import ActionsPanel from '../components/ActionsPanel.js';
import ResultsPanel from '../components/ResultsPanel.js';
import { getKpis } from '../store/index.js';

export default async function ConferenciaPage(){
  const page = document.createElement('div');
  page.className = 'container';

  const header = document.createElement('div');
  header.innerHTML = `<h1>Conferência de Lotes</h1>`;
  page.append(header);

  const kpis = document.createElement('div');
  kpis.className = 'kpis';
  const data = getKpis();
  const tpl = (ico, n, l) => `
    <div class="kpi">
      <svg class="ico"><use href="/icons.svg#${ico}"/></svg>
      <div><div class="n">${n}</div><div class="subtle">${l}</div></div>
    </div>`;
  kpis.innerHTML =
    tpl('box', data.itens, 'Itens do lote') +
    tpl('check', data.conferidos, 'Conferidos') +
    tpl('alert', data.excedentes, 'Excedentes') +
    tpl('hourglass', data.pendentes, 'Pendentes');
  page.append(kpis);

  const quick = document.createElement('div');
  quick.style.marginBottom = '16px';
  quick.innerHTML = `
    <button class="btn btn-primary"><svg class="ico"><use href="/icons.svg#check"/></svg>Finalizar Conferência</button>
    <button class="btn btn-ghost"><svg class="ico"><use href="/icons.svg#file-excel"/></svg>Exportar Excel</button>`;
  page.append(quick);

  page.append(ImportPanel());
  page.append(ActionsPanel());
  page.append(ResultsPanel());

  page.addEventListener('rz:changed', ()=>{
    const input = document.querySelector('#input-codigo-produto');
    if (input){ input.focus(); input.select(); }
  });

  return page;
}
