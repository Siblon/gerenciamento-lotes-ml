import { describe, it, expect } from 'vitest';
import store from '../src/store/index.js';

describe('rz persist', () => {
  it('retains selection after re-init', async () => {
    store.reset();
    store.setCurrentRZ('RZ-9');
    store.__resetBoot();
    store.state.currentRZ = null;
    await store.init();
    expect(store.state.currentRZ).toBe('RZ-9');
  });
});
