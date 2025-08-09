import { describe, it, expect } from 'vitest';
import store from '../src/store/index.js';

describe('store state structure', () => {
  it('has basic keys', () => {
    expect(store.state).toMatchObject({
      rzList: [],
      itemsByRZ: {},
      totalByRZSku: {},
      conferidosByRZSku: {},
      currentRZ: null,
    });
  });
});
