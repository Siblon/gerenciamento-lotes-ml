// Implementação simplificada para registrar observação de excedente
// Retorna uma Promise que resolve com a string informada (pode ser vazia)
// Para testes, o estado atual do modal pode ser acessado via getCurrentModal()

let currentModal = null;

export function openExcedenteModal({ defaultValue = '' } = {}) {
  return new Promise((resolve) => {
    currentModal = {
      value: defaultValue,
      confirm() {
        const val = currentModal.value || '';
        currentModal = null;
        resolve(val);
      },
      cancel() {
        currentModal = null;
        resolve(null);
      },
      keypress(key) {
        if (key === 'Enter') currentModal.confirm();
        if (key === 'Escape') currentModal.cancel();
      },
    };
  });
}

export function getCurrentModal() {
  return currentModal;
}
