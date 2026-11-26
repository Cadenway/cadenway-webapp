import { describe, expect, it } from 'vitest';

import { stableKey } from './stable-key.util';

describe('stableKey', () => {
  it('derives the same UUID-shaped key from the same parts', async () => {
    const parts: readonly string[] = ['task-timer-stop', 'o1', 'u1', 'CAD-482', '1762592400000'];

    const first: string = await stableKey(parts);

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    await expect(stableKey([...parts])).resolves.toBe(first);
  });

  it('derives another key when any part changes, including where a part ends', async () => {
    const base: string = await stableKey(['o1', 'u1', 'CAD-482', '1762592400000']);

    await expect(stableKey(['o1', 'u2', 'CAD-482', '1762592400000'])).resolves.not.toBe(base);
    await expect(stableKey(['o1', 'u1', 'CAD-482', '1762592400001'])).resolves.not.toBe(base);
    await expect(stableKey(['o1u', '1', 'CAD-482', '1762592400000'])).resolves.not.toBe(base);
  });
});
