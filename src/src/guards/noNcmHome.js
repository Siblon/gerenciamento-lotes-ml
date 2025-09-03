// src/guards/noNcmHome.js
const kill = () => {
  // remove qualquer painel NCM renderizado por engano na home
  document.querySelectorAll('#card-ncm, [data-panel="ncm"]').forEach((n) => n.remove());
};
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', kill);
} else {
  kill();
}
