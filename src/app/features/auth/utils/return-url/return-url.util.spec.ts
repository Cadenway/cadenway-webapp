import { describe, expect, it } from 'vitest';

import { safeReturnUrl } from './return-url.util';

describe('safeReturnUrl', () => {
  it('keeps a path of the application', () => {
    expect(safeReturnUrl('/invite/invitation-lumen')).toBe('/invite/invitation-lumen');
  });

  it('refuses anything that could leave the application', () => {
    for (const value of [
      undefined,
      '',
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/x\n',
      `/${'a'.repeat(2_048)}`,
    ]) {
      expect(safeReturnUrl(value)).toBeNull();
    }
  });
});
