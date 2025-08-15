import { describe, it, expect } from 'vitest';
import { openExcedenteModal, getCurrentModal } from '../src/components/ExcedenteModal.js';

describe('ExcedenteModal', () => {
  it('accepts empty observation with Enter', async () => {
    const promise = openExcedenteModal({ defaultValue: '' });
    const modal = getCurrentModal();
    modal.keypress('Enter');
    const val = await promise;
    expect(val).toBe('');
  });

  it('saves filled observation', async () => {
    const promise = openExcedenteModal({ defaultValue: '' });
    const modal = getCurrentModal();
    modal.value = 'teste';
    modal.keypress('Enter');
    const val = await promise;
    expect(val).toBe('teste');
  });
});
