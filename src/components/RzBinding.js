import store, { setCurrentRZ, emit } from '../store/index.js';

export function initRzBinding() {
  function bind(sel) {
    if (!sel || sel.dataset.rzBound === '1') return;
    sel.dataset.rzBound = '1';
    const controller = new AbortController();
    const { signal } = controller;

    if (store.state.currentRZ) {
      sel.value = store.state.currentRZ;
    } else if (sel.value && !store.state.currentRZ) {
      setCurrentRZ(sel.value);
    }

    sel.addEventListener(
      'change',
      () => {
        setCurrentRZ(sel.value);
        emit('refresh');
      },
      { signal }
    );

    if (import.meta.hot) {
      import.meta.hot.dispose(() => controller.abort());
    }
  }

  const initial = document.querySelector('#select-rz, #rz, select[name="rz"], [data-rz]');
  if (initial) {
    bind(initial);
    return;
  }

  const mo = new MutationObserver(() => {
    const sel = document.querySelector('#select-rz, #rz, select[name="rz"], [data-rz]');
    if (sel) {
      mo.disconnect();
      bind(sel);
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), 3000);
}
