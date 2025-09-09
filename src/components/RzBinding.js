import store, { setCurrentRZ, emit } from '../store/index.js';

export function initRzBinding() {
  const sel = document.getElementById('rz') ||
    document.querySelector('select[name="rz"], #rz, [data-rz]');
  if (!sel) return;
  sel.addEventListener('change', () => {
    const value = sel.value;
    setCurrentRZ(value);
    emit('refresh');
  });
  if (store.state.currentRZ) {
    sel.value = store.state.currentRZ;
  }
}
