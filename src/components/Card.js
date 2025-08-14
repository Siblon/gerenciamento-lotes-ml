// src/components/Card.js
// Wrapper simples para manipular cards colapsáveis
export function createCard(selector) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el) throw new Error('Card element not found');
  return {
    el,
    collapse() { el.classList.add('collapsed'); },
    expand() { el.classList.remove('collapsed'); },
    toggle() { el.classList.toggle('collapsed'); },
  };
}
