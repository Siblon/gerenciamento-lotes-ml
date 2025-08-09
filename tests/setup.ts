import { afterAll, beforeAll, vi } from 'vitest';
beforeAll(() => { vi.useRealTimers(); });
afterAll(() => {
  vi.clearAllTimers();
  vi.restoreAllMocks();
  // Feche qualquer servidor/stream aberto, se houver:
  globalThis.__server__?.close?.();
});
