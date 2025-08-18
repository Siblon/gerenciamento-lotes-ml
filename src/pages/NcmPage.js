import '../css/theme.css';
import NcmPanel from '../components/NcmPanel.js';

export default async function NcmPage(){
  const page = document.createElement('div');
  page.className = 'container';
  const h = document.createElement('div');
  h.innerHTML = `<h1>NCM</h1><p class="subtle">Resolver códigos NCM sem interromper a conferência.</p>`;
  page.append(h);
  page.append(NcmPanel());
  return page;
}
