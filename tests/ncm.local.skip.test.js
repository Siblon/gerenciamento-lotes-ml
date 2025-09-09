import { describe, it, expect } from 'vitest';
import { resolveNcmByDescription } from '../src/services/ncmApi.js';

describe('NCM resolution', () => {
  it('skips on localhost', async () => {
    const original = globalThis.location;
    globalThis.location = { hostname: 'localhost' };
    const r = await resolveNcmByDescription('teste');
    expect(r.status).toBe('skipped');
    expect(r.ncm).toBeNull();
    globalThis.location = original;
  });
});

