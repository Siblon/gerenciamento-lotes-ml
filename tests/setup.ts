import { beforeAll, afterAll, vi } from 'vitest';

let warnSpy;
const verbose = process.env.VERBOSE === '1' || process.env.CONFER_VERBOSE === '1';

beforeAll(() => {
  if (!verbose) {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  }
});

afterAll(() => {
  warnSpy?.mockRestore();
});
