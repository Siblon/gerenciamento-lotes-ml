import { describe, it, expect } from 'vitest';
import store from '../src/store/index.js';

describe('RZ flow', () => {
  it('setCurrentRZ updates state and filters items', () => {
    store.reset();
    store.setCurrentRZ('RZ-1');
    expect(store.state.currentRZ).toBe('RZ-1');
    store.bulkUpsertItems([
      { id: '1', codigo: 'A', rz: 'RZ-1' },
      { id: '2', codigo: 'B', rz: 'RZ-2' },
    ]);
    const filtered = store.state.items.filter(
      (it) => it.rz === store.state.currentRZ,
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].codigo).toBe('A');
  });
});
