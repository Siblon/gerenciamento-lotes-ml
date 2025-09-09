import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/utils/boot.js', () => ({
  showBoot: vi.fn(),
  hideBoot: vi.fn(),
}));

vi.mock('../src/store/index.js', () => ({ init: vi.fn() }));
vi.mock('../src/services/ncmQueue.js', () => ({ startNcmQueue: vi.fn(() => Promise.resolve({ status: 'skipped' })) }));
vi.mock('../src/components/Indicators.js', () => ({ initIndicators: vi.fn(), computeFinance: vi.fn() }));
vi.mock('../src/components/ActionsPanel.js', () => ({ initActionsPanel: vi.fn() }));
vi.mock('../src/components/RzBinding.js', () => ({ initRzBinding: vi.fn() }));

import { hideBoot } from '../src/utils/boot.js';
import '../src/main.js';

describe('boot sequence', () => {
  it('calls hideBoot after init', async () => {
    await Promise.resolve();
    expect(hideBoot).toHaveBeenCalled();
  });
});
