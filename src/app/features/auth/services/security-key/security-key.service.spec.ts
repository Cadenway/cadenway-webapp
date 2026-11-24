import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { SecurityKeyService } from './security-key.service';

describe('SecurityKeyService', () => {
  it('rejects when the browser cannot run a WebAuthn ceremony', async () => {
    await expect(
      TestBed.inject(SecurityKeyService).assert({ challenge: 'Zml4dHVyZQ', allowCredentials: [] }),
    ).rejects.toThrow();
  });
});
