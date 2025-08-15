import { beforeAll, afterAll, vi } from 'vitest';

let warnSpy;
const verbose = process.env.VERBOSE === '1' || process.env.CONFER_VERBOSE === '1';

if (typeof globalThis.localStorage === 'undefined') {
  let store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  } as any;
}

beforeAll(() => {
  if (!verbose) {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  }
});

afterAll(() => {
  warnSpy?.mockRestore();
});
