import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { isPromptDismissed, SecurityKeyRegistration } from './security-key-registration.service';

describe('SecurityKeyRegistration', () => {
  it('reports no WebAuthn where the browser has none', () => {
    expect(TestBed.inject(SecurityKeyRegistration).supported()).toBe(false);
  });

  it('rejects a ceremony the browser cannot run', async () => {
    await expect(
      TestBed.inject(SecurityKeyRegistration).create({
        challenge: 'Zml4dHVyZQ',
        rp: { name: 'Cadenway' },
        user: { id: 'dQ', name: 'camille', displayName: 'Camille Martin' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      }),
    ).rejects.toThrow();
  });

  it('tells a dismissed prompt from a failure', () => {
    expect(isPromptDismissed(new DOMException('closed', 'NotAllowedError'))).toBe(true);
    expect(
      isPromptDismissed(Object.assign(new Error('aborted'), { code: 'ERROR_CEREMONY_ABORTED' })),
    ).toBe(true);
    expect(isPromptDismissed(new Error('The authenticator failed.'))).toBe(false);
    expect(isPromptDismissed('closed')).toBe(false);
  });
});
