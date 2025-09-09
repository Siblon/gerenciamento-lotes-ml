import { describe, it, expect } from 'vitest';
import store1 from '../src/store/index.js';
import store2 from '../src/store/index.js';

describe('store singleton', () => {
  it('returns same instance and init is idempotent', async () => {
    expect(store1).toBe(store2);
    store1.setCurrentRZ('RZ-X');
    await store1.init();
    store1.setCurrentRZ('RZ-Y');
    await store1.init();
    expect(store1.state.currentRZ).toBe('RZ-Y');
  });
});
