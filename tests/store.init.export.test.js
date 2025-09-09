import { describe, it, expect } from 'vitest';
import store, { init } from '../src/store/index.js';

describe('store init export', () => {
  it('exports init and can be called', () => {
    expect(typeof init).toBe('function');
    expect(() => init()).not.toThrow();
    expect(store.init).toBe(init);
  });
});

