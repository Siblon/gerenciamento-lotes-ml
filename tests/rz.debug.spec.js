import { describe, it, expect } from 'vitest';

describe('rzDebug toggle', ()=>{
  it('não ativa quando DEBUG_RZ não está setado', async ()=>{
    globalThis.location = { search: '' };
    const mod = await import('../src/debug/logger.js');
    expect(mod.isDebug()).toBe(false);
  });
});
