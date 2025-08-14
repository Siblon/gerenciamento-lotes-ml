// src/components/app.js
// Orquestra os painéis da aplicação
import { initImportPanel } from './ImportPanel.js';
import { initActionsPanel } from './ActionsPanel.js';
import { initScannerPanel } from './ScannerPanel.js';
import { renderResults } from './ResultsPanel.js';

export function initApp(){
  const render = () => renderResults();

  const actions = initActionsPanel(render);
  initImportPanel(render);
  initScannerPanel({
    onCode: (code) => {
      actions.setSku(code);
      actions.consultar('scanner');
    }
  });

  render();
}
